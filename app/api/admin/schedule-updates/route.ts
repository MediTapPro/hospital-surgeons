import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { doctorAvailability, doctors, hospitals, assignments } from '@/src/db/drizzle/migrations/schema';
import { eq, and, or, isNull, isNotNull, gte, lte, desc, sql, count } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const searchParams = req.nextUrl.searchParams;
    
    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // Filters
    const doctorSearch = searchParams.get('doctorSearch') || undefined; // Search by doctor name
    const slotType = searchParams.get('slotType') || undefined; // 'parent' | 'sub' (default: only parent)
    const status = searchParams.get('status') || undefined;
    const startDate = searchParams.get('startDate') || undefined; // Filter by slotDate
    const endDate = searchParams.get('endDate') || undefined;

    // Build where conditions
    const conditions: any[] = [];
    
    // Only show parent slots by default (unless explicitly filtering for sub-slots)
    if (slotType === 'sub') {
      conditions.push(isNotNull(doctorAvailability.parentSlotId));
    } else {
      // Default: only parent slots
      conditions.push(isNull(doctorAvailability.parentSlotId));
    }
    
    // Doctor search by name
    if (doctorSearch) {
      const searchPattern = `%${doctorSearch}%`;
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM doctors d 
          WHERE d.id = ${doctorAvailability.doctorId} 
          AND (d.first_name || ' ' || d.last_name) ILIKE ${searchPattern}
        )`
      );
    }
    
    if (status) {
      conditions.push(eq(doctorAvailability.status, status));
    }
    
    if (startDate) {
      conditions.push(gte(doctorAvailability.slotDate, startDate));
    }
    
    if (endDate) {
      conditions.push(lte(doctorAvailability.slotDate, endDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(doctorAvailability)
      .where(whereClause);
    
    const total = Number(countResult[0]?.count || 0);

    // Get schedule updates with joins
    const scheduleUpdates = await db
      .select({
        id: doctorAvailability.id,
        doctorId: doctorAvailability.doctorId,
        slotDate: doctorAvailability.slotDate,
        startTime: doctorAvailability.startTime,
        endTime: doctorAvailability.endTime,
        status: doctorAvailability.status,
        isManual: doctorAvailability.isManual,
        templateId: doctorAvailability.templateId,
        parentSlotId: doctorAvailability.parentSlotId,
        bookedByHospitalId: doctorAvailability.bookedByHospitalId,
        updatedAt: doctorAvailability.updatedAt,
        // Doctor info
        doctorFirstName: sql<string>`(SELECT first_name FROM doctors WHERE id = ${doctorAvailability.doctorId})`,
        doctorLastName: sql<string>`(SELECT last_name FROM doctors WHERE id = ${doctorAvailability.doctorId})`,
        // Hospital info (for sub-slots)
        hospitalName: sql<string | null>`(
          SELECT name FROM hospitals 
          WHERE id = ${doctorAvailability.bookedByHospitalId}
        )`,
        // Assignment info (for sub-slots)
        assignmentId: sql<string | null>`(
          SELECT id FROM assignments 
          WHERE availability_slot_id = ${doctorAvailability.id}
          LIMIT 1
        )`,
      })
      .from(doctorAvailability)
      .where(whereClause)
      .orderBy(desc(doctorAvailability.updatedAt))
      .limit(limit)
      .offset(offset);

    // Format response
    const formattedUpdates = scheduleUpdates.map((update) => ({
      id: update.id,
      doctorId: update.doctorId,
      doctorName: `Dr. ${update.doctorFirstName || ''} ${update.doctorLastName || ''}`.trim() || 'Unknown',
      slotType: update.parentSlotId ? 'sub' : 'parent',
      slotDate: update.slotDate,
      startTime: update.startTime,
      endTime: update.endTime,
      status: update.status,
      isManual: update.isManual,
      templateId: update.templateId || null,
      parentSlotId: update.parentSlotId || null,
      hospitalId: update.bookedByHospitalId || null,
      hospitalName: update.hospitalName || null,
      assignmentId: update.assignmentId || null,
      updatedAt: update.updatedAt,
    }));

    return NextResponse.json({
      success: true,
      data: formattedUpdates,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching schedule updates:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch schedule updates',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

