import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
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
 */
async function getHandler() { return NextResponse.json(await service.getSettings()); }
async function putHandler(req: AuthenticatedRequest) {
  const result = await service.updateSettings(await req.json(), req.user?.userId ?? null);
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}

export const GET = withAuth(getHandler, ['admin']);
export const PUT = withAuth(putHandler, ['admin']);
