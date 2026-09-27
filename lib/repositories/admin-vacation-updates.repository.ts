import { getDb } from '@/lib/db';
import { doctorLeaves } from '@/src/db/drizzle/migrations/schema';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';

export type VacationUpdateQuery = { page: number; limit: number; doctorId?: string; leaveType?: string; startDate?: string; endDate?: string };

export class AdminVacationUpdatesRepository {
  constructor(private readonly db: any = getDb()) {}
  private where(query: VacationUpdateQuery) {
    const conditions: any[] = [];
    if (query.doctorId) conditions.push(eq(doctorLeaves.doctorId, query.doctorId));
    if (query.leaveType) conditions.push(eq(doctorLeaves.leaveType, query.leaveType));
    if (query.startDate && query.endDate) conditions.push(sql`${doctorLeaves.startDate} <= ${query.endDate} AND ${doctorLeaves.endDate} >= ${query.startDate}`);
    else if (query.startDate) conditions.push(gte(doctorLeaves.endDate, query.startDate));
    else if (query.endDate) conditions.push(lte(doctorLeaves.startDate, query.endDate));
    return conditions.length ? and(...conditions) : undefined;
  }
  async list(query: VacationUpdateQuery) {
    const where = this.where(query);
    const [countResult, rows] = await Promise.all([
      this.db.select({ count: sql<number>`count(*)` }).from(doctorLeaves).where(where),
      this.db.select({ id: doctorLeaves.id, doctorId: doctorLeaves.doctorId, leaveType: doctorLeaves.leaveType, startDate: doctorLeaves.startDate, endDate: doctorLeaves.endDate, reason: doctorLeaves.reason, createdAt: doctorLeaves.createdAt, doctorFirstName: sql<string>`(SELECT first_name FROM doctors WHERE id = ${doctorLeaves.doctorId})`, doctorLastName: sql<string>`(SELECT last_name FROM doctors WHERE id = ${doctorLeaves.doctorId})` }).from(doctorLeaves).where(where).orderBy(desc(doctorLeaves.createdAt)).limit(query.limit).offset((query.page - 1) * query.limit),
    ]);
    return { rows, total: Number(countResult[0]?.count || 0) };
  }
}
