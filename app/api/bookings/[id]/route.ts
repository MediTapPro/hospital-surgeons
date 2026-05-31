import { NextRequest, NextResponse } from 'next/server';
import { BookingsService } from '@/lib/services/bookings.service';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';

/**
 * @swagger
 * /api/bookings/{id}:
 *   get:
 *     summary: Get booking/assignment by ID
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Booking/Assignment ID
 *     responses:
 *       200:
 *         description: Booking details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       404:
 *         description: Booking not found
 *   patch:
 *     summary: Update booking/assignment by ID
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Booking/Assignment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, confirmed, completed, cancelled, no_show]
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *               treatmentNotes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Booking updated successfully
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Booking not found
 *   delete:
 *     summary: Delete booking/assignment by ID
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Booking/Assignment ID
 *     responses:
 *       200:
 *         description: Booking deleted successfully
 *       403:
 *         description: Insufficient permissions
 */
async function getHandler(req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const bookingsService = new BookingsService();
    const result = await bookingsService.findBookingById(params.id);
    
    return NextResponse.json(result, { status: result.success ? 200 : 404 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

async function patchHandler(req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const body = await req.json();
    const bookingsService = new BookingsService();
    const result = await bookingsService.updateBooking(params.id, body);
    
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

async function deleteHandler(req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const bookingsService = new BookingsService();
    const result = await bookingsService.deleteBooking(params.id);
    
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

export const GET = withAuthAndContext(getHandler);
export const PATCH = withAuthAndContext(patchHandler, ['hospital', 'doctor', 'admin']);
export const DELETE = withAuthAndContext(deleteHandler, ['hospital', 'admin']);

