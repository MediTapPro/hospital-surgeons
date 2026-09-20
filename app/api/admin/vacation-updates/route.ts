import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { AdminVacationUpdatesService } from '@/lib/services/admin-vacation-updates.service';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LEAVE_TYPES = ['vacation', 'sick', 'personal', 'emergency', 'other'];

/** @swagger
 * /api/admin/vacation-updates:
 *   get:
 *     summary: List doctor vacation updates (Admin only)
 *     tags: [Admin Vacation Updates]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *       - { in: query, name: doctorId, schema: { type: string, format: uuid } }
 *       - { in: query, name: leaveType, schema: { type: string, enum: [vacation, sick, personal, emergency, other] } }
 *       - { in: query, name: startDate, schema: { type: string, format: date } }
 *       - { in: query, name: endDate, schema: { type: string, format: date } }
 *     responses: { 200: { description: Vacation updates retrieved }, 400: { description: Invalid query }, 403: { description: Admin access required } }
 */
async function getHandler(req: AuthenticatedRequest) {
  const query = req.nextUrl.searchParams;
  const page = Number(query.get('page') || 1);
  const limit = Number(query.get('limit') || 20);
  const doctorId = query.get('doctorId') || undefined;
  const leaveType = query.get('leaveType') || undefined;
  const startDate = query.get('startDate') || undefined;
  const endDate = query.get('endDate') || undefined;
  const invalidDate = (value?: string) => Boolean(value && Number.isNaN(Date.parse(value)));
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100 || (doctorId && !UUID_PATTERN.test(doctorId)) || (leaveType && !LEAVE_TYPES.includes(leaveType)) || invalidDate(startDate) || invalidDate(endDate) || (startDate && endDate && startDate > endDate)) return NextResponse.json({ success: false, message: 'Invalid vacation update filters.' }, { status: 400 });
  try {
    const result = await new AdminVacationUpdatesService().list({ page, limit, doctorId, leaveType, startDate, endDate });
    return NextResponse.json({ success: true, data: result.data, pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) } });
  } catch (error) {
    console.error('Error fetching vacation updates:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch vacation updates' }, { status: 500 });
  }
}
export const GET = withAuth(getHandler, ['admin']);
