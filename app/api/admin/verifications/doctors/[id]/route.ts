import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { doctors, doctorCredentials, files, users, auditLogs, doctorSpecialties, specialties } from '@/src/db/drizzle/migrations/schema';
import { eq, desc } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const doctorId = id;

    // Get doctor with user info
    const doctorResult = await db
      .select({
        id: doctors.id,
        userId: doctors.userId,
        firstName: doctors.firstName,
        lastName: doctors.lastName,
        medicalLicenseNumber: doctors.medicalLicenseNumber,
        licenseVerificationStatus: doctors.licenseVerificationStatus,
        yearsOfExperience: doctors.yearsOfExperience,
        bio: doctors.bio,
        primaryLocation: doctors.primaryLocation,
        latitude: doctors.latitude,
        longitude: doctors.longitude,
        averageRating: doctors.averageRating,
        totalRatings: doctors.totalRatings,
        completedAssignments: doctors.completedAssignments,
        email: users.email,
        phone: users.phone,
        emailVerified: users.emailVerified,
        phoneVerified: users.phoneVerified,
        createdAt: users.createdAt,
      })
      .from(doctors)
      .leftJoin(users, eq(doctors.userId, users.id))
      .where(eq(doctors.id, doctorId))
      .limit(1);

    if (doctorResult.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Doctor not found' },
        { status: 404 }
      );
    }

    const doctor = doctorResult[0];

    // Get all credentials with file info
    const credentials = await db
      .select({
        id: doctorCredentials.id,
        credentialType: doctorCredentials.credentialType,
        title: doctorCredentials.title,
        institution: doctorCredentials.institution,
        verificationStatus: doctorCredentials.verificationStatus,
        uploadedAt: doctorCredentials.uploadedAt,
        fileId: doctorCredentials.fileId,
        filename: files.filename,
        url: files.url,
        mimetype: files.mimetype,
        size: files.size,
      })
      .from(doctorCredentials)
      .leftJoin(files, eq(doctorCredentials.fileId, files.id))
      .where(eq(doctorCredentials.doctorId, doctorId))
      .orderBy(desc(doctorCredentials.uploadedAt));

    // Get specialties
    const doctorSpecialtiesList = await db
      .select({
        specialtyId: doctorSpecialties.specialtyId,
        specialtyName: specialties.name,
        isPrimary: doctorSpecialties.isPrimary,
        yearsOfExperience: doctorSpecialties.yearsOfExperience,
      })
      .from(doctorSpecialties)
      .leftJoin(specialties, eq(doctorSpecialties.specialtyId, specialties.id))
      .where(eq(doctorSpecialties.doctorId, doctorId));

    // Get verification history from audit logs
    const verificationHistoryQuery = sql`
      SELECT * FROM audit_logs
      WHERE entity_type = 'doctor' 
        AND entity_id = ${doctorId} 
        AND action IN ('verify', 'reject', 'verification_requested')
      ORDER BY created_at DESC
      LIMIT 20
    `;
    const verificationHistory = await db.execute(verificationHistoryQuery);

    return NextResponse.json({
      success: true,
      data: {
        id: doctor.id,
        userId: doctor.userId,
        name: `Dr. ${doctor.firstName} ${doctor.lastName}`,
        firstName: doctor.firstName,
        lastName: doctor.lastName,
        email: doctor.email,
        phone: doctor.phone,
        emailVerified: doctor.emailVerified,
        phoneVerified: doctor.phoneVerified,
        medicalLicenseNumber: doctor.medicalLicenseNumber,
        licenseVerificationStatus: doctor.licenseVerificationStatus,
        yearsOfExperience: doctor.yearsOfExperience,
        bio: doctor.bio,
        primaryLocation: doctor.primaryLocation,
        latitude: doctor.latitude,
        longitude: doctor.longitude,
        averageRating: doctor.averageRating,
        totalRatings: doctor.totalRatings,
        completedAssignments: doctor.completedAssignments,
        credentials: credentials.map((cred) => ({
          id: cred.id,
          credentialType: cred.credentialType,
          title: cred.title,
          institution: cred.institution,
          verificationStatus: cred.verificationStatus,
          uploadedAt: cred.uploadedAt,
          file: {
            id: cred.fileId,
            filename: cred.filename,
            url: cred.url,
            mimetype: cred.mimetype,
            size: cred.size,
          },
        })),
        specialties: doctorSpecialtiesList.map((ds) => ({
          id: ds.specialtyId,
          name: ds.specialtyName,
          isPrimary: ds.isPrimary,
          yearsOfExperience: ds.yearsOfExperience,
        })),
        verificationHistory: (verificationHistory.rows || []).map((log: any) => ({
          id: log.id,
          action: log.action,
          details: log.details,
          createdAt: log.created_at,
        })),
        createdAt: doctor.createdAt,
      },
    });
  } catch (error) {
    console.error('Error fetching doctor verification details:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch doctor verification details',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

