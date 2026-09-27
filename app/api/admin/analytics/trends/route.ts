import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { AdminAnalyticsService } from '@/lib/services/admin-analytics.service';

/** @swagger
 * /api/admin/analytics/trends:
 *   get:
 *     summary: Get combined analytics trends (Admin only)
 *     tags: [Admin Analytics]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: query, name: months, schema: { type: integer, minimum: 1, maximum: 24, default: 12 } }]
 *     responses: { 200: { description: Analytics trends retrieved successfully }, 400: { description: Invalid months value }, 403: { description: Admin access required } }
 */
async function getHandler(req: AuthenticatedRequest) {
  try { return NextResponse.json({ success: true, data: await new AdminAnalyticsService().trends(req.nextUrl.searchParams.get('months')) }); }
  catch (error) { return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'Failed to fetch analytics trends' }, { status: error instanceof RangeError ? 400 : 500 }); }
}
export const GET = withAuth(getHandler, ['admin']);
