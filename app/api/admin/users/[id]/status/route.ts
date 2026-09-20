import { NextResponse } from 'next/server';
import { withAuthAndContext, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { isUserAccountStatus, USER_ACCOUNT_STATUSES } from '@/lib/enums/users.enums';
import { AdminUsersService } from '@/lib/services/admin-users.service';
import { getRequestMetadata } from '@/lib/utils/audit-logger';

/**
 * @swagger
 * /api/admin/users/{id}/status:
 *   put:
 *     summary: Update a user's account access status (Admin only)
 *     description: Updates the user's lifecycle status and writes its audit event atomically. An admin cannot change their own account status.
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [active, inactive, pending, suspended] }
 *               reason: { type: string }
 *     responses:
 *       200: { description: Account status updated }
 *       400: { description: Invalid account status }
 *       403: { description: Admin access required or self-update is not allowed }
 *       404: { description: User not found }
 */
async function putHandler(
  req: AuthenticatedRequest,
  context: { params: Promise<{ id: string }> },
) {
  const body = await req.json();
  if (!isUserAccountStatus(body.status)) {
    return NextResponse.json(
      { success: false, message: `Invalid status. Must be one of: ${USER_ACCOUNT_STATUSES.join(', ')}` },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  const result = await new AdminUsersService().updateAccountStatus({
    targetUserId: id,
    adminUserId: req.user!.userId,
    status: body.status,
    reason: typeof body.reason === 'string' ? body.reason : undefined,
    requestMetadata: getRequestMetadata(req),
  });

  if (!result.success) {
    const responseStatus = result.code === 'NOT_FOUND' ? 404 : 403;
    const message = result.code === 'NOT_FOUND'
      ? 'User not found'
      : 'You cannot change your own account status';
    return NextResponse.json({ success: false, message }, { status: responseStatus });
  }

  return NextResponse.json({
    success: true,
    message: result.unchanged ? 'User status is already up to date' : 'User status updated successfully',
    data: result.data,
  });
}

export const PUT = withAuthAndContext(putHandler, ['admin']);
