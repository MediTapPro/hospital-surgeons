import { getDb } from '@/lib/db';
import {
  assignments,
  doctors,
  homeVisitDetails,
  orders,
  paymentTransactions,
} from '@/src/db/drizzle/migrations/schema';
import { and, count, desc, eq, inArray } from 'drizzle-orm';

export class PatientPaymentsRepository {
  constructor(private db: any = getDb()) {}

  async findHomeVisitPaymentsByUserId(userId: string, limit: number, offset: number) {
    return this.db
      .select({
        orderId: orders.id,
        assignmentId: assignments.id,
        orderStatus: orders.status,
        orderAmount: orders.amount,
        currency: orders.currency,
        orderCreatedAt: orders.createdAt,
        orderPaidAt: orders.paidAt,
        failureReason: orders.failureReason,
        transactionId: paymentTransactions.id,
        transactionStatus: paymentTransactions.status,
        paymentMethod: paymentTransactions.paymentMethod,
        gatewayName: paymentTransactions.gatewayName,
        gatewayPaymentId: paymentTransactions.gatewayPaymentId,
        transactionCreatedAt: paymentTransactions.createdAt,
        verifiedAt: paymentTransactions.verifiedAt,
        visitDate: assignments.completedAt,
        doctorFirstName: doctors.firstName,
        doctorLastName: doctors.lastName,
      })
      .from(paymentTransactions)
      .innerJoin(orders, eq(orders.id, paymentTransactions.orderId))
      .innerJoin(assignments, eq(assignments.id, orders.assignmentId))
      .innerJoin(homeVisitDetails, eq(homeVisitDetails.assignmentId, assignments.id))
      .innerJoin(doctors, eq(doctors.id, assignments.doctorId))
      .where(
        and(
          eq(orders.userId, userId),
          eq(orders.orderType, 'consultation'),
          eq(assignments.source, 'patient'),
          inArray(paymentTransactions.status, ['success', 'failed', 'refunded'])
        )
      )
      .orderBy(desc(paymentTransactions.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async countHomeVisitPaymentsByUserId(userId: string) {
    const [result] = await this.db
      .select({ total: count() })
      .from(paymentTransactions)
      .innerJoin(orders, eq(orders.id, paymentTransactions.orderId))
      .innerJoin(assignments, eq(assignments.id, orders.assignmentId))
      .innerJoin(homeVisitDetails, eq(homeVisitDetails.assignmentId, assignments.id))
      .where(
        and(
          eq(orders.userId, userId),
          eq(orders.orderType, 'consultation'),
          eq(assignments.source, 'patient'),
          inArray(paymentTransactions.status, ['success', 'failed', 'refunded'])
        )
      );

    return Number(result?.total ?? 0);
  }
}
