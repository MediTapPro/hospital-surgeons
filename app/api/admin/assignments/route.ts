import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { assignments, doctors, hospitals, patients, users, assignmentRatings, assignmentPayments } from '@/src/db/drizzle/migrations/schema';
import { eq, and, or, like, sql, desc, asc, gte, lte } from 'drizzle-orm';

/**
 * @swagger
 * /api/admin/assignments:
 *   get:
 *     summary: Get all assignments with filters (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, accepted, declined, completed, cancelled]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent, emergency]
 *       - in: query
 *         name: doctorId
 *         schema:
 *           type: string
 *       - in: query
 *         name: hospitalId
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: requestedAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
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
 *                 pagination:
 *                   type: object
 *       401:
 *         description: Unauthorized
 */
export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const searchParams = req.nextUrl.searchParams;
    
    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    // Filters
    const status = searchParams.get('status') || undefined;
    const priority = searchParams.get('priority') || undefined;
    const doctorId = searchParams.get('doctorId') || undefined;
    const hospitalId = searchParams.get('hospitalId') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const search = searchParams.get('search') || undefined;
    const sortBy = searchParams.get('sortBy') || 'requestedAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build where conditions
    const conditions = [];
    
    if (status) {
      conditions.push(eq(assignments.status, status));
    }
    
    if (priority) {
      conditions.push(eq(assignments.priority, priority));
    }
    
    if (doctorId) {
      conditions.push(eq(assignments.doctorId, doctorId));
    }
    
    if (hospitalId) {
      conditions.push(eq(assignments.hospitalId, hospitalId));
    }
    
    if (startDate) {
      conditions.push(gte(assignments.requestedAt, startDate));
    }
    
    if (endDate) {
      conditions.push(lte(assignments.requestedAt, endDate));
    }

    // Add search filter to WHERE clause
    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(
          sql`EXISTS (
            SELECT 1 FROM hospitals h 
            WHERE h.id = ${assignments.hospitalId} 
            AND h.name ILIKE ${searchPattern}
          )`,
          sql`EXISTS (
            SELECT 1 FROM doctors d 
            WHERE d.id = ${assignments.doctorId} 
            AND (d.first_name || ' ' || d.last_name) ILIKE ${searchPattern}
          )`,
          sql`EXISTS (
            SELECT 1 FROM patients p 
            WHERE p.id = ${assignments.patientId} 
            AND p.full_name ILIKE ${searchPattern}
          )`
        )!
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(assignments)
      .where(whereClause);
    
    const total = Number(countResult[0]?.count || 0);

    // Map sortBy to actual column references
    const sortColumnMap: Record<string, any> = {
      requestedAt: assignments.requestedAt,
      status: assignments.status,
      priority: assignments.priority,
      createdAt: assignments.requestedAt, // Use requestedAt as createdAt
      completedAt: assignments.completedAt,
      cancelledAt: assignments.cancelledAt,
    };

    const sortColumn = sortColumnMap[sortBy] || assignments.requestedAt;

    // Get assignments with related data
    const assignmentsList = await db
      .select({
        id: assignments.id,
        hospitalId: assignments.hospitalId,
        doctorId: assignments.doctorId,
        patientId: assignments.patientId,
        priority: assignments.priority,
        status: assignments.status,
        requestedAt: assignments.requestedAt,
        expiresAt: assignments.expiresAt,
        actualStartTime: assignments.actualStartTime,
        actualEndTime: assignments.actualEndTime,
        treatmentNotes: assignments.treatmentNotes,
        consultationFee: assignments.consultationFee,
        cancellationReason: assignments.cancellationReason,
        cancelledBy: assignments.cancelledBy,
        cancelledAt: assignments.cancelledAt,
        completedAt: assignments.completedAt,
        paidAt: assignments.paidAt,
        // Hospital info
        hospitalName: sql<string>`(SELECT name FROM hospitals WHERE id = ${assignments.hospitalId})`,
        // Doctor info
        doctorFirstName: sql<string>`(SELECT first_name FROM doctors WHERE id = ${assignments.doctorId})`,
        doctorLastName: sql<string>`(SELECT last_name FROM doctors WHERE id = ${assignments.doctorId})`,
        // Patient info
        patientName: sql<string>`(SELECT full_name FROM patients WHERE id = ${assignments.patientId})`,
      })
      .from(assignments)
      .where(whereClause)
      .orderBy(sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn))
      .limit(limit)
      .offset(offset);

    // Format response
    const formattedAssignments = assignmentsList.map((assignment) => ({
      id: assignment.id,
      hospital: {
        id: assignment.hospitalId,
        name: assignment.hospitalName || 'Unknown',
      },
      doctor: {
        id: assignment.doctorId,
        name: `Dr. ${assignment.doctorFirstName || ''} ${assignment.doctorLastName || ''}`.trim() || 'Unknown',
      },
      patient: {
        id: assignment.patientId,
        name: assignment.patientName || 'Unknown',
      },
      priority: assignment.priority,
      status: assignment.status,
      requestedAt: assignment.requestedAt,
      expiresAt: assignment.expiresAt,
      actualStartTime: assignment.actualStartTime,
      actualEndTime: assignment.actualEndTime,
      treatmentNotes: assignment.treatmentNotes,
      consultationFee: assignment.consultationFee ? Number(assignment.consultationFee) : null,
      cancellationReason: assignment.cancellationReason,
      cancelledBy: assignment.cancelledBy,
      cancelledAt: assignment.cancelledAt,
      completedAt: assignment.completedAt,
      paidAt: assignment.paidAt,
    }));

    return NextResponse.json({
      success: true,
      data: formattedAssignments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
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



