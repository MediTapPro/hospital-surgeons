import { NextRequest, NextResponse } from 'next/server';
import { HospitalsService } from '@/lib/services/hospitals.service';
import { withAuth } from '@/lib/auth/middleware';
import { getDb } from '@/lib/db';
import { files } from '@/src/db/drizzle/migrations/schema';
import { eq } from 'drizzle-orm';

/**
 * @swagger
 * /api/hospitals/profile:
 *   get:
 *     summary: Get current hospital profile with subscription plan details
 *     tags: [Hospitals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Hospital profile retrieved successfully with current plan details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   description: Hospital profile data
 *                 currentPlan:
 *                   type: object
 *                   nullable: true
 *                   description: Current active subscription plan details
 *                   properties:
 *                     subscription:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         status:
 *                           type: string
 *                         startDate:
 *                           type: string
 *                         endDate:
 *                           type: string
 *                         autoRenew:
 *                           type: boolean
 *                         billingCycle:
 *                           type: string
 *                     plan:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         tier:
 *                           type: string
 *                         description:
 *                           type: string
 *                         hospitalFeatures:
 *                           type: object
 *                           nullable: true
 *                     pricing:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id:
 *                           type: string
 *                         billingCycle:
 *                           type: string
 *                         billingPeriodMonths:
 *                           type: number
 *                         price:
 *                           type: number
 *                         currency:
 *                           type: string
 *                         setupFee:
 *                           type: number
 *                         discountPercentage:
 *                           type: number
 *       404:
 *         description: Hospital profile not found
 */
async function handler(req: NextRequest) {
  try {
    const user = (req as any).user;
    const hospitalsService = new HospitalsService();
    const result = await hospitalsService.findHospitalByUserId(user.userId);

    let profileUrl: string | null = null;
    if (result.success && (result as any).data?.logoId) {
      const db = getDb();
      const fileId = (result as any).data.logoId as string;
      const fileResult = await db
        .select({ url: files.url, cdnUrl: files.cdnUrl })
        .from(files)
        .where(eq(files.id, fileId))
        .limit(1);
      profileUrl = (fileResult[0]?.cdnUrl || fileResult[0]?.url || null) as string | null;
    }
    
    // Get current subscription/plan details
    const { SubscriptionsService } = await import('@/lib/services/subscriptions.service');
    const subscriptionsService = new SubscriptionsService();
    const subscriptionResult = await subscriptionsService.getActiveSubscriptionByUserId(user.userId);
    
    // Combine profile with subscription data
    const response = {
      ...result,
      data: (result as any).data
        ? {
            ...(result as any).data,
            profile_url: profileUrl,
          }
        : (result as any).data,
      currentPlan: subscriptionResult.success && subscriptionResult.data ? {
        subscription: {
          id: subscriptionResult.data.subscription.id,
          status: subscriptionResult.data.subscription.status,
          startDate: subscriptionResult.data.subscription.startDate,
          endDate: subscriptionResult.data.subscription.endDate,
          autoRenew: subscriptionResult.data.subscription.autoRenew,
          billingCycle: subscriptionResult.data.subscription.billingCycle,
        },
        plan: {
          id: subscriptionResult.data.plan.id,
          name: subscriptionResult.data.plan.name,
          tier: subscriptionResult.data.plan.tier,
          description: subscriptionResult.data.plan.description,
          hospitalFeatures: subscriptionResult.data.plan.hospitalFeatures,
        },
        pricing: subscriptionResult.data.pricing,
      } : null,
    };
    
    return NextResponse.json(response, { status: result.success ? 200 : 404 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

export const GET = withAuth(handler);


























