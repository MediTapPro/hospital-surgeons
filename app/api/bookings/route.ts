import { NextRequest, NextResponse } from 'next/server';
import { BookingsService } from '@/lib/services/bookings.service';
import { withAuth } from '@/lib/auth/middleware';

/**
 * @swagger
 * /api/bookings:
 *   get:
 *     summary: Get all bookings
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hospitalId
 *         schema:
 *           type: string
 *       - in: query
 *         name: doctorId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, completed, cancelled, no_show]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: List of bookings
 *   post:
 *     summary: Create a new booking (Hospital/Admin only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - hospitalId
 *               - doctorId
 *               - specialtyId
 *               - bookingDate
 *               - startTime
 *               - endTime
 *               - doctorFee
 *               - commissionAmount
 *               - totalAmount
 *             properties:
 *               hospitalId:
 *                 type: string
 *               doctorId:
 *                 type: string
 *               specialtyId:
 *                 type: string
 *               bookingDate:
 *                 type: string
 *                 format: date
 *               startTime:
 *                 type: string
 *               endTime:
 *                 type: string
 *               doctorFee:
 *                 type: number
 *               commissionAmount:
 *                 type: number
 *               totalAmount:
 *                 type: number
 *     responses:
 *       201:
 *         description: Booking created successfully
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = {
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10,
      hospitalId: searchParams.get('hospitalId') || undefined,
      doctorId: searchParams.get('doctorId') || undefined,
      specialtyId: searchParams.get('specialtyId') || undefined,
      status: searchParams.get('status') || undefined,
      sortBy: searchParams.get('sortBy') as 'status' | 'priority' | 'requestedAt' | undefined,
      sortOrder: searchParams.get('sortOrder') as 'asc' | 'desc' | undefined,
    };

    const bookingsService = new BookingsService();
    const result = await bookingsService.findBookings(query);
    
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
    const bookingsService = new BookingsService();
    const result = await bookingsService.createBooking(body);
    
    return NextResponse.json(result, { status: result.success ? 201 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

export const POST = withAuth(postHandler, ['hospital', 'admin']);
