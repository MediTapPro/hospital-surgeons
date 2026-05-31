import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { doctors } from '@/src/db/drizzle/migrations/schema';
import { sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const db = getDb();

    // Get all doctors with their names
    const doctorsList = await db
      .select({
        id: doctors.id,
        firstName: doctors.firstName,
        lastName: doctors.lastName,
      })
      .from(doctors)
      .orderBy(sql`${doctors.firstName} ASC, ${doctors.lastName} ASC`);

    // Format response
    const formattedDoctors = doctorsList.map((doctor) => ({
      id: doctor.id,
      name: `Dr. ${doctor.firstName || ''} ${doctor.lastName || ''}`.trim() || 'Unknown',
    }));

    return NextResponse.json({
      success: true,
      data: formattedDoctors,
    });
  } catch (error) {
    console.error('Error fetching doctors list:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch doctors list',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

