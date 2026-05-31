import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { assignmentPayments, assignments, doctors, hospitals, patients, users, doctorAvailability } from '@/src/db/drizzle/migrations/schema';
import { eq, desc, and, sql, inArray } from 'drizzle-orm';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';

/**
 * @swagger
 * /api/doctors/{id}/payments:
 *   get:
 *     summary: Get payments for a doctor
 *     tags: [Doctors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Doctor ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, processing, completed, failed]
 *         description: Filter by payment status
 *     responses:
 *       200:
 *         description: Payments retrieved successfully
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
 *                     payments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           assignmentId:
 *                             type: string
 *                             format: uuid
 *                           consultationFee:
 *                             type: number
 *                           platformCommission:
 *                             type: number
 *                           doctorPayout:
 *                             type: number
 *                           paymentStatus:
 *                             type: string
 *                             enum: [pending, processing, completed, failed]
 *                           paidToDoctorAt:
 *                             type: string
 *                             format: date-time
 *                             nullable: true
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           assignment:
 *                             type: object
 *                             properties:
 *                               completedAt:
 *                                 type: string
 *                                 format: date-time
 *                                 nullable: true
 *                               status:
 *                                 type: string
 *                           hospital:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 format: uuid
 *                               name:
 *                                 type: string
 *                           patient:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 format: uuid
 *                               name:
 *                                 type: string
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *                         hasNextPage:
 *                           type: boolean
 *                         hasPrevPage:
 *                           type: boolean
 *       403:
 *         description: Doctor can only view their own payments
 *       500:
 *         description: Internal server error
 */
async function getHandler(
  req: AuthenticatedRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const doctorId = params.id;
    const db = getDb();
    const user = (req as any).user;
    const searchParams = req.nextUrl.searchParams;

    // Authorization: Doctors can only view their own payments, admins can view any
    if (user.userRole === 'doctor') {
      const { DoctorsService } = await import('@/lib/services/doctors.service');
      const doctorsService = new DoctorsService();
      const doctorResult = await doctorsService.findDoctorByUserId(user.userId);
      
      if (!doctorResult.success || !doctorResult.data || doctorResult.data.id !== doctorId) {
        return NextResponse.json(
          {
            success: false,
            message: 'You do not have permission to view these payments',
          },
          { status: 403 }
        );
      }
    }

    // Pagination
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;

    // Filter by status if provided
    const statusFilter = searchParams.get('status') || undefined;

    // Build where conditions
    const whereConditions: any[] = [eq(assignmentPayments.doctorId, doctorId)];
    if (statusFilter) {
      whereConditions.push(eq(assignmentPayments.paymentStatus, statusFilter as any));
    }

    // Earnings summary (all-time)
    const totalEarningsResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${assignmentPayments.doctorPayout}), 0)`,
      })
      .from(assignmentPayments)
      .where(
        and(
          eq(assignmentPayments.doctorId, doctorId),
          eq(assignmentPayments.paymentStatus, 'completed')
        )
      );

    const pendingEarningsResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${assignmentPayments.doctorPayout}), 0)`,
      })
      .from(assignmentPayments)
      .where(
        and(
          eq(assignmentPayments.doctorId, doctorId),
          inArray(assignmentPayments.paymentStatus, ['pending', 'processing'])
        )
      );

    const totalEarnings = Number(totalEarningsResult[0]?.total || 0);
    const pendingEarnings = Number(pendingEarningsResult[0]?.total || 0);

    // Get total count
    const totalCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(assignmentPayments)
      .where(and(...whereConditions));

    const total = Number(totalCount[0]?.count || 0);
    const totalPages = Math.ceil(total / limit);

    // Get payments with assignment, hospital, and patient details
    const payments = await db
      .select({
        id: assignmentPayments.id,
        assignmentId: assignmentPayments.assignmentId,
        consultationFee: assignmentPayments.consultationFee,
        platformCommission: assignmentPayments.platformCommission,
        doctorPayout: assignmentPayments.doctorPayout,
        paymentStatus: assignmentPayments.paymentStatus,
        paymentMethod: assignmentPayments.paymentMethod,
        paidToDoctorAt: assignmentPayments.paidToDoctorAt,
        createdAt: assignmentPayments.createdAt,
        // Assignment details
        assignmentCompletedAt: assignments.completedAt,
        assignmentStatus: assignments.status,
        assignmentRequestedAt: assignments.requestedAt,
        // Slot date (from doctor_availability if linked)
        slotDate: doctorAvailability.slotDate,
        // Hospital details
        hospitalId: hospitals.id,
        hospitalName: hospitals.name,
        // Patient details (from assignment)
        patientId: patients.id,
        patientName: patients.fullName,
      })
      .from(assignmentPayments)
      .innerJoin(assignments, eq(assignments.id, assignmentPayments.assignmentId))
      .innerJoin(hospitals, eq(hospitals.id, assignmentPayments.hospitalId))
      .innerJoin(patients, eq(patients.id, assignments.patientId))
      .leftJoin(doctorAvailability, eq(doctorAvailability.id, assignments.availabilitySlotId))
      .where(and(...whereConditions))
      .orderBy(desc(assignmentPayments.createdAt))
      .limit(limit)
      .offset(offset);

    // Format response
    const formattedPayments = payments.map(payment => ({
      id: payment.id,
      assignmentId: payment.assignmentId,
      consultationFee: payment.consultationFee ? parseFloat(payment.consultationFee.toString()) : 0,
      platformCommission: payment.platformCommission ? parseFloat(payment.platformCommission.toString()) : 0,
      doctorPayout: payment.doctorPayout ? parseFloat(payment.doctorPayout.toString()) : 0,
      paymentStatus: payment.paymentStatus,
      paymentMethod: payment.paymentMethod || null,
      paidToDoctorAt: payment.paidToDoctorAt,
      createdAt: payment.createdAt,
      assignment: {
        completedAt: payment.assignmentCompletedAt,
        status: payment.assignmentStatus,
        date: payment.slotDate || (payment.assignmentRequestedAt ? new Date(payment.assignmentRequestedAt).toISOString().split('T')[0] : null),
      },
      hospital: {
        id: payment.hospitalId,
        name: payment.hospitalName,
      },
      patient: {
        id: payment.patientId,
        name: payment.patientName,
      },
    }));

    return NextResponse.json({
      success: true,
      data: {
        totalEarnings,
        pendingEarnings,
        payments: formattedPayments,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching doctor payments:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch payments',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const GET = withAuthAndContext(getHandler, ['doctor', 'admin']);

