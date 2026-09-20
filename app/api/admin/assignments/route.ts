import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { AdminAssignmentsService } from '@/lib/services/admin-assignments.service';

/**
 * @swagger
 * /api/admin/assignments:
 *   get:
 *     summary: List hospital and home-visit assignments
 *     tags: [Admin Assignments]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Assignment list }
 *       403: { description: Admin access required }
 */
const service = new AdminAssignmentsService();

async function getHandler(req: AuthenticatedRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get('page') || 1));
    const limit = Math.min(100, Math.max(1, Number(params.get('limit') || 10)));
    const result = await service.list({
      page,
      limit,
      status: params.get('status') || undefined,
      priority: params.get('priority') || undefined,
      doctorId: params.get('doctorId') || undefined,
      hospitalId: params.get('hospitalId') || undefined,
      startDate: params.get('startDate') || undefined,
      endDate: params.get('endDate') || undefined,
      search: params.get('search') || undefined,
      sortBy: params.get('sortBy') || 'requestedAt',
      sortOrder: params.get('sortOrder') === 'asc' ? 'asc' : 'desc',
    });
    return NextResponse.json({ success: true, data: result.data, pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) } });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch assignments' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler, ['admin']);
