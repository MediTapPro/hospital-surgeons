import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { doctors, doctorCredentials, files, users, auditLogs } from '@/src/db/drizzle/migrations/schema';
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
      conditions.push(eq(doctors.licenseVerificationStatus, status));
    }
    
    if (search) {
      conditions.push(
        or(
          like(doctors.firstName, `%${search}%`),
          like(doctors.lastName, `%${search}%`),
          like(doctors.medicalLicenseNumber, `%${search}%`)
        )!
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(doctors)
      .where(whereClause);
    
    const total = Number(countResult[0]?.count || 0);

    // Get doctors with related data
    const doctorsList = await db
      .select({
        id: doctors.id,
        userId: doctors.userId,
        firstName: doctors.firstName,
        lastName: doctors.lastName,
        medicalLicenseNumber: doctors.medicalLicenseNumber,
        licenseVerificationStatus: doctors.licenseVerificationStatus,
        yearsOfExperience: doctors.yearsOfExperience,
        primaryLocation: doctors.primaryLocation,
        averageRating: doctors.averageRating,
        totalRatings: doctors.totalRatings,
        email: users.email,
        phone: users.phone,
        createdAt: users.createdAt,
        // Count credentials
        credentialsCount: sql<number>`(
          SELECT COUNT(*)::int 
          FROM doctor_credentials 
          WHERE doctor_id = ${doctors.id}
        )`,
        // Count pending credentials
        pendingCredentialsCount: sql<number>`(
          SELECT COUNT(*)::int 
          FROM doctor_credentials 
          WHERE doctor_id = ${doctors.id}
          AND verification_status = 'pending'
        )`,
      })
      .from(doctors)
      .leftJoin(users, eq(doctors.userId, users.id))
      .where(whereClause)
      .orderBy(sortOrder === 'asc' ? asc(users.createdAt) : desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    // Format response
    const formattedDoctors = doctorsList.map((doctor) => ({
      id: doctor.id,
      userId: doctor.userId,
      name: `Dr. ${doctor.firstName} ${doctor.lastName}`,
      firstName: doctor.firstName,
      lastName: doctor.lastName,
      email: doctor.email,
      phone: doctor.phone,
      medicalLicenseNumber: doctor.medicalLicenseNumber,
      licenseVerificationStatus: doctor.licenseVerificationStatus,
      yearsOfExperience: doctor.yearsOfExperience,
      primaryLocation: doctor.primaryLocation,
      averageRating: doctor.averageRating,
      totalRatings: doctor.totalRatings,
      credentialsCount: doctor.credentialsCount || 0,
      pendingCredentialsCount: doctor.pendingCredentialsCount || 0,
      createdAt: doctor.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: formattedDoctors,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching doctor verifications:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch doctor verifications',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

