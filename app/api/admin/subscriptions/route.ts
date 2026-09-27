import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { AdminSubscriptionsService } from '@/lib/services/admin-subscriptions.service';

/**
 * @swagger
 * /api/admin/subscriptions:
 *   get:
 *     summary: List subscriptions for administrators
 *     tags: [Admin Subscriptions]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Subscription list }
 *       403: { description: Admin access required }
 */
const service = new AdminSubscriptionsService();

async function getHandler(req: AuthenticatedRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get('page') || 1));
    const limit = Math.min(100, Math.max(1, Number(params.get('limit') || 10)));
    const result = await service.list({
      page,
      limit,
      status: params.get('status') || undefined,
      userRole: params.get('role') === 'doctor' || params.get('role') === 'hospital' ? params.get('role') as 'doctor' | 'hospital' : undefined,
      planId: params.get('planId') || undefined,
      userId: params.get('userId') || undefined,
      expiringSoon: params.get('expiringSoon') === 'true',
      sortOrder: params.get('sortOrder') === 'asc' ? 'asc' : 'desc',
    });
    return NextResponse.json({
      success: true,
      data: result.data,
      summary: result.summary,
      pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) },
    });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch subscriptions' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler, ['admin']);
