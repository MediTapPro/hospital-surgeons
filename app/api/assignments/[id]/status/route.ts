import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { assignments, doctorAvailability, enumStatus, patientProfiles } from '@/src/db/drizzle/migrations/schema';
import { eq, and } from 'drizzle-orm';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';
import { UpdateAssignmentStatusDtoSchema } from '@/lib/validations/assignment-status.dto';
import { validateRequest } from '@/lib/utils/validate-request';

/**
 * Update assignment status
 * PATCH /api/assignments/[id]/status
 */
async function patchHandler(
  req: AuthenticatedRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const assignmentId = params.id;

    // Validate request body with Zod
    const validation = await validateRequest(req, UpdateAssignmentStatusDtoSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { status, cancellationReason, treatmentNotes } = validation.data;

    const db = getDb();
    const user = (req as any).user;

    // Get the assignment to verify ownership
    const assignment = await db
      .select()
      .from(assignments)
      .where(eq(assignments.id, assignmentId))
      .limit(1);

    if (assignment.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Assignment not found',
        },
        { status: 404 }
      );
    }

    const assignmentData = assignment[0];

    // Verify ownership based on user role
    if (user.userRole === 'doctor') {
      // For doctors, we need to check if the assignment's doctorId matches the doctor's profile
      // Get doctor profile to match userId with doctorId
      const { DoctorsService } = await import('@/lib/services/doctors.service');
      const doctorsService = new DoctorsService();
      const doctorResult = await doctorsService.findDoctorByUserId(user.userId);

      if (!doctorResult.success || !doctorResult.data || doctorResult.data.id !== assignmentData.doctorId) {
        return NextResponse.json(
          {
            success: false,
            message: 'You do not have permission to update this assignment',
          },
          { status: 403 }
        );
      }
    } else if (user.userRole === 'hospital') {
      // For hospitals, check if the assignment's hospitalId matches the hospital's profile
      const { HospitalsService } = await import('@/lib/services/hospitals.service');
      const hospitalsService = new HospitalsService();
      const hospitalResult = await hospitalsService.findHospitalByUserId(user.userId);

      if (!hospitalResult.success || !hospitalResult.data || hospitalResult.data.id !== assignmentData.hospitalId) {
        return NextResponse.json(
          {
            success: false,
            message: 'You do not have permission to update this assignment',
          },
          { status: 403 }
        );
      }
    } else if (user.userRole === 'patient') {
      // Patients are only allowed to cancel their assignments
      if (status !== 'cancelled') {
        return NextResponse.json(
          {
            success: false,
            message: 'Patients are only permitted to cancel assignments.',
          },
          { status: 403 }
        );
      }

      const { PatientProfilesRepository } = await import('@/lib/repositories/patient-profiles.repository');
      const patientProfilesRepo = new PatientProfilesRepository();
      const patientProfile = await patientProfilesRepo.findProfileByUserId(user.userId);

      if (!patientProfile || patientProfile.id !== assignmentData.patientProfileId) {
        return NextResponse.json(
          {
            success: false,
            message: 'You do not have permission to update this assignment',
          },
          { status: 403 }
        );
      }
    }

    // Check if assignment is already in a final state
    // Allow 'cancelled' status even if already 'cancelled' (idempotency)
    // But block updates to 'declined' or 'completed' assignments
    if ((assignmentData.status === 'declined' || assignmentData.status === 'completed') && status !== 'cancelled') {
      return NextResponse.json(
        {
          success: false,
          message: `Assignment is already ${assignmentData.status} and cannot be updated`,
        },
        { status: 400 }
      );
    }

    // Only allow 'completed' status if assignment is already 'accepted'
    if (status === 'completed' && assignmentData.status !== 'accepted') {
      return NextResponse.json(
        {
          success: false,
          message: 'Assignment must be accepted before it can be marked as completed',
        },
        { status: 400 }
      );
    }

    // TEMP: for testing only — allow marking bookings as completed even for future dates
    const BYPASS_COMPLETE_TIME_CHECK = true;

    // Only allow 'completed' status if current time is after the scheduled start time
    if (status === 'completed' && assignmentData.availabilitySlotId) {
      const slotInfo = await db
        .select({
          slotDate: doctorAvailability.slotDate,
          startTime: doctorAvailability.startTime,
        })
        .from(doctorAvailability)
        .where(eq(doctorAvailability.id, assignmentData.availabilitySlotId))
        .limit(1);

      if (slotInfo.length > 0) {
        const slot = slotInfo[0];
        // Use IST offset (+05:30) since slot times are stored in IST
        const scheduledStartDateTime = new Date(`${slot.slotDate}T${slot.startTime}+05:30`);
        const now = new Date();

        if (!BYPASS_COMPLETE_TIME_CHECK && now < scheduledStartDateTime) {
          const timeDifferenceMs = scheduledStartDateTime.getTime() - now.getTime();
          const hoursUntilStart = timeDifferenceMs / (1000 * 60 * 60);

          const daysRemaining = Math.floor(hoursUntilStart / 24);
          const hoursRemaining = Math.floor(hoursUntilStart % 24);
          const minutesRemaining = Math.floor((hoursUntilStart % 1) * 60);

          const timeRemainingText = daysRemaining > 0
            ? `${daysRemaining} day${daysRemaining > 1 ? 's' : ''}, ${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''} and ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}`
            : hoursRemaining > 0
              ? `${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''} and ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}`
              : `${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}`;

          return NextResponse.json(
            {
              success: false,
              message: `Assignment cannot be marked as completed before its scheduled start time. The assignment is scheduled to start in ${timeRemainingText} (${scheduledStartDateTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}).`,
            },
            { status: 400 }
          );
        }
      }
    }

    // Only allow 'cancelled' status if assignment is 'pending' or 'accepted'
    if (status === 'cancelled' && assignmentData.status !== 'pending' && assignmentData.status !== 'accepted') {
      return NextResponse.json(
        {
          success: false,
          message: `Assignment cannot be cancelled from ${assignmentData.status} status`,
        },
        { status: 400 }
      );
    }

    // Check configurable cancellation notice period for assignments with booked slots
    // Apply to both 'pending' and 'accepted' assignments that have an availabilitySlotId
    if (status === 'cancelled' && assignmentData.availabilitySlotId &&
      (assignmentData.status === 'pending' || assignmentData.status === 'accepted') &&
      assignmentData.hospitalId) {
      // Fetch hospital preferences to get the cancellation notice period (in days)
      const { hospitalPreferences } = await import('@/src/db/drizzle/migrations/schema');
      const preferences = await db
        .select({
          assignmentCancellationNoticeDays: hospitalPreferences.assignmentCancellationNoticeDays
        })
        .from(hospitalPreferences)
        .where(eq(hospitalPreferences.hospitalId, assignmentData.hospitalId))
        .limit(1);

      // Get cancellation notice period (default to 1 day if not set)
      const cancellationNoticeDays = preferences[0]?.assignmentCancellationNoticeDays ?? 1;
      const cancellationNoticeHours = cancellationNoticeDays * 24;

      // Fetch the availability slot to get the scheduled start time
      const slotInfo = await db
        .select({
          slotDate: doctorAvailability.slotDate,
          startTime: doctorAvailability.startTime,
        })
        .from(doctorAvailability)
        .where(eq(doctorAvailability.id, assignmentData.availabilitySlotId))
        .limit(1);

      if (slotInfo.length > 0) {
        const slot = slotInfo[0];
        // Combine slotDate and startTime with IST offset since slot times are stored in IST
        const scheduledStartDateTime = new Date(`${slot.slotDate}T${slot.startTime}+05:30`);
        const now = new Date();

        // Calculate the difference in milliseconds
        const timeDifferenceMs = scheduledStartDateTime.getTime() - now.getTime();
        // Convert to hours
        const hoursUntilStart = timeDifferenceMs / (1000 * 60 * 60);

        // Check if less than the required notice period remains
        if (hoursUntilStart < cancellationNoticeHours) {
          const daysRemaining = Math.floor(hoursUntilStart / 24);
          const hoursRemaining = Math.floor(hoursUntilStart % 24);
          const minutesRemaining = Math.floor((hoursUntilStart % 1) * 60);

          const timeRemainingText = daysRemaining > 0
            ? `${daysRemaining} day${daysRemaining > 1 ? 's' : ''}, ${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''} and ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}`
            : hoursRemaining > 0
              ? `${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''} and ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}`
              : `${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}`;

          return NextResponse.json(
            {
              success: false,
              message: `Assignment cannot be cancelled. It must be cancelled at least ${cancellationNoticeDays} day${cancellationNoticeDays !== 1 ? 's' : ''} (${cancellationNoticeHours} hours) before the scheduled start time. Only ${timeRemainingText} remaining.`,
            },
            { status: 400 }
          );
        }
      }
    }

    // Check if assignment has expired (only for pending assignments)
    if (status === 'accepted' && assignmentData.status === 'pending' && assignmentData.expiresAt) {
      const expiresAt = new Date(assignmentData.expiresAt);
      const now = new Date();
      if (expiresAt < now) {
        return NextResponse.json(
          {
            success: false,
            message: 'This assignment has expired and can no longer be accepted. Please contact the hospital for a new assignment.',
          },
          { status: 400 }
        );
      }
    }

    // Verify status exists in enum_status table, insert if it doesn't
    const statusCheck = await db
      .select()
      .from(enumStatus)
      .where(eq(enumStatus.status, status))
      .limit(1);

    if (statusCheck.length === 0) {
      // Insert status if it doesn't exist
      await db.insert(enumStatus).values({
        status,
        description: `${status} assignment status`,
      }).onConflictDoNothing();
    }

    // Update assignment status
    const updateData: any = {
      status,
    };

    if (status === 'accepted') {
      updateData.actualStartTime = new Date().toISOString();
    } else if (status === 'declined') {
      updateData.cancelledAt = new Date().toISOString();
      updateData.cancelledBy = 'doctor';
      if (cancellationReason) {
        updateData.cancellationReason = cancellationReason;
      }
    } else if (status === 'cancelled') {
      updateData.cancelledAt = new Date().toISOString();
      // Set cancelledBy based on user role
      updateData.cancelledBy = user.userRole === 'hospital' ? 'hospital' : user.userRole === 'patient' ? 'patient' : 'doctor';
      if (cancellationReason) {
        updateData.cancellationReason = cancellationReason;
      }
    } else if (status === 'completed') {
      updateData.completedAt = new Date().toISOString();
      updateData.actualEndTime = new Date().toISOString();
      if (treatmentNotes) {
        updateData.treatmentNotes = treatmentNotes;
      }
    }

    const updatedAssignment = await db
      .update(assignments)
      .set(updateData)
      .where(eq(assignments.id, assignmentId))
      .returning();

    // Automatically create payment record when assignment is completed
    if (status === 'completed' && assignmentData.consultationFee && assignmentData.hospitalId) {
      const { assignmentPayments } = await import('@/src/db/drizzle/migrations/schema');

      // Check if payment already exists (prevent duplicates)
      const existingPayment = await db
        .select()
        .from(assignmentPayments)
        .where(eq(assignmentPayments.assignmentId, assignmentId))
        .limit(1);

      if (existingPayment.length === 0) {
        // Create payment record (no commission: doctorPayout = consultationFee)
        const consultationFee = parseFloat(assignmentData.consultationFee.toString());
        const platformCommission = 0; // No commission for now
        const doctorPayout = consultationFee; // Full amount to doctor

        try {
          await db.insert(assignmentPayments).values({
            assignmentId: assignmentId,
            hospitalId: assignmentData.hospitalId,
            doctorId: assignmentData.doctorId,
            consultationFee: consultationFee.toString(),
            platformCommission: platformCommission.toString(),
            doctorPayout: doctorPayout.toString(),
            paymentStatus: 'pending',
          });
        } catch (error: any) {
          // Ignore duplicate key errors (payment already exists)
          // This can happen if the assignment was completed multiple times
          if (error?.code !== '23505') { // PostgreSQL unique violation
            throw error;
          }
        }
      }
    }

    // Release or delete availability slot for declined or cancelled assignments
    if ((status === 'declined' || status === 'cancelled') && assignmentData.availabilitySlotId) {
      // Check if this is a sub-slot (has parentSlotId) or a parent slot
      const slotInfo = await db
        .select({
          id: doctorAvailability.id,
          parentSlotId: doctorAvailability.parentSlotId,
        })
        .from(doctorAvailability)
        .where(eq(doctorAvailability.id, assignmentData.availabilitySlotId))
        .limit(1);

      if (slotInfo.length > 0) {
        const slot = slotInfo[0];

        if (slot.parentSlotId) {
          // This is a sub-slot: delete it
          await db
            .delete(doctorAvailability)
            .where(eq(doctorAvailability.id, assignmentData.availabilitySlotId));
        } else {
          // This is a parent slot: just release it (set to available)
          await db
            .update(doctorAvailability)
            .set({
              status: 'available',
              bookedByHospitalId: null,
              bookedAt: null,
            })
            .where(eq(doctorAvailability.id, assignmentData.availabilitySlotId));
        }
      }
    }

    // Send push notifications for all assignment status changes
    // Accepted/Declined/Completed: Doctor → Hospital
    // Cancelled: Notify the other party (Doctor cancels → Hospital, Hospital cancels → Doctor)
    if (status === 'accepted' || status === 'declined' || status === 'completed' || status === 'cancelled') {
      try {
        console.log(`📬 [ASSIGNMENT STATUS] Attempting to send push notification`);
        console.log(`📬 [ASSIGNMENT STATUS] Assignment ID: ${assignmentId}`);
        console.log(`📬 [ASSIGNMENT STATUS] New Status: ${status}`);
        console.log(`📬 [ASSIGNMENT STATUS] Changed By: ${user.userRole}`);

        const { hospitals, doctors, patients } = await import('@/src/db/drizzle/migrations/schema');
        const { NotificationsService } = await import('@/lib/services/notifications.service');
        const notificationsService = new NotificationsService();

        const baseUrl = process.env.FRONTEND_URL;
        if (!baseUrl) {
          throw new Error('FRONTEND_URL environment variable is not set');
        }
        const deepLink = 'hospitalapp://view_assignment';

        // Get doctor and patient names
        const [doctorInfo, patientInfo, hospitalInfo, patientProfileInfo] = await Promise.all([
          db
            .select({
              userId: doctors.userId,
              firstName: doctors.firstName,
              lastName: doctors.lastName,
            })
            .from(doctors)
            .where(eq(doctors.id, assignmentData.doctorId))
            .limit(1),
          assignmentData.patientId
            ? db
                .select({
                  fullName: patients.fullName,
                })
                .from(patients)
                .where(eq(patients.id, assignmentData.patientId))
                .limit(1)
            : Promise.resolve([]),
          assignmentData.hospitalId
            ? db
                .select({
                  userId: hospitals.userId,
                  name: hospitals.name,
                })
                .from(hospitals)
                .where(eq(hospitals.id, assignmentData.hospitalId))
                .limit(1)
            : Promise.resolve([]),
          assignmentData.patientProfileId
            ? db
                .select({
                  fullName: patientProfiles.fullName,
                  userId: patientProfiles.userId,
                })
                .from(patientProfiles)
                .where(eq(patientProfiles.id, assignmentData.patientProfileId))
                .limit(1)
            : Promise.resolve([]),
        ]);

        const doctorName = doctorInfo[0] ? `Dr. ${doctorInfo[0].firstName} ${doctorInfo[0].lastName}` : 'Doctor';
        const patientName = patientInfo[0]?.fullName || patientProfileInfo[0]?.fullName || 'Patient';
        const hospitalName = hospitalInfo[0]?.name || 'Hospital';
        const doctorUserId = doctorInfo[0]?.userId;
        const hospitalUserId = hospitalInfo[0]?.userId;
        const patientUserId = patientProfileInfo[0]?.userId;

        // Determine recipient and notification content based on status and who changed it
        let recipientUserId: string | null = null;
        let notificationTitle = '';
        let notificationMessage = '';
        let notificationType = '';

        const isHomeVisit = assignmentData.source === 'patient' && patientUserId;

        if (status === 'accepted') {
          recipientUserId = isHomeVisit ? patientUserId : hospitalUserId;
          notificationTitle = isHomeVisit ? 'Home Visit Accepted' : 'Assignment Accepted';
          notificationMessage = isHomeVisit 
            ? `${doctorName} has accepted your home visit request.` 
            : `${doctorName} has accepted the assignment for ${patientName}`;
          notificationType = 'assignment_accepted';
        } else if (status === 'declined') {
          recipientUserId = isHomeVisit ? patientUserId : hospitalUserId;
          notificationTitle = isHomeVisit ? 'Home Visit Declined' : 'Assignment Declined';
          notificationMessage = isHomeVisit 
            ? `${doctorName} has declined your home visit request.` 
            : `${doctorName} has declined the assignment for ${patientName}`;
          notificationType = 'assignment_declined';
        } else if (status === 'completed') {
          recipientUserId = isHomeVisit ? patientUserId : hospitalUserId;
          notificationTitle = isHomeVisit ? 'Home Visit Completed' : 'Assignment Completed';
          notificationMessage = isHomeVisit 
            ? `${doctorName} has completed your home visit.` 
            : `${doctorName} has completed the assignment for ${patientName}`;
          notificationType = 'assignment_completed';
        } else if (status === 'cancelled') {
          if (user.userRole === 'doctor') {
            recipientUserId = isHomeVisit ? patientUserId : hospitalUserId;
            notificationTitle = isHomeVisit ? 'Home Visit Cancelled' : 'Assignment Cancelled';
            notificationMessage = isHomeVisit 
              ? `${doctorName} has cancelled the home visit.` 
              : `${doctorName} has cancelled the assignment for ${patientName}`;
            notificationType = 'assignment_cancelled';
          } else if (user.userRole === 'patient') {
            recipientUserId = doctorUserId;
            notificationTitle = 'Home Visit Cancelled';
            notificationMessage = `${patientName} has cancelled their home visit request.`;
            notificationType = 'assignment_cancelled';
          } else if (user.userRole === 'hospital') {
            recipientUserId = doctorUserId;
            notificationTitle = 'Assignment Cancelled';
            notificationMessage = `${hospitalName} has cancelled the assignment for ${patientName}`;
            notificationType = 'assignment_cancelled';
          }
        }

        // Send notification if we have a recipient
        if (recipientUserId) {
          console.log(`📬 [ASSIGNMENT STATUS] Sending notification to ${user.userRole === 'doctor' && status === 'cancelled' ? 'hospital' : user.userRole === 'hospital' && status === 'cancelled' ? 'doctor' : 'hospital'}`);
          console.log(`📬 [ASSIGNMENT STATUS] Recipient User ID: ${recipientUserId}`);
          console.log(`📬 [ASSIGNMENT STATUS] Notification Title: ${notificationTitle}`);
          console.log(`📬 [ASSIGNMENT STATUS] Notification Message: ${notificationMessage}`);

          await notificationsService.sendPushNotification(recipientUserId, {
            userId: recipientUserId,
            recipientType: 'user',
            notificationType: 'booking',
            title: notificationTitle,
            message: notificationMessage,
            channel: 'push',
            priority: status === 'completed' || status === 'accepted' ? 'high' : 'medium',
            assignmentId: assignmentId,
            payload: {
              notificationType: notificationType,
              assignmentId: assignmentId,
              hospitalId: assignmentData.hospitalId,
              hospitalName: hospitalName,
              doctorId: assignmentData.doctorId,
              doctorName: doctorName,
              patientId: assignmentData.patientId,
              patientName: patientName,
              status: status,
              cancellationReason: (status === 'declined' || status === 'cancelled') ? cancellationReason : undefined,
              deepLink: deepLink,
            },
          });

          console.log(`✅ [ASSIGNMENT STATUS] Push notification process completed`);
          console.log(`✅ [ASSIGNMENT STATUS] Assignment ID: ${assignmentId}, Status: ${status}`);
        } else {
          console.warn(`⚠️  [ASSIGNMENT STATUS] Recipient User ID not found`);
          console.warn(`⚠️  [ASSIGNMENT STATUS] Push notification skipped`);
        }
      } catch (notificationError) {
        // Don't fail status update if notification fails
        console.error('❌ [ASSIGNMENT STATUS] FAILURE: Exception while sending push notification');
        console.error(`❌ [ASSIGNMENT STATUS] Assignment ID: ${assignmentId}`);
        console.error(`❌ [ASSIGNMENT STATUS] Status: ${status}`);
        console.error(`❌ [ASSIGNMENT STATUS] Changed By: ${user.userRole}`);
        console.error('❌ [ASSIGNMENT STATUS] Error:', notificationError instanceof Error ? notificationError.message : String(notificationError));
        console.error('❌ [ASSIGNMENT STATUS] Stack:', notificationError instanceof Error ? notificationError.stack : 'No stack trace');
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedAssignment[0],
      message: `Assignment ${status} successfully`,
    });
  } catch (error) {
    console.error('Error updating assignment status:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to update assignment status',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const PATCH = withAuthAndContext(patchHandler, ['doctor', 'hospital', 'admin', 'patient']);

