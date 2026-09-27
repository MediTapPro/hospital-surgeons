import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { AdminAssignmentsService } from '@/lib/services/admin-assignments.service';

/** @swagger
 * /api/admin/assignments/stats:
 *   get:
 *     summary: Get assignment statistics
 *     tags: [Admin Assignments]
 *     security: [{ bearerAuth: [] }]
 */
const service = new AdminAssignmentsService();

async function getHandler(_req: AuthenticatedRequest) {
  try {
    return NextResponse.json({ success: true, data: await service.stats() });
  } catch (error) {
    console.error('Error fetching assignment statistics:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch assignment statistics' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler, ['admin']);
