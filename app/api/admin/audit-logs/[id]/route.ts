import { NextResponse } from 'next/server';
import { withAuthAndContext, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { AdminAuditLogsService } from '@/lib/services/admin-audit-logs.service';

/** @swagger
 * /api/admin/audit-logs/{id}:
 *   get:
 *     summary: Get an audit log (Admin only)
 *     tags: [Admin Audit Logs]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Audit log retrieved }, 404: { description: Audit log not found }, 403: { description: Admin access required } }
 */
async function getHandler(_req: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({ success: false, message: 'Invalid audit log id.' }, { status: 400 });
  try { const log = await new AdminAuditLogsService().getById(id); return log ? NextResponse.json({ success: true, data: log }) : NextResponse.json({ success: false, message: 'Audit log not found' }, { status: 404 }); }
  catch (error) { console.error('Error fetching audit log:', error); return NextResponse.json({ success: false, message: 'Failed to fetch audit log' }, { status: 500 }); }
}
export const GET = withAuthAndContext(getHandler, ['admin']);
