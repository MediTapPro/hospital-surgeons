import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { PatientProfilesService } from '@/lib/services/patient-profiles.service';

/**
 * @swagger
 * /api/patients/bookings:
 *   get:
 *     summary: Get logged-in patient's home visit bookings
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of the patient's home visit bookings
 *       401:
 *         description: Unauthorized
 */
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const userId = req.user!.userId;
    const service = new PatientProfilesService();
    const bookings = await service.getHomeVisitBookings(userId);

    return NextResponse.json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    console.error('Error fetching patient home visit bookings:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      success: false,
      message: errorMessage,
    }, { status: 400 });
  }
}, ['patient']);
