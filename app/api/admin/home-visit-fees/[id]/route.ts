import { NextResponse } from 'next/server';
import { withAuthAndContext, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { PlatformFeesService } from '@/lib/services/platform-fees.service';
import { getRequestMetadata } from '@/lib/utils/audit-logger';

const feesService = new PlatformFeesService();

/**
 * @swagger
 * /api/admin/home-visit-fees/{id}:
 *   delete:
 *     summary: Delete a specialty-specific home-visit fee
 *     tags: [Admin Home Visits]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Fee deleted }
 *       400: { description: Fee cannot be deleted }
 *       403: { description: Admin access required }
 */
async function deleteHandler(
  req: AuthenticatedRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const id = params.id;

  const result = await feesService.deletePlatformFee(id, { userId: req.user!.userId, requestMetadata: getRequestMetadata(req) });
  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}

export const DELETE = withAuthAndContext(deleteHandler, ['admin']);
