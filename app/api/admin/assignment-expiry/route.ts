import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { getRequestMetadata } from '@/lib/utils/audit-logger';
import { AssignmentExpiryService } from '@/lib/services/assignment-expiry.service';

const service = new AssignmentExpiryService();

/**
 * @swagger
 * /api/admin/assignment-expiry:
 *   get:
 *     summary: Get assignment expiry settings
 *     tags: [Admin Settings]
 *     security: [{ bearerAuth: [] }]
 *   put:
 *     summary: Update assignment expiry settings
 *     tags: [Admin Settings]
 *     security: [{ bearerAuth: [] }]
 *     requestBody: { required: true, content: { application/json: { schema: { type: array, items: { type: object, required: [priority, expiryHours, isActive], properties: { priority: { type: string, enum: [routine, urgent, emergency] }, expiryHours: { type: integer, minimum: 1 }, isActive: { type: boolean } } } } } } }
 */
async function getHandler() { return NextResponse.json(await service.getSettings()); }
async function putHandler(req: AuthenticatedRequest) {
  try {
    const body = await req.json();
    const result = await service.updateSettings(body, req.user?.userId ?? null, getRequestMetadata(req));
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid assignment expiry settings request.' }, { status: 400 });
  }
}

export const GET = withAuth(getHandler, ['admin']);
export const PUT = withAuth(putHandler, ['admin']);
