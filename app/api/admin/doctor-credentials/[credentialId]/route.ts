import { NextRequest, NextResponse } from 'next/server';
import { DoctorsService } from '@/lib/services/doctors.service';
import { validateRequest } from '@/lib/utils/validate-request';
import { UpdateCredentialStatusDtoSchema } from '@/lib/validations/verification.dto';
import { createAuditLog, getRequestMetadata } from '@/lib/utils/audit-logger';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ credentialId: string }> }
) {
  try {
    const { credentialId } = await params;
    
    // Validate request body with Zod schema
    const validation = await validateRequest(req, UpdateCredentialStatusDtoSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { verificationStatus, notes } = validation.data;

    const doctorsService = new DoctorsService();
    const result = await doctorsService.updateCredentialStatus(credentialId, verificationStatus);

    if (!result.success || !result.data) {
      return NextResponse.json(result, { status: 404 });
    }

    const credential = result.data as any;

    // Get request metadata
    const metadata = getRequestMetadata(req);
    const adminUserId = req.headers.get('x-user-id') || null;

    // Create comprehensive audit log
    await createAuditLog({
      userId: adminUserId,
      actorType: 'admin',
      action: verificationStatus === 'verified' ? 'credential_verified' : 'credential_rejected',
      entityType: 'doctor_credential',
      entityId: credentialId,
      entityName: credential.title || 'Credential',
      httpMethod: 'PUT',
      endpoint: `/api/admin/doctor-credentials/${credentialId}`,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      previousStatus: credential.verificationStatus,
      newStatus: verificationStatus,
      changes: {
        verificationStatus: {
          old: credential.verificationStatus,
          new: verificationStatus,
        },
      },
      notes: notes || undefined,
      details: {
        doctorId: credential.doctorId,
        credentialType: credential.credentialType,
        institution: credential.institution,
        updatedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Credential updated successfully',
      data: {
        id: credential.id,
        doctorId: credential.doctorId,
        verificationStatus: credential.verificationStatus,
      },
    });
  } catch (error) {
    console.error('Error updating credential status:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to update credential status',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

