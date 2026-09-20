import { getDb } from '@/lib/db';
import { assignments, assignmentPayments, assignmentRatings, users } from '@/src/db/drizzle/migrations/schema';
import { eq } from 'drizzle-orm';
import { sql, type SQL } from 'drizzle-orm';

type DbClient = ReturnType<typeof getDb>;

export interface AdminAssignmentQuery {
  page: number;
  limit: number;
  status?: string;
  priority?: string;
  doctorId?: string;
  hospitalId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

const assignmentSelect = sql`SELECT
  a.*, h.name AS hospital_name,
  d.first_name AS doctor_first_name, d.last_name AS doctor_last_name,
  COALESCE(p.full_name, hv.recipient_name, pp.full_name) AS patient_name,
  p.date_of_birth AS patient_dob, p.gender AS patient_gender, p.phone AS patient_phone,
  p.medical_condition AS patient_condition,
  hv.address_label AS visit_address_label, hv.address_text AS visit_address,
  hv.recipient_phone, hv.recipient_relationship,
  u_h.email AS hospital_email, u_h.phone AS hospital_phone,
  u_d.email AS doctor_email, u_d.phone AS doctor_phone,
  CASE WHEN a.source = 'patient' THEN 'home_visit' ELSE 'hospital_assignment' END AS display_source
  FROM assignments a
  LEFT JOIN hospitals h ON h.id = a.hospital_id
  LEFT JOIN doctors d ON d.id = a.doctor_id
  LEFT JOIN patients p ON p.id = a.patient_id
  LEFT JOIN patient_profiles pp ON pp.id = a.patient_profile_id
  LEFT JOIN home_visit_details hv ON hv.assignment_id = a.id
  LEFT JOIN users u_h ON u_h.id = h.user_id
  LEFT JOIN users u_d ON u_d.id = d.user_id`;

export class AdminAssignmentsRepository {
  private readonly db = getDb();

  async list(query: AdminAssignmentQuery) {
    const where: SQL[] = [];
    if (query.status) where.push(sql`a.status = ${query.status}`);
    if (query.priority) where.push(sql`a.priority = ${query.priority}`);
    if (query.doctorId) where.push(sql`a.doctor_id = ${query.doctorId}`);
    if (query.hospitalId) where.push(sql`a.hospital_id = ${query.hospitalId}`);
    if (query.startDate) where.push(sql`a.requested_at >= ${query.startDate}`);
    if (query.endDate) where.push(sql`a.requested_at <= ${query.endDate}`);
    if (query.search) {
      const pattern = `%${query.search}%`;
      where.push(sql`(
        h.name ILIKE ${pattern} OR
        (d.first_name || ' ' || d.last_name) ILIKE ${pattern} OR
        p.full_name ILIKE ${pattern} OR pp.full_name ILIKE ${pattern} OR hv.recipient_name ILIKE ${pattern}
      )`);
    }
    const clause = where.length ? sql`WHERE ${sql.join(where, sql` AND `)}` : sql``;
    const sortMap: Record<string, SQL> = {
      requestedAt: sql`a.requested_at`, status: sql`a.status`, priority: sql`a.priority`,
      completedAt: sql`a.completed_at`, cancelledAt: sql`a.cancelled_at`,
    };
    const sort = sortMap[query.sortBy || 'requestedAt'] || sortMap.requestedAt;
    const direction = sql.raw(query.sortOrder === 'asc' ? 'ASC' : 'DESC');
    const offset = (query.page - 1) * query.limit;

    const count = await this.db.execute(sql`SELECT COUNT(*)::int AS count FROM assignments a
      LEFT JOIN hospitals h ON h.id = a.hospital_id
      LEFT JOIN doctors d ON d.id = a.doctor_id
      LEFT JOIN patients p ON p.id = a.patient_id
      LEFT JOIN patient_profiles pp ON pp.id = a.patient_profile_id
      LEFT JOIN home_visit_details hv ON hv.assignment_id = a.id ${clause}`);
    const rows = await this.db.execute(sql`${assignmentSelect} ${clause} ORDER BY ${sort} ${direction} LIMIT ${query.limit} OFFSET ${offset}`);
    return { rows: rows.rows as any[], total: Number((count.rows as any[])[0]?.count || 0) };
  }

  async findById(id: string) {
    const result = await this.db.execute(sql`${assignmentSelect} WHERE a.id = ${id}`);
    const row = (result.rows as any[])[0];
    if (!row) return null;
    const [rating] = await this.db.select().from(assignmentRatings).where(eq(assignmentRatings.assignmentId, id)).limit(1);
    const [payment] = await this.db.select().from(assignmentPayments).where(eq(assignmentPayments.assignmentId, id)).limit(1);
    const history = await this.db.execute(sql`SELECT id, action, details, created_at FROM audit_logs
      WHERE entity_type = 'assignment' AND entity_id = ${id} ORDER BY created_at DESC LIMIT 20`);
    return { row, rating: rating || null, payment: payment || null, history: history.rows as any[] };
  }

  async update(id: string, data: Record<string, unknown>, client: DbClient = this.db) {
    const [oldAssignment] = await client.select().from(assignments).where(eq(assignments.id, id)).limit(1);
    if (!oldAssignment) return null;
    const [updatedAssignment] = await client.update(assignments).set(data as any).where(eq(assignments.id, id)).returning();
    return { oldAssignment, updatedAssignment };
  }

  async stats() {
    const [byStatus, byPriority, today] = await Promise.all([
      this.db.execute(sql`SELECT status, COUNT(*)::int AS count FROM assignments GROUP BY status`),
      this.db.execute(sql`SELECT priority, COUNT(*)::int AS count FROM assignments GROUP BY priority`),
      this.db.execute(sql`SELECT COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'accepted')::int AS accepted,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
        COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled
        FROM assignments WHERE requested_at >= CURRENT_DATE AND requested_at < CURRENT_DATE + INTERVAL '1 day'`),
    ]);
    return { byStatus: byStatus.rows as any[], byPriority: byPriority.rows as any[], today: (today.rows as any[])[0] || {} };
  }
}
