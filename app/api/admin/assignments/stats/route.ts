import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { assignments } from '@/src/db/drizzle/migrations/schema';
import { sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const searchParams = req.nextUrl.searchParams;
    const months = parseInt(searchParams.get('months') || '6');

    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    // Get assignments by status
    const statusStats = await db.execute(sql`
      SELECT 
        status,
        COUNT(*)::int as count
      FROM assignments
      GROUP BY status
    `);

    // Get assignments by priority
    const priorityStats = await db.execute(sql`
      SELECT 
        priority,
        COUNT(*)::int as count
      FROM assignments
      GROUP BY priority
    `);

    // Get monthly assignment trends
    const monthlyTrends = await db.execute(sql`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', requested_at), 'Mon YYYY') as month,
        EXTRACT(MONTH FROM DATE_TRUNC('month', requested_at)) as month_num,
        EXTRACT(YEAR FROM DATE_TRUNC('month', requested_at)) as year,
        COUNT(*)::int as count
      FROM assignments
      WHERE requested_at >= ${startDate.toISOString()}
        AND requested_at <= ${endDate.toISOString()}
      GROUP BY DATE_TRUNC('month', requested_at)
      ORDER BY DATE_TRUNC('month', requested_at) ASC
    `);

    // Get today's assignments
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayStats = await db.execute(sql`
      SELECT 
        COUNT(*)::int as total,
        COUNT(CASE WHEN status = 'pending' THEN 1 END)::int as pending,
        COUNT(CASE WHEN status = 'accepted' THEN 1 END)::int as accepted,
        COUNT(CASE WHEN status = 'completed' THEN 1 END)::int as completed,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END)::int as cancelled
      FROM assignments
      WHERE requested_at >= ${today.toISOString()}
        AND requested_at <= ${todayEnd.toISOString()}
    `);

    return NextResponse.json({
      success: true,
      data: {
        byStatus: statusStats.rows.map((row: any) => ({
          status: row.status,
          count: row.count || 0,
        })),
        byPriority: priorityStats.rows.map((row: any) => ({
          priority: row.priority,
          count: row.count || 0,
        })),
        monthlyTrends: monthlyTrends.rows.map((row: any) => ({
          month: row.month,
          monthNum: row.month_num,
          year: row.year,
          count: row.count || 0,
        })),
        today: {
          total: todayStats.rows[0]?.total || 0,
          pending: todayStats.rows[0]?.pending || 0,
          accepted: todayStats.rows[0]?.accepted || 0,
          completed: todayStats.rows[0]?.completed || 0,
          cancelled: todayStats.rows[0]?.cancelled || 0,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching assignment stats:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch assignment statistics',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}





