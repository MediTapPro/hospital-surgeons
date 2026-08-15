import { getDb } from '@/lib/db';
import { getMaxAssignmentsForDoctor } from '@/lib/config/subscription-limits';
import { CreateHomeVisitDto } from '@/lib/validations/home-visit.dto';
import { DoctorsRepository } from '@/lib/repositories/doctors.repository';
import { PatientProfilesRepository } from '@/lib/repositories/patient-profiles.repository';
import { HomeVisitsRepository } from '@/lib/repositories/home-visits.repository';

export class HomeVisitsService {
  private db = getDb();
  private doctorsRepository = new DoctorsRepository();
  private patientProfilesRepo = new PatientProfilesRepository();
  private homeVisitsRepo = new HomeVisitsRepository();

  private async checkAssignmentLimit(doctorId: string, db: any) {
    const doctor = await this.homeVisitsRepo.findDoctorUser(doctorId);
    if (!doctor) {
      throw new Error('Doctor not found');
    }

    const maxAssignments = await getMaxAssignmentsForDoctor(doctor.userId);
    if (maxAssignments === -1) return;

    const sub = await this.homeVisitsRepo.findActiveSubscription(doctorId);
    if (!sub) return;

    const usageData = await this.homeVisitsRepo.findDoctorUsage(doctorId, sub.id);
    if (!usageData) return;

    if (usageData.count >= maxAssignments) {
      throw new Error('ASSIGNMENT_LIMIT_REACHED');
    }
  }

  private async incrementAssignmentUsage(doctorId: string, db: any) {
    const sub = await this.homeVisitsRepo.findActiveSubscription(doctorId, db);
    if (!sub) return;

    const usageData = await this.homeVisitsRepo.findDoctorUsage(doctorId, sub.id, db);
    if (!usageData) return;

    await this.homeVisitsRepo.incrementDoctorUsage(usageData.id, db);
  }

  async createHomeVisitBooking(userId: string, dto: CreateHomeVisitDto) {
    // 1. Fetch patient profile using patient repository
    const patientProfile = await this.patientProfilesRepo.findProfileByUserId(userId);
    if (!patientProfile) {
      return {
        success: false,
        code: 'PATIENT_PROFILE_NOT_FOUND',
        message: 'Patient profile not found. Please complete profile registration.',
      };
    }

    const patientProfileId = patientProfile.id;
    const patientName = patientProfile.fullName;

    const {
      doctorId,
      parentSlotId,
      startTime,
      endTime,
      availabilitySlotId,
      priority = 'routine',
      treatmentNotes,
      patientAddressId,
      patientFamilyMemberId,
      symptoms
    } = dto;

    // 1b. Resolve address & family member for snapshot (booking keeps its own copy,
    //     so later edits/deletes of saved addresses/members don't affect this booking)
    const [address, familyMember] = await Promise.all([
      patientAddressId
        ? this.patientProfilesRepo.getAddressById(patientAddressId)
        : Promise.resolve(null),
      patientFamilyMemberId
        ? this.patientProfilesRepo.getFamilyMemberById(patientFamilyMemberId)
        : Promise.resolve(null),
    ]);

    // 2. Check doctor limit
    try {
      await this.checkAssignmentLimit(doctorId, this.db);
    } catch (error: any) {
      if (error.message === 'ASSIGNMENT_LIMIT_REACHED') {
        const doctor = await this.homeVisitsRepo.findDoctorUser(doctorId);
        const doctorName = doctor
          ? `Dr. ${doctor.firstName} ${doctor.lastName}`
          : 'This doctor';

        return {
          success: false,
          code: 'ASSIGNMENT_LIMIT_REACHED',
          message: `${doctorName} has reached their monthly limit. Please try another doctor.`,
        };
      }
      throw error;
    }

    // 3. Expiry configuration
    const expiryConfig = await this.homeVisitsRepo.findExpiryConfig(priority);
    let expiryHours = 24;
    if (expiryConfig) {
      expiryHours = expiryConfig.expiryHours;
    } else {
      if (priority === 'urgent') expiryHours = 6;
      else if (priority === 'emergency') expiryHours = 1;
    }

    let expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiryHours);

    // 4. Validate slot
    let slotDate: string | null = null;
    let useNewSlotFlow = false;

    if (parentSlotId && startTime && endTime) {
      useNewSlotFlow = true;

      const parentSlot = await this.homeVisitsRepo.findParentSlot(parentSlotId);
      if (!parentSlot) {
        return {
          success: false,
          code: 'PARENT_SLOT_NOT_FOUND',
          message: 'Parent slot not found',
        };
      }

      slotDate = parentSlot.slotDate;

      if (parentSlot.slotType !== 'home_visit') {
        return {
          success: false,
          code: 'INVALID_SLOT_TYPE',
          message: 'The selected slot is designated for hospital bookings, not home visits.',
        };
      }

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
            message: `Cannot book a home visit for a past time.`,
          };
        }

        const [endHour, endMin] = endTime.split(':').map(Number);
        const endTimeDate = new Date(`${slotDate}T${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00+05:30`);
        if (expiresAt > endTimeDate) {
          expiresAt = endTimeDate;
        }
      }
    } else if (availabilitySlotId) {
      const targetSlot = await this.homeVisitsRepo.findAvailabilitySlot(availabilitySlotId);
      if (!targetSlot) {
        return {
          success: false,
          code: 'SLOT_NOT_FOUND',
          message: 'Availability slot not found',
        };
      }

      if (targetSlot.slotType !== 'home_visit') {
        return {
          success: false,
          code: 'INVALID_SLOT_TYPE',
          message: 'The selected slot is designated for hospital bookings, not home visits.',
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
            message: `Cannot book a home visit for a past time.`,
          };
        }
      }
    }

    // 5. Ensure Priority Exists
    await this.homeVisitsRepo.ensurePriorityExists(priority);

    let finalAvailabilitySlotId: string;
    let newAssignment: any;

    // 6. DB Transaction (Multi-write wrapped in transaction boundary)
    await this.db.transaction(async (tx) => {
      if (useNewSlotFlow) {
        const subSlot = await this.homeVisitsRepo.createSubSlot({
          doctorId,
          slotDate: slotDate!,
          startTime: startTime!,
          endTime: endTime!,
          parentSlotId: parentSlotId!,
          status: 'booked',
          slotType: 'home_visit',
          isManual: false,
          notes: 'Sub-slot created for patient home visit',
        }, tx);

        finalAvailabilitySlotId = subSlot.id;
      } else {
        await this.homeVisitsRepo.updateSlotStatus(availabilitySlotId!, 'booked', tx);
        finalAvailabilitySlotId = availabilitySlotId!;
      }

      newAssignment = await this.homeVisitsRepo.createAssignment({
        doctorId,
        patientProfileId,
        availabilitySlotId: finalAvailabilitySlotId,
        priority,
        status: 'pending',
        source: 'patient',
        expiresAt: expiresAt.toISOString(),
        treatmentNotes: treatmentNotes || null,
      }, tx);

      await this.homeVisitsRepo.createHomeVisitDetails({
        assignmentId: newAssignment.id,
        patientAddressId: patientAddressId || null,
        patientFamilyMemberId: patientFamilyMemberId || null,
        symptoms: symptoms || null,
        addressLabel: address?.label ?? null,
        addressText: address?.addressText ?? null,
        addressLatitude: address?.latitude != null ? String(address.latitude) : null,
        addressLongitude: address?.longitude != null ? String(address.longitude) : null,
        recipientName: familyMember?.fullName ?? null,
        recipientPhone: familyMember?.phone ?? null,
        recipientRelationship: familyMember?.relationship ?? null,
      }, tx);

      await this.incrementAssignmentUsage(doctorId, tx);
    });

    return {
      success: true,
      data: newAssignment,
      patientName,
      expiresAt,
    };
  }
}
