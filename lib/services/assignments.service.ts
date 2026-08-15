import { getDb } from '@/lib/db';
import { getMaxAssignmentsForDoctor } from '@/lib/config/subscription-limits';
import { CreateAssignmentDto } from '@/lib/validations/assignment.dto';
import { DoctorsRepository } from '@/lib/repositories/doctors.repository';
import { AssignmentsRepository } from '@/lib/repositories/assignments.repository';

export class AssignmentsService {
  private db = getDb();
  private doctorsRepository = new DoctorsRepository();
  private assignmentsRepo = new AssignmentsRepository();

  private async checkAssignmentLimit(doctorId: string) {
    const doctor = await this.assignmentsRepo.findDoctorUser(doctorId);
    if (!doctor) {
      throw new Error('Doctor not found');
    }

    const maxAssignments = await getMaxAssignmentsForDoctor(doctor.userId);
    if (maxAssignments === -1) return;

    const sub = await this.assignmentsRepo.findActiveSubscription(doctorId);
    if (!sub) return;

    const usageData = await this.assignmentsRepo.findDoctorUsage(doctorId, sub.id);
    if (!usageData) return;

    if (usageData.count >= maxAssignments) {
      throw new Error('ASSIGNMENT_LIMIT_REACHED');
    }
  }

  private async incrementAssignmentUsage(doctorId: string, db: any) {
    const sub = await this.assignmentsRepo.findActiveSubscription(doctorId, db);
    if (!sub) return;

    const usageData = await this.assignmentsRepo.findDoctorUsage(doctorId, sub.id, db);
    if (!usageData) return;

    await this.assignmentsRepo.incrementDoctorUsage(usageData.id, db);
  }

  async createHospitalAssignment(hospitalId: string, dto: CreateAssignmentDto) {
    const { patientId, doctorId, parentSlotId, startTime, endTime, availabilitySlotId, priority = 'routine', consultationFee, procedureId, procedureTypeId, roomTypeId, specialtyId } = dto;

    await this.checkAssignmentLimit(doctorId);

    const expiryConfig = await this.assignmentsRepo.findExpiryConfig(priority);
    let expiryHours = 24;
    if (expiryConfig) {
      expiryHours = expiryConfig.expiryHours;
    } else {
      if (priority === 'urgent') expiryHours = 6;
      else if (priority === 'emergency') expiryHours = 1;
    }

    let expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiryHours);

    let slotDate: string | null = null;
    let useNewSlotFlow = false;

    if (parentSlotId && startTime && endTime) {
      useNewSlotFlow = true;

      const parentSlot = await this.assignmentsRepo.findParentSlot(parentSlotId);
      if (!parentSlot) {
        return {
          success: false,
          code: 'PARENT_SLOT_NOT_FOUND',
          message: 'Parent slot not found',
        };
      }

      slotDate = parentSlot.slotDate;

      if (!this.doctorsRepository.fitsWithinParent(parentSlot.startTime, parentSlot.endTime, startTime, endTime)) {
        return {
          success: false,
          code: 'TIME_RANGE_OUT_OF_BOUNDS',
          message: `Selected time range (${startTime}-${endTime}) does not fit within parent slot (${parentSlot.startTime}-${parentSlot.endTime})`,
        };
      }

      const hasOverlap = await this.doctorsRepository.hasOverlappingSubSlots(parentSlotId, startTime, endTime);
      if (hasOverlap) {
        return {
          success: false,
          code: 'TIME_OVERLAP',
          message: `Selected time range (${startTime}-${endTime}) overlaps with an existing booking`,
        };
      }

      if (slotDate) {
        const [startHour, startMin] = startTime.split(':').map(Number);
        const startTimeDate = new Date(`${slotDate}T${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}:00+05:30`);
        const now = new Date();
        if (startTimeDate < now) {
          return {
            success: false,
            code: 'PAST_TIME_NOT_ALLOWED',
            message: `Cannot create assignment for a past time.`,
          };
        }

        const [endHour, endMin] = endTime.split(':').map(Number);
        const endTimeDate = new Date(`${slotDate}T${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00+05:30`);
        if (expiresAt > endTimeDate) {
          expiresAt = endTimeDate;
        }
      }
    } else if (availabilitySlotId) {
      const targetSlot = await this.assignmentsRepo.findAvailabilitySlot(availabilitySlotId);
      if (!targetSlot) {
        return {
          success: false,
          code: 'SLOT_NOT_FOUND',
          message: 'Availability slot not found',
        };
      }

      if (!targetSlot.parentSlotId) {
        return {
          success: false,
          code: 'PARENT_SLOT_CANNOT_BE_BOOKED_DIRECTLY',
          message: 'Cannot book parent slot directly. Please provide parentSlotId with startTime and endTime to create a sub-slot',
        };
      }

      if (targetSlot.status === 'booked') {
        return {
          success: false,
          code: 'SLOT_ALREADY_BOOKED',
          message: 'This slot has already been booked.',
        };
      }

      if (targetSlot.slotDate && targetSlot.startTime) {
        const slotStartDateTime = new Date(`${targetSlot.slotDate}T${targetSlot.startTime}+05:30`);
        const now = new Date();
        if (slotStartDateTime < now) {
          return {
            success: false,
            code: 'PAST_TIME_NOT_ALLOWED',
            message: `Cannot create assignment for a past time.`,
          };
        }
      }
    }

    await this.assignmentsRepo.ensurePriorityExists(priority);

    let finalAvailabilitySlotId: string;
    let newAssignment: any;

    await this.db.transaction(async (tx) => {
      if (useNewSlotFlow) {
        const subSlot = await this.assignmentsRepo.createSubSlot({
          doctorId,
          slotDate: slotDate!,
          startTime: startTime!,
          endTime: endTime!,
          parentSlotId: parentSlotId!,
          status: 'booked',
          isManual: false,
          notes: 'Sub-slot created for hospital assignment',
          hospitalId,
        }, tx);

        finalAvailabilitySlotId = subSlot.id;
      } else {
        await this.assignmentsRepo.updateSlotStatus(availabilitySlotId!, 'booked', hospitalId, tx);
        finalAvailabilitySlotId = availabilitySlotId!;
      }

      newAssignment = await this.assignmentsRepo.createAssignment({
        hospitalId,
        doctorId,
        patientId,
        availabilitySlotId: finalAvailabilitySlotId,
        priority,
        status: 'pending',
        source: 'hospital',
        expiresAt: expiresAt.toISOString(),
        consultationFee: consultationFee !== undefined && consultationFee !== null ? String(consultationFee) : null,
        procedureId: procedureId || null,
        procedureTypeId: procedureTypeId || null,
        roomTypeId: roomTypeId || null,
        specialtyId: specialtyId || null,
      }, tx);

      await this.incrementAssignmentUsage(doctorId, tx);
    });

    return {
      success: true,
      data: newAssignment,
      expiresAt,
    };
  }
}
