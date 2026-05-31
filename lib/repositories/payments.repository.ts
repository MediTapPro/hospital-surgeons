import { getDb } from '@/lib/db';
import { 
  paymentTransactions, // For subscription payments
  assignmentPayments, // For assignment payments
  users, 
  subscriptions, 
  assignments 
} from '@/src/db/drizzle/migrations/schema';
import { eq, desc, sql } from 'drizzle-orm';

export interface CreatePaymentData {
  userId?: string; // For subscription payments
  subscriptionId?: string;
  assignmentId?: string; // For assignment payments (replaces bookingId)
  paymentType: 'subscription' | 'assignment' | 'commission';
  amount: number;
  status?: 'pending' | 'completed' | 'failed' | 'refunded' | 'processing';
  paymentGateway?: string;
  gatewayTransactionId?: string; // Maps to paymentId in paymentTransactions
  paidAt?: string;
  // For assignment payments:
  hospitalId?: string;
  doctorId?: string;
  consultationFee?: number;
  platformCommission?: number;
  doctorPayout?: number;
}

export interface PaymentQuery {
  page?: number;
  limit?: number;
  userId?: string;
  status?: string;
  paymentType?: string;
}

export class PaymentsRepository {
  private db = getDb();

  async create(dto: CreatePaymentData) {
    // Route to appropriate table based on payment type
    if (dto.paymentType === 'subscription' && dto.subscriptionId) {
      // Use paymentTransactions for subscription payments
      // Note: paymentTransactions requires orderId, not subscriptionId directly
      // This might need adjustment based on orders table structure
      const result = await this.db
        .insert(paymentTransactions)
        .values({
          orderId: dto.subscriptionId, // This should be orderId, may need mapping
          paymentGateway: dto.paymentGateway || 'unknown',
          paymentId: dto.gatewayTransactionId || '',
          amount: Math.round(dto.amount * 100), // Convert to cents (bigint with mode: "number" accepts number)
          currency: 'USD',
          status: dto.status || 'pending',
          verifiedAt: dto.paidAt,
        })
        .returning();
      
      const row = Array.isArray(result) ? result[0] : result;
      if (!row) {
        throw new Error('Failed to create payment transaction');
      }
      return row;
    } else if (dto.paymentType === 'assignment' && dto.assignmentId) {
      // Use assignmentPayments for assignment payments
      if (!dto.hospitalId || !dto.doctorId || !dto.consultationFee) {
        throw new Error('Assignment payment requires hospitalId, doctorId, and consultationFee');
      }
      const consultationFee = dto.consultationFee;
      const platformCommission = dto.platformCommission || 0;
      const doctorPayout = dto.doctorPayout || (consultationFee - platformCommission);
      
      const result = await this.db
        .insert(assignmentPayments)
        .values({
          assignmentId: dto.assignmentId,
          hospitalId: dto.hospitalId,
          doctorId: dto.doctorId,
          consultationFee: consultationFee.toString(),
          platformCommission: platformCommission.toString(),
          doctorPayout: doctorPayout.toString(),
          paymentStatus: (dto.status || 'pending') as any,
          paidToDoctorAt: dto.paidAt,
        })
        .returning();
      
      const row = Array.isArray(result) ? result[0] : result;
      if (!row) {
        throw new Error('Failed to create assignment payment');
      }
      return row;
    } else {
      // No fallback table - throw error for unsupported payment types
      throw new Error(`Payment type '${dto.paymentType}' requires subscriptionId or assignmentId`);
    }
  }

  async list(query: PaymentQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    // For now, query both tables and combine results
    // In production, you might want separate endpoints or better query logic
    
    // Query paymentTransactions (subscription payments)
    const subscriptionPayments = await this.db
      .select({
        payment: paymentTransactions,
        type: sql<string>`'subscription'`.as('paymentType'),
      })
      .from(paymentTransactions)
      .leftJoin(subscriptions, eq(subscriptions.paymentTransactionId, paymentTransactions.id))
      .leftJoin(users, eq(users.id, subscriptions.userId))
      .where(query.userId ? eq(users.id, query.userId) : undefined)
      .orderBy(desc(paymentTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    // Query assignmentPayments (assignment payments)
    const assignmentPaymentsList = await this.db
      .select({
        payment: assignmentPayments,
        type: sql<string>`'assignment'`.as('paymentType'),
      })
      .from(assignmentPayments)
      .leftJoin(assignments, eq(assignments.id, assignmentPayments.assignmentId))
      .where(query.userId ? eq(assignments.hospitalId, query.userId) : undefined) // Approximate user filter
      .orderBy(desc(assignmentPayments.createdAt))
      .limit(limit)
      .offset(offset);

    // Combine and sort (simplified - in production, use UNION or separate queries)
    const data = [...subscriptionPayments, ...assignmentPaymentsList]
      .sort((a, b) => {
        const aDate = (a.payment.createdAt || '') as string;
        const bDate = (b.payment.createdAt || '') as string;
        return bDate.localeCompare(aDate);
      })
      .slice(0, limit);

    return { data, total: data.length, page, limit };
  }

  async get(id: string) {
    // Try paymentTransactions first
    const transactionPayment = await this.db
      .select({
        payment: paymentTransactions,
        type: sql<string>`'subscription'`.as('paymentType'),
      })
      .from(paymentTransactions)
      .where(eq(paymentTransactions.id, id))
      .limit(1);
    
    if (transactionPayment[0]) return transactionPayment[0];

    // Try assignmentPayments
    const assignmentPayment = await this.db
      .select({
        payment: assignmentPayments,
        type: sql<string>`'assignment'`.as('paymentType'),
      })
      .from(assignmentPayments)
      .where(eq(assignmentPayments.id, id))
      .limit(1);
    
    if (assignmentPayment[0]) return assignmentPayment[0];

    // Payment not found in either table
    return undefined;
  }

  async update(id: string, dto: Partial<CreatePaymentData>) {
    // Try to update in paymentTransactions first
    try {
      const updateFields: any = {};
      if (dto.status) updateFields.status = dto.status;
      if (dto.gatewayTransactionId) updateFields.paymentId = dto.gatewayTransactionId;
      if (dto.paidAt) updateFields.verifiedAt = dto.paidAt;
      
      const [row] = await this.db
        .update(paymentTransactions)
        .set(updateFields)
        .where(eq(paymentTransactions.id, id))
        .returning();
      if (row) return row;
    } catch (e) {
      // Not a paymentTransaction, try assignmentPayments
    }

    // Try assignmentPayments
    try {
      const updateFields: any = {};
      if (dto.status) updateFields.paymentStatus = dto.status as any;
      if (dto.paidAt) updateFields.paidToDoctorAt = dto.paidAt;
      
      const [row] = await this.db
        .update(assignmentPayments)
        .set(updateFields)
        .where(eq(assignmentPayments.id, id))
        .returning();
      if (row) return row;
    } catch (e) {
      // Not an assignmentPayment
    }

    // Payment not found in either table
    throw new Error(`Payment with id ${id} not found`);
  }

  async remove(id: string) {
    // Try to delete from paymentTransactions first
    try {
      await this.db.delete(paymentTransactions).where(eq(paymentTransactions.id, id));
      return;
    } catch (e) {
      // Not a paymentTransaction, try assignmentPayments
    }

    // Try to delete from assignmentPayments
    try {
      await this.db.delete(assignmentPayments).where(eq(assignmentPayments.id, id));
      return;
    } catch (e2) {
      // Payment not found in either table
      throw new Error(`Payment with id ${id} not found`);
    }
  }
}


