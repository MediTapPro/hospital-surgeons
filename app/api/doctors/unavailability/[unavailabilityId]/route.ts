import { NextRequest, NextResponse } from 'next/server';
import { DoctorsService } from '@/lib/services/doctors.service';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';

/**
 * @swagger
 * /api/doctors/unavailability/{unavailabilityId}:
 *   patch:
 *     summary: Update a leave/unavailability record
 *     tags: [Doctors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: unavailabilityId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unavailability record ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               leaveType:
 *                 type: string
 *                 enum: [sick, vacation, personal, emergency, other]
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Leave record updated successfully
 *       400:
 *         description: Bad request
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Leave record not found
 *   delete:
 *     summary: Delete a leave/unavailability record
 *     tags: [Doctors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: unavailabilityId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unavailability record ID
 *     responses:
 *       200:
 *         description: Leave record deleted successfully
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Leave record not found
 */
async function patchHandler(
  req: AuthenticatedRequest,
  context: { params: Promise<{ unavailabilityId: string }> }
) {
  try {
    const params = await context.params;
    const body = await req.json();
    const doctorsService = new DoctorsService();
    
    // Get doctor ID from authenticated user
    const userId = (req as any).user?.userId;
    if (!userId) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    
    // Get doctor profile to get doctorId
    const doctorResult = await doctorsService.findDoctorByUserId(userId);
    if (!doctorResult.success || !doctorResult.data) {
      return NextResponse.json({ success: false, message: 'Doctor not found' }, { status: 404 });
    }
    
    const result = await doctorsService.updateUnavailability(
      doctorResult.data.id,
      params.unavailabilityId,
      body
    );
    
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
  context: { params: Promise<{ unavailabilityId: string }> }
) {
  try {
    const params = await context.params;
    const doctorsService = new DoctorsService();
    const result = await doctorsService.deleteUnavailability(params.unavailabilityId);
    
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

