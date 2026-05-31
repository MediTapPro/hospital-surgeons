import { getDb } from '@/lib/db';
import {
  users,
  doctors,
  hospitals,
  assignments,
  subscriptions,
  supportTickets,
  auditLogs,
} from '@/src/db/drizzle/migrations/schema';
import { eq, and, count, sql, desc } from 'drizzle-orm';

export class AdminDashboardRepository {
  private db = getDb();

  async getStats() {
    const activeDoctorsResult = await this.db
      .select({ count: count() })
      .from(doctors)
      .innerJoin(users, eq(doctors.userId, users.id))
      .where(eq(users.status, 'active'));

    const activeHospitalsResult = await this.db
      .select({ count: count() })
      .from(hospitals)
      .innerJoin(users, eq(hospitals.userId, users.id))
      .where(eq(users.status, 'active'));

    const pendingDoctorVerificationsResult = await this.db
      .select({ count: count() })
      .from(doctors)
      .where(eq(doctors.licenseVerificationStatus, 'pending'));

    const pendingHospitalVerificationsResult = await this.db
      .select({ count: count() })
      .from(hospitals)
      .where(eq(hospitals.licenseVerificationStatus, 'pending'));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    const todayAssignmentsResult = await this.db
      .select({ count: count() })
      .from(assignments)
      .where(sql`DATE(${assignments.requestedAt}) = DATE(${todayStr})`);

    const activeSubscriptionsResult = await this.db
      .select({ count: count() })
      .from(subscriptions)
      .where(eq(subscriptions.status, 'active'));

    const openTicketsResult = await this.db
      .select({ count: count() })
      .from(supportTickets)
      .where(eq(supportTickets.status, 'open'));

    const totalUsersResult = await this.db
      .select({ count: count() })
      .from(users);

    const pendingUsersResult = await this.db
      .select({ count: count() })
      .from(users)
      .where(eq(users.status, 'pending'));

    const suspendedUsersResult = await this.db
      .select({ count: count() })
      .from(users)
      .where(eq(users.status, 'suspended'));

    const totalDoctorsResult = await this.db
      .select({ count: count() })
      .from(users)
      .where(eq(users.role, 'doctor'));

    const totalHospitalsResult = await this.db
      .select({ count: count() })
      .from(users)
      .where(eq(users.role, 'hospital'));

    const totalAdminsResult = await this.db
      .select({ count: count() })
      .from(users)
      .where(eq(users.role, 'admin'));

    const activeUsersResult = await this.db
      .select({ count: count() })
      .from(users)
      .where(eq(users.status, 'active'));

    return {
      activeDoctors: activeDoctorsResult[0]?.count || 0,
      activeHospitals: activeHospitalsResult[0]?.count || 0,
      pendingVerifications:
        (pendingDoctorVerificationsResult[0]?.count || 0) +
        (pendingHospitalVerificationsResult[0]?.count || 0),
      todayAssignments: todayAssignmentsResult[0]?.count || 0,
      activeSubscriptions: activeSubscriptionsResult[0]?.count || 0,
      openTickets: openTicketsResult[0]?.count || 0,
      totalUsers: totalUsersResult[0]?.count || 0,
      pendingUsers: pendingUsersResult[0]?.count || 0,
      suspendedUsers: suspendedUsersResult[0]?.count || 0,
      totalDoctors: totalDoctorsResult[0]?.count || 0,
      totalHospitals: totalHospitalsResult[0]?.count || 0,
      totalAdmins: totalAdminsResult[0]?.count || 0,
      activeUsers: activeUsersResult[0]?.count || 0,
    };
  }

  async getRecentActivity(limit: number = 10) {
    const recentVerifications = await this.db.execute(sql`
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
    `);

    const recentAssignments = await this.db
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

    const recentRegistrations = await this.db.execute(sql`
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
    `);

    const recentSubscriptions = await this.db.execute(sql`
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
    `);

    return {
      verifications: recentVerifications.rows || [],
      assignments: recentAssignments,
      registrations: recentRegistrations.rows || [],
      subscriptions: recentSubscriptions.rows || [],
    };
  }

  async getAlerts() {
    const pendingDoctorVerifications = await this.db.execute(sql`
      SELECT COUNT(*)::int as count
      FROM doctors
      WHERE license_verification_status = 'pending'
    `);

    const pendingHospitalVerifications = await this.db.execute(sql`
      SELECT COUNT(*)::int as count
      FROM hospitals
      WHERE license_verification_status = 'pending'
    `);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const expiringSubscriptions = await this.db.execute(sql`
      SELECT COUNT(*)::int as count
      FROM subscriptions
      WHERE status = 'active'
        AND end_date >= ${tomorrow.toISOString()}
        AND end_date <= ${nextWeek.toISOString()}
    `);

    const tomorrowEnd = new Date();
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
    tomorrowEnd.setHours(23, 59, 59, 999);

    const expiringTomorrow = await this.db.execute(sql`
      SELECT COUNT(*)::int as count
      FROM subscriptions
      WHERE status = 'active'
        AND end_date >= ${tomorrow.toISOString()}
        AND end_date <= ${tomorrowEnd.toISOString()}
    `);

    const highPriorityAssignments = await this.db.execute(sql`
      SELECT COUNT(*)::int as count
      FROM assignments
      WHERE status = 'pending'
        AND priority = 'high'
    `);

    const urgentTickets = await this.db.execute(sql`
      SELECT COUNT(*)::int as count
      FROM support_tickets
      WHERE status = 'open'
        AND priority = 'high'
    `);

    const now = new Date();
    const overdueAssignments = await this.db.execute(sql`
      SELECT COUNT(*)::int as count
      FROM assignments
      WHERE status = 'pending'
        AND expires_at IS NOT NULL
        AND expires_at < ${now.toISOString()}
    `);

    return {
      pendingDoctorVerifications: Number(pendingDoctorVerifications.rows[0]?.count || 0),
      pendingHospitalVerifications: Number(pendingHospitalVerifications.rows[0]?.count || 0),
      expiringSubscriptions: Number(expiringSubscriptions.rows[0]?.count || 0),
      expiringTomorrow: Number(expiringTomorrow.rows[0]?.count || 0),
      highPriorityAssignments: Number(highPriorityAssignments.rows[0]?.count || 0),
      urgentTickets: Number(urgentTickets.rows[0]?.count || 0),
      overdueAssignments: Number(overdueAssignments.rows[0]?.count || 0),
    };
  }

  async getTrends(months: number = 6) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const assignmentTrends = await this.db.execute(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', requested_at), 'Mon') as month,
        EXTRACT(MONTH FROM DATE_TRUNC('month', requested_at)) as month_num,
        COUNT(*)::int as assignments
      FROM assignments
      WHERE requested_at >= ${startDate.toISOString()}
        AND requested_at <= ${endDate.toISOString()}
      GROUP BY DATE_TRUNC('month', requested_at)
      ORDER BY DATE_TRUNC('month', requested_at) ASC
    `);

    const userGrowthTrends = await this.db.execute(sql`
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
    `);

    const assignmentStatusDistribution = await this.db.execute(sql`
      SELECT
        status,
        COUNT(*)::int as count
      FROM assignments
      GROUP BY status
    `);

    const userRoleDistribution = await this.db.execute(sql`
      SELECT
        role,
        COUNT(*)::int as count
      FROM users
      GROUP BY role
    `);

    return {
      assignmentTrends: (assignmentTrends.rows || []).map((row: any) => ({
        month: row.month,
        assignments: row.assignments || 0,
      })),
      userGrowthTrends: (userGrowthTrends.rows || []).map((row: any) => ({
        month: row.month,
        doctors: row.doctors || 0,
        hospitals: row.hospitals || 0,
      })),
      assignmentStatusDistribution: (assignmentStatusDistribution.rows || []).map((row: any) => ({
        status: row.status,
        count: row.count || 0,
      })),
      userRoleDistribution: (userRoleDistribution.rows || []).map((row: any) => ({
        role: row.role,
        count: row.count || 0,
      })),
    };
  }
}
