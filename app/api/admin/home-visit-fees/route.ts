import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { PlatformFeesService } from '@/lib/services/platform-fees.service';
import { getRequestMetadata } from '@/lib/utils/audit-logger';

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

    if (!Number.isFinite(feeNum) || !Number.isFinite(commissionNum) || feeNum < 0 || commissionNum < 0 || commissionNum > 100) {
      return NextResponse.json(
        { success: false, message: 'Fee must be non-negative and platformCommissionPercentage must be between 0 and 100' },
        { status: 400 }
      );
    }

    if (specialtyId !== null && specialtyId !== undefined && (typeof specialtyId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(specialtyId))) {
      return NextResponse.json({ success: false, message: 'specialtyId must be a valid UUID or null' }, { status: 400 });
    }

    const result = await feesService.upsertPlatformFee({
      specialtyId: specialtyId || null,
      fee: feeNum,
      platformCommissionPercentage: commissionNum,
    }, { userId: req.user!.userId, requestMetadata: getRequestMetadata(req) });

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
