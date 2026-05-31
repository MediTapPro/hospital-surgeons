import { NextRequest, NextResponse } from 'next/server';
import { SubscriptionsService } from '@/lib/services/subscriptions.service';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';

/**
 * @swagger
 * /api/subscriptions/current:
 *   get:
 *     summary: Get current active subscription for authenticated user
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active subscription retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: No active subscription found
 *       401:
 *         description: Unauthorized
 */
async function getHandler(req: AuthenticatedRequest) {
  try {
    const user = req.user;
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const subscriptionsService = new SubscriptionsService();
    const result = await subscriptionsService.getActiveSubscriptionByUserId(user.userId);
    
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);

