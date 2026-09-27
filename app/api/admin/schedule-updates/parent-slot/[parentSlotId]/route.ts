import { NextResponse } from 'next/server';
import { withAuthAndContext, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { AdminScheduleUpdatesService } from '@/lib/services/admin-schedule-updates.service';

/** @swagger
 * /api/admin/schedule-updates/parent-slot/{parentSlotId}:
 *   get:
 *     summary: Get a parent schedule slot and its sub-slots
 *     tags: [Admin Schedule]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: parentSlotId, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Parent slot details }, 404: { description: Parent slot not found }, 403: { description: Admin access required } }
 */
async function getHandler(_req: AuthenticatedRequest, context: { params: Promise<{ parentSlotId: string }> }) {
  const { parentSlotId } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parentSlotId)) return NextResponse.json({ success: false, message: 'Invalid parent slot id.' }, { status: 400 });
  try { const data = await new AdminScheduleUpdatesService().parentDetail(parentSlotId); return data ? NextResponse.json({ success: true, data }) : NextResponse.json({ success: false, message: 'Parent slot not found' }, { status: 404 }); }
  catch (error) { return NextResponse.json({ success: false, message: 'Failed to fetch parent slot details' }, { status: 500 }); }
}
export const GET = withAuthAndContext(getHandler, ['admin']);
