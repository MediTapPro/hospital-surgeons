import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { hospitals, subscriptions, subscriptionPlans, hospitalPlanFeatures, hospitalUsageTracking } from '@/src/db/drizzle/migrations/schema';
import { eq, and } from 'drizzle-orm';
import { getMaxAssignmentsForHospitalFromUser, DEFAULT_HOSPITAL_ASSIGNMENT_LIMIT } from '@/lib/config/hospital-subscription-limits';

/**
 * @swagger
 * /api/hospitals/{id}/assignment-usage:
 *   get:
 *     summary: Get hospital assignment usage for current month
 *     tags: [Hospitals]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Hospital ID
 *     responses:
 *       200:
 *         description: Assignment usage data
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
 *                       type: number
 *                     limit:
 *                       type: number
 *                     percentage:
 *                       type: number
 *                     status:
 *                       type: string
 *                       enum: [ok, warning, critical, reached]
 *                     resetDate:
 *                       type: string
 *                       format: date-time
 *                     remaining:
 *                       type: number
 *                     plan:
 *                       type: string
 *       404:
 *         description: Hospital not found
 *       500:
 *         description: Internal server error
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const hospitalId = params.id;
    const db = getDb();

    const currentMonth = new Date().toISOString().slice(0, 7); // "2024-03"

    // Get hospital's userId
    const hospital = await db
      .select({ userId: hospitals.userId })
      .from(hospitals)
      .where(eq(hospitals.id, hospitalId))
      .limit(1);

    if (hospital.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Hospital not found' },
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
          eq(subscriptions.userId, hospital[0].userId),
          eq(subscriptions.status, 'active')
        )
      )
      .limit(1);

    // Get max assignments from database (queries hospitalPlanFeatures.maxAssignmentsPerMonth)
    const maxAssignments = await getMaxAssignmentsForHospitalFromUser(hospital[0].userId);
    const planName = subscription.length > 0 && subscription[0].plan 
      ? subscription[0].plan.name 
      : 'Free Plan';

    // Get usage record
    const usage = await db
      .select()
      .from(hospitalUsageTracking)
      .where(
        and(
          eq(hospitalUsageTracking.hospitalId, hospitalId),
          eq(hospitalUsageTracking.month, currentMonth)
        )
      )
      .limit(1);

    const usageData = usage.length > 0 ? usage[0] : {
      assignmentsCount: 0,
      assignmentsLimit: maxAssignments,
      month: currentMonth,
    };

    // Calculate percentage (skip if unlimited)
    const percentage = maxAssignments === -1 
      ? 0 
      : Math.round((usageData.assignmentsCount / maxAssignments) * 100);

    // Calculate status
    let status: 'ok' | 'warning' | 'critical' | 'reached' = 'ok';
    if (maxAssignments !== -1) {
      if (usageData.assignmentsCount >= maxAssignments) {
        status = 'reached';
      } else if (percentage >= 80) {
        status = 'critical';
      } else if (percentage >= 60) {
        status = 'warning';
      }
    }

    // Calculate reset date (1st of next month)
    const resetDate = new Date();
    resetDate.setMonth(resetDate.getMonth() + 1);
    resetDate.setDate(1);
    resetDate.setHours(0, 0, 0, 0);

    return NextResponse.json({
      success: true,
      data: {
        used: usageData.assignmentsCount,
        limit: maxAssignments,
        percentage,
        status,
        resetDate: resetDate.toISOString(),
        remaining: maxAssignments === -1 ? -1 : Math.max(0, maxAssignments - usageData.assignmentsCount),
        plan: planName,
      },
    });
  } catch (error) {
    console.error('Error fetching hospital assignment usage:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch assignment usage', error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}


