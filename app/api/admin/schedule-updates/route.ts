import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { AdminScheduleUpdatesService } from '@/lib/services/admin-schedule-updates.service';

/** @swagger
 * /api/admin/schedule-updates:
 *   get:
 *     summary: List doctor schedule updates (Admin only)
 *     tags: [Admin Schedule]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *       - { in: query, name: status, schema: { type: string, enum: [available, booked, blocked] } }
 *       - { in: query, name: slotType, schema: { type: string, enum: [parent, sub] } }
 *       - { in: query, name: startDate, schema: { type: string, format: date } }
 *       - { in: query, name: endDate, schema: { type: string, format: date } }
 *     responses: { 200: { description: Schedule updates retrieved }, 400: { description: Invalid query }, 403: { description: Admin access required } }
 */
async function getHandler(req: AuthenticatedRequest) {
  const query = req.nextUrl.searchParams;
  const page = Number(query.get('page') || 1);
  const limit = Number(query.get('limit') || 20);
  const status = query.get('status') || undefined;
  const slotType = query.get('slotType') || undefined;
  const startDate = query.get('startDate') || undefined;
  const endDate = query.get('endDate') || undefined;
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100 || (status && !['available', 'booked', 'blocked'].includes(status)) || (slotType && !['parent', 'sub'].includes(slotType)) || (startDate && Number.isNaN(Date.parse(startDate)) || endDate && Number.isNaN(Date.parse(endDate)) || startDate && endDate && startDate > endDate)) return NextResponse.json({ success: false, message: 'Invalid schedule update filters.' }, { status: 400 });
  try { const result = await new AdminScheduleUpdatesService().list({ page, limit, doctorSearch: query.get('doctorSearch')?.trim() || undefined, status, slotType: slotType as 'parent' | 'sub' | undefined, startDate, endDate }); return NextResponse.json({ success: true, data: result.data, pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) } }); }
  catch (error) { return NextResponse.json({ success: false, message: 'Failed to fetch schedule updates' }, { status: 500 }); }
}
export const GET = withAuth(getHandler, ['admin']);
