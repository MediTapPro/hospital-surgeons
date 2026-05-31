import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { hospitals, hospitalDocuments, files, users, auditLogs } from '@/src/db/drizzle/migrations/schema';
import { eq, and, or, like, sql, desc, asc } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const searchParams = req.nextUrl.searchParams;
    
    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    // Filters
    const status = searchParams.get('status') || 'pending';
    const search = searchParams.get('search') || undefined;
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build where conditions
    const conditions = [];
    
    if (status && status !== 'all') {
      conditions.push(eq(hospitals.licenseVerificationStatus, status));
    }
    
    if (search) {
      conditions.push(
        or(
          like(hospitals.name, `%${search}%`),
          like(hospitals.registrationNumber, `%${search}%`),
          like(hospitals.city, `%${search}%`)
        )!
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(hospitals)
      .where(whereClause);
    
    const total = Number(countResult[0]?.count || 0);

    // Get hospitals with related data
    const hospitalsList = await db
      .select({
        id: hospitals.id,
        userId: hospitals.userId,
        name: hospitals.name,
        registrationNumber: hospitals.registrationNumber,
        licenseVerificationStatus: hospitals.licenseVerificationStatus,
        hospitalType: hospitals.hospitalType,
        address: hospitals.address,
        city: hospitals.city,
        numberOfBeds: hospitals.numberOfBeds,
        contactEmail: hospitals.contactEmail,
        contactPhone: hospitals.contactPhone,
        email: users.email,
        phone: users.phone,
        createdAt: users.createdAt,
        // Count documents
        documentsCount: sql<number>`(
          SELECT COUNT(*)::int 
          FROM hospital_documents 
          WHERE hospital_id = ${hospitals.id}
        )`,
        // Count pending documents
        pendingDocumentsCount: sql<number>`(
          SELECT COUNT(*)::int 
          FROM hospital_documents 
          WHERE hospital_id = ${hospitals.id}
          AND verification_status = 'pending'
        )`,
      })
      .from(hospitals)
      .leftJoin(users, eq(hospitals.userId, users.id))
      .where(whereClause)
      .orderBy(sortOrder === 'asc' ? asc(users.createdAt) : desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    // Format response
    const formattedHospitals = hospitalsList.map((hospital) => ({
      id: hospital.id,
      userId: hospital.userId,
      name: hospital.name,
      email: hospital.email || hospital.contactEmail,
      phone: hospital.phone || hospital.contactPhone,
      registrationNumber: hospital.registrationNumber,
      licenseVerificationStatus: hospital.licenseVerificationStatus,
      hospitalType: hospital.hospitalType,
      address: hospital.address,
      city: hospital.city,
      numberOfBeds: hospital.numberOfBeds,
      documentsCount: hospital.documentsCount || 0,
      pendingDocumentsCount: hospital.pendingDocumentsCount || 0,
      createdAt: hospital.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: formattedHospitals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching hospital verifications:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch hospital verifications',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

