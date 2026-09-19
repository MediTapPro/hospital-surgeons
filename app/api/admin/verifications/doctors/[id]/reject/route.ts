import { NextResponse } from 'next/server';
import { withAuthAndContext, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { ProviderVerificationsService } from '@/lib/services/provider-verifications.service';
import { RejectDtoSchema } from '@/lib/validations/verification.dto';
import { validateRequest } from '@/lib/utils/validate-request';
import { getRequestMetadata } from '@/lib/utils/audit-logger';

/**
 * @swagger
 * /api/admin/verifications/doctors/{id}/reject:
 *   put:
 *     summary: Reject a doctor's licence (Admin only)
 *     description: Updates doctors.license_verification_status to rejected and stores the required reason in the atomic audit event. It does not change users.status.
 *     tags: [Admin Verifications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [reason], properties: { reason: { type: string }, notes: { type: string } } }
 *     responses:
 *       200: { description: Doctor verification rejected }
 *       400: { description: Rejection reason is required }
 *       403: { description: Admin access required }
 *       404: { description: Doctor not found }
 */
async function putHandler(req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) {
  const validation = await validateRequest(req, RejectDtoSchema);
  if (!validation.success) return validation.response;

  const { id } = await context.params;
  const result = await new ProviderVerificationsService().updateProviderVerification({
    providerType: 'doctor', providerId: id, verificationStatus: 'rejected', adminUserId: req.user!.userId,
    reason: validation.data.reason, notes: validation.data.notes, requestMetadata: getRequestMetadata(req),
  });

  if (!result.success) {
    return NextResponse.json({ success: false, message: result.code === 'NOT_FOUND' ? 'Doctor not found' : 'Failed to reject doctor' }, { status: result.code === 'NOT_FOUND' ? 404 : 500 });
  }

  return NextResponse.json({ success: true, message: 'Doctor verification rejected', data: { id: result.data.id, licenseVerificationStatus: result.data.verificationStatus, reason: validation.data.reason } });
}

export const PUT = withAuthAndContext(putHandler, ['admin']);
