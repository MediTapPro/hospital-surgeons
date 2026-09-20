import { getDb } from '@/lib/db';
import { subscriptions, users } from '@/src/db/drizzle/migrations/schema';
import { eq, sql, type SQL } from 'drizzle-orm';

type DbClient = ReturnType<typeof getDb>;

export interface AdminSubscriptionQuery {
  page: number;
  limit: number;
  status?: string;
  planId?: string;
  userId?: string;
  expiringSoon?: boolean;
  sortOrder?: 'asc' | 'desc';
}

export class AdminSubscriptionsRepository {
  private readonly db = getDb();

  async list(query: AdminSubscriptionQuery) {
    const { page, limit, status, planId, userId, expiringSoon, sortOrder = 'desc' } = query;
    const offset = (page - 1) * limit;
    const where: SQL[] = [];

    if (status) where.push(sql`s.status = ${status}`);
    if (planId) where.push(sql`s.plan_id = ${planId}`);
    if (userId) where.push(sql`s.user_id = ${userId}`);
    if (expiringSoon) {
      const future = new Date();
      future.setDate(future.getDate() + 7);
      where.push(sql`s.end_date >= ${new Date().toISOString()}`);
      where.push(sql`s.end_date <= ${future.toISOString()}`);
    }

    const clause = where.length ? sql`WHERE ${sql.join(where, sql` AND `)}` : sql``;
    const countResult = await this.db.execute(sql`SELECT COUNT(*)::int AS count FROM subscriptions s ${clause}`);
    const result = await this.db.execute(sql`SELECT s.*, u.email AS user_email, u.role AS user_role,
        sp.name AS plan_name, sp.tier AS plan_tier, sp.user_role AS plan_user_role,
        pp.price AS plan_price, pp.currency AS plan_currency
        FROM subscriptions s
        LEFT JOIN users u ON s.user_id = u.id
        LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
        LEFT JOIN plan_pricing pp ON s.pricing_id = pp.id
        ${clause}
        ORDER BY s.created_at ${sql.raw(sortOrder === 'asc' ? 'ASC' : 'DESC')}
        LIMIT ${limit} OFFSET ${offset}`);

    return { rows: result.rows as any[], total: Number((countResult.rows as any[])[0]?.count || 0) };
  }

  async findById(id: string, client: DbClient = this.db) {
    const result = await client.execute(sql`SELECT s.*, u.email AS user_email, u.role AS user_role,
        sp.name AS plan_name, sp.tier AS plan_tier, sp.user_role AS plan_user_role,
        pp.price AS plan_price, pp.currency AS plan_currency
        FROM subscriptions s
        LEFT JOIN users u ON s.user_id = u.id
        LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
        LEFT JOIN plan_pricing pp ON s.pricing_id = pp.id
        WHERE s.id = ${id}`);
    return (result.rows as any[])[0] || null;
  }

  async listExpiring(days: number) {
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + days);
    const result = await this.db.execute(sql`SELECT s.*, u.email AS user_email, u.role AS user_role,
        sp.name AS plan_name, sp.tier AS plan_tier, sp.user_role AS plan_user_role,
        pp.price AS plan_price, pp.currency AS plan_currency
        FROM subscriptions s
        LEFT JOIN users u ON s.user_id = u.id
        LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
        LEFT JOIN plan_pricing pp ON s.pricing_id = pp.id
        WHERE s.status = 'active' AND s.end_date >= ${now.toISOString()} AND s.end_date <= ${future.toISOString()}
        ORDER BY s.end_date ASC`);
    return { rows: result.rows as any[], now };
  }

  async update(id: string, data: Record<string, unknown>, client: DbClient = this.db) {
    const existing = await client.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1);
    if (!existing[0]) return null;
    const [updated] = await client.update(subscriptions).set(data as any).where(eq(subscriptions.id, id)).returning();
    const [user] = await client.select({ email: users.email }).from(users).where(eq(users.id, existing[0].userId)).limit(1);
    return { oldSubscription: existing[0], updatedSubscription: updated, userEmail: user?.email || null };
  }
}
