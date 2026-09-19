import { NextResponse } from 'next/server';
import { withAuthAndContext, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { AdminUsersService } from '@/lib/services/admin-users.service';
import { getRequestMetadata } from '@/lib/utils/audit-logger';

/**
 * @swagger
 * /api/admin/users/{id}:
 *   get:
 *     summary: Get a user's admin detail view (Admin only)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: User details retrieved }
 *       401: { description: Authentication required }
 *       403: { description: Admin access required }
 *       404: { description: User not found }
 *   delete:
 *     summary: Suspend a user account (Admin only)
 *     description: Soft-deletes a non-admin user by setting its account status to suspended and writing an audit entry atomically.
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: User suspended }
 *       401: { description: Authentication required }
 *       403: { description: Admin access required, protected account, or self-update }
 *       404: { description: User not found }
 */
async function getHandler(req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const data = await new AdminUsersService().getUserDetail(id);
    if (!data) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch user' }, { status: 500 });
  }
}

async function deleteHandler(req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const result = await new AdminUsersService().suspendUser({
      targetUserId: id,
      adminUserId: req.user!.userId,
      requestMetadata: getRequestMetadata(req),
    });
    if (!result.success) {
      const status = result.code === 'NOT_FOUND' ? 404 : 403;
      const message = result.code === 'NOT_FOUND' ? 'User not found' : result.code === 'ADMIN_SUSPEND_FORBIDDEN' ? 'Cannot delete admin users' : 'You cannot change your own account status';
      return NextResponse.json({ success: false, message }, { status });
    }
    return NextResponse.json({
      success: true,
      message: result.unchanged ? 'User is already suspended' : 'User deleted successfully (soft delete - status set to suspended)',
      data: result.data,
    });
  } catch (error) {
    console.error('Error suspending user:', error);
    return NextResponse.json({ success: false, message: 'Failed to delete user' }, { status: 500 });
  }
}

export const GET = withAuthAndContext(getHandler, ['admin']);
export const DELETE = withAuthAndContext(deleteHandler, ['admin']);
