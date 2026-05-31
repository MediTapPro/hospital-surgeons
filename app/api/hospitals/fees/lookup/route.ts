import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { FeesService } from '@/lib/services/fees.service';
import { HospitalsService } from '@/lib/services/hospitals.service';

const feesService = new FeesService();
const hospitalsService = new HospitalsService();

/**
 * @swagger
 * /api/hospitals/fees/lookup:
 *   get:
 *     summary: Lookup the effective fee for a doctor/specialty/room combination
 *     description: Returns the negotiated hospital fee if approved, otherwise falls back to the doctor's Global MRP.
 *     tags: [Hospital Fees]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: doctorId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: specialtyId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: roomTypeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: procedureId
 *         required: false
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: procedureTypeId
 *         required: false
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Effective fee found successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     fee: { type: string }
 *                     source: { type: string, enum: [hospital_specific, global_mrp] }
 *       404:
 *         description: No fee found for this combination
 *       401:
 *         description: Unauthorized
 */
async function getHandler(req: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const doctorId = searchParams.get('doctorId');
    const specialtyId = searchParams.get('specialtyId');
    const procedureId = searchParams.get('procedureId');
    const procedureTypeId = searchParams.get('procedureTypeId');
    const roomTypeId = searchParams.get('roomTypeId');

    if (!doctorId || !specialtyId || !roomTypeId) {
      return NextResponse.json(
        { success: false, message: 'Missing required parameters (doctorId, specialtyId, roomTypeId)' },
        { status: 400 }
      );
    }

    // 1. Get hospital profile to get its ID
    if (!req.user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const hospitalResult = await hospitalsService.findHospitalByUserId(req.user.userId);
    if (!hospitalResult.success || !hospitalResult.data) {
      return NextResponse.json(
        { success: false, message: hospitalResult.message || 'Hospital profile not found' },
        { status: 404 }
      );
    }

    const hospital = hospitalResult.data;

    // 2. Lookup the effective fee (Waterfall: Hospital Approved -> Global MRP)
    const result = await feesService.getEffectiveFee({
      doctorId,
      specialtyId,
      procedureId: procedureId || null,
      procedureTypeId: procedureTypeId || null,
      roomTypeId,
      hospitalId: hospital.id
    });

    if (!result) {
      return NextResponse.json(
        { success: false, message: 'No fee found for this combination' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Error in fee lookup:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: error.message },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler, ['hospital']);
