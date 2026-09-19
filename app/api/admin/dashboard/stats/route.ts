import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { AdminDashboardService } from '@/lib/services/admin-dashboard.service';

/**
 * @swagger
 * /api/admin/dashboard/stats:
 *   get:
 *     summary: Get admin dashboard statistics (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     activeDoctors:
 *                       type: integer
 *                     activeHospitals:
 *                       type: integer
 *                     todayAssignments:
 *                       type: integer
 *                     homeVisitsToday:
 *                       type: integer
 *                     homeVisitPatientPaymentsCollected:
 *                       type: number
 *                     homeVisitPendingDoctorPayout:
 *                       type: number
 *                     activeSubscriptions:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 */
async function getHandler(_req: AuthenticatedRequest) {
  try {
    const result = await new AdminDashboardService().getDashboardStats();
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch dashboard statistics',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler, ['admin']);




