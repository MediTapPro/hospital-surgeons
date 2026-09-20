import { AdminAnalyticsRepository } from '@/lib/repositories/admin-analytics.repository';

export class AdminAnalyticsService {
  constructor(private readonly repository = new AdminAnalyticsRepository()) {}

  private range(monthsInput?: string | null) {
    const months = Number(monthsInput ?? 12);
    if (!Number.isInteger(months) || months < 1 || months > 24) throw new RangeError('months must be an integer between 1 and 24');
    const end = new Date();
    const start = new Date(end);
    start.setMonth(start.getMonth() - months);
    const previousStart = new Date(start);
    previousStart.setMonth(previousStart.getMonth() - months);
    return { months, start: start.toISOString(), end: end.toISOString(), previousStart: previousStart.toISOString() };
  }

  async overview(months?: string | null) {
    const range = this.range(months);
    const result = await this.repository.overview(range.start, range.previousStart);
    const current = result.current as any;
    const previous = result.previous as any;
    const growth = (value: number, prior: number) => prior > 0 ? Math.round(((value - prior) / prior) * 10000) / 100 : 0;
    return { totalUsers: Number(current.total_users || 0), newUsers: Number(current.new_users || 0), userGrowth: growth(Number(current.new_users || 0), Number(previous.previous_users || 0)), totalAssignments: Number(current.total_assignments || 0), newAssignments: Number(current.new_assignments || 0), assignmentGrowth: growth(Number(current.new_assignments || 0), Number(previous.previous_assignments || 0)), activeSubscriptions: Number(current.active_subscriptions || 0), totalRevenue: Number(current.total_revenue || 0) / 100 };
  }

  async users(months?: string | null) { const range = this.range(months); const data = await this.repository.users(range.start, range.end); return { growth: data.growth, byRole: data.byRole, byStatus: data.byStatus }; }
  async assignments(months?: string | null) { const range = this.range(months); return this.repository.assignments(range.start, range.end); }
  async revenue(months?: string | null) { const range = this.range(months); const data = await this.repository.revenue(range.start, range.end); return { monthly: data.monthly.map((row: any) => ({ month: row.month, monthNum: row.month_num, year: row.year, revenue: Number(row.revenue || 0) / 100, transactions: Number(row.transactions || 0) })), byPlan: data.byPlan.map((row: any) => ({ planName: row.plan_name, tier: row.plan_tier, subscriptionCount: Number(row.subscription_count || 0), totalRevenue: Number(row.total_revenue || 0) })), transactionStats: data.transactionStats.map((row: any) => ({ status: row.status, count: Number(row.count || 0), totalAmount: Number(row.total_amount || 0) / 100 })) }; }
  async trends(months?: string | null) { const range = this.range(months); return (await this.repository.trends(range.start, range.end)).map((row: any) => ({ month: row.month, monthNum: row.month_num, year: row.year, users: Number(row.users || 0), assignments: Number(row.assignments || 0), subscriptions: Number(row.subscriptions || 0), revenue: Number(row.revenue || 0) / 100 })); }
}
