import { NextRequest, NextResponse } from 'next/server';
import { FeesService } from '@/lib/services/fees.service';
import { DoctorsService } from '@/lib/services/doctors.service';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { validateRequest } from '@/lib/utils/validate-request';
import { CreateMrpFeeDtoSchema } from '@/lib/validations/fees.dto';

/**
 * @swagger
 * /api/doctors/fees/mrp:
 *   get:
 *     summary: Get all doctor fees (Global MRP and Hospital-specific)
 *     description: Returns a comprehensive list of all procedures with their Global MRP and any hospital-specific custom pricing.
 *     tags: [Doctors, Fees]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Fees retrieved successfully
 *       401:
 *         description: Unauthorized
 */
async function getHandler(req: AuthenticatedRequest) {
  try {
    const user = req.user;
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found in session' }, { status: 401 });
    }
    const doctorsService = new DoctorsService();
    const doctorResult = await doctorsService.findDoctorByUserId(user.userId);

    if (!doctorResult.success || !doctorResult.data) {
      return NextResponse.json({ success: false, message: 'Doctor profile not found' }, { status: 404 });
    }

    const doctorId = doctorResult.data.id;
    const feesService = new FeesService();
    const result = await feesService.getAllFees(doctorId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in GET /api/doctors/fees/mrp:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/doctors/fees/mrp:
 *   post:
 *     summary: Create or Update a doctor fee (MRP or Hospital-specific)
 *     description: Saves a fee record. If hospitalId is provided, it saves as a hospital-specific fee (limited to 5 hospitals). Otherwise, it saves as a Global MRP fee.
 *     tags: [Doctors, Fees]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - specialtyId
 *               - roomTypeId
 *               - fee
 *             properties:
 *               hospitalId:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *                 description: Specific hospital for this fee (null for Global MRP)
 *               specialtyId:
 *                 type: string
 *                 format: uuid
 *               procedureId:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *               procedureTypeId:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *               roomTypeId:
 *                 type: string
 *                 format: uuid
 *               fee:
 *                 type: string
 *               discountPercentage:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Fee saved successfully
 *       400:
 *         description: Bad request
 */
async function postHandler(req: AuthenticatedRequest) {
  try {
    const user = req.user;
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found in session' }, { status: 401 });
    }
    const doctorsService = new DoctorsService();
    const doctorResult = await doctorsService.findDoctorByUserId(user.userId);

    if (!doctorResult.success || !doctorResult.data) {
      return NextResponse.json({ success: false, message: 'Doctor profile not found' }, { status: 404 });
    }

    const doctorId = doctorResult.data.id;
    const validation = await validateRequest(req, CreateMrpFeeDtoSchema);
    
    if (!validation.success) {
      return validation.response;
    }

    const feesService = new FeesService();
    const result = await feesService.saveFee({
      ...validation.data,
      doctorId,
    });

    return NextResponse.json(result, { status: result.success ? 201 : 400 });
  } catch (error) {
    console.error('Error in POST /api/doctors/fees/mrp:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
