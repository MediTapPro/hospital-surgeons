import { getDb } from '@/lib/db';
import { auditLogs, users } from '@/src/db/drizzle/migrations/schema';
import { and, asc, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';

export type AuditLogQuery = { page?: number; limit?: number; actorType?: string; action?: string; entityType?: string; userId?: string; search?: string; startDate?: string; endDate?: string; sortOrder?: 'asc' | 'desc' };

export class AdminAuditLogsRepository {
  constructor(private readonly db: any = getDb()) {}
  private where(query: AuditLogQuery) {
    const conditions: any[] = [];
    if (query.actorType) conditions.push(eq(auditLogs.actorType, query.actorType));
    if (query.action) conditions.push(eq(auditLogs.action, query.action));
    if (query.entityType) conditions.push(eq(auditLogs.entityType, query.entityType));
    if (query.userId) conditions.push(eq(auditLogs.userId, query.userId));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(or(ilike(auditLogs.action, term), ilike(auditLogs.entityType, term), ilike(users.email, term), sql`CAST(${auditLogs.details} AS TEXT) ILIKE ${term}`));
    }
    if (query.startDate) conditions.push(gte(auditLogs.createdAt, query.startDate));
    if (query.endDate) conditions.push(lte(auditLogs.createdAt, query.endDate));
    return conditions.length ? and(...conditions) : undefined;
  }
  async list(query: AuditLogQuery) {
    const where = this.where(query);
    const order = query.sortOrder === 'asc' ? asc(auditLogs.createdAt) : desc(auditLogs.createdAt);
    const [countResult, rows] = await Promise.all([
      this.db.select({ count: sql<number>`count(*)` }).from(auditLogs).leftJoin(users, eq(auditLogs.userId, users.id)).where(where),
      this.db.select({ id: auditLogs.id, userId: auditLogs.userId, actorType: auditLogs.actorType, action: auditLogs.action, entityType: auditLogs.entityType, entityId: auditLogs.entityId, details: auditLogs.details, createdAt: auditLogs.createdAt, userEmail: users.email, userRole: users.role }).from(auditLogs).leftJoin(users, eq(auditLogs.userId, users.id)).where(where).orderBy(order).limit(query.limit || 50).offset(((query.page || 1) - 1) * (query.limit || 50)),
    ]);
    return { rows, total: Number(countResult[0]?.count || 0) };
  }
  async findById(id: string) {
    const [row] = await this.db.select({ id: auditLogs.id, userId: auditLogs.userId, actorType: auditLogs.actorType, action: auditLogs.action, entityType: auditLogs.entityType, entityId: auditLogs.entityId, details: auditLogs.details, createdAt: auditLogs.createdAt, userEmail: users.email, userRole: users.role }).from(auditLogs).leftJoin(users, eq(auditLogs.userId, users.id)).where(eq(auditLogs.id, id)).limit(1);
    return row || null;
  }
  async export(query: AuditLogQuery) {
    const where = this.where(query);
    return this.db.select({ id: auditLogs.id, userId: auditLogs.userId, actorType: auditLogs.actorType, action: auditLogs.action, entityType: auditLogs.entityType, entityId: auditLogs.entityId, details: auditLogs.details, createdAt: auditLogs.createdAt, userEmail: users.email, userRole: users.role }).from(auditLogs).leftJoin(users, eq(auditLogs.userId, users.id)).where(where).orderBy(desc(auditLogs.createdAt));
  }
}
