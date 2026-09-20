import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { AdminDashboardService } from '@/lib/services/admin-dashboard.service';
import {
  ADMIN_DASHBOARD_ACTIVITY_DEFAULT_LIMIT,
  ADMIN_DASHBOARD_ACTIVITY_MAX_LIMIT,
} from '@/lib/utils/constants';

/**
 * @swagger
 * /api/admin/dashboard/recent-activity:
 *   get:
 *     summary: Get recent admin dashboard activity
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, minimum: 1, maximum: 50 }
 *     responses:
 *       200: { description: Recent activity retrieved successfully }
 *       400: { description: Invalid limit value }
 *       403: { description: Admin access required }
 */
async function getHandler(req: AuthenticatedRequest) {
  const rawLimit = req.nextUrl.searchParams.get('limit');
  const limit = rawLimit === null ? ADMIN_DASHBOARD_ACTIVITY_DEFAULT_LIMIT : Number(rawLimit);

  if (!Number.isInteger(limit) || limit < 1 || limit > ADMIN_DASHBOARD_ACTIVITY_MAX_LIMIT) {
    return NextResponse.json(
      { success: false, message: `limit must be a whole number from 1 to ${ADMIN_DASHBOARD_ACTIVITY_MAX_LIMIT}.` },
      { status: 400 }
    );
  }

  const result = await new AdminDashboardService().getRecentActivity(limit);
  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}

export const GET = withAuth(getHandler, ['admin']);
