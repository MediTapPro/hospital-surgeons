import { getDb } from '@/lib/db';
import { supportTickets, users, assignments } from '@/src/db/drizzle/migrations/schema';
import { eq, desc } from 'drizzle-orm';

export interface CreateSupportTicketData {
  userId: string;
  bookingId?: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
}

export interface UpdateSupportTicketData {
  subject?: string;
  description?: string;
  category?: string;
  priority?: string;
  status?: string;
  assignedTo?: string;
}

export interface CreateSupportTicketMessageData {
  ticketId: string;
  userId: string;
  message: string;
  isInternal?: boolean;
}

export class SupportRepository {
  private db = getDb();

  async createTicket(dto: CreateSupportTicketData) {
    const [row] = await this.db
      .insert(supportTickets)
      .values({
        userId: dto.userId,
        bookingId: dto.bookingId,
        subject: dto.subject,
        description: dto.description,
        category: dto.category,
        priority: dto.priority,
      })
      .returning();
    return row;
  }

  async listTickets(page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    const data = await this.db
      .select({
        ticket: supportTickets,
        user: { id: users.id, email: users.email },
        assignment: { id: assignments.id },
      })
      .from(supportTickets)
      .leftJoin(users, eq(users.id, supportTickets.userId))
      .leftJoin(assignments, eq(assignments.id, supportTickets.bookingId)) // bookingId field references assignments
      .orderBy(desc(supportTickets.createdAt))
      .limit(limit)
      .offset(offset);

    return { data, page, limit };
  }

  async getTicket(id: string) {
    const [row] = await this.db
      .select({
        ticket: supportTickets,
        user: { id: users.id, email: users.email },
        assignment: { id: assignments.id },
      })
      .from(supportTickets)
      .leftJoin(users, eq(users.id, supportTickets.userId))
      .leftJoin(assignments, eq(assignments.id, supportTickets.bookingId)) // bookingId field references assignments
      .where(eq(supportTickets.id, id))
      .limit(1);
    return row;
  }

  async updateTicket(id: string, dto: UpdateSupportTicketData) {
    const updateFields: any = {};
    
    if (dto.subject) updateFields.subject = dto.subject;
    if (dto.description) updateFields.description = dto.description;
    if (dto.category) updateFields.category = dto.category;
    if (dto.priority) updateFields.priority = dto.priority;
    if (dto.status) updateFields.status = dto.status;
    if (dto.assignedTo) updateFields.assignedTo = dto.assignedTo;

    const [row] = await this.db
      .update(supportTickets)
      .set(updateFields)
      .where(eq(supportTickets.id, id))
      .returning();
    return row;
  }

  async deleteTicket(id: string) {
    await this.db.delete(supportTickets).where(eq(supportTickets.id, id));
  }

  async addMessage(dto: CreateSupportTicketMessageData) {
    // TODO: supportTicketMessages table does not exist in schema
    // This functionality needs to be implemented when the table is added
    throw new Error('Support ticket messages are not yet implemented. The supportTicketMessages table needs to be added to the schema.');
  }

  async listMessages(ticketId: string) {
    // TODO: supportTicketMessages table does not exist in schema
    // This functionality needs to be implemented when the table is added
    return [];
  }
}


