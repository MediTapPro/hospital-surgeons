import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { PatientPaymentsService } from '@/lib/services/patient-payments.service';
import { PATIENT_PAYMENTS_DEFAULT_LIMIT, PATIENT_PAYMENTS_MAX_LIMIT } from '@/lib/utils/constants';

/**
 * @swagger
 * /api/patients/payments:
 *   get:
 *     summary: List a patient's completed home-visit payment transactions
 *     tags: [Patients]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, maximum: 50 }
 *     responses:
 *       200: { description: Payment history retrieved }
 *       401: { description: Authentication required }
 */
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const requestedPage = Number(req.nextUrl.searchParams.get('page') ?? '1');
    const requestedLimit = Number(req.nextUrl.searchParams.get('limit') ?? PATIENT_PAYMENTS_DEFAULT_LIMIT);
    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const limit = Number.isInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, PATIENT_PAYMENTS_MAX_LIMIT)
      : PATIENT_PAYMENTS_DEFAULT_LIMIT;
    const result = await new PatientPaymentsService().getHomeVisitPayments(req.user!.userId, page, limit);

    return NextResponse.json({ success: true, data: result.payments, pagination: result.pagination });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: 'Unable to load payment history.',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}, ['patient']);
