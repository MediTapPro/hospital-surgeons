import { NextResponse } from 'next/server';
import { withAuthAndContext, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { AssignmentPaymentsService } from '@/lib/services/assignment-payments.service';
import { getRequestMetadata } from '@/lib/utils/audit-logger';

/**
 * @swagger
 * /api/admin/payments/{id}/settle:
 *   patch:
 *     summary: Mark a doctor settlement as paid
 *     description: Admin-only home-visit payout action. The patient payment must be paid and the doctor settlement pending. It records `paid_to_doctor_at` and changes settlement status to completed atomically. Hospital settlements keep their existing workflow.
 *     tags: [Admin Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Doctor settlement marked as paid }
 *       400: { description: Record is not an eligible pending home-visit settlement, or patient payment is incomplete }
 *       404: { description: Settlement not found }
 *       403: { description: Admin access required }
 */
async function patchHandler(_req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await new AssignmentPaymentsService().markSettlementPaid({
    paymentId: id,
    actorId: _req.user!.userId,
    requestMetadata: getRequestMetadata(_req),
  });

  if (!result.success) {
    const messages: Record<string, string> = {
      PAYMENT_NOT_FOUND: 'Payment record not found.',
      UNSUPPORTED_PAYMENT_SOURCE: 'Hospital settlement payments use their existing workflow.',
      SETTLEMENT_NOT_PENDING: 'Only pending settlements can be marked as paid.',
      PATIENT_PAYMENT_NOT_PAID: 'The patient payment must be successful before paying the doctor.',
    };
    const status = result.code === 'PAYMENT_NOT_FOUND' ? 404 : 400;
    return NextResponse.json({ success: false, message: messages[result.code] }, { status });
  }

  return NextResponse.json({ success: true, data: result.data, message: 'Doctor settlement marked as paid.' });
}

export const PATCH = withAuthAndContext(patchHandler, ['admin']);
