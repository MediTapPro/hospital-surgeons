import { NextResponse } from 'next/server';
import { withAuthAndContext, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { HomeVisitPaymentsService } from '@/lib/services/home-visit-payments.service';

const homeVisitPaymentsService = new HomeVisitPaymentsService();

/**
 * @swagger
 * /api/bookings/home-visit/{id}/payment-order:
 *   post:
 *     summary: Create a Razorpay order for a completed paid home visit
 *     tags: [Home Visits]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201: { description: Payment order created }
 *       400: { description: Visit is not eligible for payment }
 *       401: { description: Authentication required }
 */
async function postHandler(
  req: AuthenticatedRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const userId = req.user?.userId;
  if (!userId) {
    return NextResponse.json({ success: false, message: 'User context not found.' }, { status: 401 });
  }

  const result = await homeVisitPaymentsService.createPaymentOrder(userId, id);
  return NextResponse.json(result, { status: result.success ? 201 : 400 });
}

export const POST = withAuthAndContext(postHandler, ['patient']);
