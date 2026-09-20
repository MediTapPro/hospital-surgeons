import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { AdminDashboardService } from '@/lib/services/admin-dashboard.service';
import {
  ADMIN_DASHBOARD_TRENDS_DEFAULT_MONTHS,
  ADMIN_DASHBOARD_TRENDS_MAX_MONTHS,
} from '@/lib/utils/constants';

/**
 * @swagger
 * /api/admin/dashboard/trends:
 *   get:
 *     summary: Get admin dashboard assignment and user growth trends
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: months
 *         schema: { type: integer, default: 6, minimum: 1, maximum: 24 }
 *     responses:
 *       200: { description: Dashboard trends retrieved successfully }
 *       400: { description: Invalid months value }
 *       403: { description: Admin access required }
 */
async function getHandler(req: AuthenticatedRequest) {
  const rawMonths = req.nextUrl.searchParams.get('months');
  const months = rawMonths === null ? ADMIN_DASHBOARD_TRENDS_DEFAULT_MONTHS : Number(rawMonths);

  if (!Number.isInteger(months) || months < 1 || months > ADMIN_DASHBOARD_TRENDS_MAX_MONTHS) {
    return NextResponse.json(
      { success: false, message: `months must be a whole number from 1 to ${ADMIN_DASHBOARD_TRENDS_MAX_MONTHS}.` },
      { status: 400 }
    );
  }

  const result = await new AdminDashboardService().getDashboardTrends(months);
  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}

export const GET = withAuth(getHandler, ['admin']);
