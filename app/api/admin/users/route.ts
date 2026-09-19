import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { isUserAccountStatus, isUserRole, type UserAccountStatus, type UserRole } from '@/lib/enums/users.enums';
import { AdminUsersService } from '@/lib/services/admin-users.service';

const SORT_FIELDS = ['createdAt', 'email', 'status', 'role', 'id'] as const;

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: List users and account lifecycle data (Admin only)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1, minimum: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 10, minimum: 1, maximum: 100 } }
 *       - { in: query, name: role, schema: { type: string, enum: [admin, doctor, hospital, patient] } }
 *       - { in: query, name: status, schema: { type: string, enum: [active, inactive, pending, suspended] } }
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: sortBy, schema: { type: string, enum: [createdAt, email, status, role, id], default: createdAt } }
 *       - { in: query, name: sortOrder, schema: { type: string, enum: [asc, desc], default: desc } }
 *     responses:
 *       200: { description: Users retrieved successfully }
 *       400: { description: Invalid query parameter }
 *       401: { description: Authentication required }
 *       403: { description: Admin access required }
 */
async function getHandler(req: AuthenticatedRequest) {
  const query = req.nextUrl.searchParams;
  const page = Number(query.get('page') || '1');
  const limit = Number(query.get('limit') || '10');
  const role = query.get('role');
  const status = query.get('status');
  const sortBy = query.get('sortBy') || 'createdAt';
  const sortOrder = query.get('sortOrder') || 'desc';

  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    return NextResponse.json({ success: false, message: 'page must be at least 1 and limit must be between 1 and 100' }, { status: 400 });
  }
  if (role && role !== 'all' && !isUserRole(role)) {
    return NextResponse.json({ success: false, message: 'Invalid role filter' }, { status: 400 });
  }
  if (status && status !== 'all' && !isUserAccountStatus(status)) {
    return NextResponse.json({ success: false, message: 'Invalid status filter' }, { status: 400 });
  }
  if (!SORT_FIELDS.includes(sortBy as (typeof SORT_FIELDS)[number]) || !['asc', 'desc'].includes(sortOrder)) {
    return NextResponse.json({ success: false, message: 'Invalid sort option' }, { status: 400 });
  }

  try {
    const result = await new AdminUsersService().listUsers({
      page,
      limit,
      role: role && role !== 'all' ? role as UserRole : undefined,
      status: status && status !== 'all' ? status as UserAccountStatus : undefined,
      search: query.get('search')?.trim() || undefined,
      sortBy: sortBy as (typeof SORT_FIELDS)[number],
      sortOrder: sortOrder as 'asc' | 'desc',
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch users' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler, ['admin']);
