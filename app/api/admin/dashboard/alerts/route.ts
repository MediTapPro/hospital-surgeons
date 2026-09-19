import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { AdminDashboardService } from '@/lib/services/admin-dashboard.service';

/**
 * @swagger
 * /api/admin/dashboard/alerts:
 *   get:
 *     summary: Get actionable admin dashboard alerts (Admin only)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Dashboard alerts retrieved successfully }
 *       403: { description: Admin access required }
 */
async function getHandler(_req: AuthenticatedRequest) {
  const result = await new AdminDashboardService().getDashboardAlerts();
  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}

export const GET = withAuth(getHandler, ['admin']);
