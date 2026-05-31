import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import {
  assignments,
  doctorAvailability,
  procedures,
  procedureTypes,
  roomTypes,
  specialties,
} from '@/src/db/drizzle/migrations/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';

/**
 * @swagger
 * /api/hospitals/{id}/patients/{patientId}/assigned-doctors:
 *   get:
 *     summary: Get assigned doctors and their slots for a specific patient
 *     tags: [Hospitals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Hospital ID
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Patient ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Assigned doctors retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       procedure:
 *                         type: object
 *                       procedureType:
 *                         type: object
 *                       roomType:
 *                         type: object
 *                       specialty:
 *                         type: object
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       400:
 *         description: Invalid hospital or patient ID
 *       401:
 *         description: Unauthorized
 */
async function getHandler(
  req: AuthenticatedRequest,
  context: { params: Promise<{ id: string; patientId: string }> }
) {
  try {
    const params = await context.params;
    const hospitalId = params.id;
    const patientId = params.patientId;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(hospitalId) || !uuidRegex.test(patientId)) {
      return NextResponse.json(
        { success: false, message: 'Invalid hospital or patient ID' },
        { status: 400 }
      );
    }

    const db = getDb();
    const searchParams = req.nextUrl.searchParams;

    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10')));
    const offset = (page - 1) * limit;

    const whereClause = and(
      eq(assignments.hospitalId, hospitalId),
      eq(assignments.patientId, patientId)
    );

    // Total count for pagination
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(assignments)
      .where(whereClause);
    const total = Number(countResult[0]?.count || 0);
    const totalPages = Math.ceil(total / limit);

    // Fetch assignments with doctor and slot info
    const rows = await db
      .select({
        assignmentId: assignments.id,
        status: assignments.status,
        priority: assignments.priority,
        requestedAt: assignments.requestedAt,
        expiresAt: assignments.expiresAt,
        actualStartTime: assignments.actualStartTime,
        actualEndTime: assignments.actualEndTime,
        completedAt: assignments.completedAt,
        cancelledAt: assignments.cancelledAt,
        cancellationReason: assignments.cancellationReason,
        treatmentNotes: assignments.treatmentNotes,
        consultationFee: assignments.consultationFee,
        // Doctor info via subqueries (matches pattern in existing assignments endpoint)
        doctorId: assignments.doctorId,
        doctorFirstName: sql<string>`(SELECT first_name FROM doctors WHERE id = ${assignments.doctorId})`,
        doctorLastName: sql<string>`(SELECT last_name FROM doctors WHERE id = ${assignments.doctorId})`,
        doctorCity: sql<string>`(SELECT city FROM doctors WHERE id = ${assignments.doctorId})`,
        doctorState: sql<string>`(SELECT state FROM doctors WHERE id = ${assignments.doctorId})`,
        doctorPincode: sql<string>`(SELECT pincode FROM doctors WHERE id = ${assignments.doctorId})`,
        doctorAverageRating: sql<string>`(SELECT average_rating FROM doctors WHERE id = ${assignments.doctorId})`,
        specialties: sql<{ name: string; isPrimary: boolean }[]>`(
          SELECT COALESCE(
            json_agg(
              json_build_object(
                'name', s.name,
                'isPrimary', ds.is_primary
              )
              ORDER BY ds.is_primary DESC, s.name ASC
            ),
            '[]'::json
          )
          FROM doctor_specialties ds
          JOIN specialties s ON s.id = ds.specialty_id
          WHERE ds.doctor_id = ${assignments.doctorId}
        )`,
        // Procedure info
        procedureId: assignments.procedureId,
        procedureName: procedures.name,
        procedureTypeId: assignments.procedureTypeId,
        procedureTypeName: procedureTypes.displayName,
        roomTypeId: assignments.roomTypeId,
        roomTypeName: roomTypes.displayName,
        specialtyId: assignments.specialtyId,
        specialtyName: specialties.name,
        // Slot info from joined doctor_availability
        slotId: doctorAvailability.id,
        slotDate: sql<string>`${doctorAvailability.slotDate}::text`,
        slotStartTime: sql<string>`${doctorAvailability.startTime}::text`,
        slotEndTime: sql<string>`${doctorAvailability.endTime}::text`,
        slotStatus: doctorAvailability.status,
      })
      .from(assignments)
      .leftJoin(doctorAvailability, eq(assignments.availabilitySlotId, doctorAvailability.id))
      .leftJoin(procedures, eq(assignments.procedureId, procedures.id))
      .leftJoin(procedureTypes, eq(assignments.procedureTypeId, procedureTypes.id))
      .leftJoin(roomTypes, eq(assignments.roomTypeId, roomTypes.id))
      .leftJoin(specialties, eq(assignments.specialtyId, specialties.id))
      .where(whereClause)
      .orderBy(desc(assignments.requestedAt))
      .limit(limit)
      .offset(offset);

    const data = rows.map((row) => ({
      assignmentId: row.assignmentId,
      status: row.status,
      priority: row.priority || 'routine',
      requestedAt: row.requestedAt,
      expiresAt: row.expiresAt,
      actualStartTime: row.actualStartTime,
      actualEndTime: row.actualEndTime,
      completedAt: row.completedAt,
      cancelledAt: row.cancelledAt,
      cancellationReason: row.cancellationReason,
      treatmentNotes: row.treatmentNotes,
      consultationFee: row.consultationFee ? Number(row.consultationFee) : null,
      doctor: {
        id: row.doctorId,
        name: `Dr. ${row.doctorFirstName || ''} ${row.doctorLastName || ''}`.trim(),
        specialties: Array.isArray(row.specialties) ? row.specialties : [],
        city: row.doctorCity,
        state: row.doctorState,
        pincode: row.doctorPincode,
        averageRating: row.doctorAverageRating ? Number(row.doctorAverageRating) : null,
      },
      slot: row.slotId
        ? {
            id: row.slotId,
            date: row.slotDate,
            startTime: row.slotStartTime,
            endTime: row.slotEndTime,
            status: row.slotStatus,
          }
        : null,
      procedure: row.procedureId ? {
        id: row.procedureId,
        name: row.procedureName,
      } : null,
      procedureType: row.procedureTypeId ? {
        id: row.procedureTypeId,
        name: row.procedureTypeName,
      } : null,
      roomType: row.roomTypeId ? {
        id: row.roomTypeId,
        name: row.roomTypeName,
      } : null,
      specialty: row.specialtyId ? {
        id: row.specialtyId,
        name: row.specialtyName,
      } : null,
    }));

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching patient assigned doctors:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch assigned doctors',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const GET = withAuthAndContext(getHandler, ['hospital', 'admin']);
