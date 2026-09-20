import { getDb } from '@/lib/db';
import {
  assignments,
  homeVisitDetails,
  orders,
  patientProfiles,
} from '@/src/db/drizzle/migrations/schema';
import { and, eq, sql } from 'drizzle-orm';

export class HomeVisitPaymentsRepository {
  constructor(private db: any = getDb()) {}

  async lockBooking(assignmentId: string, tx: any) {
    await tx.execute(sql`SELECT id FROM assignments WHERE id = ${assignmentId} FOR UPDATE`);
  }

  async findEligibleBooking(userId: string, assignmentId: string, tx?: any) {
    const client = tx || this.db;
    const [booking] = await client
      .select({
        assignmentId: assignments.id,
        status: assignments.status,
        consultationFee: assignments.consultationFee,
        paidAt: assignments.paidAt,
        paymentMode: homeVisitDetails.paymentMode,
        isFreeTrial: homeVisitDetails.isFreeTrial,
      })
      .from(assignments)
      .innerJoin(homeVisitDetails, eq(homeVisitDetails.assignmentId, assignments.id))
      .innerJoin(patientProfiles, eq(patientProfiles.id, assignments.patientProfileId))
      .where(
        and(
          eq(assignments.id, assignmentId),
          eq(assignments.source, 'patient'),
          eq(patientProfiles.userId, userId)
        )
      )
      .limit(1);

    return booking ?? null;
  }

  async getAttemptNumber(assignmentId: string, tx?: any) {
    const client = tx || this.db;
    const [result] = await client
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(eq(orders.assignmentId, assignmentId));

    return Number(result?.count || 0) + 1;
  }

  async createOrder(values: {
    userId: string;
    assignmentId: string;
    amount: number;
    attemptNumber: number;
  }, tx?: any) {
    const client = tx || this.db;
    const [order] = await client
      .insert(orders)
      .values({
        userId: values.userId,
        assignmentId: values.assignmentId,
        orderType: 'consultation',
        amount: values.amount,
        currency: 'INR',
        description: 'Home visit payment',
        status: 'pending',
        attemptNumber: values.attemptNumber,
      })
      .returning();

    return order;
  }

  async setGatewayOrder(id: string, gatewayOrderId: string, tx?: any) {
    const client = tx || this.db;
    const [order] = await client
      .update(orders)
      .set({
        gatewayName: 'razorpay',
        gatewayOrderId,
      })
      .where(eq(orders.id, id))
      .returning();

    return order;
  }

  async markOrderFailed(id: string, reason: string) {
    await this.db
      .update(orders)
      .set({ status: 'failed', failureReason: reason })
      .where(eq(orders.id, id));
  }
}
