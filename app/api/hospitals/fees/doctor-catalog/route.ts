import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { FeesService } from '@/lib/services/fees.service';
import { HospitalsService } from '@/lib/services/hospitals.service';

const feesService = new FeesService();
const hospitalsService = new HospitalsService();

/**
 * @swagger
 * /api/hospitals/fees/doctor-catalog:
 *   get:
 *     summary: Get full fee catalog for a doctor at this hospital
 *     description: Returns all fee combinations for a doctor across all their specialties, using hospital-specific approved fees if available, otherwise falling back to Global MRP.
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
 *         required: false
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Fee catalog retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     doctorId: { type: string, format: uuid }
 *                     specialties:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           specialtyId: { type: string, format: uuid }
 *                           specialtyName: { type: string }
 *                           combinations:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 procedureId: { type: string, format: uuid }
 *                                 procedureName: { type: string }
 *                                 procedureTypeId: { type: string, format: uuid }
 *                                 procedureTypeName: { type: string }
 *                                 roomTypeId: { type: string, format: uuid }
 *                                 roomTypeName: { type: string }
 *                                 baseFee: { type: string }
 *                                 discountPercentage: { type: string }
 *                                 effectiveFee: { type: string }
 *                                 source: { type: string, enum: [hospital_specific, global_mrp] }
 *                                 status: { type: string }
 *       400:
 *         description: Missing required parameters
 *       404:
 *         description: Hospital profile not found
 */
async function getHandler(req: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const doctorId = searchParams.get('doctorId');
    const specialtyId = searchParams.get('specialtyId');

    if (!doctorId) {
      return NextResponse.json(
        { success: false, message: 'Missing required parameter: doctorId' },
        { status: 400 }
      );
    }

    // 1. Get hospital ID from auth context
    const hospitalResult = await hospitalsService.findHospitalByUserId(req.user!.userId);
    if (!hospitalResult.success || !hospitalResult.data) {
      return NextResponse.json(
        { success: false, message: hospitalResult.message || 'Hospital profile not found' },
        { status: 404 }
      );
    }

    const hospitalId = (hospitalResult.data as any).id;

    // 2. Fetch catalog
    const result = await feesService.getDoctorCatalogForHospital(doctorId, hospitalId, specialtyId || undefined);

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: any) {
    console.error('Error in GET /api/hospitals/fees/doctor-catalog:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: error.message },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler, ['hospital']);
