import { NextResponse } from 'next/server';
import { withAuthAndContext, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { ProviderVerificationsService } from '@/lib/services/provider-verifications.service';
import { getRequestMetadata } from '@/lib/utils/audit-logger';
import { validateRequest } from '@/lib/utils/validate-request';
import { UpdateCredentialStatusDtoSchema } from '@/lib/validations/verification.dto';

/**
 * @swagger
 * /api/admin/doctor-credentials/{credentialId}:
 *   put:
 *     summary: Update one doctor credential's verification status (Admin only)
 *     description: Updates doctor_credentials.verification_status and records the audit event in the same transaction. This does not update the doctor's overall licence status.
 *     tags: [Admin Verifications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: credentialId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [verificationStatus], properties: { verificationStatus: { type: string, enum: [pending, verified, rejected] }, notes: { type: string } } }
 *     responses:
 *       200: { description: Credential updated }
 *       400: { description: Invalid request }
 *       403: { description: Admin access required }
 *       404: { description: Credential not found }
 */
async function putHandler(req: AuthenticatedRequest, context: { params: Promise<{ credentialId: string }> }) {
  const validation = await validateRequest(req, UpdateCredentialStatusDtoSchema);
  if (!validation.success) return validation.response;

  const { credentialId } = await context.params;
  const result = await new ProviderVerificationsService().updateDoctorCredentialVerification({
    credentialId,
    verificationStatus: validation.data.verificationStatus,
    adminUserId: req.user!.userId,
    notes: validation.data.notes,
    requestMetadata: getRequestMetadata(req),
  });

  if (!result.success) {
    return NextResponse.json({ success: false, message: result.code === 'NOT_FOUND' ? 'Credential not found' : 'Failed to update credential status' }, { status: result.code === 'NOT_FOUND' ? 404 : 500 });
  }

  return NextResponse.json({ success: true, message: 'Credential updated successfully', data: result.data });
}

export const PUT = withAuthAndContext(putHandler, ['admin']);
