import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { PlatformFeesService } from '@/lib/services/platform-fees.service';

const feesService = new PlatformFeesService();

/**
 * @swagger
 * /api/admin/home-visit-fees:
 *   get:
 *     summary: List home-visit fees
 *     tags: [Admin Home Visits]
 *     security: [{ bearerAuth: [] }]
 *   post:
 *     summary: Create or update a home-visit fee for a specialty
 *     tags: [Admin Home Visits]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Fee saved }
 *       400: { description: Invalid fee details }
 *       403: { description: Admin access required }
 */
async function getHandler(req: AuthenticatedRequest) {
  const result = await feesService.getPlatformFees();
  if (!result.success) {
    return NextResponse.json(result, { status: 500 });
  }
  return NextResponse.json(result);
}

async function postHandler(req: AuthenticatedRequest) {
  try {
    const body = await req.json();
    const { specialtyId, fee, platformCommissionPercentage } = body;

    // Basic body validation
    if (fee === undefined || platformCommissionPercentage === undefined) {
      return NextResponse.json(
        { success: false, message: 'Fee and platformCommissionPercentage are required' },
        { status: 400 }
      );
    }

    const feeNum = parseFloat(fee);
    const commissionNum = parseFloat(platformCommissionPercentage);

    if (isNaN(feeNum) || isNaN(commissionNum)) {
      return NextResponse.json(
        { success: false, message: 'Fee and platformCommissionPercentage must be valid numbers' },
        { status: 400 }
      );
    }

    const result = await feesService.upsertPlatformFee({
      specialtyId: specialtyId || null,
      fee: feeNum,
      platformCommissionPercentage: commissionNum,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in postHandler:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler, ['admin']);
export const POST = withAuth(postHandler, ['admin']);
