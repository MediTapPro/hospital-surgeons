import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getDb } from '@/lib/db';
import { 
  subscriptions, 
  subscriptionPlans, 
  planPricing,
  paymentTransactions,
  orders
} from '@/src/db/drizzle/migrations/schema';
import { eq, desc, sql, inArray } from 'drizzle-orm';

/**
 * @swagger
 * /api/subscriptions/history:
 *   get:
 *     summary: Get subscription history for authenticated user
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Subscription history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *       401:
 *         description: Unauthorized
 */
async function getHandler(req: AuthenticatedRequest) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'User not authenticated' },
        { status: 401 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20;
    const offset = (page - 1) * limit;

    // Fetch all subscriptions for the user with related data
    const subscriptionsList = await getDb()
      .select({
        subscription: subscriptions,
        plan: subscriptionPlans,
        pricing: planPricing,
        paymentTransaction: paymentTransactions,
        order: orders,
      })
      .from(subscriptions)
      .leftJoin(subscriptionPlans, eq(subscriptionPlans.id, subscriptions.planId))
      .leftJoin(planPricing, eq(planPricing.id, subscriptions.pricingId))
      .leftJoin(paymentTransactions, eq(paymentTransactions.subscriptionId, subscriptions.id))
      .leftJoin(orders, eq(orders.id, subscriptions.orderId))
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const totalResult = await getDb()
      .select({ count: sql<number>`count(*)` })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId));

    const total = Number(totalResult[0]?.count || 0);

    // Fetch replaced subscriptions to detect upgrades/changes
    const subscriptionIds = subscriptionsList
      .map(s => s.subscription.id)
      .filter((id): id is string => !!id);
    
    const replacedSubscriptionsMap = new Map<string, any>();
    if (subscriptionIds.length > 0) {
      const replacedSubs = await getDb()
        .select()
        .from(subscriptions)
        .where(inArray(subscriptions.replacedBySubscriptionId, subscriptionIds));
      
      replacedSubs.forEach(sub => {
        if (sub.replacedBySubscriptionId) {
          replacedSubscriptionsMap.set(sub.replacedBySubscriptionId, sub);
        }
      });
    }

    // Format response
    const formattedSubscriptions = subscriptionsList.map((s) => {
      const subscription = s.subscription;
      const plan = s.plan;
      const pricing = s.pricing;
      const paymentTransaction = s.paymentTransaction;
      const order = s.order;

      // Determine subscription type
      let subscriptionType = 'new';
      let description = plan?.name || 'Subscription';
      
      const oldSub = replacedSubscriptionsMap.get(subscription.id);
      if (oldSub) {
        if (oldSub.planId === plan?.id && oldSub.pricingId !== pricing?.id) {
          subscriptionType = 'billing_cycle_change';
          const billingCycle = pricing?.billingCycle || 
            (pricing?.billingPeriodMonths === 12 ? 'Yearly' : 
             pricing?.billingPeriodMonths === 3 ? 'Quarterly' : 
             pricing?.billingPeriodMonths === 6 ? 'Half-Yearly' : 
             'Monthly');
          description = `${plan?.name} - Billing Cycle Changed to ${billingCycle}`;
        } else if (oldSub.planId !== plan?.id) {
          subscriptionType = 'upgrade';
          description = `${plan?.name} - Upgraded`;
        }
      }

      return {
        id: subscription.id,
        status: subscription.status, // 'active', 'expired', 'cancelled', 'suspended'
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        createdAt: subscription.createdAt,
        cancelledAt: subscription.cancelledAt,
        cancellationReason: subscription.cancellationReason,
        autoRenew: subscription.autoRenew,
        plan: plan ? {
          id: plan.id,
          name: plan.name,
          tier: plan.tier,
          userRole: plan.userRole,
        } : null,
        pricing: pricing ? {
          id: pricing.id,
          billingCycle: pricing.billingCycle,
          billingPeriodMonths: pricing.billingPeriodMonths,
          price: Number(pricing.price),
          currency: pricing.currency,
        } : null,
        payment: paymentTransaction ? {
          id: paymentTransaction.id,
          amount: Number(paymentTransaction.amount),
          currency: paymentTransaction.currency,
          status: paymentTransaction.status,
          paymentId: paymentTransaction.paymentId,
          createdAt: paymentTransaction.createdAt,
        } : null,
        order: order ? {
          id: order.id,
          status: order.status,
          amount: Number(order.amount),
          currency: order.currency,
          attemptNumber: order.attemptNumber,
        } : null,
        subscriptionType,
        description,
        replacedBySubscriptionId: subscription.replacedBySubscriptionId,
      };
    });

    return NextResponse.json({
      success: true,
      data: formattedSubscriptions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Fetch subscription history error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);

