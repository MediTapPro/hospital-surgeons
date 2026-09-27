import { AdminAuditLogsRepository, type AuditLogQuery } from '@/lib/repositories/admin-audit-logs.repository';

export class AdminAuditLogsService {
  constructor(private readonly repository = new AdminAuditLogsRepository()) {}
  private format(log: any) { return { id: log.id, userId: log.userId, userEmail: log.userEmail, userRole: log.userRole, actorType: log.actorType, action: log.action, entityType: log.entityType, entityId: log.entityId, details: log.details, createdAt: log.createdAt }; }
  async list(query: AuditLogQuery) { const result = await this.repository.list(query); return { data: result.rows.map((row: any) => this.format(row)), total: result.total }; }
  async getById(id: string) { const row = await this.repository.findById(id); return row ? this.format(row) : null; }
  async export(query: AuditLogQuery) { return (await this.repository.export(query)).map((row: any) => this.format(row)); }
}
