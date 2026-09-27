import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { AdminAuditLogsService } from '@/lib/services/admin-audit-logs.service';

/** @swagger
 * /api/admin/audit-logs:
 *   get:
 *     summary: List audit logs (Admin only)
 *     tags: [Admin Audit Logs]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *       - { in: query, name: search, schema: { type: string, maxLength: 100 } }
 *       - { in: query, name: actorType, schema: { type: string, maxLength: 50 } }
 *       - { in: query, name: action, schema: { type: string, maxLength: 100 } }
 *       - { in: query, name: entityType, schema: { type: string, maxLength: 100 } }
 *       - { in: query, name: userId, schema: { type: string, format: uuid } }
 *       - { in: query, name: startDate, schema: { type: string, format: date } }
 *       - { in: query, name: endDate, schema: { type: string, format: date } }
 *     responses: { 200: { description: Audit logs retrieved }, 400: { description: Invalid filters }, 403: { description: Admin access required } }
 */
async function getHandler(req: AuthenticatedRequest) {
  const q = req.nextUrl.searchParams;
  const page = Number(q.get('page') || 1);
  const limit = Number(q.get('limit') || 20);
  const values = { search: q.get('search')?.trim() || undefined, actorType: q.get('actorType') || undefined, action: q.get('action') || undefined, entityType: q.get('entityType') || undefined, userId: q.get('userId') || undefined, startDate: q.get('startDate') || undefined, endDate: q.get('endDate') || undefined, sortOrder: (q.get('sortOrder') || 'desc') as 'asc' | 'desc' };
  const invalidDate = (value?: string) => Boolean(value && Number.isNaN(Date.parse(value)));
  const invalidText = (value?: string) => Boolean(value && (value.length > 100 || /[\u0000-\u001f]/.test(value)));
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100 || values.sortOrder === undefined || (values.sortOrder !== 'asc' && values.sortOrder !== 'desc') || invalidText(values.search) || invalidText(values.actorType) || invalidText(values.action) || invalidText(values.entityType) || invalidDate(values.startDate) || invalidDate(values.endDate) || (values.startDate && values.endDate && values.startDate > values.endDate)) return NextResponse.json({ success: false, message: 'Invalid audit log filters.' }, { status: 400 });
  try { const result = await new AdminAuditLogsService().list({ page, limit, ...values }); return NextResponse.json({ success: true, data: result.data, pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) } }); }
  catch (error) { console.error('Error fetching audit logs:', error); return NextResponse.json({ success: false, message: 'Failed to fetch audit logs' }, { status: 500 }); }
}
export const GET = withAuth(getHandler, ['admin']);
