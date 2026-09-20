import { NextResponse } from 'next/server';
import { withAuthAndContext, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { AdminSubscriptionsService } from '@/lib/services/admin-subscriptions.service';
import { getRequestMetadata } from '@/lib/utils/audit-logger';

/**
 * @swagger
 * /api/admin/subscriptions/{id}:
 *   get:
 *     summary: Get a subscription for administrators
 *     tags: [Admin Subscriptions]
 *     security: [{ bearerAuth: [] }]
 *   put:
 *     summary: Update a subscription for administrators
 *     tags: [Admin Subscriptions]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Subscription updated }
 *       404: { description: Subscription not found }
 *       403: { description: Admin access required }
 */
const service = new AdminSubscriptionsService();

type Context = { params: Promise<{ id: string }> };

async function getHandler(_req: AuthenticatedRequest, { params }: Context) {
  try {
    const data = await service.get((await params).id);
    return data
      ? NextResponse.json({ success: true, data })
      : NextResponse.json({ success: false, message: 'Subscription not found' }, { status: 404 });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch subscription' }, { status: 500 });
  }
}

async function putHandler(req: AuthenticatedRequest, { params }: Context) {
  try {
    const id = (await params).id;
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.status !== undefined) data.status = body.status;
    if (body.autoRenew !== undefined) data.autoRenew = body.autoRenew;
    if (body.endDate !== undefined) data.endDate = body.endDate;
    const metadata = getRequestMetadata(req);
    const result = await service.update(id, data, {
      userId: req.user?.userId ?? null,
      actorType: 'admin',
      action: 'update',
      entityType: 'subscription',
      httpMethod: 'PUT',
      endpoint: `/api/admin/subscriptions/${id}`,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      details: { updatedAt: new Date().toISOString() },
    });
    return result
      ? NextResponse.json({ success: true, message: 'Subscription updated successfully', data: result })
      : NextResponse.json({ success: false, message: 'Subscription not found' }, { status: 404 });
  } catch (error) {
    console.error('Error updating subscription:', error);
    return NextResponse.json({ success: false, message: 'Failed to update subscription' }, { status: 500 });
  }
}

export const GET = withAuthAndContext(getHandler, ['admin']);
export const PUT = withAuthAndContext(putHandler, ['admin']);
