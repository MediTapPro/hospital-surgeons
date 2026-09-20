import { getDb } from '@/lib/db';
import { subscriptions, users } from '@/src/db/drizzle/migrations/schema';
import { eq, sql, type SQL } from 'drizzle-orm';

type DbClient = ReturnType<typeof getDb>;

export interface AdminSubscriptionQuery {
  page: number;
  limit: number;
  status?: string;
  userRole?: 'doctor' | 'hospital';
  planId?: string;
  userId?: string;
  expiringSoon?: boolean;
  sortOrder?: 'asc' | 'desc';
}

export class AdminSubscriptionsRepository {
  private readonly db = getDb();

  async list(query: AdminSubscriptionQuery) {
    const { page, limit, status, planId, userId, userRole, expiringSoon, sortOrder = 'desc' } = query;
    const offset = (page - 1) * limit;
    const where: SQL[] = [];

    if (status) where.push(sql`s.status = ${status}`);
    if (planId) where.push(sql`s.plan_id = ${planId}`);
    if (userId) where.push(sql`s.user_id = ${userId}`);
    if (userRole) where.push(sql`u.role = ${userRole}`);
    if (expiringSoon) {
      const future = new Date();
      future.setDate(future.getDate() + 7);
      where.push(sql`s.end_date >= ${new Date().toISOString()}`);
      where.push(sql`s.end_date <= ${future.toISOString()}`);
    }

    const clause = where.length ? sql`WHERE ${sql.join(where, sql` AND `)}` : sql``;
    const countResult = await this.db.execute(sql`SELECT COUNT(*)::int AS count FROM subscriptions s
      LEFT JOIN users u ON s.user_id = u.id ${clause}`);
    const result = await this.db.execute(sql`SELECT s.*, u.email AS user_email, u.role AS user_role,
        sp.name AS plan_name, sp.tier AS plan_tier, sp.user_role AS plan_user_role,
        pp.price AS plan_price, pp.currency AS plan_currency
        FROM subscriptions s
        LEFT JOIN users u ON s.user_id = u.id
        LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
        LEFT JOIN LATERAL (
          SELECT p.price, p.currency
          FROM plan_pricing p
          WHERE p.id = s.pricing_id
             OR (s.pricing_id IS NULL AND p.plan_id = s.plan_id AND p.is_active = true)
          ORDER BY CASE WHEN p.id = s.pricing_id THEN 0 WHEN p.billing_cycle = 'monthly' THEN 1 ELSE 2 END,
                   p.billing_period_months
          LIMIT 1
        ) pp ON true
        ${clause}
        ORDER BY s.created_at ${sql.raw(sortOrder === 'asc' ? 'ASC' : 'DESC')}
        LIMIT ${limit} OFFSET ${offset}`);

    const summaryWhere: SQL[] = [];
    if (query.userRole) summaryWhere.push(sql`u.role = ${query.userRole}`);
    if (query.planId) summaryWhere.push(sql`s.plan_id = ${query.planId}`);
    if (query.userId) summaryWhere.push(sql`s.user_id = ${query.userId}`);
    const summaryClause = summaryWhere.length ? sql`WHERE ${sql.join(summaryWhere, sql` AND `)}` : sql``;
    const summary = await this.db.execute(sql`SELECT
      COUNT(*) FILTER (WHERE s.status = 'active')::int AS active_count,
      COALESCE(SUM(CASE WHEN s.status = 'active' AND sp.tier <> 'free'
        THEN pp.price / GREATEST(COALESCE(NULLIF(s.billing_period_months, 0), pp.billing_period_months, 1), 1)
        ELSE 0 END), 0)::numeric AS monthly_revenue
      FROM subscriptions s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
      LEFT JOIN LATERAL (
        SELECT p.price, p.billing_period_months
        FROM plan_pricing p
        WHERE p.id = s.pricing_id
           OR (s.pricing_id IS NULL AND p.plan_id = s.plan_id AND p.is_active = true)
        ORDER BY CASE WHEN p.id = s.pricing_id THEN 0 WHEN p.billing_cycle = 'monthly' THEN 1 ELSE 2 END,
                 p.billing_period_months
        LIMIT 1
      ) pp ON true ${summaryClause}`);
    const summaryRow = (summary.rows as any[])[0] || {};
    return {
      rows: result.rows as any[],
      total: Number((countResult.rows as any[])[0]?.count || 0),
      summary: { activeCount: Number(summaryRow.active_count || 0), monthlyRevenue: Number(summaryRow.monthly_revenue || 0) },
    };
  }

  async findById(id: string, client: DbClient = this.db) {
    const result = await client.execute(sql`SELECT s.*, u.email AS user_email, u.role AS user_role,
        sp.name AS plan_name, sp.tier AS plan_tier, sp.user_role AS plan_user_role,
        pp.price AS plan_price, pp.currency AS plan_currency
        FROM subscriptions s
        LEFT JOIN users u ON s.user_id = u.id
        LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
        LEFT JOIN LATERAL (
          SELECT p.price, p.currency
          FROM plan_pricing p
          WHERE p.id = s.pricing_id
             OR (s.pricing_id IS NULL AND p.plan_id = s.plan_id AND p.is_active = true)
          ORDER BY CASE WHEN p.id = s.pricing_id THEN 0 WHEN p.billing_cycle = 'monthly' THEN 1 ELSE 2 END,
                   p.billing_period_months
          LIMIT 1
        ) pp ON true
        WHERE s.id = ${id}`);
    return (result.rows as any[])[0] || null;
  }

  async listExpiring(days: number, userRole?: 'doctor' | 'hospital') {
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + days);
    const roleClause = userRole ? sql`AND u.role = ${userRole}` : sql``;
    const result = await this.db.execute(sql`SELECT s.*, u.email AS user_email, u.role AS user_role,
        sp.name AS plan_name, sp.tier AS plan_tier, sp.user_role AS plan_user_role,
        pp.price AS plan_price, pp.currency AS plan_currency
        FROM subscriptions s
        LEFT JOIN users u ON s.user_id = u.id
        LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
        LEFT JOIN LATERAL (
          SELECT p.price, p.currency
          FROM plan_pricing p
          WHERE p.id = s.pricing_id
             OR (s.pricing_id IS NULL AND p.plan_id = s.plan_id AND p.is_active = true)
          ORDER BY CASE WHEN p.id = s.pricing_id THEN 0 WHEN p.billing_cycle = 'monthly' THEN 1 ELSE 2 END,
                   p.billing_period_months
          LIMIT 1
        ) pp ON true
        WHERE s.status = 'active' AND s.end_date >= ${now.toISOString()} AND s.end_date <= ${future.toISOString()} ${roleClause}
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
