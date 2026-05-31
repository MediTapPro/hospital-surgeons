import { getDb } from '@/lib/db';
import { analyticsEvents, users } from '@/src/db/drizzle/migrations/schema';
import { eq, and, desc, like } from 'drizzle-orm';

export interface CreateAnalyticsEventData {
  userId?: string;
  eventType: string;
  eventName: string;
  properties?: Record<string, any>;
}

export interface AnalyticsEventQuery {
  page?: number;
  limit?: number;
  userId?: string;
  eventType?: string;
  eventName?: string;
}

export class AnalyticsRepository {
  private db = getDb();

  async create(dto: CreateAnalyticsEventData) {
    const [row] = await this.db
      .insert(analyticsEvents)
      .values({
        userId: dto.userId,
        eventType: dto.eventType,
        eventName: dto.eventName,
        properties: dto.properties,
      })
      .returning();
    return row;
  }

  async list(query: AnalyticsEventQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    const whereConditions = [];
    if (query.userId) whereConditions.push(eq(analyticsEvents.userId, query.userId));
    if (query.eventType) whereConditions.push(like(analyticsEvents.eventType, `%${query.eventType}%`));
    if (query.eventName) whereConditions.push(like(analyticsEvents.eventName, `%${query.eventName}%`));

    const data = await this.db
      .select({ event: analyticsEvents, user: { id: users.id, email: users.email } })
      .from(analyticsEvents)
      .leftJoin(users, eq(users.id, analyticsEvents.userId))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(analyticsEvents.createdAt))
      .limit(limit)
      .offset(offset);

    return { data, page, limit };
  }
}


