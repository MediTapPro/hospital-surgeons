import { NextResponse } from 'next/server';
import { withAuthAndContext, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { ADMIN_MANAGEABLE_USER_ROLES, isAdminManageableUserRole } from '@/lib/enums/users.enums';
import { AdminUsersService } from '@/lib/services/admin-users.service';
import { getRequestMetadata } from '@/lib/utils/audit-logger';

/**
 * @swagger
 * /api/admin/users/{id}/role:
 *   put:
 *     summary: Update a user's role (Admin only)
 *     description: Updates the user role and audit event atomically. Existing admin accounts and the current admin's own role are protected.
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role: { type: string, enum: [doctor, hospital, admin] }
 *               reason: { type: string }
 *     responses:
 *       200: { description: User role updated }
 *       400: { description: Invalid role }
 *       403: { description: Admin access required or protected account }
 *       404: { description: User not found }
 */
async function putHandler(req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) {
  const body = await req.json();
  if (!isAdminManageableUserRole(body.role)) {
    return NextResponse.json(
      { success: false, message: `Invalid role. Must be one of: ${ADMIN_MANAGEABLE_USER_ROLES.join(', ')}` },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  try {
    const result = await new AdminUsersService().updateUserRole({
      targetUserId: id,
      adminUserId: req.user!.userId,
      role: body.role,
      reason: typeof body.reason === 'string' ? body.reason : undefined,
      requestMetadata: getRequestMetadata(req),
    });
    if (!result.success) {
      const status = result.code === 'NOT_FOUND' ? 404 : 403;
      const message = result.code === 'NOT_FOUND'
        ? 'User not found'
        : result.code === 'ADMIN_ROLE_PROTECTED'
          ? 'Cannot change admin role'
          : 'You cannot change your own role';
      return NextResponse.json({ success: false, message }, { status });
    }
    return NextResponse.json({
      success: true,
      message: result.unchanged ? 'User role is already up to date' : 'User role updated successfully',
      data: result.data,
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    return NextResponse.json({ success: false, message: 'Failed to update user role' }, { status: 500 });
  }
}

export const PUT = withAuthAndContext(putHandler, ['admin']);
