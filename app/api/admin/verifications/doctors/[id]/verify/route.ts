import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { doctors, users } from '@/src/db/drizzle/migrations/schema';
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
    const doctorId = id;
    
    // Validate request body with Zod schema
    const validation = await validateRequest(req, VerifyDtoSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { notes } = validation.data;

    // Check if doctor exists with user info
    const existingDoctor = await db
      .select({
        id: doctors.id,
        userId: doctors.userId,
        firstName: doctors.firstName,
        lastName: doctors.lastName,
        medicalLicenseNumber: doctors.medicalLicenseNumber,
        licenseVerificationStatus: doctors.licenseVerificationStatus,
        userEmail: users.email,
      })
      .from(doctors)
      .leftJoin(users, eq(doctors.userId, users.id))
      .where(eq(doctors.id, doctorId))
      .limit(1);

    if (existingDoctor.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Doctor not found' },
        { status: 404 }
      );
    }

    const doctor = existingDoctor[0];
    const doctorName = `Dr. ${doctor.firstName} ${doctor.lastName}`;
    const previousStatus = doctor.licenseVerificationStatus;

    // Update doctor verification status
    const [updatedDoctor] = await db
      .update(doctors)
      .set({
        licenseVerificationStatus: 'verified',
      })
      .where(eq(doctors.id, doctorId))
      .returning();

    // Get request metadata
    const metadata = getRequestMetadata(req);
    
    // Get admin user ID from request (you may need to adjust this based on your auth setup)
    // For now, we'll use the doctor's userId as a fallback, but ideally get from auth token
    const adminUserId = req.headers.get('x-user-id') || null;

    // Create comprehensive audit log
    await createAuditLog({
      userId: adminUserId,
      actorType: 'admin',
      action: 'verify',
      entityType: 'doctor',
      entityId: doctorId,
      entityName: doctorName,
      httpMethod: 'PUT',
      endpoint: `/api/admin/verifications/doctors/${doctorId}/verify`,
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
      notes: notes || 'Doctor verified by admin',
      details: {
        doctorEmail: doctor.userEmail || undefined,
        medicalLicenseNumber: doctor.medicalLicenseNumber || undefined,
        verifiedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Doctor verified successfully',
      data: {
        id: updatedDoctor.id,
        licenseVerificationStatus: updatedDoctor.licenseVerificationStatus,
      },
    });
  } catch (error) {
    console.error('Error verifying doctor:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to verify doctor',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


