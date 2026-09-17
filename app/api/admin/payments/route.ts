import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { AssignmentPaymentsService } from '@/lib/services/assignment-payments.service';

/**
 * @swagger
 * /api/admin/payments:
 *   get:
 *     summary: List assignment payment and settlement records
 *     description: Admin-only unified payment ledger for hospital assignments and paid home visits. Patient payment status and doctor settlement status are separate fields.
 *     tags: [Admin Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *       200: { description: Payment records retrieved successfully }
 *       401: { description: Authentication required }
 *       403: { description: Admin access required }
 *       500: { description: Unable to load payment records }
 */

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const service = new AssignmentPaymentsService();
    const result = await service.list({
      page: req.nextUrl.searchParams.get('page'),
      limit: req.nextUrl.searchParams.get('limit'),
      source: req.nextUrl.searchParams.get('source'),
      status: req.nextUrl.searchParams.get('status'),
    });

    return NextResponse.json({
      success: true,
      data: result.payments,
      pagination: result.pagination,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Unable to load payment records.', error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}, ['admin']);
