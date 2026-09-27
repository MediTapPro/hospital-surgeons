import { getDb } from '@/lib/db';
import { AssignmentExpiryRepository } from '@/lib/repositories/assignment-expiry.repository';
import { ASSIGNMENT_PRIORITIES, type AssignmentPriority } from '@/lib/enums/assignments.enums';
import { createAuditLog, type AuditLogData } from '@/lib/utils/audit-logger';

const DEFAULTS = { routine: 24, urgent: 6, emergency: 1 } as const;

export class AssignmentExpiryService {
  private readonly repository = new AssignmentExpiryRepository();

  async getSettings() {
    try {
      const rows = await this.repository.list();
      return { success: true, data: ASSIGNMENT_PRIORITIES.map((priority) => rows.find((row: any) => row.priority === priority) || { priority, expiryHours: DEFAULTS[priority], isActive: true }) };
    } catch (error) {
      return { success: false, message: 'Failed to retrieve assignment expiry settings', error: error instanceof Error ? error.message : String(error) };
    }
  }

  async updateSettings(values: Array<{ priority: AssignmentPriority; expiryHours: number; isActive: boolean }>, actorId: string | null, requestMetadata?: Pick<AuditLogData, 'ipAddress' | 'userAgent' | 'endpoint'>) {
    if (!Array.isArray(values) || values.length !== ASSIGNMENT_PRIORITIES.length) return { success: false, message: 'All assignment priorities are required.' };
    for (const value of values) if (!ASSIGNMENT_PRIORITIES.includes(value.priority) || !Number.isInteger(value.expiryHours) || value.expiryHours < 1 || typeof value.isActive !== 'boolean') return { success: false, message: 'Expiry hours must be a whole number greater than zero.' };
    try {
      const db = getDb();
      let data: any[] = [];
      await db.transaction(async (tx: any) => {
        data = await Promise.all(values.map((value) => this.repository.upsert(value.priority, value.expiryHours, value.isActive, tx)));
        await createAuditLog({ userId: actorId, actorType: 'admin', action: 'update', entityType: 'assignment_expiry_config', details: { values }, ...requestMetadata }, tx, { throwOnError: true });
      });
      return { success: true, message: 'Assignment expiry settings updated successfully', data };
    } catch (error) {
      return { success: false, message: 'Failed to update assignment expiry settings', error: error instanceof Error ? error.message : String(error) };
    }
  }
}
