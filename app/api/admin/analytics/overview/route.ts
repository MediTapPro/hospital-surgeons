import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * @swagger
 * /api/admin/analytics/overview:
 *   get:
 *     summary: Get analytics overview (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: months
 *         schema:
 *           type: integer
 *           default: 12
 *         description: Number of months to analyze
 *     responses:
 *       200:
 *         description: Analytics overview retrieved successfully
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
 *                     totalUsers:
 *                       type: integer
 *                     newUsers:
 *                       type: integer
 *                     totalAssignments:
 *                       type: integer
 *                     newAssignments:
 *                       type: integer
 *                     activeSubscriptions:
 *                       type: integer
 *                     totalRevenue:
 *                       type: number
 *       401:
 *         description: Unauthorized
 */
export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const searchParams = req.nextUrl.searchParams;
    const months = parseInt(searchParams.get('months') || '12');

    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    // Get overall statistics
    const stats = await db.execute(sql`
      SELECT 
        (SELECT COUNT(*)::int FROM users) as total_users,
        (SELECT COUNT(*)::int FROM users WHERE created_at >= ${startDate.toISOString()}) as new_users,
        (SELECT COUNT(*)::int FROM assignments) as total_assignments,
        (SELECT COUNT(*)::int FROM assignments WHERE requested_at >= ${startDate.toISOString()}) as new_assignments,
        (SELECT COUNT(*)::int FROM subscriptions WHERE status = 'active') as active_subscriptions,
        (SELECT COALESCE(SUM(amount)::bigint, 0) FROM payment_transactions WHERE status = 'success' AND created_at >= ${startDate.toISOString()}) as total_revenue
    `);

    const row = stats.rows[0] as any;

    // Calculate growth percentages
    const previousPeriodStart = new Date(startDate);
    previousPeriodStart.setMonth(previousPeriodStart.getMonth() - months);

    const previousStats = await db.execute(sql`
      SELECT 
        (SELECT COUNT(*)::int FROM users WHERE created_at >= ${previousPeriodStart.toISOString()} AND created_at < ${startDate.toISOString()}) as previous_users,
        (SELECT COUNT(*)::int FROM assignments WHERE requested_at >= ${previousPeriodStart.toISOString()} AND requested_at < ${startDate.toISOString()}) as previous_assignments
    `);

    const prevRow = previousStats.rows[0] as any;
    const userGrowth = prevRow.previous_users > 0 
      ? ((row.new_users - prevRow.previous_users) / prevRow.previous_users) * 100 
      : 0;
    const assignmentGrowth = prevRow.previous_assignments > 0
      ? ((row.new_assignments - prevRow.previous_assignments) / prevRow.previous_assignments) * 100
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        totalUsers: row.total_users || 0,
        newUsers: row.new_users || 0,
        userGrowth: Math.round(userGrowth * 100) / 100,
        totalAssignments: row.total_assignments || 0,
        newAssignments: row.new_assignments || 0,
        assignmentGrowth: Math.round(assignmentGrowth * 100) / 100,
        activeSubscriptions: row.active_subscriptions || 0,
        totalRevenue: Number(row.total_revenue || 0) / 100, // Convert from cents
      },
    });
  } catch (error) {
    console.error('Error fetching analytics overview:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch analytics overview',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}





