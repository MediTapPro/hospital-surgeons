import { paymentManager } from '@/app/api/lib/payment-gate-ways/payment-gateway-manager';
import { getDb } from '@/lib/db';
import { HomeVisitPaymentsRepository } from '@/lib/repositories/home-visit-payments.repository';

export class HomeVisitPaymentsService {
  private db = getDb();
  private repository = new HomeVisitPaymentsRepository();

  async createPaymentOrder(userId: string, assignmentId: string) {
    try {
      return await this.db.transaction(async (tx) => {
        await this.repository.lockBooking(assignmentId, tx);
        const booking = await this.repository.findEligibleBooking(userId, assignmentId, tx);
        if (!booking) {
          return { success: false, code: 'BOOKING_NOT_FOUND', message: 'Home visit booking not found.' };
        }

        if (booking.status !== 'completed') {
          return { success: false, code: 'VISIT_NOT_COMPLETED', message: 'Payment is available after the visit is completed.' };
        }

        if (booking.isFreeTrial || booking.paymentMode !== 'pay_after_completion') {
          return { success: false, code: 'PAYMENT_NOT_REQUIRED', message: 'This home visit does not require payment.' };
        }

        if (booking.paidAt) {
          return { success: false, code: 'BOOKING_ALREADY_PAID', message: 'This home visit has already been paid.' };
        }

        const amount = Number(booking.consultationFee);
        if (!Number.isFinite(amount) || amount <= 0) {
          return { success: false, code: 'INVALID_BOOKING_FEE', message: 'This home visit does not have a valid payment amount.' };
        }

        const order = await this.repository.createOrder({
          userId,
          assignmentId,
          amount: Math.round(amount),
          attemptNumber: await this.repository.getAttemptNumber(assignmentId, tx),
        }, tx);

        const gateway = paymentManager.getGateway('razorpay');
        const session = await gateway.createCheckoutSession({
          amount,
          currency: 'INR',
          successUrl: '',
          cancelUrl: '',
          metadata: {
            orderId: order.id,
            assignmentId,
            orderType: 'consultation',
          },
        });

        await this.repository.setGatewayOrder(order.id, session.id, tx);
        return { success: true, data: { orderId: order.id, session } };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to initialise payment.';
      return { success: false, code: 'PAYMENT_GATEWAY_UNAVAILABLE', message };
    }
  }
}
