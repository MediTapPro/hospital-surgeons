import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { hospitals, hospitalDocuments, files, users, auditLogs, hospitalDepartments, specialties } from '@/src/db/drizzle/migrations/schema';
import { eq, desc } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const hospitalId = id;

    // Get hospital with user info
    const hospitalResult = await db
      .select({
        id: hospitals.id,
        userId: hospitals.userId,
        name: hospitals.name,
        registrationNumber: hospitals.registrationNumber,
        licenseVerificationStatus: hospitals.licenseVerificationStatus,
        hospitalType: hospitals.hospitalType,
        address: hospitals.address,
        city: hospitals.city,
        latitude: hospitals.latitude,
        longitude: hospitals.longitude,
        numberOfBeds: hospitals.numberOfBeds,
        contactEmail: hospitals.contactEmail,
        contactPhone: hospitals.contactPhone,
        websiteUrl: hospitals.websiteUrl,
        email: users.email,
        phone: users.phone,
        emailVerified: users.emailVerified,
        phoneVerified: users.phoneVerified,
        createdAt: users.createdAt,
      })
      .from(hospitals)
      .leftJoin(users, eq(hospitals.userId, users.id))
      .where(eq(hospitals.id, hospitalId))
      .limit(1);

    if (hospitalResult.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Hospital not found' },
        { status: 404 }
      );
    }

    const hospital = hospitalResult[0];

    // Get all documents with file info
    const documents = await db
      .select({
        id: hospitalDocuments.id,
        documentType: hospitalDocuments.documentType,
        verificationStatus: hospitalDocuments.verificationStatus,
        uploadedAt: hospitalDocuments.uploadedAt,
        fileId: hospitalDocuments.fileId,
        filename: files.filename,
        url: files.url,
        mimetype: files.mimetype,
        size: files.size,
      })
      .from(hospitalDocuments)
      .leftJoin(files, eq(hospitalDocuments.fileId, files.id))
      .where(eq(hospitalDocuments.hospitalId, hospitalId))
      .orderBy(desc(hospitalDocuments.uploadedAt));

    // Get departments
    const hospitalDepartmentsList = await db
      .select({
        specialtyId: hospitalDepartments.specialtyId,
        specialtyName: specialties.name,
      })
      .from(hospitalDepartments)
      .leftJoin(specialties, eq(hospitalDepartments.specialtyId, specialties.id))
      .where(eq(hospitalDepartments.hospitalId, hospitalId));

    // Get verification history from audit logs
    const verificationHistoryQuery = sql`
      SELECT * FROM audit_logs
      WHERE entity_type = 'hospital' 
        AND entity_id = ${hospitalId} 
        AND action IN ('verify', 'reject', 'verification_requested')
      ORDER BY created_at DESC
      LIMIT 20
    `;
    const verificationHistory = await db.execute(verificationHistoryQuery);

    return NextResponse.json({
      success: true,
      data: {
        id: hospital.id,
        userId: hospital.userId,
        name: hospital.name,
        email: hospital.email || hospital.contactEmail,
        phone: hospital.phone || hospital.contactPhone,
        emailVerified: hospital.emailVerified,
        phoneVerified: hospital.phoneVerified,
        registrationNumber: hospital.registrationNumber,
        licenseVerificationStatus: hospital.licenseVerificationStatus,
        hospitalType: hospital.hospitalType,
        address: hospital.address,
        city: hospital.city,
        latitude: hospital.latitude,
        longitude: hospital.longitude,
        numberOfBeds: hospital.numberOfBeds,
        contactEmail: hospital.contactEmail,
        contactPhone: hospital.contactPhone,
        websiteUrl: hospital.websiteUrl,
        documents: documents.map((doc) => ({
          id: doc.id,
          documentType: doc.documentType,
          verificationStatus: doc.verificationStatus,
          uploadedAt: doc.uploadedAt,
          file: {
            id: doc.fileId,
            filename: doc.filename,
            url: doc.url,
            mimetype: doc.mimetype,
            size: doc.size,
          },
        })),
        departments: hospitalDepartmentsList.map((hd) => ({
          id: hd.specialtyId,
          name: hd.specialtyName,
        })),
        verificationHistory: (verificationHistory.rows || []).map((log: any) => ({
          id: log.id,
          action: log.action,
          details: log.details,
          createdAt: log.created_at,
        })),
        createdAt: hospital.createdAt,
      },
    });
  } catch (error) {
    console.error('Error fetching hospital verification details:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch hospital verification details',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

