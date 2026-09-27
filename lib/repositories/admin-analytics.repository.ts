import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';

export class AdminAnalyticsRepository {
  constructor(private readonly db: any = getDb()) {}

  async overview(start: string, previousStart: string) {
    const [current, previous] = await Promise.all([
      this.db.execute(sql`SELECT
        (SELECT COUNT(*)::int FROM users) AS total_users,
        (SELECT COUNT(*)::int FROM users WHERE created_at >= ${start}) AS new_users,
        (SELECT COUNT(*)::int FROM assignments) AS total_assignments,
        (SELECT COUNT(*)::int FROM assignments WHERE requested_at >= ${start}) AS new_assignments,
        (SELECT COUNT(*)::int FROM subscriptions WHERE status = 'active') AS active_subscriptions,
        (SELECT COALESCE(SUM(amount)::bigint, 0) FROM payment_transactions WHERE status = 'success' AND created_at >= ${start}) AS total_revenue`),
      this.db.execute(sql`SELECT
        (SELECT COUNT(*)::int FROM users WHERE created_at >= ${previousStart} AND created_at < ${start}) AS previous_users,
        (SELECT COUNT(*)::int FROM assignments WHERE requested_at >= ${previousStart} AND requested_at < ${start}) AS previous_assignments`),
    ]);
    return { current: current.rows[0] || {}, previous: previous.rows[0] || {} };
  }

  async users(start: string, end: string) {
    const [growth, byRole, byStatus] = await Promise.all([
      this.db.execute(sql`SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') AS month, EXTRACT(MONTH FROM DATE_TRUNC('month', created_at)) AS month_num, EXTRACT(YEAR FROM DATE_TRUNC('month', created_at)) AS year, COUNT(*)::int AS count FROM users WHERE created_at >= ${start} AND created_at <= ${end} GROUP BY DATE_TRUNC('month', created_at) ORDER BY DATE_TRUNC('month', created_at)`),
      this.db.execute(sql`SELECT role, COUNT(*)::int AS count FROM users GROUP BY role`),
      this.db.execute(sql`SELECT status, COUNT(*)::int AS count FROM users GROUP BY status`),
    ]);
    return { growth: growth.rows, byRole: byRole.rows, byStatus: byStatus.rows };
  }

  async assignments(start: string, end: string) {
    const [trends, byStatus, byPriority] = await Promise.all([
      this.db.execute(sql`SELECT TO_CHAR(DATE_TRUNC('month', requested_at), 'Mon YYYY') AS month, EXTRACT(MONTH FROM DATE_TRUNC('month', requested_at)) AS month_num, EXTRACT(YEAR FROM DATE_TRUNC('month', requested_at)) AS year, COUNT(*)::int AS count FROM assignments WHERE requested_at >= ${start} AND requested_at <= ${end} GROUP BY DATE_TRUNC('month', requested_at) ORDER BY DATE_TRUNC('month', requested_at)`),
      this.db.execute(sql`SELECT status, COUNT(*)::int AS count FROM assignments GROUP BY status`),
      this.db.execute(sql`SELECT priority, COUNT(*)::int AS count FROM assignments GROUP BY priority`),
    ]);
    return { trends: trends.rows, byStatus: byStatus.rows, byPriority: byPriority.rows };
  }

  async revenue(start: string, end: string) {
    const [monthly, byPlan, transactionStats] = await Promise.all([
      this.db.execute(sql`SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') AS month, EXTRACT(MONTH FROM DATE_TRUNC('month', created_at)) AS month_num, EXTRACT(YEAR FROM DATE_TRUNC('month', created_at)) AS year, COALESCE(SUM(amount)::bigint, 0) AS revenue, COUNT(*)::int AS transactions FROM payment_transactions WHERE status = 'success' AND created_at >= ${start} AND created_at <= ${end} GROUP BY DATE_TRUNC('month', created_at) ORDER BY DATE_TRUNC('month', created_at)`),
      this.db.execute(sql`SELECT sp.name AS plan_name, sp.tier AS plan_tier, COUNT(s.id)::int AS subscription_count, COALESCE(SUM(pp.price)::bigint, 0) AS total_revenue FROM subscriptions s JOIN subscription_plans sp ON s.plan_id = sp.id LEFT JOIN plan_pricing pp ON s.pricing_id = pp.id WHERE s.status = 'active' GROUP BY sp.id, sp.name, sp.tier ORDER BY total_revenue DESC`),
      this.db.execute(sql`SELECT status, COUNT(*)::int AS count, COALESCE(SUM(amount)::bigint, 0) AS total_amount FROM payment_transactions WHERE created_at >= ${start} AND created_at <= ${end} GROUP BY status`),
    ]);
    return { monthly: monthly.rows, byPlan: byPlan.rows, transactionStats: transactionStats.rows };
  }

  async trends(start: string, end: string) {
    const result = await this.db.execute(sql`SELECT TO_CHAR(DATE_TRUNC('month', date_series), 'Mon YYYY') AS month, EXTRACT(MONTH FROM DATE_TRUNC('month', date_series)) AS month_num, EXTRACT(YEAR FROM DATE_TRUNC('month', date_series)) AS year, COALESCE(user_count, 0)::int AS users, COALESCE(assignment_count, 0)::int AS assignments, COALESCE(subscription_count, 0)::int AS subscriptions, COALESCE(revenue, 0)::bigint AS revenue FROM generate_series(DATE_TRUNC('month', ${start}::timestamp), DATE_TRUNC('month', ${end}::timestamp), '1 month'::interval) AS date_series LEFT JOIN (SELECT DATE_TRUNC('month', created_at) AS month, COUNT(*)::int AS user_count FROM users WHERE created_at >= ${start} GROUP BY DATE_TRUNC('month', created_at)) u ON DATE_TRUNC('month', date_series) = u.month LEFT JOIN (SELECT DATE_TRUNC('month', requested_at) AS month, COUNT(*)::int AS assignment_count FROM assignments WHERE requested_at >= ${start} GROUP BY DATE_TRUNC('month', requested_at)) a ON DATE_TRUNC('month', date_series) = a.month LEFT JOIN (SELECT DATE_TRUNC('month', created_at) AS month, COUNT(*)::int AS subscription_count FROM subscriptions WHERE created_at >= ${start} GROUP BY DATE_TRUNC('month', created_at)) s ON DATE_TRUNC('month', date_series) = s.month LEFT JOIN (SELECT DATE_TRUNC('month', created_at) AS month, SUM(amount)::bigint AS revenue FROM payment_transactions WHERE status = 'success' AND created_at >= ${start} GROUP BY DATE_TRUNC('month', created_at)) r ON DATE_TRUNC('month', date_series) = r.month ORDER BY date_series`);
    return result.rows;
  }
}
