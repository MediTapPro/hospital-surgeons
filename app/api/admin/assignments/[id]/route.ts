import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { assignments, doctors, hospitals, patients, users, assignmentRatings, assignmentPayments } from '@/src/db/drizzle/migrations/schema';
import { eq, sql } from 'drizzle-orm';
import { createAuditLog, getRequestMetadata, buildChangesObject } from '@/lib/utils/audit-logger';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const assignmentId = id;

    // Get assignment with all related data
    const assignmentResult = await db.execute(sql`
      SELECT 
        a.*,
        h.name as hospital_name,
        h.id as hospital_id,
        d.first_name as doctor_first_name,
        d.last_name as doctor_last_name,
        d.id as doctor_id,
        p.full_name as patient_name,
        p.date_of_birth as patient_dob,
        p.gender as patient_gender,
        p.phone as patient_phone,
        p.medical_condition as patient_condition,
        u_h.email as hospital_email,
        u_h.phone as hospital_phone,
        u_d.email as doctor_email,
        u_d.phone as doctor_phone
      FROM assignments a
      LEFT JOIN hospitals h ON a.hospital_id = h.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN users u_h ON h.user_id = u_h.id
      LEFT JOIN users u_d ON d.user_id = u_d.id
      WHERE a.id = ${assignmentId}
    `);

    if (assignmentResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Assignment not found' },
        { status: 404 }
      );
    }

    const assignment = assignmentResult.rows[0] as any;

    // Get rating if exists
    const ratingResult = await db
      .select()
      .from(assignmentRatings)
      .where(eq(assignmentRatings.assignmentId, assignmentId))
      .limit(1);

    // Get payment if exists
    const paymentResult = await db
      .select()
      .from(assignmentPayments)
      .where(eq(assignmentPayments.assignmentId, assignmentId))
      .limit(1);

    // Get audit history
    const historyResult = await db.execute(sql`
      SELECT * FROM audit_logs
      WHERE entity_type = 'assignment' 
        AND entity_id = ${assignmentId}
      ORDER BY created_at DESC
      LIMIT 20
    `);

    return NextResponse.json({
      success: true,
      data: {
        id: assignment.id,
        hospital: {
          id: assignment.hospital_id,
          name: assignment.hospital_name,
          email: assignment.hospital_email,
          phone: assignment.hospital_phone,
        },
        doctor: {
          id: assignment.doctor_id,
          name: `Dr. ${assignment.doctor_first_name || ''} ${assignment.doctor_last_name || ''}`.trim(),
          email: assignment.doctor_email,
          phone: assignment.doctor_phone,
        },
        patient: {
          id: assignment.patient_id,
          name: assignment.patient_name,
          dateOfBirth: assignment.patient_dob,
          gender: assignment.patient_gender,
          phone: assignment.patient_phone,
          medicalCondition: assignment.patient_condition,
        },
        priority: assignment.priority,
        status: assignment.status,
        requestedAt: assignment.requested_at,
        expiresAt: assignment.expires_at,
        actualStartTime: assignment.actual_start_time,
        actualEndTime: assignment.actual_end_time,
        treatmentNotes: assignment.treatment_notes,
        consultationFee: assignment.consultation_fee ? Number(assignment.consultation_fee) : null,
        cancellationReason: assignment.cancellation_reason,
        cancelledBy: assignment.cancelled_by,
        cancelledAt: assignment.cancelled_at,
        completedAt: assignment.completed_at,
        paidAt: assignment.paid_at,
        rating: ratingResult.length > 0 ? {
          rating: ratingResult[0].rating,
          comment: ratingResult[0].reviewText,
        } : null,
        payment: paymentResult.length > 0 ? {
          consultationFee: Number(paymentResult[0].consultationFee),
          platformCommission: Number(paymentResult[0].platformCommission),
          doctorPayout: Number(paymentResult[0].doctorPayout),
          paymentStatus: paymentResult[0].paymentStatus,
          paidToDoctorAt: paymentResult[0].paidToDoctorAt,
        } : null,
        history: (historyResult.rows || []).map((log: any) => ({
          id: log.id,
          action: log.action,
          details: log.details,
          createdAt: log.created_at,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching assignment:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch assignment',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const assignmentId = id;
    const body = await req.json();
    const { status, treatmentNotes, cancellationReason, cancelledBy } = body;

    // Check if assignment exists
    const existing = await db
      .select()
      .from(assignments)
      .where(eq(assignments.id, assignmentId))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Assignment not found' },
        { status: 404 }
      );
    }

    // Build update object
    const updateData: any = {};
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'completed') {
        updateData.completedAt = new Date().toISOString();
      } else if (status === 'cancelled') {
        updateData.cancelledAt = new Date().toISOString();
        if (cancellationReason) updateData.cancellationReason = cancellationReason;
        if (cancelledBy) updateData.cancelledBy = cancelledBy;
      }
    }
    if (treatmentNotes !== undefined) updateData.treatmentNotes = treatmentNotes;

    const oldAssignment = existing[0];

    // Update assignment
    const [updatedAssignment] = await db
      .update(assignments)
      .set(updateData)
      .where(eq(assignments.id, assignmentId))
      .returning();

    // Get request metadata
    const metadata = getRequestMetadata(req);
    const adminUserId = req.headers.get('x-user-id') || null;

    // Build changes object
    const oldData: any = {
      status: oldAssignment.status,
      treatmentNotes: oldAssignment.treatmentNotes,
      cancellationReason: oldAssignment.cancellationReason,
    };
    const newData: any = {
      status: updatedAssignment.status,
      treatmentNotes: updatedAssignment.treatmentNotes,
      cancellationReason: updatedAssignment.cancellationReason,
    };
    const changes = buildChangesObject(oldData, newData, ['status', 'treatmentNotes', 'cancellationReason']);

    // Create comprehensive audit log
    await createAuditLog({
      userId: adminUserId,
      actorType: 'admin',
      action: 'update',
      entityType: 'assignment',
      entityId: assignmentId,
      entityName: `Assignment ${assignmentId}`,
      httpMethod: 'PUT',
      endpoint: `/api/admin/assignments/${assignmentId}`,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      changes: changes,
      previousStatus: oldAssignment.status,
      newStatus: updatedAssignment.status,
      reason: cancellationReason || null,
      details: {
        doctorId: oldAssignment.doctorId,
        hospitalId: oldAssignment.hospitalId,
        patientId: oldAssignment.patientId,
        requestedAt: oldAssignment.requestedAt,
        expiresAt: oldAssignment.expiresAt,
        priority: oldAssignment.priority,
        updatedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Assignment updated successfully',
      data: updatedAssignment,
    });
  } catch (error) {
    console.error('Error updating assignment:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to update assignment',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


