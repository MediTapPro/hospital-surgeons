import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { DoctorsService } from '@/lib/services/doctors.service';
import { BookingsService } from '@/lib/services/bookings.service';

/**
 * @swagger
 * /api/doctors/pending-assignments:
 *   get:
 *     summary: Get pending assignment requests for the authenticated doctor
 *     tags: [Doctors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Maximum number of assignments to return
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, emergency]
 *         description: Filter by priority level
 *     responses:
 *       200:
 *         description: Pending assignments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       hospitalName:
 *                         type: string
 *                       patientName:
 *                         type: string
 *                       patientAge:
 *                         type: integer
 *                         nullable: true
 *                       condition:
 *                         type: string
 *                       status:
 *                         type: string
 *                       priority:
 *                         type: string
 *                       requestedAt:
 *                         type: string
 *                         format: date-time
 *                       expiresAt:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       expiresIn:
 *                         type: string
 *                         nullable: true
 *                         description: Human-readable time until expiry (e.g., "2h 30m")
 *                       consultationFee:
 *                         type: number
 *                         nullable: true
 *                 count:
 *                   type: number
 *       404:
 *         description: Doctor profile not found
 *       500:
 *         description: Internal server error
 */
async function getHandler(req: NextRequest) {
  try {
    const user = (req as any).user;
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const priority = searchParams.get('priority');

    const doctorsService = new DoctorsService();
    const bookingsService = new BookingsService();

    // Find doctor by userId
    const doctorResult = await doctorsService.findDoctorByUserId(user.userId);
    if (!doctorResult.success || !doctorResult.data) {
      return NextResponse.json(
        { success: false, message: 'Doctor profile not found' },
        { status: 404 }
      );
    }

    const doctorId = doctorResult.data.id;

    // Get pending bookings
    const bookingsResult = await bookingsService.findBookings({
      doctorId,
      status: 'pending',
      page: 1,
      limit,
    });

    if (!bookingsResult.success || !bookingsResult.data) {
      return NextResponse.json({
        success: true,
        data: [],
        count: 0,
      });
    }

    const bookings = Array.isArray(bookingsResult.data) ? bookingsResult.data : [];
    const now = new Date();

    // Transform bookings to match expected format
    const assignmentsWithExpiry = bookings.map((booking: any) => {
      let expiresIn = null;
      if (booking.expiresAt) {
        const expiryDate = new Date(booking.expiresAt);
        const diffMs = expiryDate.getTime() - now.getTime();
        if (diffMs > 0) {
          const hours = Math.floor(diffMs / (1000 * 60 * 60));
          const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
          if (hours > 0) {
            expiresIn = `${hours}h ${minutes}m`;
          } else {
            expiresIn = `${minutes} min`;
          }
        }
      }

      // Calculate patient age
      let patientAge = null;
      if (booking.patient?.dateOfBirth) {
        const birthDate = new Date(booking.patient.dateOfBirth);
        const age = now.getFullYear() - birthDate.getFullYear();
        const monthDiff = now.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
          patientAge = age - 1;
        } else {
          patientAge = age;
        }
      }

      return {
        id: booking.id,
        hospitalName: booking.hospital?.name || 'Unknown Hospital',
        patientName: booking.patient?.fullName || 'Unknown Patient',
        patientAge,
        condition: booking.patient?.medicalCondition || booking.medicalCondition || 'Not specified',
        status: booking.status,
        priority: booking.priority || 'medium',
        requestedAt: booking.requestedAt || booking.createdAt,
        expiresAt: booking.expiresAt,
        expiresIn,
        consultationFee: booking.consultationFee || booking.doctorFee ? Number(booking.consultationFee || booking.doctorFee) : null,
      };
    });

    return NextResponse.json({
      success: true,
      data: assignmentsWithExpiry,
      count: assignmentsWithExpiry.length,
    });
  } catch (error) {
    console.error('Error fetching pending assignments:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);

