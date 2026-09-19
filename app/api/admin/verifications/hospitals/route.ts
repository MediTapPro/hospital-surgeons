import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { VERIFICATION_STATUSES, type VerificationStatus } from '@/lib/enums/verification.enums';
import { ProviderVerificationsService } from '@/lib/services/provider-verifications.service';

/**
 * @swagger
 * /api/admin/verifications/hospitals:
 *   get:
 *     summary: List hospital registration-verification reviews (Admin only)
 *     tags: [Admin Verifications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, verified, rejected, all] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *     responses:
 *       200: { description: Hospital verification reviews }
 *       400: { description: Invalid query parameters }
 *       403: { description: Admin access required }
 */
async function getHandler(req: AuthenticatedRequest) {
  const page = Number(req.nextUrl.searchParams.get('page') || 1);
  const limit = Number(req.nextUrl.searchParams.get('limit') || 10);
  const requestedStatus = req.nextUrl.searchParams.get('status') || 'pending';
  const requestedSortOrder = req.nextUrl.searchParams.get('sortOrder') || 'desc';

  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    return NextResponse.json({ success: false, message: 'Page must be at least 1 and limit must be between 1 and 100.' }, { status: 400 });
  }
  if (requestedStatus !== 'all' && !VERIFICATION_STATUSES.includes(requestedStatus as VerificationStatus)) {
    return NextResponse.json({ success: false, message: 'Invalid verification status.' }, { status: 400 });
  }
  if (requestedSortOrder !== 'asc' && requestedSortOrder !== 'desc') {
    return NextResponse.json({ success: false, message: 'Invalid sort order.' }, { status: 400 });
  }

  try {
    const result = await new ProviderVerificationsService().listHospitals({
      page, limit, search: req.nextUrl.searchParams.get('search') || undefined,
      status: requestedStatus === 'all' ? undefined : requestedStatus as VerificationStatus,
      sortOrder: requestedSortOrder,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Error fetching hospital verifications:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch hospital verifications' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler, ['admin']);
