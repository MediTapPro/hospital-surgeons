import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';
import {
  assignments,
  doctorAvailability,
  doctors,
  hospitals,
  patients,
} from '@/src/db/drizzle/migrations/schema';
import { eq, sql } from 'drizzle-orm';

async function getHandler(
  req: AuthenticatedRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const assignmentId = params.id;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(assignmentId)) {
      return NextResponse.json(
        { success: false, message: 'Invalid assignment id' },
        { status: 400 }
      );
    }

    const user = req.user;
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const db = getDb();

    // Fetch assignment core first (needed for permission checks)
    const baseAssignment = await db
      .select({
        id: assignments.id,
        doctorId: assignments.doctorId,
        hospitalId: assignments.hospitalId,
      })
      .from(assignments)
      .where(eq(assignments.id, assignmentId))
      .limit(1);

    if (baseAssignment.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Assignment not found' },
        { status: 404 }
      );
    }

    const assignmentCore = baseAssignment[0];

    // Authorization: only assigned doctor, owning hospital, or admin
    if (user.userRole === 'doctor') {
      const { DoctorsService } = await import('@/lib/services/doctors.service');
      const doctorsService = new DoctorsService();
      const doctorResult = await doctorsService.findDoctorByUserId(user.userId);

      if (
        !doctorResult.success ||
        !doctorResult.data ||
        doctorResult.data.id !== assignmentCore.doctorId
      ) {
        return NextResponse.json(
          { success: false, message: 'Insufficient permissions' },
          { status: 403 }
        );
      }
    } else if (user.userRole === 'hospital') {
      const { HospitalsService } = await import('@/lib/services/hospitals.service');
      const hospitalsService = new HospitalsService();
      const hospitalResult = await hospitalsService.findHospitalByUserId(user.userId);

      if (
        !hospitalResult.success ||
        !hospitalResult.data ||
        hospitalResult.data.id !== assignmentCore.hospitalId
      ) {
        return NextResponse.json(
          { success: false, message: 'Insufficient permissions' },
          { status: 403 }
        );
      }
    }

    // Fetch full assignment details
    const rows = await db
      .select({
        id: assignments.id,
        patientId: assignments.patientId,
        doctorId: assignments.doctorId,
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

        // Patient
        patientName: patients.fullName,
        patientCondition: patients.medicalCondition,

        // Doctor
        doctorFirstName: doctors.firstName,
        doctorLastName: doctors.lastName,
        doctorPrimaryLocation: doctors.primaryLocation,
        doctorFullAddress: doctors.fullAddress,
        doctorLatitude: doctors.latitude,
        doctorLongitude: doctors.longitude,

        // Hospital
        hospitalName: hospitals.name,
        hospitalFullAddress: sql<string | null>`COALESCE(${hospitals.fullAddress}, ${hospitals.address})`,
        hospitalCity: hospitals.city,
        hospitalState: hospitals.state,
        hospitalPincode: hospitals.pincode,
        hospitalLatitude: hospitals.latitude,
        hospitalLongitude: hospitals.longitude,

        // Slot
        slotDate: doctorAvailability.slotDate,
        slotFrom: doctorAvailability.startTime,
        slotTo: doctorAvailability.endTime,
        parentSlotId: doctorAvailability.parentSlotId,
      })
      .from(assignments)
      .leftJoin(patients, eq(assignments.patientId, patients.id))
      .leftJoin(doctors, eq(assignments.doctorId, doctors.id))
      .leftJoin(hospitals, eq(assignments.hospitalId, hospitals.id))
      .leftJoin(doctorAvailability, eq(assignments.availabilitySlotId, doctorAvailability.id))
      .where(eq(assignments.id, assignmentId))
      .limit(1);

    const row = rows[0];

    const date = row.slotDate
      ? String(row.slotDate)
      : row.requestedAt
      ? new Date(row.requestedAt).toISOString().split('T')[0]
      : null;

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        status: row.status,
        priority: row.priority,
        requestedAt: row.requestedAt,
        expiresAt: row.expiresAt,
        actualStartTime: row.actualStartTime,
        actualEndTime: row.actualEndTime,
        completedAt: row.completedAt,
        cancelledAt: row.cancelledAt,
        cancellationReason: row.cancellationReason,
        treatmentNotes: row.treatmentNotes,
        fee: row.consultationFee ? Number(row.consultationFee) : 0,

        patient: {
          id: row.patientId,
          name: row.patientName || 'Unknown',
          condition: row.patientCondition || null,
        },
        doctor: {
          id: row.doctorId,
          firstName: row.doctorFirstName || null,
          lastName: row.doctorLastName || null,
          primaryLocation: row.doctorPrimaryLocation || null,
          fullAddress: row.doctorFullAddress || null,
          latitude:
            row.doctorLatitude === null || row.doctorLatitude === undefined
              ? null
              : Number(row.doctorLatitude),
          longitude:
            row.doctorLongitude === null || row.doctorLongitude === undefined
              ? null
              : Number(row.doctorLongitude),
        },
        hospital: {
          id: row.hospitalId,
          name: row.hospitalName || null,
          fullAddress: row.hospitalFullAddress || null,
          city: row.hospitalCity || null,
          state: row.hospitalState || null,
          pincode: row.hospitalPincode || null,
          latitude:
            row.hospitalLatitude === null || row.hospitalLatitude === undefined
              ? null
              : Number(row.hospitalLatitude),
          longitude:
            row.hospitalLongitude === null || row.hospitalLongitude === undefined
              ? null
              : Number(row.hospitalLongitude),
        },
        schedule: {
          date,
          from: row.slotFrom ? String(row.slotFrom) : null,
          to: row.slotTo ? String(row.slotTo) : null,
          availabilitySlotId: row.availabilitySlotId || null,
          parentSlotId: row.parentSlotId || null,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching assignment details:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch assignment details',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const GET = withAuthAndContext(getHandler, ['doctor', 'hospital', 'admin']);
