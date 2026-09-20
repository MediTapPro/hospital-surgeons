import { NextResponse } from 'next/server';
import { withAuthAndContext, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { AdminAssignmentsService } from '@/lib/services/admin-assignments.service';
import { getRequestMetadata } from '@/lib/utils/audit-logger';

/**
 * @swagger
 * /api/admin/assignments/{id}:
 *   get:
 *     summary: Get assignment details
 *     tags: [Admin Assignments]
 *     security: [{ bearerAuth: [] }]
 *   put:
 *     summary: Update assignment notes or status
 *     tags: [Admin Assignments]
 *     security: [{ bearerAuth: [] }]
 */
const service = new AdminAssignmentsService();
type Context = { params: Promise<{ id: string }> };

async function getHandler(_req: AuthenticatedRequest, { params }: Context) {
  try {
    const data = await service.get((await params).id);
    return data ? NextResponse.json({ success: true, data }) : NextResponse.json({ success: false, message: 'Assignment not found' }, { status: 404 });
  } catch (error) {
    console.error('Error fetching assignment:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch assignment' }, { status: 500 });
  }
}

async function putHandler(req: AuthenticatedRequest, { params }: Context) {
  try {
    const id = (await params).id;
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.status !== undefined) data.status = body.status;
    if (body.treatmentNotes !== undefined) data.treatmentNotes = body.treatmentNotes;
    if (body.status === 'completed') data.completedAt = new Date().toISOString();
    if (body.status === 'cancelled') {
      data.cancelledAt = new Date().toISOString();
      if (body.cancellationReason) data.cancellationReason = body.cancellationReason;
      if (body.cancelledBy) data.cancelledBy = body.cancelledBy;
    }
    const metadata = getRequestMetadata(req);
    const result = await service.update(id, data, {
      userId: req.user?.userId ?? null,
      actorType: 'admin', action: 'update', entityType: 'assignment', httpMethod: 'PUT',
      endpoint: `/api/admin/assignments/${id}`, ipAddress: metadata.ipAddress, userAgent: metadata.userAgent,
      details: { updatedAt: new Date().toISOString(), reason: body.cancellationReason || undefined },
    });
    return result ? NextResponse.json({ success: true, message: 'Assignment updated successfully', data: result }) : NextResponse.json({ success: false, message: 'Assignment not found' }, { status: 404 });
  } catch (error) {
    console.error('Error updating assignment:', error);
    return NextResponse.json({ success: false, message: 'Failed to update assignment' }, { status: 500 });
  }
}

export const GET = withAuthAndContext(getHandler, ['admin']);
export const PUT = withAuthAndContext(putHandler, ['admin']);
