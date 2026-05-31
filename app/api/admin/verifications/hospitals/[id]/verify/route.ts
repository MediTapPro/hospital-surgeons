import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { hospitals, users } from '@/src/db/drizzle/migrations/schema';
import { eq } from 'drizzle-orm';
import { validateRequest } from '@/lib/utils/validate-request';
import { VerifyDtoSchema } from '@/lib/validations/verification.dto';
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
    const validation = await validateRequest(req, VerifyDtoSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { notes } = validation.data;

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
        licenseVerificationStatus: 'verified',
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
      action: 'verify',
      entityType: 'hospital',
      entityId: hospitalId,
      entityName: hospital.name,
      httpMethod: 'PUT',
      endpoint: `/api/admin/verifications/hospitals/${hospitalId}/verify`,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      previousStatus: previousStatus,
      newStatus: 'verified',
      changes: {
        licenseVerificationStatus: {
          old: previousStatus,
          new: 'verified',
        },
      },
      notes: notes || 'Hospital verified by admin',
      details: {
        hospitalEmail: hospital.userEmail || undefined,
        registrationNumber: hospital.registrationNumber || undefined,
        verifiedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Hospital verified successfully',
      data: {
        id: updatedHospital.id,
        licenseVerificationStatus: updatedHospital.licenseVerificationStatus,
      },
    });
  } catch (error) {
    console.error('Error verifying hospital:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to verify hospital',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


