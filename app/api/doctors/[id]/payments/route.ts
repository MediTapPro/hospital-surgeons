import { NextResponse } from 'next/server';
import { withAuthAndContext, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { AssignmentPaymentsService } from '@/lib/services/assignment-payments.service';

/**
 * @swagger
 * /api/doctors/{id}/payments:
 *   get:
 *     summary: List a doctor's assignment payments and settlement balances
 *     description: Returns hospital-assignment and home-visit records. `patientPaymentStatus` applies to home visits; `paymentStatus` is always the doctor-settlement status.
 *     tags: [Doctors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 50 }
 *       - in: query
 *         name: source
 *         schema: { type: string, enum: [hospital_assignment, home_visit] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, processing, completed, failed] }
 *     responses:
 *       200: { description: Payments retrieved successfully }
 *       403: { description: Doctor can only view their own payment records }
 *       500: { description: Unable to load payment records }
 */
async function getHandler(req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: doctorId } = await context.params;
    const user = (req as any).user;

    if (user.userRole === 'doctor') {
      const { DoctorsService } = await import('@/lib/services/doctors.service');
      const doctorResult = await new DoctorsService().findDoctorByUserId(user.userId);
      if (!doctorResult.success || doctorResult.data?.id !== doctorId) {
        return NextResponse.json({ success: false, message: 'You do not have permission to view these payments' }, { status: 403 });
      }
    }

    const result = await new AssignmentPaymentsService().listForDoctor(doctorId, {
      page: req.nextUrl.searchParams.get('page'),
      limit: req.nextUrl.searchParams.get('limit'),
      source: req.nextUrl.searchParams.get('source'),
      status: req.nextUrl.searchParams.get('status'),
    });

    return NextResponse.json({
      success: true,
      data: {
        totalEarnings: result.totalEarnings,
        pendingEarnings: result.pendingEarnings,
        payments: result.payments.map((payment: any) => ({
          ...payment,
          assignment: {
            completedAt: payment.assignmentCompletedAt,
            status: payment.assignmentStatus,
            date: payment.slotDate || (payment.assignmentRequestedAt ? new Date(payment.assignmentRequestedAt).toISOString().split('T')[0] : null),
          },
          hospital: { id: payment.hospitalId, name: payment.hospitalName || null },
          patient: { id: payment.patientId || payment.patientProfileId, name: payment.patient },
        })),
        pagination: result.pagination,
      },
    });
  } catch (error) {
    console.error('Error fetching doctor payments:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch payments' }, { status: 500 });
  }
}

export const GET = withAuthAndContext(getHandler, ['doctor', 'admin']);
