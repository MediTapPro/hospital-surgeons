import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { AssignmentPaymentsService } from '@/lib/services/assignment-payments.service';
import { ASSIGNMENT_PAYMENT_SOURCES, ASSIGNMENT_SETTLEMENT_STATUSES } from '@/lib/enums/assignment-payments.enums';
import { ASSIGNMENT_PAYMENTS_MAX_LIMIT } from '@/lib/utils/constants';

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
 *       400: { description: Invalid pagination, source, or settlement status }
 *       401: { description: Authentication required }
 *       403: { description: Admin access required }
 *       500: { description: Unable to load payment records }
 */

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const query = req.nextUrl.searchParams;
    const page = Number(query.get('page') || '1');
    const limit = Number(query.get('limit') || '20');
    const source = query.get('source');
    const status = query.get('status');
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > ASSIGNMENT_PAYMENTS_MAX_LIMIT) {
      return NextResponse.json({ success: false, message: `page must be at least 1 and limit must be between 1 and ${ASSIGNMENT_PAYMENTS_MAX_LIMIT}.` }, { status: 400 });
    }
    if (source && !ASSIGNMENT_PAYMENT_SOURCES.includes(source as (typeof ASSIGNMENT_PAYMENT_SOURCES)[number])) {
      return NextResponse.json({ success: false, message: `Invalid source. Must be one of: ${ASSIGNMENT_PAYMENT_SOURCES.join(', ')}.` }, { status: 400 });
    }
    if (status && !ASSIGNMENT_SETTLEMENT_STATUSES.includes(status as (typeof ASSIGNMENT_SETTLEMENT_STATUSES)[number])) {
      return NextResponse.json({ success: false, message: `Invalid status. Must be one of: ${ASSIGNMENT_SETTLEMENT_STATUSES.join(', ')}.` }, { status: 400 });
    }
    const service = new AssignmentPaymentsService();
    const result = await service.list({
      page: String(page),
      limit: String(limit),
      source,
      status,
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
