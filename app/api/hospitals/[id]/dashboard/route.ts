import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { patients, assignments, hospitals, subscriptions, subscriptionPlans, hospitalPlanFeatures, doctors, doctorSpecialties, specialties, doctorAvailability } from '@/src/db/drizzle/migrations/schema';
import { eq, and, gte, sql, count, desc, or, isNull, ne, asc } from 'drizzle-orm';

/**
 * @swagger
 * /api/hospitals/{id}/dashboard:
 *   get:
 *     summary: Get hospital dashboard metrics and data
 *     tags: [Hospitals]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Hospital ID
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
 *                     metrics:
 *                       type: object
 *                     todaysSchedule:
 *                       type: array
 *                     recentAssignments:
 *                       type: array
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const hospitalId = params.id;
    
    // Validate UUID format - return empty data for placeholder
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(hospitalId) || hospitalId === 'hospital-id-placeholder') {
      return NextResponse.json({
        success: true,
        data: {
          metrics: {
            totalPatients: { value: '0', change: '0%', trend: 'neutral' },
            activeAssignments: { value: '0', change: '0 pending', trend: 'neutral' },
            monthlyAssignments: { value: '0', change: '0%', trend: 'neutral' },
            subscriptionUsage: { value: '0', change: 'N/A', trend: 'neutral' },
          },
          todaysSchedule: [],
          pendingActions: [
            { type: 'unassigned', count: 0, message: 'Patients without assigned doctors', action: 'Assign Now' },
            { type: 'declined', count: 0, message: 'Declined assignments need reassignment', action: 'Find Doctor' },
            { type: 'expiring', count: 0, message: 'Assignments expiring soon', action: 'Send Reminder' },
          ],
        },
      });
    }
    
    const db = getDb();

    // Get current date range
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Calculate previous month range
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // Total Patients
    const totalPatientsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(patients)
      .where(eq(patients.hospitalId, hospitalId));
    const totalPatients = Number(totalPatientsResult[0]?.count || 0);
    
    // Total Patients - Previous Month (for percentage calculation)
    const totalPatientsPreviousMonthResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(patients)
      .where(
        and(
          eq(patients.hospitalId, hospitalId),
          gte(patients.createdAt, startOfPreviousMonth.toISOString()),
          sql`${patients.createdAt} < ${startOfMonth.toISOString()}`
        )
      );
    const totalPatientsPreviousMonth = Number(totalPatientsPreviousMonthResult[0]?.count || 0);
    
    // Calculate Total Patients percentage change
    let totalPatientsChange = '0%';
    let totalPatientsTrend: 'up' | 'down' | 'neutral' = 'neutral';
    if (totalPatientsPreviousMonth > 0) {
      const change = ((totalPatients - totalPatientsPreviousMonth) / totalPatientsPreviousMonth) * 100;
      totalPatientsChange = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
      totalPatientsTrend = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
    } else if (totalPatients > 0 && totalPatientsPreviousMonth === 0) {
      totalPatientsChange = 'New';
      totalPatientsTrend = 'up';
    }

    // Active Assignments (pending or accepted)
    const activeAssignmentsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(assignments)
      .where(
        and(
          eq(assignments.hospitalId, hospitalId),
          sql`${assignments.status} = ANY(ARRAY['pending', 'accepted'])`
        )
      );
    const activeAssignments = Number(activeAssignmentsResult[0]?.count || 0);

    // Pending Assignments
    const pendingAssignmentsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(assignments)
      .where(
        and(
          eq(assignments.hospitalId, hospitalId),
          eq(assignments.status, 'pending')
        )
      );
    const pendingAssignments = Number(pendingAssignmentsResult[0]?.count || 0);

    // Monthly Assignments
    const monthlyAssignmentsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(assignments)
      .where(
        and(
          eq(assignments.hospitalId, hospitalId),
          gte(assignments.requestedAt, startOfMonth.toISOString())
        )
      );
    const monthlyAssignments = Number(monthlyAssignmentsResult[0]?.count || 0);
    
    // Monthly Assignments - Previous Month (for percentage calculation)
    const monthlyAssignmentsPreviousMonthResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(assignments)
      .where(
        and(
          eq(assignments.hospitalId, hospitalId),
          gte(assignments.requestedAt, startOfPreviousMonth.toISOString()),
          sql`${assignments.requestedAt} < ${startOfMonth.toISOString()}`
        )
      );
    const monthlyAssignmentsPreviousMonth = Number(monthlyAssignmentsPreviousMonthResult[0]?.count || 0);
    
    // Calculate Monthly Assignments percentage change
    let monthlyAssignmentsChange = '0%';
    let monthlyAssignmentsTrend: 'up' | 'down' | 'neutral' = 'neutral';
    if (monthlyAssignmentsPreviousMonth > 0) {
      const change = ((monthlyAssignments - monthlyAssignmentsPreviousMonth) / monthlyAssignmentsPreviousMonth) * 100;
      monthlyAssignmentsChange = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
      monthlyAssignmentsTrend = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
    } else if (monthlyAssignments > 0 && monthlyAssignmentsPreviousMonth === 0) {
      monthlyAssignmentsChange = 'New';
      monthlyAssignmentsTrend = 'up';
    }

    // Get subscription info
    const hospital = await db
      .select({
        userId: hospitals.userId,
      })
      .from(hospitals)
      .where(eq(hospitals.id, hospitalId))
      .limit(1);

    let subscriptionUsage = null;
    let subscriptionLimit = null;
    let assignmentUsage = null;
    let assignmentLimit = null;
    let subscriptionUsageTrend: 'up' | 'down' | 'neutral' = 'neutral';
    let assignmentUsageTrend: 'up' | 'down' | 'neutral' = 'neutral';
    if (hospital[0]?.userId) {
      const subscriptionResult = await db
        .select({
          planId: subscriptions.planId,
          status: subscriptions.status,
        })
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.userId, hospital[0].userId),
            eq(subscriptions.status, 'active')
          )
        )
        .limit(1);

      if (subscriptionResult[0]?.planId) {
        const planFeaturesResult = await db
          .select({
            maxPatients: hospitalPlanFeatures.maxPatientsPerMonth,
            maxAssignments: hospitalPlanFeatures.maxAssignmentsPerMonth,
          })
          .from(hospitalPlanFeatures)
          .where(eq(hospitalPlanFeatures.planId, subscriptionResult[0].planId))
          .limit(1);

        subscriptionLimit = planFeaturesResult[0]?.maxPatients;
        assignmentLimit = planFeaturesResult[0]?.maxAssignments;
        
        // Count patients this month
        const patientsThisMonthResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(patients)
          .where(
            and(
              eq(patients.hospitalId, hospitalId),
              gte(patients.createdAt, startOfMonth.toISOString())
            )
          );
        subscriptionUsage = Number(patientsThisMonthResult[0]?.count || 0);

        // Count patients previous month (for trend)
        const patientsPreviousMonthResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(patients)
          .where(
            and(
              eq(patients.hospitalId, hospitalId),
              gte(patients.createdAt, startOfPreviousMonth.toISOString()),
              sql`${patients.createdAt} < ${startOfMonth.toISOString()}`
            )
          );
        const subscriptionUsagePreviousMonth = Number(patientsPreviousMonthResult[0]?.count || 0);
        if (subscriptionUsagePreviousMonth > 0) {
          subscriptionUsageTrend =
            subscriptionUsage > subscriptionUsagePreviousMonth
              ? 'up'
              : subscriptionUsage < subscriptionUsagePreviousMonth
                ? 'down'
                : 'neutral';
        } else if ((subscriptionUsage || 0) > 0 && subscriptionUsagePreviousMonth === 0) {
          subscriptionUsageTrend = 'up';
        }

        // Count assignments this month
        const assignmentsThisMonthResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(assignments)
          .where(
            and(
              eq(assignments.hospitalId, hospitalId),
              gte(assignments.requestedAt, startOfMonth.toISOString())
            )
          );
        assignmentUsage = Number(assignmentsThisMonthResult[0]?.count || 0);

        // Count assignments previous month (for trend)
        const assignmentsPreviousMonthResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(assignments)
          .where(
            and(
              eq(assignments.hospitalId, hospitalId),
              gte(assignments.requestedAt, startOfPreviousMonth.toISOString()),
              sql`${assignments.requestedAt} < ${startOfMonth.toISOString()}`
            )
          );
        const assignmentUsagePreviousMonth = Number(assignmentsPreviousMonthResult[0]?.count || 0);
        if (assignmentUsagePreviousMonth > 0) {
          assignmentUsageTrend =
            assignmentUsage > assignmentUsagePreviousMonth
              ? 'up'
              : assignmentUsage < assignmentUsagePreviousMonth
                ? 'down'
                : 'neutral';
        } else if ((assignmentUsage || 0) > 0 && assignmentUsagePreviousMonth === 0) {
          assignmentUsageTrend = 'up';
        }
      }
    }

    // Get today's schedule (assignments scheduled for today, not requested today)
    // Filter by slot_date from doctor_availability if available, otherwise by requestedAt
    // Use PostgreSQL's CURRENT_DATE to avoid timezone issues
    const todayScheduleResult = await db
      .select({
        id: assignments.id,
        doctorId: assignments.doctorId,
        patientId: assignments.patientId,
        status: assignments.status,
        priority: assignments.priority,
        consultationFee: assignments.consultationFee,
        requestedAt: assignments.requestedAt,
        expiresAt: assignments.expiresAt,
        actualStartTime: assignments.actualStartTime,
        availabilitySlotId: assignments.availabilitySlotId,
      })
      .from(assignments)
      .where(
        and(
          eq(assignments.hospitalId, hospitalId),
          sql`(
            EXISTS (
              SELECT 1 FROM doctor_availability da 
              WHERE da.id = ${assignments.availabilitySlotId} 
              AND DATE(da.slot_date) = CURRENT_DATE
            )
            OR (
              ${assignments.availabilitySlotId} IS NULL 
              AND DATE(${assignments.requestedAt}::timestamp) = CURRENT_DATE
            )
          )`
        )
      )
      .orderBy(desc(assignments.requestedAt))
      .limit(10);

    // Get additional details for each assignment
    const scheduleWithDetails = await Promise.all(
      todayScheduleResult.map(async (item) => {
        const [doctorResult] = await db
          .select({
            firstName: doctors.firstName,
            lastName: doctors.lastName,
          })
          .from(doctors)
          .where(eq(doctors.id, item.doctorId))
          .limit(1);

        const [patientResult] = await db
          .select({
            fullName: patients.fullName,
            medicalCondition: patients.medicalCondition,
          })
          .from(patients)
          .where(eq(patients.id, item.patientId))
          .limit(1);

        let slotTime = null;
        if (item.availabilitySlotId) {
          const [slotResult] = await db
            .select({
              startTime: doctorAvailability.startTime,
            })
            .from(doctorAvailability)
            .where(eq(doctorAvailability.id, item.availabilitySlotId))
            .limit(1);
          slotTime = slotResult?.startTime || null;
        }

        // Get specialty
        const [specialtyResult] = await db
          .select({
            specialtyName: specialties.name,
          })
          .from(doctorSpecialties)
          .innerJoin(specialties, eq(doctorSpecialties.specialtyId, specialties.id))
          .where(eq(doctorSpecialties.doctorId, item.doctorId))
          .limit(1);

        return {
          ...item,
          doctorFirstName: doctorResult?.firstName || '',
          doctorLastName: doctorResult?.lastName || '',
          patientName: patientResult?.fullName || '',
          patientCondition: patientResult?.medicalCondition || '',
          specialtyName: specialtyResult?.specialtyName || 'General',
          slotTime: slotTime ? formatTime(slotTime) : 'TBD',
          priority: item.priority || 'routine',
          consultationFee: item.consultationFee ? Number(item.consultationFee) : null,
        };
      })
    );

    // Get pending actions
    // Unassigned patients (patients without accepted or pending assignments)
    // This includes: patients with no assignments, or patients with only declined/cancelled assignments
    const unassignedPatientsResult = await db
      .select({ count: sql<number>`count(DISTINCT ${patients.id})` })
      .from(patients)
      .where(
        and(
          eq(patients.hospitalId, hospitalId),
          sql`NOT EXISTS (
            SELECT 1 FROM assignments a
            WHERE a.patient_id = ${patients.id}
            AND a.status IN ('accepted', 'pending')
          )`
        )
      );
    const unassignedCount = Number(unassignedPatientsResult[0]?.count || 0);

    // Declined assignments
    const declinedAssignmentsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(assignments)
      .where(
        and(
          eq(assignments.hospitalId, hospitalId),
          eq(assignments.status, 'declined')
        )
      );
    const declinedCount = Number(declinedAssignmentsResult[0]?.count || 0);

    // Expiring assignments (expires within 24 hours)
    const expiringAssignmentsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(assignments)
      .where(
        and(
          eq(assignments.hospitalId, hospitalId),
          eq(assignments.status, 'pending'),
          sql`${assignments.expiresAt} IS NOT NULL`,
          sql`${assignments.expiresAt} <= NOW() + INTERVAL '24 hours'`
        )
      );
    const expiringCount = Number(expiringAssignmentsResult[0]?.count || 0);

    // Note: availableSlots removed per request — this endpoint no longer
    // returns availableSlots. If needed in future, we can reintroduce a
    // dedicated endpoint for available slots with proper pagination/timezone handling.

    return NextResponse.json({
      success: true,
      data: {
        metrics: {
          totalPatients: {
            value: totalPatients.toString(),
            change: totalPatientsChange,
            trend: totalPatientsTrend,
          },
          activeAssignments: {
            value: activeAssignments.toString(),
            change: `${pendingAssignments} pending`,
            trend: 'neutral',
          },
          monthlyAssignments: {
            value: monthlyAssignments.toString(),
            change: monthlyAssignmentsChange,
            trend: monthlyAssignmentsTrend,
          },
        //   subscriptionUsage: {
        //     value: subscriptionUsage?.toString() || '0',
        //     change: subscriptionLimit ? (subscriptionLimit === -1 ? 'Unlimited' : `${subscriptionLimit} limit`) : 'N/A',
        //     trend: subscriptionUsageTrend,
        //   },
        //   assignmentUsage: {
        //     value: assignmentUsage?.toString() || '0',
        //     change: assignmentLimit ? (assignmentLimit === -1 ? 'Unlimited' : `${assignmentLimit} limit`) : 'N/A',
        //     trend: assignmentUsageTrend,
        //   },
        // },
        subscriptionUsage: {
          patients: {
            used: subscriptionUsage || 0,
            limit: subscriptionLimit ?? null,
            // trend: subscriptionUsageTrend,
          },
          assignments: {
            used: assignmentUsage || 0,
            limit: assignmentLimit ?? null,
            // trend: assignmentUsageTrend,
          },
        },
        },
        todaysSchedule: scheduleWithDetails.map((item) => ({
          id: item.id,
          time: item.slotTime || 'TBD',
          doctor: `Dr. ${item.doctorFirstName || ''} ${item.doctorLastName || ''}`.trim(),
          specialty: item.specialtyName || 'General',
          patient: item.patientName || 'Unknown',
          condition: item.patientCondition || 'N/A',
          status: item.status,
          priority: item.priority || 'routine',
          consultationFee: item.consultationFee || null,
          acceptedAt: item.status === 'accepted' && item.actualStartTime ? 'Accepted' : null,
          expiresIn: item.status === 'pending' && item.expiresAt ? calculateTimeUntil(item.expiresAt) : null,
        })),
        pendingActions: [
          {
            type: 'unassigned',
            count: unassignedCount,
            message: 'Patients without assigned doctors',
            action: 'Assign Now',
          },
          {
            type: 'declined',
            count: declinedCount,
            message: 'Declined assignments need reassignment',
            action: 'Find Doctor',
          },
          {
            type: 'expiring',
            count: expiringCount,
            message: 'Assignments expiring soon',
            action: 'Send Reminder',
          },
  ],
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch dashboard data',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

function calculateTimeUntil(expiresAt: string): string {
  const expires = new Date(expiresAt);
  const now = new Date();
  const diffMs = expires.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  return `${diffHours}h`;
}

function formatTime(timeString: string): string {
  if (!timeString) return 'TBD';
  // Convert HH:MM:SS to readable format
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${minutes} ${ampm}`;
}

