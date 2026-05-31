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

    // Revenue by month
    const monthlyRevenue = await db.execute(sql`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') as month,
        EXTRACT(MONTH FROM DATE_TRUNC('month', created_at)) as month_num,
        EXTRACT(YEAR FROM DATE_TRUNC('month', created_at)) as year,
        COALESCE(SUM(amount)::bigint, 0) as revenue,
        COUNT(*)::int as transactions
      FROM payment_transactions
      WHERE status = 'success'
        AND created_at >= ${startDate.toISOString()}
        AND created_at <= ${endDate.toISOString()}
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY DATE_TRUNC('month', created_at) ASC
    `);

    // Revenue by plan (from subscriptions - using pricing)
    const revenueByPlan = await db.execute(sql`
      SELECT 
        sp.name as plan_name,
        sp.tier as plan_tier,
        COUNT(s.id)::int as subscription_count,
        COALESCE(SUM(pp.price)::bigint, 0) as total_revenue
      FROM subscriptions s
      JOIN subscription_plans sp ON s.plan_id = sp.id
      LEFT JOIN plan_pricing pp ON s.pricing_id = pp.id
      WHERE s.status = 'active'
      GROUP BY sp.id, sp.name, sp.tier
      ORDER BY total_revenue DESC
    `);

    // Payment transaction stats
    const transactionStats = await db.execute(sql`
      SELECT 
        status,
        COUNT(*)::int as count,
        COALESCE(SUM(amount)::bigint, 0) as total_amount
      FROM payment_transactions
      WHERE created_at >= ${startDate.toISOString()}
        AND created_at <= ${endDate.toISOString()}
      GROUP BY status
    `);

    return NextResponse.json({
      success: true,
      data: {
        monthly: (monthlyRevenue.rows || []).map((row: any) => ({
          month: row.month,
          monthNum: row.month_num,
          year: row.year,
          revenue: Number(row.revenue || 0) / 100, // Convert from cents
          transactions: row.transactions || 0,
        })),
        byPlan: (revenueByPlan.rows || []).map((row: any) => ({
          planName: row.plan_name,
          tier: row.plan_tier,
          subscriptionCount: row.subscription_count || 0,
          totalRevenue: Number(row.total_revenue || 0),
        })),
        transactionStats: (transactionStats.rows || []).map((row: any) => ({
          status: row.status,
          count: row.count || 0,
          totalAmount: Number(row.total_amount || 0) / 100,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching revenue analytics:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch revenue analytics',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}





