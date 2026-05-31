import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { DoctorsService } from '@/lib/services/doctors.service';
import { BookingsService } from '@/lib/services/bookings.service';
import { getDb } from '@/lib/db';
import { assignments, doctorHospitalAffiliations, subscriptions, subscriptionPlans, doctorPlanFeatures, doctorAssignmentUsage, assignmentPayments, doctorAvailability, patients, hospitals } from '@/src/db/drizzle/migrations/schema';
import { eq, and, sql, count, gte, asc } from 'drizzle-orm';
import { getMaxAssignmentsForDoctor } from '@/lib/config/subscription-limits';

/**
 * @swagger
 * /api/doctors/dashboard:
 *   get:
 *     summary: Get doctor dashboard statistics and overview
 *     tags: [Doctors]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalAssignments:
 *                       type: number
 *                       description: Total assignments across all statuses
 *                     pendingAssignments:
 *                       type: number
 *                       description: Count of pending assignments
 *                     acceptedAssignments:
 *                       type: number
 *                       description: Count of accepted assignments
 *                     completedAssignments:
 *                       type: number
 *                       description: Count of completed assignments
 *                     acceptanceRate:
 *                       type: number
 *                       description: Acceptance rate percentage (accepted + completed) / total * 100
 *                     averageRating:
 *                       type: number
 *                     totalRatings:
 *                       type: number
 *                     totalEarnings:
 *                       type: number
 *                     thisMonthEarnings:
 *                       type: number
 *                     thisMonthAssignments:
 *                       type: number
 *                     upcomingAssignments:
 *                       type: number
 *                       description: Count of upcoming assignments (accepted or pending with future dates)
 *                     upcomingSlots:
 *                       type: number
 *                       description: Fallback field with same value as upcomingAssignments
 *                     profileCompletion:
 *                       type: number
 *                       description: Profile completion percentage (0-100)
 *                     credentials:
 *                       type: object
 *                       properties:
 *                         verified:
 *                           type: number
 *                         pending:
 *                           type: number
 *                         rejected:
 *                           type: number
 *                     activeAffiliations:
 *                       type: number
 *                     licenseVerificationStatus:
 *                       type: string
 *                       enum: [pending, verified, rejected]
 *       404:
 *         description: Doctor profile not found
 *       500:
 *         description: Internal server error
 */
async function getHandler(req: NextRequest) {
  try {
    const user = (req as any).user;
    const doctorsService = new DoctorsService();
    const bookingsService = new BookingsService();
    
    // Get doctor profile
    const doctorResult = await doctorsService.findDoctorByUserId(user.userId);
    if (!doctorResult.success || !doctorResult.data) {
      return NextResponse.json(
        { success: false, message: 'Doctor profile not found' },
        { status: 404 }
      );
    }

    const doctor = doctorResult.data;
    const doctorId = doctor.id;

    const db = getDb();

    // Get stats
    const statsResult = await doctorsService.getDoctorStats(doctorId);
    const stats = statsResult.success ? statsResult.data : null;

    // Get total assignments count (all statuses)
    const totalAssignmentsResult = await db
      .select({ count: count() })
      .from(assignments)
      .where(eq(assignments.doctorId, doctorId));
    const totalAssignments = Number(totalAssignmentsResult[0]?.count || 0);

    // Get pending assignments count
    const pendingAssignmentsResult = await db
      .select({ count: count() })
      .from(assignments)
      .where(
        and(
          eq(assignments.doctorId, doctorId),
          eq(assignments.status, 'pending')
        )
      );
    const pendingAssignments = Number(pendingAssignmentsResult[0]?.count || 0);

    // Get accepted assignments count
    const acceptedAssignmentsResult = await db
      .select({ count: count() })
      .from(assignments)
      .where(
        and(
          eq(assignments.doctorId, doctorId),
          eq(assignments.status, 'accepted')
        )
      );
    const acceptedAssignments = Number(acceptedAssignmentsResult[0]?.count || 0);

    // Get completed assignments count
    const completedAssignmentsResult = await db
      .select({ count: count() })
      .from(assignments)
      .where(
        and(
          eq(assignments.doctorId, doctorId),
          eq(assignments.status, 'completed')
        )
      );
    const completedAssignments = Number(completedAssignmentsResult[0]?.count || 0);

    // Calculate acceptance rate: (accepted + completed) / total * 100
    const acceptanceRate = totalAssignments > 0
      ? Math.round(((acceptedAssignments + completedAssignments) / totalAssignments) * 100)
      : 0;

    // Get today's assignments count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    
    const todayAssignmentsResult = await db
      .select({ count: count() })
      .from(assignments)
      .where(
        and(
          eq(assignments.doctorId, doctorId),
          sql`DATE(${assignments.requestedAt}) = CURRENT_DATE`
        )
      );
    const todayAssignments = Number(todayAssignmentsResult[0]?.count || 0);

  // Get upcoming assignments count (accepted assignments with future scheduled times)
  // Use availability slot datetime (slot_date + start_time) as canonical scheduled time.
    const upcomingAssignmentsCountResult = await db
      .select({ count: count() })
      .from(assignments)
      .leftJoin(doctorAvailability, eq(assignments.availabilitySlotId, doctorAvailability.id))
      .where(
        and(
          eq(assignments.doctorId, doctorId),
          sql`${assignments.status} = 'accepted'`,
          // (slot_date + start_time) > now()
          sql`(doctor_availability.slot_date + doctor_availability.start_time) > now()`
        )
      );
    const upcomingSlots = Number(upcomingAssignmentsCountResult[0]?.count || 0);

    // Fetch a small bounded list of upcoming accepted assignments with date/start/end/status (limit 5)
    const upcomingLimit = 5;
    const upcomingRows = await db
      .select({
        assignmentId: assignments.id,
        slotDate: doctorAvailability.slotDate,
        startTime: doctorAvailability.startTime,
        endTime: doctorAvailability.endTime,
        status: assignments.status,
        patientName: patients.fullName,
        hospitalName: hospitals.name,
        hospitalFullAddress: hospitals.fullAddress,
        medicalCondition: patients.medicalCondition,
        priority: assignments.priority,
        consultationFee: assignments.consultationFee,
      })
      .from(assignments)
      .leftJoin(doctorAvailability, eq(assignments.availabilitySlotId, doctorAvailability.id))
      .innerJoin(patients, eq(assignments.patientId, patients.id))
      .innerJoin(hospitals, eq(assignments.hospitalId, hospitals.id))
      .where(
        and(
          eq(assignments.doctorId, doctorId),
          sql`${assignments.status} = 'accepted'`,
          sql`(doctor_availability.slot_date + doctor_availability.start_time) > now()`
        )
      )
      .orderBy(asc(doctorAvailability.slotDate), asc(doctorAvailability.startTime))
      .limit(upcomingLimit);

    const upcomingAssignments = (upcomingRows || []).map((r: any) => ({
      id: r.assignmentId,
      date: r.slotDate ?? null,
      startTime: r.startTime ?? null,
      endTime: r.endTime ?? null,
      status: r.status,
      patientName: r.patientName || 'Unknown Patient',
      hospitalName: r.hospitalName || 'Unknown Hospital',
      hospitalFullAddress: r.hospitalFullAddress || null,
      medicalCondition: r.medicalCondition || 'N/A',
      priority: r.priority || 'routine',
      consultationFee: r.consultationFee ? Number(r.consultationFee) : null,
    }));

    // Fetch pending assignments that require action (limit 5)
    const actionRequiredLimit = 5;
    const pendingAssignmentRows = await db
      .select({
        assignmentId: assignments.id,
        slotDate: doctorAvailability.slotDate,
        startTime: doctorAvailability.startTime,
        endTime: doctorAvailability.endTime,
        status: assignments.status,
        patientName: patients.fullName,
        hospitalName: hospitals.name,
        hospitalFullAddress: hospitals.fullAddress,
        medicalCondition: patients.medicalCondition,
        priority: assignments.priority,
        consultationFee: assignments.consultationFee,
        expiresAt: assignments.expiresAt,
      })
      .from(assignments)
      .leftJoin(doctorAvailability, eq(assignments.availabilitySlotId, doctorAvailability.id))
      .innerJoin(patients, eq(assignments.patientId, patients.id))
      .innerJoin(hospitals, eq(assignments.hospitalId, hospitals.id))
      .where(
        and(
          eq(assignments.doctorId, doctorId),
          sql`${assignments.status} = 'pending'`,
          sql`(doctor_availability.slot_date + doctor_availability.start_time) > now()`
        )
      )
      .orderBy(asc(doctorAvailability.slotDate), asc(doctorAvailability.startTime))
      .limit(actionRequiredLimit);

    const actionRequiredAssignments = (pendingAssignmentRows || []).map((r: any) => ({
      id: r.assignmentId,
      type: 'accept_or_decline',
      date: r.slotDate ?? null,
      startTime: r.startTime ?? null,
      endTime: r.endTime ?? null,
      status: r.status,
      patientName: r.patientName || 'Unknown Patient',
      hospitalName: r.hospitalName || 'Unknown Hospital',
      hospitalFullAddress: r.hospitalFullAddress || null,
      medicalCondition: r.medicalCondition || 'N/A',
      priority: r.priority || 'routine',
      consultationFee: r.consultationFee ? Number(r.consultationFee) : null,
      expiresAt: r.expiresAt,
    }));

    // Get total earnings (all time)
    const totalEarningsResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${assignmentPayments.doctorPayout}), 0)`,
      })
      .from(assignmentPayments)
      .where(
        and(
          eq(assignmentPayments.doctorId, doctorId),
          eq(assignmentPayments.paymentStatus, 'completed')
        )
      );
    const totalEarnings = Number(totalEarningsResult[0]?.total || 0);

    // Get this month earnings
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const thisMonthEarningsResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${assignmentPayments.doctorPayout}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(assignmentPayments)
      .where(
        and(
          eq(assignmentPayments.doctorId, doctorId),
          eq(assignmentPayments.paymentStatus, 'completed'),
          gte(assignmentPayments.paidToDoctorAt, startOfMonth.toISOString())
        )
      );
    const thisMonthEarnings = Number(thisMonthEarningsResult[0]?.total || 0);
    const thisMonthAssignments = Number(thisMonthEarningsResult[0]?.count || 0);

    // Get credentials count
    const credentialsResult = await doctorsService.getDoctorCredentials(doctorId);
    const credentials = credentialsResult.success && credentialsResult.data ? credentialsResult.data : [];
    const credentialsStats = {
      verified: Array.isArray(credentials) ? credentials.filter((c: any) => c.verificationStatus === 'verified').length : 0,
      pending: Array.isArray(credentials) ? credentials.filter((c: any) => c.verificationStatus === 'pending').length : 0,
      rejected: Array.isArray(credentials) ? credentials.filter((c: any) => c.verificationStatus === 'rejected').length : 0,
    };

    // Get active affiliations count
    const activeAffiliationsResult = await db
      .select({ count: count() })
      .from(doctorHospitalAffiliations)
      .where(
        and(
          eq(doctorHospitalAffiliations.doctorId, doctorId),
          eq(doctorHospitalAffiliations.status, 'active')
        )
      );
    const activeAffiliations = Number(activeAffiliationsResult[0]?.count || 0);
    
    // Get subscription usage (assignment and affiliation limits)
    let subscriptionUsage = null;
    const subscriptionResult = await db
      .select({
        planId: subscriptions.planId,
        status: subscriptions.status,
      })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, user.userId),
          eq(subscriptions.status, 'active')
        )
      )
      .limit(1);

    if (subscriptionResult.length > 0 && subscriptionResult[0].planId) {
      // Get plan features
      const planFeaturesResult = await db
        .select({
          maxAssignments: doctorPlanFeatures.maxAssignmentsPerMonth,
          maxAffiliations: doctorPlanFeatures.maxAffiliations,
        })
        .from(doctorPlanFeatures)
        .where(eq(doctorPlanFeatures.planId, subscriptionResult[0].planId))
        .limit(1);

      const maxAssignments = planFeaturesResult[0]?.maxAssignments ?? null;
      const maxAffiliations = planFeaturesResult[0]?.maxAffiliations ?? null;

      // Get current month assignment usage
      const currentMonth = new Date().toISOString().slice(0, 7);
      const assignmentUsageResult = await db
        .select()
        .from(doctorAssignmentUsage)
        .where(
          and(
            eq(doctorAssignmentUsage.doctorId, doctorId),
            eq(doctorAssignmentUsage.month, currentMonth)
          )
        )
        .limit(1);

      const assignmentUsed = assignmentUsageResult.length > 0 
        ? Number(assignmentUsageResult[0].count || 0)
        : 0;

      // Calculate assignment percentage
      const assignmentPercentage = maxAssignments === -1 || maxAssignments === null
        ? 0
        : Math.round((assignmentUsed / maxAssignments) * 100);

      // Calculate affiliation percentage
      const affiliationPercentage = maxAffiliations === -1 || maxAffiliations === null
        ? 0
        : Math.round((activeAffiliations / maxAffiliations) * 100);

      subscriptionUsage = {
        assignments: {
          used: assignmentUsed,
          limit: maxAssignments,
          percentage: assignmentPercentage,
          remaining: maxAssignments === -1 || maxAssignments === null ? -1 : Math.max(0, maxAssignments - assignmentUsed),
        },
        affiliations: {
          used: activeAffiliations,
          limit: maxAffiliations,
          percentage: affiliationPercentage,
          remaining: maxAffiliations === -1 || maxAffiliations === null ? -1 : Math.max(0, maxAffiliations - activeAffiliations),
        },
      };
    }

    // Calculate profile completion
    let profileScore = 0;
    if (doctor.firstName && doctor.lastName) profileScore += 20;
    if (doctor.medicalLicenseNumber) profileScore += 15;
    if (doctor.yearsOfExperience) profileScore += 10;
    if (doctor.bio) profileScore += 15;
    // Check for location - either primaryLocation OR address components (fullAddress/city/state)
    if (doctor.primaryLocation || (doctor.fullAddress && doctor.city && doctor.state)) profileScore += 10;
    if (doctor.profilePhotoId) profileScore += 10;
    if (doctor.licenseVerificationStatus === 'verified') profileScore += 20;
    const profileCompletion = Math.min(profileScore, 100);

    return NextResponse.json({
      success: true,
      data: {
        totalAssignments,
        pendingAssignments,
        acceptedAssignments,
        completedAssignments,
        acceptanceRate,
        averageRating: Number(doctor.averageRating || 0),
        totalRatings: doctor.totalRatings || 0,
        totalEarnings,
        thisMonthEarnings,
        thisMonthAssignments,
        upcomingAssignments: upcomingSlots,
        upcomingSlots,
        upcomingAssignmentsList: upcomingAssignments,
        actionRequiredAssignments: actionRequiredAssignments,
        profileCompletion,
        credentials: credentialsStats,
        activeAffiliations,
        todayAssignments,
        licenseVerificationStatus: doctor.licenseVerificationStatus,
        subscriptionUsage,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);

