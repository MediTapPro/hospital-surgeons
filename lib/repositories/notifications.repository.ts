import { getDb } from '@/lib/db';
import { notifications, notificationPreferences, users, assignments } from '@/src/db/drizzle/migrations/schema';
import { eq, and, desc } from 'drizzle-orm';

export interface CreateNotificationData {
  userId: string; // Maps to recipientId
  recipientType?: 'user' | 'role' | 'all'; // Defaults to 'user'
  notificationType?: 'booking' | 'payment' | 'reminder' | 'system' | 'review' | 'chat'; // Store in payload
  title: string;
  message: string;
  channel: 'push' | 'email' | 'sms' | 'in_app';
  assignmentId?: string; // Maps to assignmentId (replaces relatedId)
  relatedId?: string; // Keep for backward compatibility
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  payload?: any; // JSON object for additional data
  isRead?: boolean; // Maps to 'read' field
}

export interface NotificationQuery {
  page?: number;
  limit?: number;
  userId?: string;
  channel?: string;
  isRead?: boolean;
}

export class NotificationsRepository {
  private db = getDb();

  async create(dto: CreateNotificationData) {
    // Map fields to database structure
    const payload = dto.payload || {};
    if (dto.notificationType) {
      payload.notificationType = dto.notificationType;
    }
    
    const [row] = await this.db
      .insert(notifications)
      .values({
        recipientId: dto.userId, // Maps to recipient_id column
        recipientType: dto.recipientType || 'user',
        title: dto.title,
        message: dto.message,
        channel: dto.channel as any,
        priority: dto.priority || 'medium',
        assignmentId: dto.assignmentId,
        payload: payload,
        read: dto.isRead ?? false, // Maps to 'read' column
      })
      .returning();
    return row;
  }

  async list(query: NotificationQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    const whereConditions = [];
    // Map userId → recipientId (where recipientType = 'user')
    if (query.userId) {
      whereConditions.push(
        and(
          eq(notifications.recipientId, query.userId),
          eq(notifications.recipientType, 'user')
        )
      );
    }
    if (query.channel) whereConditions.push(eq(notifications.channel, query.channel as any));
    if (query.isRead !== undefined) whereConditions.push(eq(notifications.read, query.isRead));

    const data = await this.db
      .select({
        notification: notifications,
        user: { id: users.id, email: users.email },
        assignment: { id: assignments.id },
      })
      .from(notifications)
      .leftJoin(users, eq(users.id, notifications.recipientId))
      .leftJoin(assignments, eq(assignments.id, notifications.assignmentId))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    return { data, page, limit };
  }

  async get(id: string) {
    const [row] = await this.db
      .select({
        notification: notifications,
        user: { id: users.id, email: users.email },
        assignment: { id: assignments.id },
      })
      .from(notifications)
      .leftJoin(users, eq(users.id, notifications.recipientId))
      .leftJoin(assignments, eq(assignments.id, notifications.assignmentId))
      .where(eq(notifications.id, id))
      .limit(1);
    return row;
  }

  async markRead(id: string, isRead: boolean) {
    // Map isRead → read column
    const [row] = await this.db
      .update(notifications)
      .set({ read: isRead }) // Schema maps isRead to 'read' column
      .where(eq(notifications.id, id))
      .returning();
    return row;
  }

  async getPreferences(userId: string) {
    const rows = await this.db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
    return rows[0] ?? null;
  }

  async upsertPreferences(userId: string, prefs: {
    bookingUpdatesPush?: boolean;
    bookingUpdatesEmail?: boolean;
    paymentPush?: boolean;
    remindersPush?: boolean;
  }) {
    const existing = await this.getPreferences(userId);
    if (!existing) {
      const [row] = await this.db
        .insert(notificationPreferences)
        .values({
          userId,
          bookingUpdatesPush: prefs.bookingUpdatesPush ?? true,
          bookingUpdatesEmail: prefs.bookingUpdatesEmail ?? true,
          paymentPush: prefs.paymentPush ?? true,
          remindersPush: prefs.remindersPush ?? true,
        })
        .returning();
      return row;
    }

    const [row] = await this.db
      .update(notificationPreferences)
      .set({
        bookingUpdatesPush: prefs.bookingUpdatesPush ?? existing.bookingUpdatesPush,
        bookingUpdatesEmail: prefs.bookingUpdatesEmail ?? existing.bookingUpdatesEmail,
        paymentPush: prefs.paymentPush ?? existing.paymentPush,
        remindersPush: prefs.remindersPush ?? existing.remindersPush,
      })
      .where(eq(notificationPreferences.id, existing.id))
      .returning();
    return row;
  }
}


