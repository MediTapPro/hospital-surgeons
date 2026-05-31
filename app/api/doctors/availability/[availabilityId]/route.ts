import { NextRequest, NextResponse } from 'next/server';
import { DoctorsService } from '@/lib/services/doctors.service';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';

/**
 * @swagger
 * /api/doctors/availability/{availabilityId}:
 *   patch:
 *     summary: Update an availability slot
 *     tags: [Doctors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: availabilityId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Availability slot ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               slotDate:
 *                 type: string
 *                 format: date
 *               startTime:
 *                 type: string
 *                 format: time
 *               endTime:
 *                 type: string
 *                 format: time
 *               status:
 *                 type: string
 *                 enum: [available, booked, blocked]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Availability slot updated successfully
 *       400:
 *         description: Bad request (overlapping slot or invalid data)
 *       403:
 *         description: Insufficient permissions
 *   delete:
 *     summary: Delete an availability slot
 *     tags: [Doctors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: availabilityId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Availability slot ID
 *     responses:
 *       200:
 *         description: Availability slot deleted successfully
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Availability slot not found
 */
async function patchHandler(
  req: AuthenticatedRequest,
  context: { params: Promise<{ availabilityId: string }> }
) {
  try {
    const params = await context.params;
    const body = await req.json();
    const doctorsService = new DoctorsService();
    const result = await doctorsService.updateAvailability(params.availabilityId, body);
    
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

async function deleteHandler(
  req: AuthenticatedRequest,
  context: { params: Promise<{ availabilityId: string }> }
) {
  try {
    const params = await context.params;
    const doctorsService = new DoctorsService();
    const result = await doctorsService.deleteAvailability(params.availabilityId);
    
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

export const PATCH = withAuthAndContext(patchHandler, ['doctor', 'admin']);
export const DELETE = withAuthAndContext(deleteHandler, ['doctor', 'admin']);

