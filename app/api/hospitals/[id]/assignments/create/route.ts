import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { assignments, doctorAvailability, enumPriority, doctors, subscriptions, subscriptionPlans, doctorPlanFeatures, doctorAssignmentUsage, hospitals, patients, users, assignmentExpiryConfig } from '@/src/db/drizzle/migrations/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getMaxAssignmentsForDoctor, DEFAULT_ASSIGNMENT_LIMIT } from '@/lib/config/subscription-limits';
import { createAuditLog, getRequestMetadata } from '@/lib/utils/audit-logger';

/**
 * @swagger
 * /api/hospitals/{id}/assignments/create:
 *   post:
 *     summary: Create a new assignment
 *     tags: [Hospitals, Assignments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Hospital ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - patientId
 *               - doctorId
 *             properties:
 *               patientId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the patient
 *               doctorId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the doctor
 *               parentSlotId:
 *                 type: string
 *                 format: uuid
 *                 description: Parent availability slot ID
 *               startTime:
 *                 type: string
 *                 example: "10:00"
 *                 description: "Assignment start time (HH:mm format)"
 *               endTime:
 *                 type: string
 *                 example: "11:00"
 *                 description: "Assignment end time (HH:mm format)"
 *               availabilitySlotId:
 *                 type: string
 *                 format: uuid
 *                 description: Pre-existing slot ID (backward compatibility)
 *               priority:
 *                 type: string
 *                 enum: [routine, urgent, emergency]
 *                 default: routine
 *               consultationFee:
 *                 type: number
 *                 description: Agreed upon fee for the assignment
 *               procedureId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the associated procedure
 *               procedureTypeId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the specific procedure type
 *               roomTypeId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the assigned room type
 *               specialtyId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the doctor's specialty related to this assignment
 *     responses:
 *       200:
 *         description: Assignment created successfully
 *       400:
 *         description: Invalid input or missing parameters
 *       403:
 *         description: Assignment limit reached
 *       404:
 *         description: Hospital or doctor slot not found
 *       500:
 *         description: Internal server error
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const hospitalId = params.id;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(hospitalId) || hospitalId === 'hospital-id-placeholder') {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid hospital ID',
        },
        { status: 400 }
      );
    }

    const db = getDb();

    // Validate request body with Zod
    const { CreateAssignmentDtoSchema } = await import('@/lib/validations/assignment.dto');
    const { validateRequest } = await import('@/lib/utils/validate-request');

    const validation = await validateRequest(req, CreateAssignmentDtoSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { patientId, doctorId, parentSlotId, startTime, endTime, availabilitySlotId, priority = 'routine', consultationFee, procedureId, procedureTypeId, roomTypeId, specialtyId } = validation.data;

    // Check hospital assignment limit first
    const { HospitalUsageService } = await import('@/lib/services/hospital-usage.service');
    const hospitalUsageService = new HospitalUsageService();

    try {
      await hospitalUsageService.checkAssignmentLimit(hospitalId);
    } catch (error: any) {
      if (error.message === 'HOSPITAL_ASSIGNMENT_LIMIT_REACHED') {
        // Get current usage for better error message
        try {
          const usage = await hospitalUsageService.getUsage(hospitalId);
          return NextResponse.json(
            {
              success: false,
              message: `Your hospital has reached its monthly assignment limit (${usage.assignments.used}/${usage.assignments.limit === -1 ? 'unlimited' : usage.assignments.limit} assignments used). Your limit will reset on ${new Date(usage.resetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. Upgrade your plan to create more assignments now.`,
              code: 'HOSPITAL_ASSIGNMENT_LIMIT_REACHED',
              error: 'HOSPITAL_ASSIGNMENT_LIMIT_REACHED',
              usage: {
                used: usage.assignments.used,
                limit: usage.assignments.limit,
                resetDate: usage.resetDate,
              },
            },
            { status: 403 }
          );
        } catch {
          // Fallback if usage fetch fails
          return NextResponse.json(
            {
              success: false,
              message: 'Your hospital has reached its monthly assignment limit. Upgrade your plan to create more assignments.',
              code: 'HOSPITAL_ASSIGNMENT_LIMIT_REACHED',
              error: 'HOSPITAL_ASSIGNMENT_LIMIT_REACHED',
            },
            { status: 403 }
          );
        }
      }
      throw error;
    }

    // Check doctor assignment limit
    try {
      await checkAssignmentLimit(doctorId, db);
    } catch (error: any) {
      if (error.message === 'ASSIGNMENT_LIMIT_REACHED') {
        // Get doctor info for better error message
        try {
          const doctor = await db
            .select({
              firstName: doctors.firstName,
              lastName: doctors.lastName,
            })
            .from(doctors)
            .where(eq(doctors.id, doctorId))
            .limit(1);

          const doctorName = doctor.length > 0
            ? `Dr. ${doctor[0].firstName} ${doctor[0].lastName}`
            : 'This doctor';

          // Get usage info
          const currentMonth = new Date().toISOString().slice(0, 7);
          const usage = await db
            .select()
            .from(doctorAssignmentUsage)
            .where(
              and(
                eq(doctorAssignmentUsage.doctorId, doctorId),
                eq(doctorAssignmentUsage.month, currentMonth)
              )
            )
            .limit(1);

          const usageData = usage.length > 0 ? usage[0] : null;
          const resetDate = usageData?.resetDate
            ? new Date(usageData.resetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : 'the 1st of next month';

          return NextResponse.json(
            {
              success: false,
              message: `${doctorName} has reached their monthly assignment limit (${usageData?.count || 0}/${usageData?.limitCount || 'N/A'} assignments used). The limit will reset on ${resetDate}. Please try another doctor.`,
              code: 'ASSIGNMENT_LIMIT_REACHED',
              error: 'ASSIGNMENT_LIMIT_REACHED',
              usage: usageData ? {
                used: usageData.count,
                limit: usageData.limitCount,
                resetDate: usageData.resetDate,
              } : null,
            },
            { status: 403 }
          );
        } catch {
          // Fallback if info fetch fails
          return NextResponse.json(
            {
              success: false,
              message: 'This doctor has reached their monthly assignment limit. Please try another doctor.',
              code: 'ASSIGNMENT_LIMIT_REACHED',
              error: 'ASSIGNMENT_LIMIT_REACHED',
            },
            { status: 403 }
          );
        }
      }
      throw error;
    }


    // 1. Calculate expiresAt based on priority using database configuration
    // Fetch configuration for the specific priority
    const expiryConfig = await db
      .select({ expiryHours: assignmentExpiryConfig.expiryHours })
      .from(assignmentExpiryConfig)
      .where(
        and(
          eq(assignmentExpiryConfig.priority, priority),
          eq(assignmentExpiryConfig.isActive, true)
        )
      )
      .limit(1);

    let expiryHours = 24; // Default fallback: 24 hours (Routine)

    if (expiryConfig.length > 0) {
      expiryHours = expiryConfig[0].expiryHours;
    } else {
      // Fallback defaults if config is missing
      if (priority === 'urgent') expiryHours = 6;
      else if (priority === 'emergency') expiryHours = 1;
    }

    let expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiryHours);


    // 2. Validate expiresAt against assignment time bounds (only if time bounds exist)
    // We need to fetch the slot date to properly compare times for future assignments
    let slotDate: string | null = null;
    if (parentSlotId) {
      // Fetch parent slot to get the actual slot date
      const parentSlotData = await db
        .select({ slotDate: doctorAvailability.slotDate })
        .from(doctorAvailability)
        .where(eq(doctorAvailability.id, parentSlotId))
        .limit(1);

      if (parentSlotData.length > 0) {
        slotDate = parentSlotData[0].slotDate;
      }
    }

    if (startTime && endTime && slotDate) {
      // Parse HH:mm format (startTime and endTime are in HH:mm format from parent slot)
      // Create Date objects using the ACTUAL slot date + parsed times
      const [year, month, day] = slotDate.split('-').map(Number);
      const [startHour, startMin] = startTime.split(':').map(Number);
      const [endHour, endMin] = endTime.split(':').map(Number);

      // Use IST offset (+05:30) since slot times are stored in IST
      const startTimeDate = new Date(`${slotDate}T${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}:00+05:30`);
      const endTimeDate = new Date(`${slotDate}T${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00+05:30`);

      // Validate that the selected time is not in the past
      const now = new Date();
      if (startTimeDate < now) {
        return NextResponse.json(
          {
            success: false,
            message: `Cannot create assignment for a past time. The selected start time (${startTimeDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}) has already passed.`,
            error: 'PAST_TIME_NOT_ALLOWED',
          },
          { status: 400 }
        );
      }

      if (expiresAt > endTimeDate) {
        // Case 1: Expires after assignment ends - set to end time
        expiresAt = endTimeDate;
      }
      // else: expiresAt is valid (before/during assignment) → keep it
    }

    // Verify priority exists in enum
    const priorityCheck = await db
      .select()
      .from(enumPriority)
      .where(eq(enumPriority.priority, priority))
      .limit(1);

    if (priorityCheck.length === 0) {
      // Insert priority if it doesn't exist
      await db.insert(enumPriority).values({
        priority,
        description: `${priority} priority assignment`,
      }).onConflictDoNothing();
    }

    // Determine which slot to use (parent slot -> create sub-slot, or use existing sub-slot)
    // Phase 1: All reads and validations (before any writes)
    const { DoctorsRepository } = await import('@/lib/repositories/doctors.repository');
    const doctorsRepository = new DoctorsRepository();

    let useNewSlotFlow = false;
    let parentSlotData: Awaited<ReturnType<typeof doctorsRepository.getParentSlot>> | null = null;

    if (parentSlotId && startTime && endTime) {
      useNewSlotFlow = true;

      // 1. Get and validate parent slot (READ)
      parentSlotData = await doctorsRepository.getParentSlot(parentSlotId);
      if (!parentSlotData) {
        return NextResponse.json(
          {
            success: false,
            message: 'Parent slot not found or is not a valid parent slot',
            error: 'PARENT_SLOT_NOT_FOUND',
          },
          { status: 404 }
        );
      }

      // 2. Validate time range fits within parent slot (pure check)
      if (!doctorsRepository.fitsWithinParent(
        parentSlotData.startTime,
        parentSlotData.endTime,
        startTime,
        endTime
      )) {
        return NextResponse.json(
          {
            success: false,
            message: `Selected time range (${startTime}-${endTime}) does not fit within parent slot (${parentSlotData.startTime}-${parentSlotData.endTime})`,
            error: 'TIME_RANGE_OUT_OF_BOUNDS',
          },
          { status: 400 }
        );
      }

      // 3. Check for overlapping sub-slots (READ)
      const hasOverlap = await doctorsRepository.hasOverlappingSubSlots(
        parentSlotId,
        startTime,
        endTime
      );

      if (hasOverlap) {
        return NextResponse.json(
          {
            success: false,
            message: `Selected time range (${startTime}-${endTime}) overlaps with an existing booking`,
            error: 'TIME_OVERLAP',
          },
          { status: 400 }
        );
      }

    } else if (availabilitySlotId) {
      // OLD FLOW: Read slot and validate (no writes yet)
      const slot = await db
        .select({ id: doctorAvailability.id, parentSlotId: doctorAvailability.parentSlotId, slotDate: doctorAvailability.slotDate, startTime: doctorAvailability.startTime })
        .from(doctorAvailability)
        .where(eq(doctorAvailability.id, availabilitySlotId))
        .limit(1);

      if (slot.length === 0) {
        return NextResponse.json(
          {
            success: false,
            message: 'Availability slot not found',
            error: 'SLOT_NOT_FOUND',
          },
          { status: 404 }
        );
      }

      // Validate that the slot time is not in the past
      if (slot[0].slotDate && slot[0].startTime) {
        const slotStartDateTime = new Date(`${slot[0].slotDate}T${slot[0].startTime}+05:30`);
        const now = new Date();
        if (slotStartDateTime < now) {
          return NextResponse.json(
            {
              success: false,
              message: `Cannot create assignment for a past time. The selected start time (${slotStartDateTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}) has already passed.`,
              error: 'PAST_TIME_NOT_ALLOWED',
            },
            { status: 400 }
          );
        }
      }

      // If it's a parent slot, reject (must use parentSlotId + time range)
      if (!slot[0].parentSlotId) {
        return NextResponse.json(
          {
            success: false,
            message: 'Cannot book parent slot directly. Please provide parentSlotId with startTime and endTime to create a sub-slot',
            error: 'PARENT_SLOT_CANNOT_BE_BOOKED_DIRECTLY',
          },
          { status: 400 }
        );
      }

    } else {
      return NextResponse.json(
        {
          success: false,
          message: 'Either parentSlotId with startTime/endTime or availabilitySlotId must be provided',
          error: 'MISSING_SLOT_INFO',
        },
        { status: 400 }
      );
    }

    // Phase 2: All writes wrapped in a single transaction for atomicity
    // Covers: sub-slot insert/update OR slot update, assignment insert, doctor usage increment
    let finalAvailabilitySlotId: string;
    let newAssignment: any;

    await db.transaction(async (tx) => {
      if (useNewSlotFlow) {
        // NEW FLOW: Create sub-slot inline (avoids repository's own db instance)
        const [subSlot] = await tx
          .insert(doctorAvailability)
          .values({
            doctorId,
            slotDate: parentSlotData!.slotDate,
            startTime: startTime!,
            endTime: endTime!,
            parentSlotId: parentSlotId!,
            status: 'booked',
            isManual: false,
            notes: 'Sub-slot created for assignment',
          })
          .returning();

        await tx
          .update(doctorAvailability)
          .set({
            bookedByHospitalId: hospitalId,
            bookedAt: new Date().toISOString(),
          })
          .where(eq(doctorAvailability.id, subSlot.id));

        finalAvailabilitySlotId = subSlot.id;
      } else {
        // OLD FLOW: Mark existing sub-slot as booked
        await tx
          .update(doctorAvailability)
          .set({
            status: 'booked',
            bookedByHospitalId: hospitalId,
            bookedAt: new Date().toISOString(),
          })
          .where(eq(doctorAvailability.id, availabilitySlotId!));

        finalAvailabilitySlotId = availabilitySlotId!;
      }

      // Create assignment
      const [created] = await tx
        .insert(assignments)
        .values({
          hospitalId,
          doctorId,
          patientId,
          availabilitySlotId: finalAvailabilitySlotId,
          priority,
          status: 'pending',
          expiresAt: expiresAt.toISOString(),
          consultationFee: (consultationFee !== undefined && consultationFee !== null) ? String(consultationFee) : null,
          procedureId: procedureId || null,
          procedureTypeId: procedureTypeId || null,
          roomTypeId: roomTypeId || null,
          specialtyId: specialtyId || null,
        })
        .returning();
      newAssignment = created;

      // Increment doctor assignment usage count (accepts db/tx parameter)
      await incrementAssignmentUsage(doctorId, tx);
    });

    // Hospital usage increment is outside the transaction because the service
    // uses its own internal db instance and cannot accept a tx parameter
    await hospitalUsageService.incrementAssignmentUsage(hospitalId);

    // Get request metadata and entity names for audit log
    const metadata = getRequestMetadata(req);
    const hospitalUserId = req.headers.get('x-user-id') || null;

    // Get hospital, doctor, and patient names
    const [hospitalResult, doctorResult, patientResult] = await Promise.all([
      db.select({ name: hospitals.name }).from(hospitals).where(eq(hospitals.id, hospitalId)).limit(1),
      db.select({ firstName: doctors.firstName, lastName: doctors.lastName }).from(doctors).where(eq(doctors.id, doctorId)).limit(1),
      db.select({ fullName: patients.fullName }).from(patients).where(eq(patients.id, patientId)).limit(1),
    ]);

    const hospitalName = hospitalResult[0]?.name || null;
    const doctorName = doctorResult[0] ? `Dr. ${doctorResult[0].firstName} ${doctorResult[0].lastName}` : null;
    const patientName = patientResult[0]?.fullName || null;

    // Create comprehensive audit log
    await createAuditLog({
      userId: hospitalUserId,
      actorType: 'user',
      action: 'create',
      entityType: 'assignment',
      entityId: newAssignment.id,
      entityName: `Assignment: ${doctorName} → ${patientName}`,
      httpMethod: 'POST',
      endpoint: `/api/hospitals/${hospitalId}/assignments/create`,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      details: {
        hospitalId,
        hospitalName,
        doctorId,
        doctorName,
        patientId,
        patientName,
        priority,
        consultationFee: (consultationFee !== undefined && consultationFee !== null) ? consultationFee : null,
        expiresAt: expiresAt.toISOString(),
        createdAt: new Date().toISOString(),
      },
    });

    // Send push notification to doctor about new assignment
    try {
      console.log('📬 [ASSIGNMENT CREATE] Attempting to send push notification to doctor');
      console.log(`📬 [ASSIGNMENT CREATE] Assignment ID: ${newAssignment.id}`);
      console.log(`📬 [ASSIGNMENT CREATE] Doctor ID: ${doctorId}`);

      // Get doctor's userId
      const doctor = await db
        .select({ userId: doctors.userId })
        .from(doctors)
        .where(eq(doctors.id, doctorId))
        .limit(1);

      if (doctor.length > 0 && doctor[0].userId) {
        console.log(`📬 [ASSIGNMENT CREATE] Doctor User ID: ${doctor[0].userId}`);

        const { NotificationsService } = await import('@/lib/services/notifications.service');
        const notificationsService = new NotificationsService();

        const baseUrl = process.env.FRONTEND_URL;
        if (!baseUrl) {
          throw new Error('FRONTEND_URL environment variable is not set');
        }
        const deepLink = 'hospitalapp://view_assignment';

        console.log(`📬 [ASSIGNMENT CREATE] Sending notification: New Assignment Request`);
        console.log(`📬 [ASSIGNMENT CREATE] Hospital: ${hospitalName}, Patient: ${patientName}`);

        await notificationsService.sendPushNotification(doctor[0].userId, {
          userId: doctor[0].userId,
          recipientType: 'user',
          notificationType: 'booking',
          title: 'New Assignment Request',
          message: `You have a new assignment from ${hospitalName} - ${patientName}`,
          channel: 'push',
          priority: priority === 'emergency' ? 'urgent' : priority === 'urgent' ? 'high' : 'medium',
          assignmentId: newAssignment.id,
          payload: {
            notificationType: 'assignment_created',
            assignmentId: newAssignment.id,
            hospitalId: hospitalId,
            hospitalName: hospitalName,
            doctorId: doctorId,
            patientId: patientId,
            patientName: patientName,
            priority: priority,
            scheduledTime: startTime || endTime || new Date().toISOString(),
            consultationFee: (consultationFee !== undefined && consultationFee !== null) ? consultationFee : null,
            deepLink: deepLink,
          },
        });

        console.log(`✅ [ASSIGNMENT CREATE] Push notification process completed for doctor ${doctorId}`);
        console.log(`✅ [ASSIGNMENT CREATE] Assignment ID: ${newAssignment.id}`);
      } else {
        console.warn(`⚠️  [ASSIGNMENT CREATE] Doctor User ID not found for doctor ${doctorId}`);
        console.warn(`⚠️  [ASSIGNMENT CREATE] Push notification skipped`);
      }
    } catch (notificationError) {
      // Don't fail assignment creation if notification fails
      console.error('❌ [ASSIGNMENT CREATE] FAILURE: Exception while sending push notification to doctor');
      console.error(`❌ [ASSIGNMENT CREATE] Assignment ID: ${newAssignment.id}`);
      console.error(`❌ [ASSIGNMENT CREATE] Doctor ID: ${doctorId}`);
      console.error('❌ [ASSIGNMENT CREATE] Error:', notificationError instanceof Error ? notificationError.message : String(notificationError));
      console.error('❌ [ASSIGNMENT CREATE] Stack:', notificationError instanceof Error ? notificationError.stack : 'No stack trace');
    }

    return NextResponse.json({
      success: true,
      data: newAssignment,
      message: 'Assignment created successfully',
    });
  } catch (error) {
    console.error('Error creating assignment:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to create assignment',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Helper function: Check assignment limit
async function checkAssignmentLimit(doctorId: string, db: any) {
  // Get doctor's userId
  const doctor = await db
    .select({ userId: doctors.userId })
    .from(doctors)
    .where(eq(doctors.id, doctorId))
    .limit(1);

  if (doctor.length === 0) {
    throw new Error('Doctor not found');
  }

  // Get max assignments from database (queries doctorPlanFeatures.maxAssignmentsPerMonth)
  const maxAssignments = await getMaxAssignmentsForDoctor(doctor[0].userId);

  // If unlimited, skip check
  if (maxAssignments === -1) {
    return;
  }

  // Get or create usage record for current month
  const currentMonth = new Date().toISOString().slice(0, 7); // "2024-03"

  let usage = await db
    .select()
    .from(doctorAssignmentUsage)
    .where(
      and(
        eq(doctorAssignmentUsage.doctorId, doctorId),
        eq(doctorAssignmentUsage.month, currentMonth)
      )
    )
    .limit(1);

  if (usage.length === 0) {
    // Create new usage record
    const resetDate = new Date();
    resetDate.setMonth(resetDate.getMonth() + 1);
    resetDate.setDate(1);
    resetDate.setHours(0, 0, 0, 0);

    [usage] = await db
      .insert(doctorAssignmentUsage)
      .values({
        doctorId,
        month: currentMonth,
        count: 0,
        limitCount: maxAssignments,
        resetDate: resetDate.toISOString(),
      })
      .returning();
  }

  const usageData = usage[0] || usage;

  // Check if limit reached
  if (usageData.count >= maxAssignments) {
    throw new Error('ASSIGNMENT_LIMIT_REACHED');
  }
}

// Helper function: Increment assignment usage
async function incrementAssignmentUsage(doctorId: string, db: any) {
  const currentMonth = new Date().toISOString().slice(0, 7);

  // Get or create usage record
  let usage = await db
    .select()
    .from(doctorAssignmentUsage)
    .where(
      and(
        eq(doctorAssignmentUsage.doctorId, doctorId),
        eq(doctorAssignmentUsage.month, currentMonth)
      )
    )
    .limit(1);

  if (usage.length === 0) {
    // Get doctor's userId to determine limit
    const doctor = await db
      .select({ userId: doctors.userId })
      .from(doctors)
      .where(eq(doctors.id, doctorId))
      .limit(1);

    if (doctor.length === 0) return;

    // Get max assignments from database (queries doctorPlanFeatures.maxAssignmentsPerMonth)
    const maxAssignments = await getMaxAssignmentsForDoctor(doctor[0].userId);

    const resetDate = new Date();
    resetDate.setMonth(resetDate.getMonth() + 1);
    resetDate.setDate(1);
    resetDate.setHours(0, 0, 0, 0);

    await db.insert(doctorAssignmentUsage).values({
      doctorId,
      month: currentMonth,
      count: 1,
      limitCount: maxAssignments,
      resetDate: resetDate.toISOString(),
    });
  } else {
    // Increment existing count
    await db
      .update(doctorAssignmentUsage)
      .set({
        count: sql`${doctorAssignmentUsage.count} + 1`,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(doctorAssignmentUsage.doctorId, doctorId),
          eq(doctorAssignmentUsage.month, currentMonth)
        )
      );
  }
}

