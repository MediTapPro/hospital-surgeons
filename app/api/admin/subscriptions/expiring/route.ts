import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { AdminSubscriptionsService } from '@/lib/services/admin-subscriptions.service';

/**
 * @swagger
 * /api/admin/subscriptions/expiring:
 *   get:
 *     summary: List active subscriptions nearing expiry
 *     tags: [Admin Subscriptions]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Expiring subscription list }
 *       403: { description: Admin access required }
 */
const service = new AdminSubscriptionsService();

async function getHandler(req: AuthenticatedRequest) {
  try {
    const rawDays = Number(req.nextUrl.searchParams.get('days') || 7);
    const days = Math.min(365, Math.max(1, Number.isFinite(rawDays) ? rawDays : 7));
    const role = req.nextUrl.searchParams.get('role');
    const userRole = role === 'doctor' || role === 'hospital' ? role : undefined;
    const data = await service.listExpiring(days, userRole);
    return NextResponse.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error('Error fetching expiring subscriptions:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch expiring subscriptions' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler, ['admin']);
