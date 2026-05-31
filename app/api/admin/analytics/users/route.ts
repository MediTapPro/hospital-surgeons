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

    // User growth over time
    const userGrowth = await db.execute(sql`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') as month,
        EXTRACT(MONTH FROM DATE_TRUNC('month', created_at)) as month_num,
        EXTRACT(YEAR FROM DATE_TRUNC('month', created_at)) as year,
        COUNT(*)::int as count
      FROM users
      WHERE created_at >= ${startDate.toISOString()}
        AND created_at <= ${endDate.toISOString()}
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY DATE_TRUNC('month', created_at) ASC
    `);

    // Users by role
    const usersByRole = await db.execute(sql`
      SELECT 
        role,
        COUNT(*)::int as count
      FROM users
      GROUP BY role
    `);

    // Active vs inactive users
    const activeInactive = await db.execute(sql`
      SELECT 
        status,
        COUNT(*)::int as count
      FROM users
      GROUP BY status
    `);

    return NextResponse.json({
      success: true,
      data: {
        growth: (userGrowth.rows || []).map((row: any) => ({
          month: row.month,
          monthNum: row.month_num,
          year: row.year,
          count: row.count || 0,
        })),
        byRole: (usersByRole.rows || []).map((row: any) => ({
          role: row.role,
          count: row.count || 0,
        })),
        byStatus: (activeInactive.rows || []).map((row: any) => ({
          status: row.status,
          count: row.count || 0,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching user analytics:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch user analytics',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}





