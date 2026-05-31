import { getDb } from '@/lib/db';
import { auditLogs } from '@/src/db/drizzle/migrations/schema';

interface AuditLogData {
  userId?: string | null;
  actorType: 'admin' | 'user' | 'system' | 'webhook';
  action: string;
  entityType: string;
  entityId?: string | null;
  entityName?: string | null;
  httpMethod?: string;
  endpoint?: string;
  ipAddress?: string;
  userAgent?: string;
  changes?: Record<string, { old: any; new: any }>;
  previousStatus?: string;
  newStatus?: string;
  reason?: string;
  notes?: string;
  details?: Record<string, any>;
}

/**
 * Centralized audit logger for all write operations
 * Logs asynchronously to avoid blocking main operations
 */
export async function createAuditLog(data: AuditLogData): Promise<void> {
  try {
    const db = getDb();

    // Build details object with all relevant information
    const details: Record<string, any> = {
      ...(data.details || {}),
      ...(data.changes && { changes: data.changes }),
      ...(data.previousStatus && { previousStatus: data.previousStatus }),
      ...(data.newStatus && { newStatus: data.newStatus }),
      ...(data.reason && { reason: data.reason }),
      ...(data.notes && { notes: data.notes }),
      ...(data.httpMethod && { httpMethod: data.httpMethod }),
      ...(data.endpoint && { endpoint: data.endpoint }),
      ...(data.ipAddress && { ipAddress: data.ipAddress }),
      ...(data.userAgent && { userAgent: data.userAgent }),
      ...(data.entityName && { entityName: data.entityName }),
      timestamp: new Date().toISOString(),
    };

    // Insert audit log asynchronously
    await db.insert(auditLogs).values({
      userId: data.userId || null,
      actorType: data.actorType,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId || null,
      details: details,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    // Log error but don't throw - audit logging should never break main operations
    console.error('Error creating audit log:', error);
  }
}

/**
 * Helper to extract request metadata
 */
export function getRequestMetadata(req: Request): {
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
} {
  const headers = req.headers;
  return {
    ipAddress: headers.get('x-forwarded-for') || headers.get('x-real-ip') || undefined,
    userAgent: headers.get('user-agent') || undefined,
    endpoint: new URL(req.url).pathname,
  };
}

/**
 * Helper to build changes object from old and new data
 */
export function buildChangesObject(
  oldData: Record<string, any>,
  newData: Record<string, any>,
  fieldsToTrack?: string[]
): Record<string, { old: any; new: any }> {
  const changes: Record<string, { old: any; new: any }> = {};
  const fields = fieldsToTrack || Object.keys(newData);

  for (const field of fields) {
    if (oldData[field] !== newData[field]) {
      changes[field] = {
        old: oldData[field],
        new: newData[field],
      };
    }
  }

  return changes;
}

