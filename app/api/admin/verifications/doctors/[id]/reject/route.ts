import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { doctors, users } from '@/src/db/drizzle/migrations/schema';
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
    const doctorId = id;
    
    // Validate request body with Zod schema
    const validation = await validateRequest(req, RejectDtoSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { reason, notes } = validation.data;

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
        licenseVerificationStatus: 'rejected',
      })
      .where(eq(doctors.id, doctorId))
      .returning();

    // Get request metadata
    const metadata = getRequestMetadata(req);
    const adminUserId = req.headers.get('x-user-id') || null;

    // Create comprehensive audit log
    await createAuditLog({
      userId: adminUserId,
      actorType: 'admin',
      action: 'reject',
      entityType: 'doctor',
      entityId: doctorId,
      entityName: doctorName,
      httpMethod: 'PUT',
      endpoint: `/api/admin/verifications/doctors/${doctorId}/reject`,
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
        doctorEmail: doctor.userEmail || undefined,
        medicalLicenseNumber: doctor.medicalLicenseNumber || undefined,
        rejectedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Doctor verification rejected',
      data: {
        id: updatedDoctor.id,
        licenseVerificationStatus: updatedDoctor.licenseVerificationStatus,
        reason: reason,
      },
    });
  } catch (error) {
    console.error('Error rejecting doctor verification:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to reject doctor verification',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


