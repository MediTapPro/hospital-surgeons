import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { doctorAvailability, doctors, hospitals, assignments } from '@/src/db/drizzle/migrations/schema';
import { eq, and, isNull, desc, sql } from 'drizzle-orm';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ parentSlotId: string }> }
) {
  try {
    const db = getDb();
    const params = await context.params;
    const parentSlotId = params.parentSlotId;

    // Get parent slot
    const parentSlot = await db
      .select({
        id: doctorAvailability.id,
        doctorId: doctorAvailability.doctorId,
        slotDate: doctorAvailability.slotDate,
        startTime: doctorAvailability.startTime,
        endTime: doctorAvailability.endTime,
        status: doctorAvailability.status,
        isManual: doctorAvailability.isManual,
        templateId: doctorAvailability.templateId,
        updatedAt: doctorAvailability.updatedAt,
        doctorFirstName: sql<string>`(SELECT first_name FROM doctors WHERE id = ${doctorAvailability.doctorId})`,
        doctorLastName: sql<string>`(SELECT last_name FROM doctors WHERE id = ${doctorAvailability.doctorId})`,
      })
      .from(doctorAvailability)
      .where(
        and(
          eq(doctorAvailability.id, parentSlotId),
          isNull(doctorAvailability.parentSlotId)
        )
      )
      .limit(1);

    if (parentSlot.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Parent slot not found',
        },
        { status: 404 }
      );
    }

    const parent = parentSlot[0];

    // Get all sub-slots for this parent slot
    const subSlots = await db
      .select({
        id: doctorAvailability.id,
        slotDate: doctorAvailability.slotDate,
        startTime: doctorAvailability.startTime,
        endTime: doctorAvailability.endTime,
        status: doctorAvailability.status,
        bookedByHospitalId: doctorAvailability.bookedByHospitalId,
        bookedAt: doctorAvailability.bookedAt,
        updatedAt: doctorAvailability.updatedAt,
        // Hospital info
        hospitalName: sql<string | null>`(
          SELECT name FROM hospitals 
          WHERE id = ${doctorAvailability.bookedByHospitalId}
        )`,
        // Assignment info
        assignmentId: sql<string | null>`(
          SELECT id FROM assignments 
          WHERE availability_slot_id = ${doctorAvailability.id}
          LIMIT 1
        )`,
        assignmentStatus: sql<string | null>`(
          SELECT status FROM assignments 
          WHERE availability_slot_id = ${doctorAvailability.id}
          LIMIT 1
        )`,
      })
      .from(doctorAvailability)
      .where(eq(doctorAvailability.parentSlotId, parentSlotId))
      .orderBy(desc(doctorAvailability.startTime));

    // Format response
    const formattedSubSlots = subSlots.map((slot) => ({
      id: slot.id,
      slotDate: slot.slotDate,
      startTime: slot.startTime,
      endTime: slot.endTime,
      status: slot.status,
      hospitalId: slot.bookedByHospitalId || null,
      hospitalName: slot.hospitalName || null,
      assignmentId: slot.assignmentId || null,
      assignmentStatus: slot.assignmentStatus || null,
      bookedAt: slot.bookedAt || null,
      updatedAt: slot.updatedAt,
    }));

    return NextResponse.json({
      success: true,
      data: {
        parentSlot: {
          id: parent.id,
          doctorId: parent.doctorId,
          doctorName: `Dr. ${parent.doctorFirstName || ''} ${parent.doctorLastName || ''}`.trim() || 'Unknown',
          slotDate: parent.slotDate,
          startTime: parent.startTime,
          endTime: parent.endTime,
          status: parent.status,
          isManual: parent.isManual,
          templateId: parent.templateId || null,
          updatedAt: parent.updatedAt,
        },
        subSlots: formattedSubSlots,
        totalSubSlots: formattedSubSlots.length,
      },
    });
  } catch (error) {
    console.error('Error fetching parent slot details:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch parent slot details',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

