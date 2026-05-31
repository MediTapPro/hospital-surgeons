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

    // Assignment trends
    const trends = await db.execute(sql`
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

    // Assignments by status
    const byStatus = await db.execute(sql`
      SELECT 
        status,
        COUNT(*)::int as count
      FROM assignments
      GROUP BY status
    `);

    // Assignments by priority
    const byPriority = await db.execute(sql`
      SELECT 
        priority,
        COUNT(*)::int as count
      FROM assignments
      GROUP BY priority
    `);

    return NextResponse.json({
      success: true,
      data: {
        trends: (trends.rows || []).map((row: any) => ({
          month: row.month,
          monthNum: row.month_num,
          year: row.year,
          count: row.count || 0,
        })),
        byStatus: (byStatus.rows || []).map((row: any) => ({
          status: row.status,
          count: row.count || 0,
        })),
        byPriority: (byPriority.rows || []).map((row: any) => ({
          priority: row.priority,
          count: row.count || 0,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching assignment analytics:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch assignment analytics',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}





