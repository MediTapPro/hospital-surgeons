import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { subscriptions, users, subscriptionPlans } from '@/src/db/drizzle/migrations/schema';
import { and, gte, lte, eq, sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const searchParams = req.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '7');

    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    // Get subscriptions expiring within the specified days
    const expiringSubscriptions = await db.execute(sql`
      SELECT 
        s.*,
        u.email as user_email,
        u.role as user_role,
        sp.name as plan_name,
        sp.tier as plan_tier,
        sp.user_role as plan_user_role,
        pp.price as plan_price,
        pp.currency as plan_currency
      FROM subscriptions s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
      LEFT JOIN plan_pricing pp ON s.pricing_id = pp.id
      WHERE s.status = 'active'
        AND s.end_date >= ${now.toISOString()}
        AND s.end_date <= ${futureDate.toISOString()}
      ORDER BY s.end_date ASC
    `);

    // Format response
    const formattedSubscriptions = (expiringSubscriptions.rows || []).map((sub: any) => ({
      id: sub.id,
      user: {
        id: sub.user_id,
        email: sub.user_email,
        role: sub.user_role,
      },
      plan: {
        id: sub.plan_id,
        name: sub.plan_name,
        tier: sub.plan_tier,
        userRole: sub.plan_user_role,
        price: sub.plan_price ? Number(sub.plan_price) : null,
        currency: sub.plan_currency,
      },
      status: sub.status,
      startDate: sub.start_date,
      endDate: sub.end_date,
      autoRenew: sub.auto_renew,
      daysUntilExpiry: Math.ceil((new Date(sub.end_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    }));

    return NextResponse.json({
      success: true,
      data: formattedSubscriptions,
      count: formattedSubscriptions.length,
    });
  } catch (error) {
    console.error('Error fetching expiring subscriptions:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch expiring subscriptions',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}





