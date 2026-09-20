import { getDb } from '@/lib/db';
import { assignmentExpiryConfig } from '@/src/db/drizzle/migrations/schema';
import { eq } from 'drizzle-orm';
import type { AssignmentPriority } from '@/lib/enums/assignments.enums';

export class AssignmentExpiryRepository {
  constructor(private readonly db: any = getDb()) {}

  async list(tx?: any) {
    return (tx || this.db).select().from(assignmentExpiryConfig);
  }

  async upsert(priority: AssignmentPriority, expiryHours: number, isActive: boolean, tx?: any) {
    const [row] = await (tx || this.db)
      .insert(assignmentExpiryConfig)
      .values({ priority, expiryHours, isActive, updatedAt: new Date().toISOString() })
      .onConflictDoUpdate({
        target: assignmentExpiryConfig.priority,
        set: { expiryHours, isActive, updatedAt: new Date().toISOString() },
      })
      .returning();
    return row;
  }
}
