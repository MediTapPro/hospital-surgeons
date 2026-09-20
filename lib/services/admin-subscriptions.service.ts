import { getDb } from '@/lib/db';
import { AdminSubscriptionsRepository, type AdminSubscriptionQuery } from '@/lib/repositories/admin-subscriptions.repository';
import { buildChangesObject, createAuditLog, type AuditLogData } from '@/lib/utils/audit-logger';

const formatSubscription = (sub: any, now?: Date) => {
  const isFreePlan = sub.plan_tier === 'free';
  return {
  id: sub.id,
  user: { id: sub.user_id, email: sub.user_email, role: sub.user_role },
  plan: { id: sub.plan_id, name: sub.plan_name, tier: sub.plan_tier, userRole: sub.plan_user_role, price: isFreePlan ? 0 : (sub.plan_price ? Number(sub.plan_price) : null), currency: 'INR' },
  status: sub.status,
  startDate: sub.start_date,
  endDate: sub.end_date,
  autoRenew: sub.auto_renew,
  createdAt: sub.created_at,
  updatedAt: sub.updated_at,
  ...(now && { daysUntilExpiry: Math.ceil((new Date(sub.end_date).getTime() - now.getTime()) / 86_400_000) }),
  };
};

export class AdminSubscriptionsService {
  private readonly repo = new AdminSubscriptionsRepository();

  async list(query: AdminSubscriptionQuery) {
    const result = await this.repo.list(query);
    return { data: result.rows.map((row) => formatSubscription(row)), total: result.total, summary: result.summary };
  }

  async get(id: string) {
    const row = await this.repo.findById(id);
    return row ? formatSubscription(row) : null;
  }

  async listExpiring(days: number, userRole?: 'doctor' | 'hospital') {
    const result = await this.repo.listExpiring(days, userRole);
    return result.rows.map((row) => formatSubscription(row, result.now));
  }

  async update(id: string, data: Record<string, unknown>, audit: Omit<AuditLogData, 'entityId' | 'details' | 'changes' | 'previousStatus' | 'newStatus'> & { details?: Record<string, any> }) {
    const db = getDb();
    return db.transaction(async (tx) => {
      const result = await this.repo.update(id, data, tx as any);
      if (!result) return null;
      const { oldSubscription, updatedSubscription, userEmail } = result;
      const changes = buildChangesObject(
        { status: oldSubscription.status, autoRenew: oldSubscription.autoRenew, endDate: oldSubscription.endDate },
        { status: updatedSubscription.status, autoRenew: updatedSubscription.autoRenew, endDate: updatedSubscription.endDate },
        ['status', 'autoRenew', 'endDate']
      );
      await createAuditLog({
        ...audit,
        entityId: id,
        entityName: `Subscription for ${userEmail}`,
        changes,
        previousStatus: oldSubscription.status,
        newStatus: updatedSubscription.status,
        details: { ...(audit.details || {}), userId: oldSubscription.userId, userEmail, planId: oldSubscription.planId },
      }, tx as any, { throwOnError: true });
      return updatedSubscription;
    });
  }
}
