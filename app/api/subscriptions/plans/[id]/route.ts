import { NextRequest, NextResponse } from 'next/server';
import { SubscriptionsService } from '@/lib/services/subscriptions.service';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';

/**
 * @swagger
 * /api/subscriptions/plans/{id}:
 *   get:
 *     summary: Get a specific subscription plan by ID
 *     tags: [Subscriptions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Plan ID
 *     responses:
 *       200:
 *         description: Plan retrieved successfully
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
 *         description: Bad request
 *       404:
 *         description: Plan not found
 *   patch:
 *     summary: Update a subscription plan (Admin only)
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Plan ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Plan updated successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *   delete:
 *     summary: Delete a subscription plan (Admin only)
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Plan ID
 *     responses:
 *       200:
 *         description: Plan deleted successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
async function getHandler(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    
    console.log('[GET /api/subscriptions/plans/[id]] Request received, planId:', id);
    
    if (!id || id === 'null' || id === 'undefined') {
      console.error('[GET /api/subscriptions/plans/[id]] Plan ID is missing or invalid:', id);
      return NextResponse.json(
        { success: false, message: 'Plan ID is required' },
        { status: 400 }
      );
    }

    const subscriptionsService = new SubscriptionsService();
    const result = await subscriptionsService.getPlan(id);
    
    console.log('[GET /api/subscriptions/plans/[id]] Service result:', {
      success: result.success,
      hasData: !!result.data,
      message: result.message
    });
    
    if (!result.success) {
      console.error('[GET /api/subscriptions/plans/[id]] Plan not found:', result.message);
      return NextResponse.json(result, { status: 404 });
    }
    
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[GET /api/subscriptions/plans/[id]] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Internal server error', 
        error: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}

async function patchHandler(req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const body = await req.json();
    const subscriptionsService = new SubscriptionsService();
    const result = await subscriptionsService.updatePlan(params.id, body);
    
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

async function deleteHandler(req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const subscriptionsService = new SubscriptionsService();
    const result = await subscriptionsService.deletePlan(params.id);
    
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return getHandler(req, context);
}

export const PATCH = withAuthAndContext(patchHandler, ['admin']);
export const DELETE = withAuthAndContext(deleteHandler, ['admin']);

