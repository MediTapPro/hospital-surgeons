import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { doctors, subscriptions, subscriptionPlans, doctorPlanFeatures, doctorAssignmentUsage } from '@/src/db/drizzle/migrations/schema';
import { eq, and, lte, gt, sql } from 'drizzle-orm';
import { getMaxAssignmentsForDoctor, DEFAULT_ASSIGNMENT_LIMIT } from '@/lib/config/subscription-limits';

/**
 * @swagger
 * /api/doctors/{id}/assignment-usage:
 *   get:
 *     summary: Get assignment usage statistics for a doctor
 *     tags: [Doctors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Doctor ID
 *     responses:
 *       200:
 *         description: Assignment usage retrieved successfully
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
 *                     used:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *       404:
 *         description: Doctor not found
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const doctorId = params.id;
    const db = getDb();

    // Get doctor's userId
    const doctor = await db
      .select({ userId: doctors.userId })
      .from(doctors)
      .where(eq(doctors.id, doctorId))
      .limit(1);

    if (doctor.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Doctor not found' },
        { status: 404 }
      );
    }

    // Get active subscription with plan for display
    const subscription = await db
      .select({
        plan: {
          tier: subscriptionPlans.tier,
          name: subscriptionPlans.name,
        },
      })
      .from(subscriptions)
      .leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
      .where(
        and(
          eq(subscriptions.userId, doctor[0].userId),
          eq(subscriptions.status, 'active')
        )
      )
      .limit(1);

    // Get max assignments from database (queries doctorPlanFeatures.maxAssignmentsPerMonth)
    const maxAssignments = await getMaxAssignmentsForDoctor(doctor[0].userId);
    const planName = subscription.length > 0 && subscription[0].plan 
      ? subscription[0].plan.name 
      : 'Free Plan';

    // Get current period usage record via subscription period
    const activeSub = await db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, doctor[0].userId),
          eq(subscriptions.status, 'active')
        )
      )
      .limit(1);

    let usageData: any = { count: 0, limitCount: maxAssignments, periodEnd: null };

    if (activeSub.length > 0) {
      const usage = await db
        .select()
        .from(doctorAssignmentUsage)
        .where(
          and(
            eq(doctorAssignmentUsage.doctorId, doctorId),
            eq(doctorAssignmentUsage.subscriptionId, activeSub[0].id),
            lte(doctorAssignmentUsage.periodStart, sql`NOW()`),
            gt(doctorAssignmentUsage.periodEnd, sql`NOW()`)
          )
        )
        .limit(1);

      if (usage.length > 0) {
        usageData = usage[0];
      }
    }

    // Calculate percentage (skip if unlimited)
    const percentage = maxAssignments === -1 
      ? 0 
      : Math.round((usageData.count / maxAssignments) * 100);

    // Calculate status
    let status: 'ok' | 'warning' | 'critical' | 'reached' = 'ok';
    if (maxAssignments !== -1) {
      if (usageData.count >= maxAssignments) {
        status = 'reached';
      } else if (percentage >= 80) {
        status = 'critical';
      } else if (percentage >= 60) {
        status = 'warning';
      }
    }

    const resetDate = usageData.periodEnd
      ? new Date(usageData.periodEnd).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    return NextResponse.json({
      success: true,
      data: {
        used: usageData.count,
        limit: maxAssignments,
        percentage,
        status,
        resetDate,
        remaining: maxAssignments === -1 ? -1 : Math.max(0, maxAssignments - usageData.count),
        plan: planName,
      },
    });
  } catch (error) {
    console.error('Error fetching assignment usage:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch usage', error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}



