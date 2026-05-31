import { NextRequest, NextResponse } from 'next/server';
import { SubscriptionsService } from '@/lib/services/subscriptions.service';
import { withAuth } from '@/lib/auth/middleware';

/**
 * @swagger
 * /api/subscriptions/plans:
 *   get:
 *     summary: Get all available subscription plans
 *     tags: [Subscriptions]
 *     responses:
 *       200:
 *         description: List of subscription plans
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
 *   post:
 *     summary: Create a new subscription plan (Admin only)
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               tier:
 *                 type: string
 *               userRole:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Plan created successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
async function getHandler(req: NextRequest) {
  try {
    const subscriptionsService = new SubscriptionsService();
    const result = await subscriptionsService.listPlans();
    
    if (!result.success) {
      console.error('Failed to list plans:', 'error' in result ? result.error : result.message);
      return NextResponse.json(result, { status: 400 });
    }
    
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error in getHandler:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

async function postHandler(req: NextRequest) {
  try {
    const body = await req.json();
    const subscriptionsService = new SubscriptionsService();
    const result = await subscriptionsService.createPlan(body);
    
    return NextResponse.json(result, { status: result.success ? 201 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

export const GET = getHandler;
export const POST = withAuth(postHandler, ['admin']);













