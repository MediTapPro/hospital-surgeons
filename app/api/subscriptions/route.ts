import { NextRequest, NextResponse } from 'next/server';
import { SubscriptionsService } from '@/lib/services/subscriptions.service';
import { withAuth } from '@/lib/auth/middleware';

/**
 * @swagger
 * /api/subscriptions:
 *   get:
 *     summary: Get all subscriptions
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *       - in: query
 *         name: planId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, expired, cancelled, pending]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: List of subscriptions
 *   post:
 *     summary: Create a new subscription
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - planId
 *               - startDate
 *               - endDate
 *             properties:
 *               userId:
 *                 type: string
 *               planId:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               autoRenew:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Subscription created successfully
 */
async function getHandler(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = {
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10,
      userId: searchParams.get('userId') || undefined,
      planId: searchParams.get('planId') || undefined,
      status: searchParams.get('status') || undefined,
      startDateFrom: searchParams.get('startDateFrom') || undefined,
      startDateTo: searchParams.get('startDateTo') || undefined,
    };

    const subscriptionsService = new SubscriptionsService();
    const result = await subscriptionsService.list(query);
    
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

async function postHandler(req: NextRequest) {
  try {
    const user = (req as any).user;
    const body = await req.json();
    
    // Use authenticated user's ID
    const subscriptionData = {
      ...body,
      userId: user.userId,
    };
    
    const subscriptionsService = new SubscriptionsService();
    const result = await subscriptionsService.create(subscriptionData);
    
    return NextResponse.json(result, { status: result.success ? 201 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
