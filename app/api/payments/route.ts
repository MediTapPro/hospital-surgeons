import { NextRequest, NextResponse } from 'next/server';
import { PaymentsService } from '@/lib/services/payments.service';
import { withAuth } from '@/lib/auth/middleware';

/**
 * @swagger
 * /api/payments:
 *   get:
 *     summary: Get all payments
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, failed, refunded]
 *       - in: query
 *         name: paymentType
 *         schema:
 *           type: string
 *           enum: [subscription, booking, commission]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: List of payments
 *   post:
 *     summary: Create a new payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - paymentType
 *               - amount
 *             properties:
 *               userId:
 *                 type: string
 *               subscriptionId:
 *                 type: string
 *               bookingId:
 *                 type: string
 *               paymentType:
 *                 type: string
 *                 enum: [subscription, booking, commission]
 *               amount:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [pending, completed, failed, refunded]
 *     responses:
 *       201:
 *         description: Payment created successfully
 */
async function getHandler(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = {
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10,
      userId: searchParams.get('userId') || undefined,
      status: searchParams.get('status') || undefined,
      paymentType: searchParams.get('paymentType') || undefined,
    };

    const paymentsService = new PaymentsService();
    const result = await paymentsService.list(query);
    
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

async function postHandler(req: NextRequest) {
  try {
    const body = await req.json();
    const user = (req as any).user;
    
    // Use authenticated user's ID if userId not provided
    const paymentData = {
      ...body,
      userId: body.userId || user.userId,
    };
    
    const paymentsService = new PaymentsService();
    const result = await paymentsService.create(paymentData);
    
    return NextResponse.json(result, { status: result.success ? 201 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
