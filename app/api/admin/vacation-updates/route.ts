import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { doctorLeaves, doctors } from '@/src/db/drizzle/migrations/schema';
import { eq, and, gte, lte, desc, sql, count } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const searchParams = req.nextUrl.searchParams;
    
    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // Filters
    const doctorId = searchParams.get('doctorId') || undefined;
    const leaveType = searchParams.get('leaveType') || undefined;
    const startDate = searchParams.get('startDate') || undefined; // Filter by startDate
    const endDate = searchParams.get('endDate') || undefined; // Filter by endDate

    // Build where conditions
    const conditions: any[] = [];
    
    if (doctorId) {
      conditions.push(eq(doctorLeaves.doctorId, doctorId));
    }
    
    if (leaveType) {
      conditions.push(eq(doctorLeaves.leaveType, leaveType));
    }
    
    // Filter by date range - check if leave overlaps with the filter range
    if (startDate || endDate) {
      if (startDate && endDate) {
        // Leave overlaps if: leave.startDate <= filter.endDate AND leave.endDate >= filter.startDate
        conditions.push(
          sql`${doctorLeaves.startDate} <= ${endDate} AND ${doctorLeaves.endDate} >= ${startDate}`
        );
      } else if (startDate) {
        // Leave overlaps if: leave.endDate >= filter.startDate
        conditions.push(gte(doctorLeaves.endDate, startDate));
      } else if (endDate) {
        // Leave overlaps if: leave.startDate <= filter.endDate
        conditions.push(lte(doctorLeaves.startDate, endDate));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(doctorLeaves)
      .where(whereClause);
    
    const total = Number(countResult[0]?.count || 0);

    // Get vacation updates with doctor info
    const vacationUpdates = await db
      .select({
        id: doctorLeaves.id,
        doctorId: doctorLeaves.doctorId,
        leaveType: doctorLeaves.leaveType,
        startDate: doctorLeaves.startDate,
        endDate: doctorLeaves.endDate,
        reason: doctorLeaves.reason,
        createdAt: doctorLeaves.createdAt,
        // Doctor info
        doctorFirstName: sql<string>`(SELECT first_name FROM doctors WHERE id = ${doctorLeaves.doctorId})`,
        doctorLastName: sql<string>`(SELECT last_name FROM doctors WHERE id = ${doctorLeaves.doctorId})`,
      })
      .from(doctorLeaves)
      .where(whereClause)
      .orderBy(desc(doctorLeaves.createdAt))
      .limit(limit)
      .offset(offset);

    // Format response
    const formattedUpdates = vacationUpdates.map((update) => {
      const start = new Date(update.startDate);
      const end = new Date(update.endDate);
      const durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      return {
        id: update.id,
        doctorId: update.doctorId,
        doctorName: `Dr. ${update.doctorFirstName || ''} ${update.doctorLastName || ''}`.trim() || 'Unknown',
        leaveType: update.leaveType,
        startDate: update.startDate,
        endDate: update.endDate,
        durationDays,
        reason: update.reason || null,
        createdAt: update.createdAt,
      };
    });

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
    console.error('Error fetching vacation updates:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch vacation updates',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

