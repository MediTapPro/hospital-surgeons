import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { AdminUsersService } from '@/lib/services/admin-users.service';
import { AdminCreateDtoSchema } from '@/lib/validations/auth.dto';
import { getRequestMetadata } from '@/lib/utils/audit-logger';
import { validateRequest } from '@/lib/utils/validate-request';

/**
 * @swagger
 * /api/admin/users/admin:
 *   post:
 *     summary: Create an administrator account (Admin only)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password, minLength: 8 }
 *     responses:
 *       201: { description: Administrator created }
 *       400: { description: Invalid request }
 *       401: { description: Authentication required }
 *       403: { description: Admin access required }
 *       409: { description: Email already exists }
 */
async function postHandler(req: AuthenticatedRequest) {
  const validation = await validateRequest(req, AdminCreateDtoSchema);
  if (!validation.success) return validation.response;
  try {
    const result = await new AdminUsersService().createAdmin({ ...validation.data, adminUserId: req.user!.userId, requestMetadata: getRequestMetadata(req) });
    if (!result.success) return NextResponse.json({ success: false, message: 'A user with this email already exists' }, { status: 409 });
    return NextResponse.json({ success: true, message: 'Administrator created successfully', data: result.data }, { status: 201 });
  } catch (error) {
    console.error('Error creating administrator:', error);
    return NextResponse.json({ success: false, message: 'Failed to create administrator' }, { status: 500 });
  }
}

export const POST = withAuth(postHandler, ['admin']);
