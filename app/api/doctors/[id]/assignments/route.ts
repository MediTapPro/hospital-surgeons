import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { assignments, doctors, patients, hospitals, doctorAvailability, enumPriority } from '@/src/db/drizzle/migrations/schema';
import { eq, and, or, sql, desc, asc, gte, lte } from 'drizzle-orm';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';

/**
 * @swagger
 * /api/doctors/{id}/assignments:
 *   get:
 *     summary: Get all assignments for a doctor
 *     tags: [Doctors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Doctor ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, completed, cancelled, all]
 *         description: Filter by assignment status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by patient name, hospital name, or condition
 *       - in: query
 *         name: todayOnly
 *         schema:
 *           type: boolean
 *         description: Filter to only today's assignments
 *     responses:
 *       200:
 *         description: Assignments retrieved successfully
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
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       patient:
 *                         type: string
 *                       condition:
 *                         type: string
 *                       hospital:
 *                         type: string
 *                       hospitalAddress:
 *                         type: string
 *                         nullable: true
 *                         description: Full address of the hospital
 *                       date:
 *                         type: string
 *                         format: date
 *                       time:
 *                         type: string
 *                       endTime:
 *                         type: string
 *                         nullable: true
 *                       status:
 *                         type: string
 *                       priority:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       expiresIn:
 *                         type: string
 *                         nullable: true
 *                       fee:
 *                         type: number
 *       403:
 *         description: Insufficient permissions
 */
async function getHandler(
  req: AuthenticatedRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const doctorId = params.id;
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(doctorId)) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }
    
    const db = getDb();
    const searchParams = req.nextUrl.searchParams;

    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;
    const selectedDate = searchParams.get('selectedDate') || undefined;
    const from = searchParams.get('from') || undefined; // YYYY-MM-DD
    const to = searchParams.get('to') || undefined; // YYYY-MM-DD

    // Build where conditions
    const conditions = [eq(assignments.doctorId, doctorId)];
    if (status && status !== 'all') {
      conditions.push(eq(assignments.status, status));
    }

    // Date filter based on slot date (or requestedAt date if slot is NULL)
    if (from || to) {
      if (from && to) {
        conditions.push(sql`(
          EXISTS (
            SELECT 1 FROM doctor_availability da 
            WHERE da.id = ${assignments.availabilitySlotId} 
            AND DATE(da.slot_date) BETWEEN ${from}::date AND ${to}::date
          )
          OR (
            ${assignments.availabilitySlotId} IS NULL 
            AND DATE(${assignments.requestedAt}::timestamp) BETWEEN ${from}::date AND ${to}::date
          )
        )`);
      } else if (from) {
        conditions.push(sql`(
          EXISTS (
            SELECT 1 FROM doctor_availability da 
            WHERE da.id = ${assignments.availabilitySlotId} 
            AND DATE(da.slot_date) >= ${from}::date
          )
          OR (
            ${assignments.availabilitySlotId} IS NULL 
            AND DATE(${assignments.requestedAt}::timestamp) >= ${from}::date
          )
        )`);
      } else if (to) {
        conditions.push(sql`(
          EXISTS (
            SELECT 1 FROM doctor_availability da 
            WHERE da.id = ${assignments.availabilitySlotId} 
            AND DATE(da.slot_date) <= ${to}::date
          )
          OR (
            ${assignments.availabilitySlotId} IS NULL 
            AND DATE(${assignments.requestedAt}::timestamp) <= ${to}::date
          )
        )`);
      }
    }

    // Filter by selected date if provided
    if (selectedDate && !(from || to)) {
      conditions.push(
        sql`(
          EXISTS (
            SELECT 1 FROM doctor_availability 
            WHERE id = ${assignments.availabilitySlotId} 
            AND slot_date = ${selectedDate}::date
          ) OR (
            ${assignments.availabilitySlotId} IS NULL 
            AND DATE(${assignments.requestedAt}) = ${selectedDate}::date
          )
        )`
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get assignments with related data
    const assignmentsList = await db
      .select({
        id: assignments.id,
        patientId: assignments.patientId,
        hospitalId: assignments.hospitalId,
        priority: assignments.priority,
        status: assignments.status,
        requestedAt: assignments.requestedAt,
        expiresAt: assignments.expiresAt,
        actualStartTime: assignments.actualStartTime,
        actualEndTime: assignments.actualEndTime,
        completedAt: assignments.completedAt,
        cancelledAt: assignments.cancelledAt,
        cancellationReason: assignments.cancellationReason,
        treatmentNotes: assignments.treatmentNotes,
        consultationFee: assignments.consultationFee,
        availabilitySlotId: assignments.availabilitySlotId,
        // Patient info
        patientName: sql<string>`(SELECT full_name FROM patients WHERE id = ${assignments.patientId})`,
        patientCondition: sql<string>`(SELECT medical_condition FROM patients WHERE id = ${assignments.patientId})`,
        // Hospital info
        hospitalName: sql<string>`(SELECT name FROM hospitals WHERE id = ${assignments.hospitalId})`,
        hospitalAddress: sql<string | null>`(SELECT COALESCE(full_address, address) FROM hospitals WHERE id = ${assignments.hospitalId})`,
        // Slot info
        slotDate: sql<string>`${doctorAvailability.slotDate}::text`,
        slotTime: sql<string>`${doctorAvailability.startTime}::text`,
        slotEndTime: sql<string>`${doctorAvailability.endTime}::text`,
        parentSlotId: sql<string | null>`${doctorAvailability.parentSlotId}`,
      })
      .from(assignments)
      .where(whereClause)
      .leftJoin(doctorAvailability, eq(assignments.availabilitySlotId, doctorAvailability.id))
      .orderBy(
        asc(sql`COALESCE(${doctorAvailability.slotDate}, DATE(${assignments.requestedAt}::timestamp))`),
        asc(sql`COALESCE(${doctorAvailability.startTime}, (${assignments.requestedAt}::timestamp)::time)`),
        asc(assignments.requestedAt)
      );

    // Format response
    let formattedAssignments = assignmentsList.map((assignment) => {
      const date = assignment.slotDate || (assignment.requestedAt ? new Date(assignment.requestedAt).toISOString().split('T')[0] : null);
      const time = assignment.slotTime || 'TBD';
      const endTime = assignment.slotEndTime || null;

      // Format time
      let formattedTime = time;
      if (time !== 'TBD' && time.includes(':')) {
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        formattedTime = `${displayHour}:${minutes} ${ampm}`;
      }

      // Calculate expiresIn for pending assignments
      let expiresIn = null;
      if (assignment.status === 'pending' && assignment.expiresAt) {
        const expires = new Date(assignment.expiresAt);
        const now = new Date();
        const diffMs = expires.getTime() - now.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        if (diffHours > 0) {
          expiresIn = `${diffHours}h`;
        } else {
          const diffMinutes = Math.floor(diffMs / (1000 * 60));
          if (diffMinutes > 0) {
            expiresIn = `${diffMinutes}m`;
          }
        }
      }

      return {
        id: assignment.id,
        patient: assignment.patientName || 'Unknown',
        condition: assignment.patientCondition || 'N/A',
        hospital: assignment.hospitalName || 'Unknown',
        hospitalAddress: assignment.hospitalAddress || null,
        date,
        time: formattedTime,
        endTime: endTime ? (() => {
          const [hours, minutes] = endTime.split(':');
          const hour = parseInt(hours);
          const ampm = hour >= 12 ? 'PM' : 'AM';
          const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
          return `${displayHour}:${minutes} ${ampm}`;
        })() : null,
        status: assignment.status,
        priority: assignment.priority || 'routine',
        createdAt: assignment.requestedAt,
        acceptedAt: assignment.status === 'accepted' && assignment.actualStartTime ? assignment.actualStartTime : null,
        declinedAt: assignment.status === 'declined' && assignment.cancelledAt ? assignment.cancelledAt : null,
        cancelledAt: assignment.status === 'cancelled' && assignment.cancelledAt ? assignment.cancelledAt : null,
        completedAt: assignment.completedAt,
        expiresIn,
        parentSlotId: assignment.parentSlotId || null,
        availabilitySlotId: assignment.availabilitySlotId || null,
        expiresAt: assignment.expiresAt,
        fee: assignment.consultationFee ? Number(assignment.consultationFee) : 0,
        declineReason: assignment.status === 'declined' ? assignment.cancellationReason : null,
        cancellationReason: assignment.status === 'cancelled' ? assignment.cancellationReason : null,
        treatmentNotes: assignment.treatmentNotes,
        hospitalId: assignment.hospitalId,
        patientId: assignment.patientId,
      };
    });

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      formattedAssignments = formattedAssignments.filter(
        (a) =>
          a.patient.toLowerCase().includes(searchLower) ||
          a.hospital.toLowerCase().includes(searchLower) ||
          a.condition.toLowerCase().includes(searchLower)
      );
    }

    return NextResponse.json({
      success: true,
      data: formattedAssignments,
    });
  } catch (error) {
    console.error('Error fetching doctor assignments:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch assignments',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const GET = withAuthAndContext(getHandler, ['doctor', 'admin']);

