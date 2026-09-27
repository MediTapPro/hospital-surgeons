import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { AdminAuditLogsService } from '@/lib/services/admin-audit-logs.service';

/** @swagger
 * /api/admin/audit-logs/export:
 *   get:
 *     summary: Export audit logs as CSV (Admin only)
 *     tags: [Admin Audit Logs]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: query, name: format, schema: { type: string, enum: [csv, json], default: csv } }]
 *     responses: { 200: { description: Audit log export }, 403: { description: Admin access required } }
 */
async function getHandler(req: AuthenticatedRequest) {
  const q = req.nextUrl.searchParams;
  const format = q.get('format') || 'csv';
  if (!['csv', 'json'].includes(format)) return NextResponse.json({ success: false, message: 'Invalid export format.' }, { status: 400 });
  const query = { search: q.get('search')?.trim() || undefined, actorType: q.get('actorType') || undefined, action: q.get('action') || undefined, entityType: q.get('entityType') || undefined, userId: q.get('userId') || undefined, startDate: q.get('startDate') || undefined, endDate: q.get('endDate') || undefined };
  try {
    const logs = await new AdminAuditLogsService().export(query);
    if (format === 'json') return NextResponse.json({ success: true, data: logs, count: logs.length });
    const headers = ['ID', 'User Email', 'User Role', 'Actor Type', 'Action', 'Entity Type', 'Entity ID', 'Details', 'Created At'];
    const rows = logs.map((log: any) => [log.id, log.userEmail || '', log.userRole || '', log.actorType, log.action, log.entityType, log.entityId || '', JSON.stringify(log.details || {}), log.createdAt].map((field) => `"${String(field).replace(/"/g, '""')}"`).join(','));
    return new NextResponse([headers.join(','), ...rows].join('\n'), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"` } });
  } catch (error) { console.error('Error exporting audit logs:', error); return NextResponse.json({ success: false, message: 'Failed to export audit logs' }, { status: 500 }); }
}
export const GET = withAuth(getHandler, ['admin']);
