import { NextRequest, NextResponse } from 'next/server';
import { FeesService } from '@/lib/services/fees.service';
import { DoctorsService } from '@/lib/services/doctors.service';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { validateRequest } from '@/lib/utils/validate-request';
import { BulkProposeDtoSchema } from '@/lib/validations/fees.dto';

const feesService = new FeesService();
const doctorsService = new DoctorsService();

/**
 * @swagger
 * /api/doctors/fees/bulk-propose:
 *   post:
 *     summary: Bulk propose fees from Global MRP to a specific hospital
 *     description: Clones all Global MRPs for a given specialty to a target hospital with an optional relative discount/markup.
 *     tags: [Doctors, Fees]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [hospitalId, specialtyId]
 *             properties:
 *               hospitalId: { type: string, format: uuid }
 *               specialtyId: { type: string, format: uuid }
 *               discountPercentage: { type: string, example: "10.00" }
 *     responses:
 *       201:
 *         description: Fees proposed successfully
 *       400:
 *         description: Validation error or limit reached
 *       401:
 *         description: Unauthorized
 */
async function postHandler(req: AuthenticatedRequest) {
  try {
    const user = req.user;
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const doctorResult = await doctorsService.findDoctorByUserId(user.userId);
    if (!doctorResult.success || !doctorResult.data) {
      return NextResponse.json({ success: false, message: 'Doctor profile not found' }, { status: 404 });
    }

    const validation = await validateRequest(req, BulkProposeDtoSchema);
    if (!validation.success) {
      return validation.response;
    }

    const result = await feesService.bulkPropose({
      ...validation.data,
      doctorId: doctorResult.data.id,
    });

    return NextResponse.json(result, { status: result.success ? 201 : 400 });
  } catch (error: any) {
    console.error('Error in POST /api/doctors/fees/bulk-propose:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error', 
      error: error.message 
    }, { status: 500 });
  }
}

export const POST = withAuth(postHandler);
