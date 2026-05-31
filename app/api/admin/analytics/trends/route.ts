import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const searchParams = req.nextUrl.searchParams;
    const months = parseInt(searchParams.get('months') || '12');

    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    // Combined trends: users, assignments, subscriptions, revenue
    const trends = await db.execute(sql`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', date_series), 'Mon YYYY') as month,
        EXTRACT(MONTH FROM DATE_TRUNC('month', date_series)) as month_num,
        EXTRACT(YEAR FROM DATE_TRUNC('month', date_series)) as year,
        COALESCE(user_count, 0)::int as users,
        COALESCE(assignment_count, 0)::int as assignments,
        COALESCE(subscription_count, 0)::int as subscriptions,
        COALESCE(revenue, 0)::bigint as revenue
      FROM generate_series(
        DATE_TRUNC('month', ${startDate.toISOString()}::timestamp),
        DATE_TRUNC('month', ${endDate.toISOString()}::timestamp),
        '1 month'::interval
      ) as date_series
      LEFT JOIN (
        SELECT 
          DATE_TRUNC('month', created_at) as month,
          COUNT(*)::int as user_count
        FROM users
        WHERE created_at >= ${startDate.toISOString()}
        GROUP BY DATE_TRUNC('month', created_at)
      ) u ON DATE_TRUNC('month', date_series) = u.month
      LEFT JOIN (
        SELECT 
          DATE_TRUNC('month', requested_at) as month,
          COUNT(*)::int as assignment_count
        FROM assignments
        WHERE requested_at >= ${startDate.toISOString()}
        GROUP BY DATE_TRUNC('month', requested_at)
      ) a ON DATE_TRUNC('month', date_series) = a.month
      LEFT JOIN (
        SELECT 
          DATE_TRUNC('month', created_at) as month,
          COUNT(*)::int as subscription_count
        FROM subscriptions
        WHERE created_at >= ${startDate.toISOString()}
        GROUP BY DATE_TRUNC('month', created_at)
      ) s ON DATE_TRUNC('month', date_series) = s.month
      LEFT JOIN (
        SELECT 
          DATE_TRUNC('month', created_at) as month,
          SUM(amount)::bigint as revenue
        FROM payment_transactions
        WHERE status = 'success'
          AND created_at >= ${startDate.toISOString()}
        GROUP BY DATE_TRUNC('month', created_at)
      ) r ON DATE_TRUNC('month', date_series) = r.month
      ORDER BY date_series ASC
    `);

    return NextResponse.json({
      success: true,
      data: (trends.rows || []).map((row: any) => ({
        month: row.month,
        monthNum: row.month_num,
        year: row.year,
        users: row.users || 0,
        assignments: row.assignments || 0,
        subscriptions: row.subscriptions || 0,
        revenue: Number(row.revenue || 0) / 100, // Convert from cents
      })),
    });
  } catch (error) {
    console.error('Error fetching trends:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch trends',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}





