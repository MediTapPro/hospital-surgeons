import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { 
  assignments,
  users,
  doctors,
  hospitals
} from '@/src/db/drizzle/migrations/schema';
import { eq, and, sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const searchParams = req.nextUrl.searchParams;
    const months = parseInt(searchParams.get('months') || '6');

    // Calculate date range (last N months)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    // Get assignment trends (monthly) using raw SQL
    const assignmentTrendsQuery = sql`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', requested_at), 'Mon') as month,
        EXTRACT(MONTH FROM DATE_TRUNC('month', requested_at)) as month_num,
        COUNT(*)::int as assignments
      FROM assignments
      WHERE requested_at >= ${startDate.toISOString()}
        AND requested_at <= ${endDate.toISOString()}
      GROUP BY DATE_TRUNC('month', requested_at)
      ORDER BY DATE_TRUNC('month', requested_at) ASC
    `;
    const assignmentTrends = await db.execute(assignmentTrendsQuery);

    // Get user growth trends (monthly - doctors and hospitals separately)
    const userGrowthTrendsQuery = sql`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') as month,
        EXTRACT(MONTH FROM DATE_TRUNC('month', created_at)) as month_num,
        COUNT(CASE WHEN role = 'doctor' THEN 1 END)::int as doctors,
        COUNT(CASE WHEN role = 'hospital' THEN 1 END)::int as hospitals
      FROM users
      WHERE created_at >= ${startDate.toISOString()}
        AND created_at <= ${endDate.toISOString()}
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY DATE_TRUNC('month', created_at) ASC
    `;
    const userGrowthTrends = await db.execute(userGrowthTrendsQuery);

    // Format assignment trends
    const formattedAssignmentTrends = (assignmentTrends.rows || []).map((row: any) => ({
      month: row.month,
      assignments: row.assignments || 0,
    }));

    // Format user growth trends
    const formattedUserGrowth = (userGrowthTrends.rows || []).map((row: any) => ({
      month: row.month,
      doctors: row.doctors || 0,
      hospitals: row.hospitals || 0,
    }));

    // Get assignment status distribution
    const assignmentStatusQuery = sql`
      SELECT 
        status,
        COUNT(*)::int as count
      FROM assignments
      GROUP BY status
    `;
    const assignmentStatusDistribution = await db.execute(assignmentStatusQuery);

    // Get user role distribution
    const userRoleQuery = sql`
      SELECT 
        role,
        COUNT(*)::int as count
      FROM users
      GROUP BY role
    `;
    const userRoleDistribution = await db.execute(userRoleQuery);

    return NextResponse.json({
      success: true,
      data: {
        assignmentTrends: formattedAssignmentTrends,
        userGrowthTrends: formattedUserGrowth,
        assignmentStatusDistribution: (assignmentStatusDistribution.rows || []).map((row: any) => ({
          status: row.status,
          count: row.count || 0,
        })),
        userRoleDistribution: (userRoleDistribution.rows || []).map((row: any) => ({
          role: row.role,
          count: row.count || 0,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard trends:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch dashboard trends',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

