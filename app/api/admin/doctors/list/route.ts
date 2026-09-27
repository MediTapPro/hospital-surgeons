import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { AdminDoctorsService } from '@/lib/services/admin-doctors.service';

/** @swagger
 * /api/admin/doctors/list:
 *   get:
 *     summary: List doctors for admin filters
 *     tags: [Admin Doctors]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Doctors retrieved }, 403: { description: Admin access required } }
 */
async function getHandler(_req: AuthenticatedRequest) {
  try {
    const formattedDoctors = await new AdminDoctorsService().list();

    return NextResponse.json({
      success: true,
      data: formattedDoctors,
    });
  } catch (error) {
    console.error('Error fetching doctors list:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch doctors list',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler, ['admin']);
