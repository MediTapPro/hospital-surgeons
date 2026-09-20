import { getDb } from '@/lib/db';
import type { UserAccountStatus, UserRole } from '@/lib/enums/users.enums';
import { auditLogs, doctors, hospitals, patientProfiles, subscriptionPlans, subscriptions, users } from '@/src/db/drizzle/migrations/schema';
import { and, asc, count, desc, eq, like, or, sql } from 'drizzle-orm';

type UserListFilter = {
  page: number;
  limit: number;
  role?: UserRole;
  status?: UserAccountStatus;
  search?: string;
  sortBy: 'createdAt' | 'email' | 'status' | 'role' | 'id';
  sortOrder: 'asc' | 'desc';
};

export class AdminUsersRepository {
  constructor(private readonly db: any = getDb()) {}

  async listUsers(filter: UserListFilter) {
    const conditions: any[] = [];
    if (filter.role) conditions.push(eq(users.role, filter.role));
    if (filter.status) conditions.push(eq(users.status, filter.status));
    if (filter.search) {
      const searchPattern = `%${filter.search}%`;
      conditions.push(or(
        like(users.email, searchPattern),
        sql`EXISTS (SELECT 1 FROM doctors d WHERE d.user_id = users.id AND (d.first_name || ' ' || d.last_name) ILIKE ${searchPattern})`,
        sql`EXISTS (SELECT 1 FROM hospitals h WHERE h.user_id = users.id AND h.name ILIKE ${searchPattern})`,
        sql`EXISTS (SELECT 1 FROM patient_profiles pp WHERE pp.user_id = users.id AND pp.full_name ILIKE ${searchPattern})`,
      ));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const sortColumns = { createdAt: users.createdAt, email: users.email, status: users.status, role: users.role, id: users.id };
    const sortColumn = sortColumns[filter.sortBy];

    const [totalRows, counts, rows] = await Promise.all([
      this.db.select({ count: sql<number>`count(*)` }).from(users).where(where),
      this.db.select({ role: users.role, count: count() }).from(users).groupBy(users.role),
      this.db
        .select({
          id: users.id, email: users.email, role: users.role, status: users.status,
          subscriptionStatus: users.subscriptionStatus, subscriptionTier: users.subscriptionTier,
          emailVerified: users.emailVerified, phoneVerified: users.phoneVerified, phone: users.phone,
          lastLoginAt: users.lastLoginAt, createdAt: users.createdAt,
          doctorId: doctors.id, doctorFirstName: doctors.firstName, doctorLastName: doctors.lastName,
          doctorLicenseStatus: doctors.licenseVerificationStatus,
          hospitalId: hospitals.id, hospitalName: hospitals.name, hospitalLicenseStatus: hospitals.licenseVerificationStatus,
          patientProfileId: patientProfiles.id, patientFullName: patientProfiles.fullName,
          subscriptionPlanName: subscriptionPlans.name,
        })
        .from(users)
        .leftJoin(doctors, eq(users.id, doctors.userId))
        .leftJoin(hospitals, eq(users.id, hospitals.userId))
        .leftJoin(patientProfiles, eq(users.id, patientProfiles.userId))
        .leftJoin(subscriptions, and(eq(subscriptions.userId, users.id), eq(subscriptions.status, 'active')))
        .leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
        .where(where)
        .orderBy(filter.sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn))
        .limit(filter.limit)
        .offset((filter.page - 1) * filter.limit),
    ]);

    return { rows, total: Number(totalRows[0]?.count ?? 0), counts };
  }

  async getUserDetail(userId: string) {
    const [user] = await this.db
      .select({
        id: users.id, email: users.email, role: users.role, status: users.status,
        subscriptionStatus: users.subscriptionStatus, subscriptionTier: users.subscriptionTier,
        emailVerified: users.emailVerified, phoneVerified: users.phoneVerified, phone: users.phone,
        lastLoginAt: users.lastLoginAt, createdAt: users.createdAt, updatedAt: users.updatedAt,
        doctorId: doctors.id, doctorFirstName: doctors.firstName, doctorLastName: doctors.lastName,
        doctorLicenseNumber: doctors.medicalLicenseNumber, doctorLicenseStatus: doctors.licenseVerificationStatus,
        doctorYearsOfExperience: doctors.yearsOfExperience, doctorBio: doctors.bio,
        doctorAverageRating: doctors.averageRating, doctorTotalRatings: doctors.totalRatings,
        doctorCompletedAssignments: doctors.completedAssignments,
        hospitalId: hospitals.id, hospitalName: hospitals.name, hospitalType: hospitals.hospitalType,
        hospitalRegistrationNumber: hospitals.registrationNumber, hospitalLicenseStatus: hospitals.licenseVerificationStatus,
        hospitalAddress: hospitals.address, hospitalCity: hospitals.city, hospitalNumberOfBeds: hospitals.numberOfBeds,
        patientFullName: patientProfiles.fullName,
      })
      .from(users)
      .leftJoin(doctors, eq(users.id, doctors.userId))
      .leftJoin(hospitals, eq(users.id, hospitals.userId))
      .leftJoin(patientProfiles, eq(users.id, patientProfiles.userId))
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) return null;

    const [activeSubscription, recentAuditLogs] = await Promise.all([
      this.db
        .select({ id: subscriptions.id, planId: subscriptions.planId, planName: subscriptionPlans.name, tier: subscriptionPlans.tier, status: subscriptions.status, startDate: subscriptions.startDate, endDate: subscriptions.endDate, autoRenew: subscriptions.autoRenew })
        .from(subscriptions)
        .leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
        .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')))
        .limit(1),
      this.db.select().from(auditLogs).where(eq(auditLogs.userId, userId)).orderBy(desc(auditLogs.createdAt)).limit(10),
    ]);

    let assignmentStats = { total: 0, completed: 0, pending: 0, cancelled: 0 };
    if (user.role === 'doctor' && user.doctorId) {
      const result = await this.db.execute(sql`SELECT COUNT(*)::int AS total, COUNT(CASE WHEN status = 'completed' THEN 1 END)::int AS completed, COUNT(CASE WHEN status = 'pending' THEN 1 END)::int AS pending, COUNT(CASE WHEN status = 'cancelled' THEN 1 END)::int AS cancelled FROM assignments WHERE doctor_id = ${user.doctorId}`);
      assignmentStats = result.rows[0] ?? assignmentStats;
    }
    if (user.role === 'hospital' && user.hospitalId) {
      const result = await this.db.execute(sql`SELECT COUNT(*)::int AS total, COUNT(CASE WHEN status = 'completed' THEN 1 END)::int AS completed, COUNT(CASE WHEN status = 'pending' THEN 1 END)::int AS pending, COUNT(CASE WHEN status = 'cancelled' THEN 1 END)::int AS cancelled FROM assignments WHERE hospital_id = ${user.hospitalId}`);
      assignmentStats = result.rows[0] ?? assignmentStats;
    }

    return { user, activeSubscription: activeSubscription[0] ?? null, recentAuditLogs, assignmentStats };
  }

  async findUserById(userId: string) {
    const [user] = await this.db.select({ id: users.id, email: users.email, role: users.role, status: users.status }).from(users).where(eq(users.id, userId)).limit(1);
    return user ?? null;
  }

  async updateAccountStatus(userId: string, status: UserAccountStatus) {
    const [user] = await this.db.update(users).set({ status, updatedAt: new Date().toISOString() }).where(eq(users.id, userId)).returning({ id: users.id, status: users.status });
    return user ?? null;
  }

  async updateUserRole(userId: string, role: UserRole) {
    const [user] = await this.db.update(users).set({ role, updatedAt: new Date().toISOString() }).where(eq(users.id, userId)).returning({ id: users.id, role: users.role });
    return user ?? null;
  }

  async createAdminUser(email: string, passwordHash: string) {
    const [user] = await this.db
      .insert(users)
      .values({ email, passwordHash, role: 'admin', status: 'active' })
      .returning({ id: users.id, email: users.email, role: users.role, status: users.status, createdAt: users.createdAt });
    return user ?? null;
  }

  async findUserByEmail(email: string) {
    const [user] = await this.db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    return user ?? null;
  }

  async createUserAuditLog(values: { adminUserId: string; targetUserId: string; targetUserEmail: string; action: string; details: Record<string, unknown> }) {
    await this.db.insert(auditLogs).values({
      userId: values.adminUserId,
      actorType: 'admin',
      action: values.action,
      entityType: 'user',
      entityId: values.targetUserId,
      details: { userEmail: values.targetUserEmail, ...values.details },
      createdAt: new Date().toISOString(),
    });
  }
}
