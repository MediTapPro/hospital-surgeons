import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { 
  auditLogs,
  assignments,
  users,
  doctors,
  hospitals
} from '@/src/db/drizzle/migrations/schema';
import { desc, eq, sql, or } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10');

    const activities: any[] = [];

    // Get recent verifications from audit logs
    const recentVerificationsQuery = sql`
      SELECT 
        al.id,
        al.action,
        al.entity_type,
        al.entity_id,
        al.created_at,
        al.details,
        u.email as user_email,
        d.first_name || ' ' || d.last_name as doctor_name,
        h.name as hospital_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN doctors d ON al.entity_type = 'doctor' AND al.entity_id::text = d.id::text
      LEFT JOIN hospitals h ON al.entity_type = 'hospital' AND al.entity_id::text = h.id::text
      WHERE al.action IN ('verify', 'reject', 'verification_requested')
        AND al.entity_type IN ('doctor', 'hospital')
      ORDER BY al.created_at DESC
      LIMIT ${limit}
    `;
    const recentVerifications = await db.execute(recentVerificationsQuery);

    // Format verification activities
    (recentVerifications.rows || []).forEach((row: any) => {
      const doctorName = row.doctor_name || 'Unknown Doctor';
      const hospitalName = row.hospital_name || 'Unknown Hospital';
      
      activities.push({
        id: row.id,
        type: 'verification',
        message: row.action === 'verify' 
          ? `${row.entity_type === 'doctor' ? 'Dr. ' + doctorName : hospitalName} verified`
          : row.action === 'reject'
          ? `${row.entity_type === 'doctor' ? 'Dr. ' + doctorName : hospitalName} verification rejected`
          : `${row.entity_type === 'doctor' ? 'Dr. ' + doctorName : hospitalName} verification requested`,
        time: formatTimeAgo(new Date(row.created_at)),
        status: row.action === 'verify' ? 'success' : row.action === 'reject' ? 'rejected' : 'pending',
        entityType: row.entity_type,
        entityId: row.entity_id,
      });
    });

    // Get recent assignments
    const recentAssignments = await db
      .select({
        id: assignments.id,
        status: assignments.status,
        priority: assignments.priority,
        requestedAt: assignments.requestedAt,
        doctorFirstName: doctors.firstName,
        doctorLastName: doctors.lastName,
        hospitalName: hospitals.name,
      })
      .from(assignments)
      .leftJoin(doctors, eq(assignments.doctorId, doctors.id))
      .leftJoin(hospitals, eq(assignments.hospitalId, hospitals.id))
      .orderBy(desc(assignments.requestedAt))
      .limit(limit);

    // Format assignment activities
    recentAssignments.forEach((assignment) => {
      activities.push({
        id: assignment.id,
        type: 'assignment',
        message: assignment.status === 'completed'
          ? `Assignment completed by Dr. ${assignment.doctorFirstName} ${assignment.doctorLastName} at ${assignment.hospitalName}`
          : assignment.status === 'pending'
          ? `New assignment created: Dr. ${assignment.doctorFirstName} ${assignment.doctorLastName} at ${assignment.hospitalName}`
          : `Assignment ${assignment.status} at ${assignment.hospitalName}`,
        time: formatTimeAgo(new Date(assignment.requestedAt as string)),
        status: assignment.status === 'completed' ? 'success' : assignment.priority === 'high' ? 'urgent' : 'pending',
        priority: assignment.priority,
      });
    });

    // Get recent registrations
    const recentRegistrationsQuery = sql`
      SELECT 
        u.id,
        u.email,
        u.role,
        u.created_at,
        d.first_name || ' ' || d.last_name as doctor_name,
        h.name as hospital_name
      FROM users u
      LEFT JOIN doctors d ON u.id = d.user_id
      LEFT JOIN hospitals h ON u.id = h.user_id
      WHERE u.role IN ('doctor', 'hospital')
      ORDER BY u.created_at DESC
      LIMIT ${limit}
    `;
    const recentRegistrations = await db.execute(recentRegistrationsQuery);

    // Format registration activities
    (recentRegistrations.rows || []).forEach((row: any) => {
      activities.push({
        id: row.id,
        type: 'registration',
        message: `New ${row.role} registration: ${row.role === 'doctor' ? 'Dr. ' + row.doctor_name : row.hospital_name}`,
        time: formatTimeAgo(new Date(row.created_at)),
        status: 'pending',
        role: row.role,
      });
    });

    // Get recent subscription activations using raw SQL
    const recentSubscriptionsQuery = sql`
      SELECT 
        s.id,
        s.status,
        s.start_date,
        sp.name as plan_name,
        u.email as user_name
      FROM subscriptions s
      LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
      LEFT JOIN users u ON s.user_id = u.id
      ORDER BY s.created_at DESC
      LIMIT ${limit}
    `;
    const recentSubscriptions = await db.execute(recentSubscriptionsQuery);

    // Format subscription activities
    (recentSubscriptions.rows || []).forEach((sub: any) => {
      activities.push({
        id: sub.id,
        type: 'subscription',
        message: `${sub.status === 'active' ? 'Premium plan activated' : 'Subscription ' + sub.status} for ${sub.user_name}`,
        time: formatTimeAgo(new Date(sub.start_date)),
        status: sub.status === 'active' ? 'success' : 'pending',
      });
    });

    // Sort all activities by time (most recent first) and limit
    activities.sort((a, b) => {
      const timeA = parseTimeAgo(a.time);
      const timeB = parseTimeAgo(b.time);
      return timeB - timeA;
    });

    return NextResponse.json({
      success: true,
      data: activities.slice(0, limit),
    });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch recent activity',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return `${diffInSeconds} sec${diffInSeconds !== 1 ? 's' : ''} ago`;
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} min${diffInMinutes !== 1 ? 's' : ''} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  return `${diffInWeeks} week${diffInWeeks !== 1 ? 's' : ''} ago`;
}

function parseTimeAgo(timeStr: string): number {
  const now = new Date().getTime();
  const match = timeStr.match(/(\d+)\s*(sec|min|hour|day|week)s?\s*ago/);
  
  if (!match) return now;
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  let milliseconds = 0;
  switch (unit) {
    case 'sec':
      milliseconds = value * 1000;
      break;
    case 'min':
      milliseconds = value * 60 * 1000;
      break;
    case 'hour':
      milliseconds = value * 60 * 60 * 1000;
      break;
    case 'day':
      milliseconds = value * 24 * 60 * 60 * 1000;
      break;
    case 'week':
      milliseconds = value * 7 * 24 * 60 * 60 * 1000;
      break;
  }
  
  return now - milliseconds;
}

