import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { 
  doctors,
  hospitals,
  subscriptions,
  assignments,
  supportTickets
} from '@/src/db/drizzle/migrations/schema';
import { eq, and, sql, lte, gte } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const alerts: any[] = [];

    // Alert 1: Pending verifications
    const pendingDoctorVerifications = await db.execute(sql`
      SELECT COUNT(*)::int as count
      FROM doctors
      WHERE license_verification_status = 'pending'
    `);

    const pendingHospitalVerifications = await db.execute(sql`
      SELECT COUNT(*)::int as count
      FROM hospitals
      WHERE license_verification_status = 'pending'
    `);

    const totalPendingVerifications = 
      Number(pendingDoctorVerifications.rows[0]?.count || 0) + 
      Number(pendingHospitalVerifications.rows[0]?.count || 0);

    if (totalPendingVerifications > 0) {
      alerts.push({
        id: 'pending-verifications',
        message: `${totalPendingVerifications} verification${totalPendingVerifications !== 1 ? 's' : ''} pending review`,
        priority: totalPendingVerifications > 5 ? 'high' : 'medium',
        time: 'Today',
        type: 'verification',
        count: totalPendingVerifications,
      });
    }

    // Alert 2: Expiring subscriptions (next 7 days)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const expiringSubscriptions = await db.execute(sql`
      SELECT COUNT(*)::int as count
      FROM subscriptions
      WHERE status = 'active'
        AND end_date >= ${tomorrow.toISOString()}
        AND end_date <= ${nextWeek.toISOString()}
    `);

    const expiringCount = Number(expiringSubscriptions.rows[0]?.count || 0);
    if (expiringCount > 0) {
      alerts.push({
        id: 'expiring-subscriptions',
        message: `${expiringCount} subscription plan${expiringCount !== 1 ? 's' : ''} expiring in the next 7 days`,
        priority: expiringCount > 10 ? 'high' : 'medium',
        time: 'This Week',
        type: 'subscription',
        count: expiringCount,
      });
    }

    // Alert 3: Expiring subscriptions tomorrow
    const tomorrowEnd = new Date();
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
    tomorrowEnd.setHours(23, 59, 59, 999);

    const expiringTomorrow = await db.execute(sql`
      SELECT COUNT(*)::int as count
      FROM subscriptions
      WHERE status = 'active'
        AND end_date >= ${tomorrow.toISOString()}
        AND end_date <= ${tomorrowEnd.toISOString()}
    `);

    const expiringTomorrowCount = Number(expiringTomorrow.rows[0]?.count || 0);
    if (expiringTomorrowCount > 0) {
      alerts.push({
        id: 'expiring-tomorrow',
        message: `${expiringTomorrowCount} subscription plan${expiringTomorrowCount !== 1 ? 's' : ''} expiring tomorrow`,
        priority: 'high',
        time: 'Tomorrow',
        type: 'subscription',
        count: expiringTomorrowCount,
      });
    }

    // Alert 4: High priority pending assignments
    const highPriorityAssignments = await db.execute(sql`
      SELECT COUNT(*)::int as count
      FROM assignments
      WHERE status = 'pending'
        AND priority = 'high'
    `);

    const highPriorityCount = Number(highPriorityAssignments.rows[0]?.count || 0);
    if (highPriorityCount > 0) {
      alerts.push({
        id: 'high-priority-assignments',
        message: `${highPriorityCount} high priority assignment${highPriorityCount !== 1 ? 's' : ''} pending`,
        priority: 'high',
        time: 'Today',
        type: 'assignment',
        count: highPriorityCount,
      });
    }

    // Alert 5: Urgent support tickets
    const urgentTickets = await db.execute(sql`
      SELECT COUNT(*)::int as count
      FROM support_tickets
      WHERE status = 'open'
        AND priority = 'high'
    `);

    const urgentTicketsCount = Number(urgentTickets.rows[0]?.count || 0);
    if (urgentTicketsCount > 0) {
      alerts.push({
        id: 'urgent-tickets',
        message: `${urgentTicketsCount} urgent support ticket${urgentTicketsCount !== 1 ? 's' : ''} require attention`,
        priority: 'high',
        time: 'Today',
        type: 'support',
        count: urgentTicketsCount,
      });
    }

    // Alert 6: Overdue assignments (expired but not completed)
    const now = new Date();
    const overdueAssignments = await db.execute(sql`
      SELECT COUNT(*)::int as count
      FROM assignments
      WHERE status = 'pending'
        AND expires_at IS NOT NULL
        AND expires_at < ${now.toISOString()}
    `);

    const overdueCount = Number(overdueAssignments.rows[0]?.count || 0);
    if (overdueCount > 0) {
      alerts.push({
        id: 'overdue-assignments',
        message: `${overdueCount} assignment${overdueCount !== 1 ? 's' : ''} overdue`,
        priority: 'high',
        time: 'Today',
        type: 'assignment',
        count: overdueCount,
      });
    }

    // Alert 7: System maintenance (placeholder - can be configured)
    // This would typically come from a settings table or environment variable
    alerts.push({
      id: 'system-maintenance',
      message: 'System maintenance scheduled',
      priority: 'low',
      time: 'Tomorrow',
      type: 'system',
    });

    // Sort alerts by priority (high -> medium -> low)
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    alerts.sort((a, b) => (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) - (priorityOrder[a.priority as keyof typeof priorityOrder] || 0));

    return NextResponse.json({
      success: true,
      data: alerts,
    });
  } catch (error) {
    console.error('Error fetching dashboard alerts:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch dashboard alerts',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}



