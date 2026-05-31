import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { hospitals, users } from '@/src/db/drizzle/migrations/schema';
import { eq } from 'drizzle-orm';
import { validateRequest } from '@/lib/utils/validate-request';
import { RejectDtoSchema } from '@/lib/validations/verification.dto';
import { createAuditLog, getRequestMetadata } from '@/lib/utils/audit-logger';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const hospitalId = id;
    
    // Validate request body with Zod schema
    const validation = await validateRequest(req, RejectDtoSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { reason, notes } = validation.data;

    // Check if hospital exists with user info
    const existingHospital = await db
      .select({
        id: hospitals.id,
        userId: hospitals.userId,
        name: hospitals.name,
        registrationNumber: hospitals.registrationNumber,
        licenseVerificationStatus: hospitals.licenseVerificationStatus,
        userEmail: users.email,
      })
      .from(hospitals)
      .leftJoin(users, eq(hospitals.userId, users.id))
      .where(eq(hospitals.id, hospitalId))
      .limit(1);

    if (existingHospital.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Hospital not found' },
        { status: 404 }
      );
    }

    const hospital = existingHospital[0];
    const previousStatus = hospital.licenseVerificationStatus;

    // Update hospital verification status
    const [updatedHospital] = await db
      .update(hospitals)
      .set({
        licenseVerificationStatus: 'rejected',
      })
      .where(eq(hospitals.id, hospitalId))
      .returning();

    // Get request metadata
    const metadata = getRequestMetadata(req);
    const adminUserId = req.headers.get('x-user-id') || null;

    // Create comprehensive audit log
    await createAuditLog({
      userId: adminUserId,
      actorType: 'admin',
      action: 'reject',
      entityType: 'hospital',
      entityId: hospitalId,
      entityName: hospital.name,
      httpMethod: 'PUT',
      endpoint: `/api/admin/verifications/hospitals/${hospitalId}/reject`,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      previousStatus: previousStatus,
      newStatus: 'rejected',
      changes: {
        licenseVerificationStatus: {
          old: previousStatus,
          new: 'rejected',
        },
      },
      reason: reason,
      notes: notes || undefined,
      details: {
        hospitalEmail: hospital.userEmail || undefined,
        registrationNumber: hospital.registrationNumber || undefined,
        rejectedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Hospital verification rejected',
      data: {
        id: updatedHospital.id,
        licenseVerificationStatus: updatedHospital.licenseVerificationStatus,
        reason: reason,
      },
    });
  } catch (error) {
    console.error('Error rejecting hospital verification:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to reject hospital verification',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


