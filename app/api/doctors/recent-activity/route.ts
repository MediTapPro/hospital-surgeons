import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { DoctorsService } from '@/lib/services/doctors.service';
import { BookingsService } from '@/lib/services/bookings.service';

/**
 * @swagger
 * /api/doctors/recent-activity:
 *   get:
 *     summary: Get recent activity for the authenticated doctor
 *     tags: [Doctors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Maximum number of activities to return
 *     responses:
 *       200:
 *         description: Recent activity retrieved successfully
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
 *                       type:
 *                         type: string
 *                         enum: [assignment_completed, credential_verified]
 *                       icon:
 *                         type: string
 *                       text:
 *                         type: string
 *                       time:
 *                         type: string
 *                         description: Human-readable time ago (e.g., "2 hours ago")
 *                       timestamp:
 *                         type: string
 *                         format: date-time
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
    const activities: any[] = [];

    // Get recent completed bookings
    const completedBookings = await bookingsService.findBookings({
      doctorId,
      status: 'completed',
      page: 1,
      limit: 5,
    });

    if (completedBookings.success && completedBookings.data) {
      const bookings = Array.isArray(completedBookings.data) ? completedBookings.data : [];
      bookings.forEach((booking: any) => {
        if (booking.completedAt) {
          activities.push({
            type: 'assignment_completed',
            icon: '✓',
            text: `Completed assignment from ${booking.hospital?.name || 'Hospital'}`,
            time: formatTimeAgo(new Date(booking.completedAt)),
            timestamp: booking.completedAt,
          });
        }
      });
    }

    // Get recent credentials
    const credentialsResult = await doctorsService.getDoctorCredentials(doctorId);
    if (credentialsResult.success && credentialsResult.data) {
      const verifiedCredentials = credentialsResult.data
        .filter((c: any) => c.verificationStatus === 'verified')
        .slice(0, 3);
      
      verifiedCredentials.forEach((credential: any) => {
        activities.push({
          type: 'credential_verified',
          icon: '✅',
          text: `Credential verified: ${credential.title}`,
          time: formatTimeAgo(new Date(credential.uploadedAt)),
          timestamp: credential.uploadedAt,
        });
      });
    }

    // Sort by timestamp and limit
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const limitedActivities = activities.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: limitedActivities,
    });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

export const GET = withAuth(getHandler);

