import { NextRequest, NextResponse } from 'next/server';
import { paymentManager } from '@/app/api/lib/payment-gate-ways/payment-gateway-manager';
import { RazorpayGateway } from '@/app/api/lib/payment-gate-ways/gatways/razorpay';
import { getDb } from '@/lib/db';
import { assignmentPayments, assignments, homeVisitDetails, orders, paymentTransactions, webhookEvents, subscriptions, planPricing, subscriptionPlans } from '@/src/db/drizzle/migrations/schema';
import { eq, and, asc, isNull, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { SubscriptionsService } from '@/lib/services/subscriptions.service';

/**
 * @swagger
 * /api/payments/verify:
 *   post:
 *     summary: Verify payment after successful transaction
 *     description: Verifies a Razorpay payment. For a completed paid home visit, it atomically records the patient payment and makes the doctor settlement pending. Subscription flows keep their existing lifecycle.
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - razorpay_order_id
 *               - razorpay_payment_id
 *               - razorpay_signature
 *             properties:
 *               razorpay_order_id:
 *                 type: string
 *                 description: Razorpay order ID returned from payment gateway
 *                 example: "order_ABC123xyz"
 *               razorpay_payment_id:
 *                 type: string
 *                 description: Razorpay payment ID returned from payment gateway
 *                 example: "pay_XYZ789abc"
 *               razorpay_signature:
 *                 type: string
 *                 description: Payment signature for verification
 *                 example: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
 *     responses:
 *       200:
 *         description: Payment verified and processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Payment verified and processed successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     orderId:
 *                       type: string
 *                       format: uuid
 *                       description: Database order ID
 *                       example: "123e4567-e89b-12d3-a456-426614174002"
 *                     paymentTransactionId:
 *                       type: string
 *                       format: uuid
 *                       description: Payment transaction record ID
 *                       example: "123e4567-e89b-12d3-a456-426614174003"
 *                     subscriptionId:
 *                       type: string
 *                       format: uuid
 *                       nullable: true
 *                       description: Subscription ID if created
 *                       example: "123e4567-e89b-12d3-a456-426614174004"
 *                     status:
 *                       type: string
 *                       enum: [success, pending, failed, refunded]
 *                       example: "success"
 *                     razorpayPaymentId:
 *                       type: string
 *                       example: "pay_XYZ789abc"
 *       400:
 *         description: "Bad request - missing payment details or invalid signature"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Missing payment details or invalid payment signature"
 *       404:
 *         description: Associated order not found in database
 *       500:
 *         description: Internal server error
 */

/**
 * Map Razorpay payment status to internal status
 */
function mapRazorpayStatusToInternal(razorpayStatus: string): string {
  switch (razorpayStatus) {
    case 'captured':
      return 'success'; // ✅ Payment successful
    case 'authorized':
    case 'created':
      return 'pending'; // ⏳ Payment in progress
    case 'failed':
      return 'failed'; // ❌ Payment failed
    case 'refunded':
      return 'refunded'; // 🔄 Payment refunded
    default:
      return 'pending'; // ⏳ Unknown status = pending
  }
}

export async function POST(req: NextRequest) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { success: false, error: 'Missing payment details' },
        { status: 400 }
      );
    }

    const gateway = paymentManager.getGateway('razorpay') as RazorpayGateway;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret) {
      return NextResponse.json(
        { success: false, error: 'Razorpay key secret not configured' },
        { status: 500 }
      );
    }

    // ============================================
    // STEP 1: Verify the signature
    // ============================================
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(text)
      .digest('hex');

    const isSignatureValid = generatedSignature === razorpay_signature;

    if (!isSignatureValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid payment signature' },
        { status: 400 }
      );
    }

    // ============================================
    // STEP 2: Fetch payment details from Razorpay
    // ============================================
    const payment = await gateway.fetchPayment(razorpay_payment_id);

    if (payment.order_id !== razorpay_order_id) {
      return NextResponse.json(
        { success: false, error: 'Payment does not belong to this order' },
        { status: 400 }
      );
    }
    
    console.log('Payment verified:', {
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id,
      status: payment.status,
      amount: payment.amount,
    });

    // ============================================
    // STEP 3: Map Razorpay status to internal status
    // ============================================
    const internalStatus = mapRazorpayStatusToInternal(payment.status);

    // ============================================
    // STEP 4: Find DB order using Razorpay order ID
    // ============================================
    const dbOrderResult = await getDb()
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.gatewayOrderId, razorpay_order_id),
          eq(orders.gatewayName, 'razorpay')
        )
      )
      .limit(1);

    if (dbOrderResult.length === 0) {
      console.error('DB order not found for Razorpay order:', razorpay_order_id);
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    const dbOrder = dbOrderResult[0];

    const paymentTransaction = await getDb().transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM orders WHERE id = ${dbOrder.id} FOR UPDATE`);
      let homeVisitAssignmentId: string | null = null;

      const [lockedOrder] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, dbOrder.id))
        .limit(1);

      if (!lockedOrder) {
        throw new Error('Order not found while recording payment');
      }

      if (
        lockedOrder.gatewayOrderId !== razorpay_order_id
        || Math.round(payment.amount / 100) !== Number(lockedOrder.amount)
        || payment.currency !== lockedOrder.currency
      ) {
        throw new Error('Payment details do not match the order');
      }

      if (internalStatus === 'success') {
        if (lockedOrder.orderType === 'consultation') {
          if (!lockedOrder.assignmentId) {
            throw new Error('Consultation order has no assignment');
          }

          const [homeVisit] = await tx
            .select({
              assignmentId: assignments.id,
              status: assignments.status,
              paymentMode: homeVisitDetails.paymentMode,
              isFreeTrial: homeVisitDetails.isFreeTrial,
            })
            .from(assignments)
            .innerJoin(homeVisitDetails, eq(homeVisitDetails.assignmentId, assignments.id))
            .where(eq(assignments.id, lockedOrder.assignmentId))
            .limit(1);

          if (
            !homeVisit
            || homeVisit.status !== 'completed'
            || homeVisit.isFreeTrial
            || homeVisit.paymentMode !== 'pay_after_completion'
          ) {
            throw new Error('Consultation payment is not eligible for completion');
          }

          homeVisitAssignmentId = lockedOrder.assignmentId;

          await tx
            .update(assignments)
            .set({ paidAt: new Date().toISOString() })
            .where(and(eq(assignments.id, lockedOrder.assignmentId), isNull(assignments.paidAt)));
        }

        await tx
          .update(orders)
          .set({
            status: 'paid',
            paidAt: lockedOrder.paidAt ?? new Date().toISOString(),
          })
          .where(eq(orders.id, lockedOrder.id));
      } else if (internalStatus === 'failed') {
        await tx
          .update(orders)
          .set({
            status: 'failed',
            failureReason: `Payment status: ${payment.status}`,
          })
          .where(eq(orders.id, lockedOrder.id));
      }

      const [existingTransaction] = await tx
        .select()
        .from(paymentTransactions)
        .where(
          and(
            eq(paymentTransactions.gatewayName, 'razorpay'),
            eq(paymentTransactions.gatewayPaymentId, razorpay_payment_id)
          )
        )
        .limit(1);

      if (existingTransaction) {
        if (homeVisitAssignmentId) {
          const updatedPayment = await tx
            .update(assignmentPayments)
            .set({
              patientPaymentStatus: 'paid',
              patientPaidAt: new Date().toISOString(),
              paymentTransactionId: existingTransaction.id,
              paymentOrderId: lockedOrder.id,
              paymentStatus: 'pending',
            })
            .where(
              and(
                eq(assignmentPayments.assignmentId, homeVisitAssignmentId),
                eq(assignmentPayments.paymentSource, 'home_visit')
              )
            )
            .returning({ id: assignmentPayments.id });
          if (updatedPayment.length === 0) {
            throw new Error('HOME_VISIT_SETTLEMENT_NOT_FOUND');
          }
        }
        return existingTransaction;
      }

      const transactionResult = await tx
        .insert(paymentTransactions)
        .values({
          orderId: lockedOrder.id,
          paymentGateway: 'razorpay',
          paymentId: razorpay_payment_id,
          gatewayName: 'razorpay',
          gatewayPaymentId: razorpay_payment_id,
          gatewayOrderId: razorpay_order_id,
          paymentMethod: payment.method || 'card',
          amount: Math.round(payment.amount / 100),
          currency: payment.currency,
          status: internalStatus,
          gatewayResponse: payment,
          verifiedAt: new Date().toISOString(),
          verifiedVia: 'manual',
          userId: lockedOrder.userId,
          planId: lockedOrder.planId,
          pricingId: lockedOrder.pricingId,
        })
        .returning();

      const createdTransaction = Array.isArray(transactionResult) ? transactionResult[0] : null;

      if (!createdTransaction) {
        throw new Error('Failed to create payment transaction');
      }

      if (homeVisitAssignmentId) {
        const updatedPayment = await tx
          .update(assignmentPayments)
          .set({
            patientPaymentStatus: 'paid',
            patientPaidAt: new Date().toISOString(),
            paymentTransactionId: createdTransaction.id,
            paymentOrderId: lockedOrder.id,
            paymentStatus: 'pending',
          })
          .where(
            and(
              eq(assignmentPayments.assignmentId, homeVisitAssignmentId),
              eq(assignmentPayments.paymentSource, 'home_visit')
            )
          )
          .returning({ id: assignmentPayments.id });
        if (updatedPayment.length === 0) {
          throw new Error('HOME_VISIT_SETTLEMENT_NOT_FOUND');
        }
      }

      return createdTransaction;
    });

    // ============================================
    // STEP 8: Create webhook event record
    // ============================================
    const eventType = payment.status === 'captured' ? 'payment.captured' : 
                     payment.status === 'failed' ? 'payment.failed' : 
                     'payment.pending';

    const processingStatus = internalStatus === 'success' ? 'success' : 
                            internalStatus === 'failed' ? 'failed' : 
                            'pending';

    try {
      await getDb()
        .insert(webhookEvents)
        .values({
          gatewayName: 'razorpay',
          gatewayEventId: `manual_verify_${razorpay_payment_id}_${Date.now()}`,
          eventType: eventType,
          gatewayPaymentId: razorpay_payment_id,
          gatewayOrderId: razorpay_order_id,
          paymentTransactionId: paymentTransaction.id,
          payload: {
            payment: payment,
            razorpay_status: payment.status,
            internal_status: internalStatus,
            verification_method: 'manual',
            verified_at: new Date().toISOString(),
          },
          processedAt: new Date().toISOString(),
          processingStatus: processingStatus,
          userId: dbOrder.userId,
        })
        .onConflictDoNothing(); // Prevent duplicate events
    } catch (error: any) {
      // Log error but don't fail the verification
      console.error('Error creating webhook event record:', error);
    }

    // ============================================
    // STEP 9: Create subscription (only if payment successful)
    // ============================================
    let subscriptionId = null;
    if (internalStatus === 'success' && dbOrder.orderType === 'subscription' && dbOrder.planId) {
      try {
        // Check if subscription already exists for this order
        const existingSubscription = await getDb()
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.orderId, dbOrder.id))
          .limit(1);

        if (existingSubscription.length === 0) {
          // Get pricing details to determine billing period
          let billingPeriodMonths = 1; // Default to 1 month
          
          if (dbOrder.pricingId) {
            const pricingResult = await getDb()
              .select()
              .from(planPricing)
              .where(eq(planPricing.id, dbOrder.pricingId))
              .limit(1);
            
            if (pricingResult.length > 0) {
              billingPeriodMonths = pricingResult[0].billingPeriodMonths;
            }
          } else {
            // If no pricingId, get default pricing for the plan
            const defaultPricingResult = await getDb()
              .select()
              .from(planPricing)
              .where(
                and(
                  eq(planPricing.planId, dbOrder.planId),
                  eq(planPricing.isActive, true)
                )
              )
              .orderBy(asc(planPricing.billingPeriodMonths))
              .limit(1);
            
            if (defaultPricingResult.length > 0) {
              billingPeriodMonths = defaultPricingResult[0].billingPeriodMonths;
            }
          }

          // Calculate subscription dates
          const startDate = new Date();
          const endDate = new Date();
          endDate.setMonth(endDate.getMonth() + billingPeriodMonths);

          const subscriptionsService = new SubscriptionsService();
          const subscriptionResult = await subscriptionsService.create({
            userId: dbOrder.userId,
            planId: dbOrder.planId,
            pricingId: dbOrder.pricingId || undefined,
            status: 'active',
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            autoRenew: true,
          });

          if (subscriptionResult.success && subscriptionResult.data) {
            subscriptionId = subscriptionResult.data.id;

            // Update subscription with order and payment transaction IDs
            await getDb()
              .update(subscriptions)
              .set({
                orderId: dbOrder.id,
                paymentTransactionId: paymentTransaction.id,
              })
              .where(eq(subscriptions.id, subscriptionId));

            // Update payment transaction with subscription ID
            await getDb()
              .update(paymentTransactions)
              .set({
                subscriptionId: subscriptionId,
              })
              .where(eq(paymentTransactions.id, paymentTransaction.id));

            // ============================================
            // STEP 9.5: Handle upgrade (cancel old subscription if upgrade)
            // ============================================
            try {
              // Check if user has another active subscription
              const existingActiveSubscriptions = await getDb()
                .select()
                .from(subscriptions)
                .where(
                  and(
                    eq(subscriptions.userId, dbOrder.userId),
                    eq(subscriptions.status, 'active'),
                    sql`${subscriptions.id} != ${subscriptionId}` // Not the one we just created
                  )
                );

              if (existingActiveSubscriptions.length > 0) {
                // Get plan details to compare tiers
                const newPlanResult = await getDb()
                  .select()
                  .from(subscriptionPlans)
                  .where(eq(subscriptionPlans.id, dbOrder.planId))
                  .limit(1);

                if (newPlanResult.length > 0) {
                  const newPlan = newPlanResult[0];
                  
                  // Check each existing subscription
                  for (const oldSub of existingActiveSubscriptions) {
                    const oldPlanResult = await getDb()
                      .select()
                      .from(subscriptionPlans)
                      .where(eq(subscriptionPlans.id, oldSub.planId))
                      .limit(1);

                    if (oldPlanResult.length > 0) {
                      const oldPlan = oldPlanResult[0];
                      
                      // Check if it's an upgrade (new tier > old tier)
                      const tierOrder: Record<string, number> = {
                        'free': 0,
                        'basic': 1,
                        'premium': 2,
                        'enterprise': 3,
                      };
                      
                      const newTierLevel = tierOrder[newPlan.tier as string] || 0;
                      const oldTierLevel = tierOrder[oldPlan.tier as string] || 0;
                      
                      // Check if it's an upgrade (new tier > old tier)
                      const isUpgrade = newTierLevel > oldTierLevel;
                      
                      // Check if it's same plan with different billing cycle (e.g., Gold Monthly → Gold Yearly)
                      const isSamePlanDifferentPricing = newPlan.id === oldPlan.id && dbOrder.pricingId !== oldSub.pricingId;
                      
                      if (isUpgrade || isSamePlanDifferentPricing) {
                        // It's an upgrade or plan change - cancel old subscription
                        // User has paid for new subscription, so old one should be cancelled
                        await getDb()
                          .update(subscriptions)
                          .set({
                            status: 'cancelled',
                            replacedBySubscriptionId: subscriptionId,
                            cancelledAt: new Date().toISOString(),
                            cancellationReason: isUpgrade ? 'upgraded' : 'plan_changed',
                          })
                          .where(eq(subscriptions.id, oldSub.id));
                        
                        if (isUpgrade) {
                          console.log(`Upgraded subscription: Cancelled old subscription ${oldSub.id}, replaced with ${subscriptionId}`);
                        } else {
                          console.log(`Plan change: Cancelled old subscription ${oldSub.id} (same plan, different billing), replaced with ${subscriptionId}`);
                        }
                      }
                    }
                  }
                }
              }
            } catch (upgradeError: any) {
              // Log error but don't fail the verification
              console.error('Error handling upgrade:', upgradeError);
            }
          } else {
            console.error('Failed to create subscription:', subscriptionResult.message);
          }
        } else {
          subscriptionId = existingSubscription[0].id;
        }
      } catch (error: any) {
        // Log error but don't fail the verification
        console.error('Error creating subscription:', error);
      }
    }

    let homeVisitAssignmentId: string | null = null;
    if (internalStatus === 'success' && dbOrder.orderType === 'consultation' && dbOrder.assignmentId) {
      homeVisitAssignmentId = dbOrder.assignmentId;
    }

    // ============================================
    // STEP 10: Return success response
    // ============================================
    return NextResponse.json({
      success: true,
      payment: {
        id: payment.id,
        order_id: payment.order_id,
        status: payment.status,
        internal_status: internalStatus,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
      },
      order: {
        id: dbOrder.id,
        status: dbOrder.status,
      },
      transaction: {
        id: paymentTransaction.id,
        status: internalStatus,
      },
      subscription: subscriptionId ? { id: subscriptionId } : null,
      homeVisit: homeVisitAssignmentId ? { assignmentId: homeVisitAssignmentId } : null,
    });
  } catch (error: any) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Payment verification failed' },
      { status: 500 }
    );
  }
}
