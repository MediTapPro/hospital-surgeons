import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { assignments, doctors, patients, doctorAvailability, enumPriority, assignmentPayments } from '@/src/db/drizzle/migrations/schema';
import { eq, and, or, sql, desc, asc } from 'drizzle-orm';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';

/**
 * @swagger
 * /api/hospitals/{id}/assignments:
 *   get:
 *     summary: Get all assignments for a hospital
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
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, accepted, declined, completed, cancelled]
 *         description: Filter by assignment status
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent, emergency]
 *         description: Filter by priority
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
 *       401:
 *         description: Unauthorized
 */
async function getHandler(
  req: AuthenticatedRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    if (!context || !context.params) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid request context',
        },
        { status: 400 }
      );
    }
    
    const params = await context.params;
    const hospitalId = params.id;
    
    // Validate UUID format - return empty data for placeholder
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(hospitalId) || hospitalId === 'hospital-id-placeholder') {
      return NextResponse.json({
        success: true,
        data: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      });
    }
    
    const db = getDb();
    const searchParams = req.nextUrl.searchParams;

    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;
    const dateFilter = searchParams.get('dateFilter') || undefined; // 'today' | 'future' | undefined
    const selectedDate = searchParams.get('selectedDate') || undefined; // Custom date selection
    const from = searchParams.get('from') || undefined; // YYYY-MM-DD
    const to = searchParams.get('to') || undefined; // YYYY-MM-DD

    // Build where conditions
    const conditions = [eq(assignments.hospitalId, hospitalId)];
    if (status && status !== 'all') {
      conditions.push(eq(assignments.status, status));
    }

    // Date filter based on slot date
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
    } else if (selectedDate) {
      // Custom date selection - filter by specific date
      conditions.push(sql`(
        EXISTS (
          SELECT 1 FROM doctor_availability da 
          WHERE da.id = ${assignments.availabilitySlotId} 
          AND DATE(da.slot_date) = ${selectedDate}::date
        )
        OR (
          ${assignments.availabilitySlotId} IS NULL 
          AND DATE(${assignments.requestedAt}::timestamp) = ${selectedDate}::date
        )
      )`);
    } else if (dateFilter === 'today' || dateFilter === 'future') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      
      if (dateFilter === 'today') {
        conditions.push(sql`(
          EXISTS (
            SELECT 1 FROM doctor_availability da 
            WHERE da.id = ${assignments.availabilitySlotId} 
            AND DATE(da.slot_date) = ${todayStr}::date
          )
          OR (
            ${assignments.availabilitySlotId} IS NULL 
            AND DATE(${assignments.requestedAt}::timestamp) = ${todayStr}::date
          )
        )`);
      } else if (dateFilter === 'future') {
        conditions.push(sql`(
          EXISTS (
            SELECT 1 FROM doctor_availability da 
            WHERE da.id = ${assignments.availabilitySlotId} 
            AND DATE(da.slot_date) > ${todayStr}::date
          )
          OR (
            ${assignments.availabilitySlotId} IS NULL 
            AND DATE(${assignments.requestedAt}::timestamp) > ${todayStr}::date
          )
        )`);
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get assignments with related data
    const assignmentsList = await db
      .select({
        id: assignments.id,
        patientId: assignments.patientId,
        doctorId: assignments.doctorId,
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
        // Patient info
        patientName: sql<string>`(SELECT full_name FROM patients WHERE id = ${assignments.patientId})`,
        patientCondition: sql<string>`(SELECT medical_condition FROM patients WHERE id = ${assignments.patientId})`,
        // Doctor info
        doctorFirstName: sql<string>`(SELECT first_name FROM doctors WHERE id = ${assignments.doctorId})`,
        doctorLastName: sql<string>`(SELECT last_name FROM doctors WHERE id = ${assignments.doctorId})`,
        doctorFullAddress: sql<string>`(SELECT full_address FROM doctors WHERE id = ${assignments.doctorId})`,
        doctorCity: sql<string>`(SELECT city FROM doctors WHERE id = ${assignments.doctorId})`,
        doctorState: sql<string>`(SELECT state FROM doctors WHERE id = ${assignments.doctorId})`,
        doctorPincode: sql<string>`(SELECT pincode FROM doctors WHERE id = ${assignments.doctorId})`,
        specialtyName: sql<string>`(SELECT name FROM specialties WHERE id = (SELECT specialty_id FROM doctor_specialties WHERE doctor_id = ${assignments.doctorId} LIMIT 1))`,
        // Payment info
        paymentStatus: sql<string>`(SELECT payment_status FROM assignment_payments WHERE assignment_id = ${assignments.id} LIMIT 1)`,
        paymentMethod: sql<string>`(SELECT payment_method FROM assignment_payments WHERE assignment_id = ${assignments.id} LIMIT 1)`,
        // Slot info
        slotDate: sql<string>`${doctorAvailability.slotDate}::text`,
        slotTime: sql<string>`${doctorAvailability.startTime}::text`,
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

      // Calculate expiresIn for pending assignments
      let expiresIn = null;
      if (assignment.status === 'pending' && assignment.expiresAt) {
        const expires = new Date(assignment.expiresAt);
        const now = new Date();
        const diffMs = expires.getTime() - now.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        if (diffHours > 0) {
          expiresIn = `${diffHours}h`;
        }
      }

      return {
        id: assignment.id,
        patient: assignment.patientName || 'Unknown',
        condition: assignment.patientCondition || 'N/A',
        doctor: `Dr. ${assignment.doctorFirstName || ''} ${assignment.doctorLastName || ''}`.trim(),
        doctorAddress: assignment.doctorFullAddress || [assignment.doctorCity, assignment.doctorState, assignment.doctorPincode].filter(Boolean).join(', ') || null,
        specialty: assignment.specialtyName || 'General',
        date,
        time,
        status: assignment.status,
        priority: assignment.priority || 'routine',
        createdAt: assignment.requestedAt,
        acceptedAt: assignment.status === 'accepted' && assignment.actualStartTime ? assignment.actualStartTime : null,
        declinedAt: assignment.status === 'declined' && assignment.cancelledAt ? assignment.cancelledAt : null,
        cancelledAt: assignment.status === 'cancelled' && assignment.cancelledAt ? assignment.cancelledAt : null,
        completedAt: assignment.completedAt,
        expiresIn,
        fee: assignment.consultationFee ? Number(assignment.consultationFee) : 0,
        declineReason: assignment.status === 'declined' ? assignment.cancellationReason : null,
        cancellationReason: assignment.status === 'cancelled' ? assignment.cancellationReason : null,
        treatmentNotes: assignment.treatmentNotes,
        paymentStatus: assignment.paymentStatus || null,
        paymentMethod: assignment.paymentMethod || null,
      };
    });

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      formattedAssignments = formattedAssignments.filter(
        (a) =>
          a.patient.toLowerCase().includes(searchLower) ||
          a.doctor.toLowerCase().includes(searchLower) ||
          a.condition.toLowerCase().includes(searchLower)
      );
    }

    return NextResponse.json({
      success: true,
      data: formattedAssignments,
    });
  } catch (error) {
    console.error('Error fetching assignments:', error);
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

export const GET = withAuthAndContext(getHandler, ['hospital', 'admin']);

