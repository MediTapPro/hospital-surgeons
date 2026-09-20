import { NextResponse } from 'next/server';
import { withAuthAndContext, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { ProviderVerificationsService } from '@/lib/services/provider-verifications.service';
import { VerifyDtoSchema } from '@/lib/validations/verification.dto';
import { validateRequest } from '@/lib/utils/validate-request';
import { getRequestMetadata } from '@/lib/utils/audit-logger';

/**
 * @swagger
 * /api/admin/verifications/doctors/{id}/verify:
 *   put:
 *     summary: Verify a doctor's licence (Admin only)
 *     description: Verifies the doctor's licence, writes the audit event, and activates the linked user only when the account is currently pending. Suspended or inactive accounts remain unchanged.
 *     tags: [Admin Verifications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema: { type: object, properties: { notes: { type: string } } }
 *     responses:
 *       200: { description: Doctor verified }
 *       400: { description: Invalid request }
 *       403: { description: Admin access required }
 *       404: { description: Doctor not found }
 */
async function putHandler(req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) {
  const validation = await validateRequest(req, VerifyDtoSchema);
  if (!validation.success) return validation.response;

  const { id } = await context.params;
  const result = await new ProviderVerificationsService().updateProviderVerification({
    providerType: 'doctor',
    providerId: id,
    verificationStatus: 'verified',
    adminUserId: req.user!.userId,
    notes: validation.data.notes,
    requestMetadata: getRequestMetadata(req),
  });

  if (!result.success) {
    return NextResponse.json(
      { success: false, message: result.code === 'NOT_FOUND' ? 'Doctor not found' : 'Failed to verify doctor' },
      { status: result.code === 'NOT_FOUND' ? 404 : 500 },
    );
  }

  return NextResponse.json({ success: true, message: 'Doctor verified successfully', data: { id: result.data.id, licenseVerificationStatus: result.data.verificationStatus, accountStatus: result.data.accountStatus } });
}

export const PUT = withAuthAndContext(putHandler, ['admin']);
