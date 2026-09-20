import { NextResponse } from 'next/server';
import { createAuditLog, getRequestMetadata } from '@/lib/utils/audit-logger';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { CreateHomeVisitDtoSchema } from '@/lib/validations/home-visit.dto';
import { validateRequest } from '@/lib/utils/validate-request';
import { HomeVisitsService } from '@/lib/services/home-visits.service';

/**
 * @swagger
 * /api/bookings/home-visit:
 *   get:
 *     summary: Get a patient's home-visit booking quote for a doctor
 *     tags: [Home Visits]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: doctorId
 *         required: true
 *         schema: { type: string, format: uuid }
 *   post:
 *     summary: Create a patient home-visit booking
 *     description: Applies availability, free-trial, and booking-time payment snapshot rules.
 *     tags: [Home Visits]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Home visit booking created }
 *       400: { description: Invalid booking request or unavailable slot }
 *       401: { description: Authentication required }
 */
async function postHandler(req: AuthenticatedRequest) {
  try {
    const user = req.user;
    if (!user || !user.userId) {
      return NextResponse.json(
        { success: false, message: 'User context not found' },
        { status: 401 }
      );
    }

    // Validate request body
    const validation = await validateRequest(req, CreateHomeVisitDtoSchema);
    if (!validation.success) {
      return validation.response;
    }

    const dto = validation.data;

    // Call service layer for business logic execution
    const homeVisitsService = new HomeVisitsService();
    const result = await homeVisitsService.createHomeVisitBooking(user.userId, dto);

    if (!result.success) {
      // Map error codes to appropriate HTTP status codes
      let status = 400;
      if (result.code === 'PATIENT_PROFILE_NOT_FOUND') status = 404;
      else if (result.code === 'PARENT_SLOT_NOT_FOUND' || result.code === 'SLOT_NOT_FOUND') status = 404;
      else if (result.code === 'ASSIGNMENT_LIMIT_REACHED') status = 403;

      return NextResponse.json(
        {
          success: false,
          message: result.message,
          error: result.code,
        },
        { status }
      );
    }

    const newAssignment = result.data;
    const patientName = result.patientName;
    const expiresAt = result.expiresAt;

    // Log audit event
    const metadata = getRequestMetadata(req);
    const doctorResult = result.doctor;

    const doctorName = doctorResult ? `Dr. ${doctorResult.firstName} ${doctorResult.lastName}` : null;

    await createAuditLog({
      userId: user.userId,
      actorType: 'user',
      action: 'create',
      entityType: 'assignment',
      entityId: newAssignment.id,
      entityName: `Home Visit Booking: ${doctorName} → ${patientName}`,
      httpMethod: 'POST',
      endpoint: '/api/bookings/home-visit',
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      details: {
        doctorId: dto.doctorId,
        doctorName,
        patientProfileId: newAssignment.patientProfileId,
        patientName,
        priority: dto.priority || 'routine',
        expiresAt: expiresAt?.toISOString(),
        createdAt: new Date().toISOString(),
      },
    });

    // Send push notification to the doctor about the new home visit request
    try {
      if (doctorResult?.userId) {
        const { NotificationsService } = await import('@/lib/services/notifications.service');
        const notificationsService = new NotificationsService();
        const deepLink = 'hospitalapp://view_assignment';

        await notificationsService.sendPushNotification(doctorResult.userId, {
          userId: doctorResult.userId,
          recipientType: 'user',
          notificationType: 'booking',
          title: 'New Home Visit Request',
          message: `You have received a new home visit request from ${patientName}`,
          channel: 'push',
          priority: dto.priority === 'emergency' ? 'urgent' : dto.priority === 'urgent' ? 'high' : 'medium',
          assignmentId: newAssignment.id,
          payload: {
            notificationType: 'assignment_created',
            assignmentId: newAssignment.id,
            doctorId: dto.doctorId,
            patientName: patientName,
            priority: dto.priority || 'routine',
            deepLink: deepLink,
          },
        });
      }
    } catch (notificationError) {
      console.error('Failed to send notification to doctor:', notificationError);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...newAssignment,
        paymentMode: result.paymentMode,
        isFreeTrial: result.isFreeTrial,
      },
      message: 'Home visit booking created successfully',
    }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/bookings/home-visit:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to create home visit booking',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

async function getHandler(req: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const doctorId = searchParams.get('doctorId');

    if (!doctorId) {
      return NextResponse.json(
        { success: false, message: 'doctorId parameter is required' },
        { status: 400 }
      );
    }

    const user = req.user;
    if (!user?.userId) {
      return NextResponse.json(
        { success: false, message: 'User context not found' },
        { status: 401 }
      );
    }

    const homeVisitsService = new HomeVisitsService();
    const quoteResult = await homeVisitsService.getBookingQuote(user.userId, doctorId);
    return NextResponse.json(quoteResult, { status: quoteResult.success ? 200 : 400 });
  } catch (error) {
    console.error('Error in GET /api/bookings/home-visit:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to retrieve home visit fee',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler, ['patient', 'admin']);
export const POST = withAuth(postHandler, ['patient', 'admin']);
