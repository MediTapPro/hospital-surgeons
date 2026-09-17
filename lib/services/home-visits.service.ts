import { getDb } from '@/lib/db';
import { getMaxAssignmentsForDoctor } from '@/lib/config/subscription-limits';
import { CreateHomeVisitDto } from '@/lib/validations/home-visit.dto';
import { DoctorsRepository } from '@/lib/repositories/doctors.repository';
import { PatientProfilesRepository } from '@/lib/repositories/patient-profiles.repository';
import { HomeVisitsRepository } from '@/lib/repositories/home-visits.repository';
import { PlatformFeesRepository } from '@/lib/repositories/platform-fees.repository';
import { HomeVisitSettingsService } from '@/lib/services/home-visit-settings.service';

export class HomeVisitsService {
  private db = getDb();
  private doctorsRepository = new DoctorsRepository();
  private patientProfilesRepo = new PatientProfilesRepository();
  private homeVisitsRepo = new HomeVisitsRepository();
  private platformFeesRepo = new PlatformFeesRepository();
  private homeVisitSettingsService = new HomeVisitSettingsService();

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

    if (!address || address.patientProfileId !== patientProfileId) {
      return {
        success: false,
        code: 'ADDRESS_NOT_FOUND',
        message: 'Please select one of your saved addresses.',
      };
    }

    if (patientFamilyMemberId && (!familyMember || familyMember.patientProfileId !== patientProfileId)) {
      return {
        success: false,
        code: 'FAMILY_MEMBER_NOT_FOUND',
        message: 'Please select one of your saved family members.',
      };
    }

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

    // 5. Resolve home visit fee & specialtyId
    let resolvedFee: string | null = null;
    let resolvedSpecialtyId: string | null = null;

    const feeRes = await this.resolveHomeVisitFeeForDoctor(doctorId);
    if (feeRes.success && feeRes.data) {
      resolvedFee = feeRes.data.fee.toFixed(2);
      resolvedSpecialtyId = feeRes.data.specialtyId;
    }

    let finalAvailabilitySlotId: string;
    let newAssignment: any;
    let bookingMode: 'free_trial' | 'pay_after_completion' = 'pay_after_completion';
    let isFreeTrial = false;

    try {
      await this.db.transaction(async (tx) => {
        const settingsResult = await this.homeVisitSettingsService.getSettings(tx);
        if (!settingsResult.success || !settingsResult.data) {
          throw new Error('HOME_VISIT_SETTINGS_UNAVAILABLE');
        }

        const settings = settingsResult.data;
        if (!settings.homeVisitEnabled) {
          throw new Error('HOME_VISITS_DISABLED');
        }

        await this.homeVisitsRepo.lockPatientProfile(patientProfileId, tx);
        const trialCounts = await this.homeVisitsRepo.getFreeTrialCounts(patientProfileId, tx);
        isFreeTrial = settings.freeTrialEnabled
          && trialCounts.completed < settings.freeTrialVisitLimit
          && trialCounts.active < settings.freeTrialActiveBookingLimit;
        bookingMode = isFreeTrial ? 'free_trial' : 'pay_after_completion';

        if (!isFreeTrial && (!resolvedFee || Number(resolvedFee) <= 0)) {
          throw new Error('HOME_VISIT_FEE_NOT_CONFIGURED');
        }

        await this.homeVisitsRepo.ensurePriorityExists(priority, tx);

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
          consultationFee: isFreeTrial ? '0.00' : resolvedFee,
          specialtyId: resolvedSpecialtyId,
        }, tx);

        await this.homeVisitsRepo.createHomeVisitDetails({
          assignmentId: newAssignment.id,
          patientAddressId: patientAddressId || null,
          patientFamilyMemberId: patientFamilyMemberId || null,
          symptoms: symptoms || null,
          addressLabel: address.label,
          addressText: address.addressText,
          addressLatitude: address.latitude != null ? String(address.latitude) : null,
          addressLongitude: address.longitude != null ? String(address.longitude) : null,
          recipientName: familyMember?.fullName ?? null,
          recipientPhone: familyMember?.phone ?? null,
          recipientRelationship: familyMember?.relationship ?? null,
          paymentMode: bookingMode,
          isFreeTrial,
        }, tx);

        await this.incrementAssignmentUsage(doctorId, tx);
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : 'HOME_VISIT_BOOKING_FAILED';
      const messages: Record<string, string> = {
        HOME_VISIT_SETTINGS_UNAVAILABLE: 'Home visit settings are currently unavailable. Please try again shortly.',
        HOME_VISITS_DISABLED: 'Home visit bookings are currently unavailable.',
        HOME_VISIT_FEE_NOT_CONFIGURED: 'This doctor does not have a home visit fee configured yet.',
      };

      if (messages[code]) {
        return { success: false, code, message: messages[code] };
      }

      throw error;
    }

    return {
      success: true,
      data: newAssignment,
      patientName,
      expiresAt,
		paymentMode: bookingMode,
		isFreeTrial,
    };
  }

  async resolveHomeVisitFeeForDoctor(doctorId: string) {
    try {
      const docSpecs = await this.doctorsRepository.getDoctorSpecialties(doctorId);
      
      let feeConfig = null;
      let resolvedSpecialtyId: string | null = null;
      
      const primarySpec = docSpecs.length > 0 ? docSpecs[0] : null;
      
      if (primarySpec && primarySpec.specialty?.id) {
        feeConfig = await this.platformFeesRepo.findBySpecialtyId(primarySpec.specialty.id);
        if (feeConfig) {
          resolvedSpecialtyId = primarySpec.specialty.id;
        }
      }
      
      // Fallback to default platform fee if no fee config found for primary specialty
      if (!feeConfig) {
        feeConfig = await this.platformFeesRepo.findBySpecialtyId(null);
        if (primarySpec && primarySpec.specialty?.id) {
          resolvedSpecialtyId = primarySpec.specialty.id;
        }
      }

      if (!feeConfig) {
        return {
          success: false,
          message: 'No fee configuration found',
        };
      }

      return {
        success: true,
        data: {
          fee: parseFloat(feeConfig.fee),
          platformCommissionPercentage: parseFloat(feeConfig.platformCommissionPercentage),
          specialtyId: resolvedSpecialtyId,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to resolve fee',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getBookingQuote(userId: string, doctorId: string) {
    const patientProfile = await this.patientProfilesRepo.findProfileByUserId(userId);
    if (!patientProfile) {
      return {
        success: false,
        code: 'PATIENT_PROFILE_NOT_FOUND',
        message: 'Patient profile not found. Please complete profile registration.',
      };
    }

    const settingsResult = await this.homeVisitSettingsService.getSettings();
    if (!settingsResult.success || !settingsResult.data) {
      return {
        success: false,
        code: 'HOME_VISIT_SETTINGS_UNAVAILABLE',
        message: 'Home visit settings are currently unavailable. Please try again shortly.',
      };
    }

    const settings = settingsResult.data;
    if (!settings.homeVisitEnabled) {
      return {
        success: false,
        code: 'HOME_VISITS_DISABLED',
        message: 'Home visit bookings are currently unavailable.',
      };
    }

    const trialCounts = await this.homeVisitsRepo.getFreeTrialCounts(patientProfile.id);
    const isFreeTrial = settings.freeTrialEnabled
      && trialCounts.completed < settings.freeTrialVisitLimit
      && trialCounts.active < settings.freeTrialActiveBookingLimit;

    if (isFreeTrial) {
      return {
        success: true,
        data: {
          fee: 0,
          isFreeTrial: true,
          paymentMode: 'free_trial' as const,
          paymentTiming: settings.paidPaymentTiming,
        },
      };
    }

    const feeResult = await this.resolveHomeVisitFeeForDoctor(doctorId);
    if (!feeResult.success || !feeResult.data || feeResult.data.fee <= 0) {
      return {
        success: false,
        code: 'HOME_VISIT_FEE_NOT_CONFIGURED',
        message: 'This doctor does not have a home visit fee configured yet.',
      };
    }

    return {
      success: true,
      data: {
        fee: feeResult.data.fee,
        isFreeTrial: false,
        paymentMode: 'pay_after_completion' as const,
        paymentTiming: settings.paidPaymentTiming,
      },
    };
  }
}
