import { getDb } from '@/lib/db';
import { assignments, doctorAvailability } from '@/src/db/drizzle/migrations/schema';
import { and, desc, eq, gte, isNotNull, isNull, lte, sql } from 'drizzle-orm';

export type ScheduleUpdateQuery = { page: number; limit: number; doctorSearch?: string; slotType?: 'parent' | 'sub'; status?: string; startDate?: string; endDate?: string };

export class AdminScheduleUpdatesRepository {
  constructor(private readonly db: any = getDb()) {}

  private where(query: ScheduleUpdateQuery) {
    const conditions: any[] = [query.slotType === 'sub' ? isNotNull(doctorAvailability.parentSlotId) : isNull(doctorAvailability.parentSlotId)];
    if (query.doctorSearch) conditions.push(sql`EXISTS (SELECT 1 FROM doctors d WHERE d.id = ${doctorAvailability.doctorId} AND (d.first_name || ' ' || d.last_name) ILIKE ${`%${query.doctorSearch}%`})`);
    if (query.status) conditions.push(eq(doctorAvailability.status, query.status));
    if (query.startDate) conditions.push(gte(doctorAvailability.slotDate, query.startDate));
    if (query.endDate) conditions.push(lte(doctorAvailability.slotDate, query.endDate));
    return and(...conditions);
  }

  async list(query: ScheduleUpdateQuery) {
    const where = this.where(query);
    const [countResult, rows] = await Promise.all([
      this.db.select({ count: sql<number>`count(*)` }).from(doctorAvailability).where(where),
      this.db.select({ id: doctorAvailability.id, doctorId: doctorAvailability.doctorId, slotDate: doctorAvailability.slotDate, startTime: doctorAvailability.startTime, endTime: doctorAvailability.endTime, status: doctorAvailability.status, isManual: doctorAvailability.isManual, templateId: doctorAvailability.templateId, parentSlotId: doctorAvailability.parentSlotId, bookedByHospitalId: doctorAvailability.bookedByHospitalId, updatedAt: doctorAvailability.updatedAt, doctorFirstName: sql<string>`(SELECT first_name FROM doctors WHERE id = ${doctorAvailability.doctorId})`, doctorLastName: sql<string>`(SELECT last_name FROM doctors WHERE id = ${doctorAvailability.doctorId})`, hospitalName: sql<string | null>`(SELECT name FROM hospitals WHERE id = ${doctorAvailability.bookedByHospitalId})`, assignmentId: sql<string | null>`(SELECT id FROM assignments WHERE availability_slot_id = ${doctorAvailability.id} LIMIT 1)` }).from(doctorAvailability).where(where).orderBy(desc(doctorAvailability.updatedAt)).limit(query.limit).offset((query.page - 1) * query.limit),
    ]);
    return { total: Number(countResult[0]?.count || 0), rows };
  }

  async parentDetail(id: string) {
    const [parent] = await this.db.select({ id: doctorAvailability.id, doctorId: doctorAvailability.doctorId, slotDate: doctorAvailability.slotDate, startTime: doctorAvailability.startTime, endTime: doctorAvailability.endTime, status: doctorAvailability.status, isManual: doctorAvailability.isManual, templateId: doctorAvailability.templateId, updatedAt: doctorAvailability.updatedAt, doctorFirstName: sql<string>`(SELECT first_name FROM doctors WHERE id = ${doctorAvailability.doctorId})`, doctorLastName: sql<string>`(SELECT last_name FROM doctors WHERE id = ${doctorAvailability.doctorId})` }).from(doctorAvailability).where(and(eq(doctorAvailability.id, id), isNull(doctorAvailability.parentSlotId))).limit(1);
    if (!parent) return null;
    const subSlots = await this.db.select({ id: doctorAvailability.id, slotDate: doctorAvailability.slotDate, startTime: doctorAvailability.startTime, endTime: doctorAvailability.endTime, status: doctorAvailability.status, bookedByHospitalId: doctorAvailability.bookedByHospitalId, bookedAt: doctorAvailability.bookedAt, updatedAt: doctorAvailability.updatedAt, hospitalName: sql<string | null>`(SELECT name FROM hospitals WHERE id = ${doctorAvailability.bookedByHospitalId})`, assignmentId: sql<string | null>`(SELECT id FROM assignments WHERE availability_slot_id = ${doctorAvailability.id} LIMIT 1)`, assignmentStatus: sql<string | null>`(SELECT status FROM assignments WHERE availability_slot_id = ${doctorAvailability.id} LIMIT 1)` }).from(doctorAvailability).where(eq(doctorAvailability.parentSlotId, id)).orderBy(desc(doctorAvailability.startTime));
    return { parent, subSlots };
  }
}
