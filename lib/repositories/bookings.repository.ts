import { getDb } from '@/lib/db';
import { 
  assignments, // Use assignments instead of bookings
  hospitals, 
  doctors, 
  specialties, 
  users,
  patients,
  doctorAvailability,
  doctorLeaves // Use doctorLeaves instead of doctorLeaves
} from '@/src/db/drizzle/migrations/schema';
import { eq, and, desc, asc, gte, lte, sql, count, sum, avg } from 'drizzle-orm';

export interface CreateBookingData {
  hospitalId: string;
  doctorId: string;
  patientId: string; // Required in assignments
  availabilitySlotId?: string; // Optional - references doctorAvailability
  priority?: 'low' | 'medium' | 'high';
  treatmentNotes?: string;
  consultationFee?: number;
  // specialtyId removed - get from doctorSpecialties via doctorId
  // bookingDate, startTime, endTime removed - get from availabilitySlotId
}

export interface BookingQuery {
  page?: number;
  limit?: number;
  hospitalId?: string;
  doctorId?: string;
  patientId?: string;
  status?: string;
  sortBy?: 'requestedAt' | 'status' | 'priority';
  sortOrder?: 'asc' | 'desc';
}

export class BookingsRepository {
  private db = getDb();

  async createBooking(bookingData: CreateBookingData) {
    return await this.db
      .insert(assignments)
      .values({
        hospitalId: bookingData.hospitalId,
        doctorId: bookingData.doctorId,
        patientId: bookingData.patientId,
        availabilitySlotId: bookingData.availabilitySlotId,
        priority: bookingData.priority || 'medium',
        treatmentNotes: bookingData.treatmentNotes,
        consultationFee: bookingData.consultationFee ? bookingData.consultationFee.toString() : undefined,
        status: 'pending',
      })
      .returning();
  }

  async findBookingById(id: string) {
    const result = await this.db
      .select({
        booking: assignments,
        hospital: hospitals,
        doctor: doctors,
        patient: patients,
      })
      .from(assignments)
      .leftJoin(hospitals, eq(assignments.hospitalId, hospitals.id))
      .leftJoin(doctors, eq(assignments.doctorId, doctors.id))
      .leftJoin(patients, eq(assignments.patientId, patients.id))
      .where(eq(assignments.id, id))
      .limit(1);

    return result[0] || null;
  }

  async findBookings(query: BookingQuery) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const offset = (page - 1) * limit;

    let orderByClause;
    if (query.sortBy === 'requestedAt') {
      orderByClause = query.sortOrder === 'asc' ? asc(assignments.requestedAt) : desc(assignments.requestedAt);
    } else if (query.sortBy === 'status') {
      orderByClause = query.sortOrder === 'asc' ? asc(assignments.status) : desc(assignments.status);
    } else if (query.sortBy === 'priority') {
      orderByClause = query.sortOrder === 'asc' ? asc(assignments.priority) : desc(assignments.priority);
    } else {
      orderByClause = desc(assignments.requestedAt);
    }

    const whereConditions = [];
    if (query.hospitalId) whereConditions.push(eq(assignments.hospitalId, query.hospitalId));
    if (query.doctorId) whereConditions.push(eq(assignments.doctorId, query.doctorId));
    if (query.patientId) whereConditions.push(eq(assignments.patientId, query.patientId));
    if (query.status) whereConditions.push(eq(assignments.status, query.status));

    return await this.db
      .select({
        booking: assignments,
        hospital: hospitals,
        doctor: doctors,
        patient: patients,
      })
      .from(assignments)
      .leftJoin(hospitals, eq(assignments.hospitalId, hospitals.id))
      .leftJoin(doctors, eq(assignments.doctorId, doctors.id))
      .leftJoin(patients, eq(assignments.patientId, patients.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);
  }

  async updateBooking(id: string, updateData: any) {
    const updateFields: any = {};
    
    if (updateData.status) updateFields.status = updateData.status;
    if (updateData.actualStartTime) updateFields.actualStartTime = updateData.actualStartTime;
    if (updateData.actualEndTime) updateFields.actualEndTime = updateData.actualEndTime;
    if (updateData.treatmentNotes) updateFields.treatmentNotes = updateData.treatmentNotes;
    if (updateData.consultationFee !== undefined) updateFields.consultationFee = updateData.consultationFee.toString();
    if (updateData.cancellationReason) updateFields.cancellationReason = updateData.cancellationReason;
    if (updateData.cancelledBy) updateFields.cancelledBy = updateData.cancelledBy;
    if (updateData.cancelledAt) updateFields.cancelledAt = updateData.cancelledAt;
    if (updateData.completedAt) updateFields.completedAt = updateData.completedAt;
    if (updateData.paidAt) updateFields.paidAt = updateData.paidAt;

    return await this.db
      .update(assignments)
      .set(updateFields)
      .where(eq(assignments.id, id))
      .returning();
  }

  async deleteBooking(id: string) {
    return await this.db
      .delete(assignments)
      .where(eq(assignments.id, id))
      .returning();
  }

  async checkDoctorAvailability(doctorId: string, bookingDate: string, startTime: string, endTime: string) {
    // Check for conflicting assignments via availability slots
    const conflictingAssignments = await this.db
      .select()
      .from(assignments)
      .leftJoin(doctorAvailability, eq(assignments.availabilitySlotId, doctorAvailability.id))
      .where(and(
        eq(assignments.doctorId, doctorId),
        eq(doctorAvailability.slotDate, bookingDate),
        eq(assignments.status, 'confirmed'),
        sql`(${doctorAvailability.startTime} < ${endTime} AND ${doctorAvailability.endTime} > ${startTime})`
      ));

    // Check availability for the specific date
    const regularAvailability = await this.db
      .select()
      .from(doctorAvailability)
      .where(and(
        eq(doctorAvailability.doctorId, doctorId),
        eq(doctorAvailability.slotDate, bookingDate),
        eq(doctorAvailability.status, 'available')
      ));

    const unavailability = await this.db
      .select()
      .from(doctorLeaves)
      .where(and(
        eq(doctorLeaves.doctorId, doctorId),
        lte(doctorLeaves.startDate, bookingDate),
        gte(doctorLeaves.endDate, bookingDate)
      ));

    return {
      isAvailable: conflictingAssignments.length === 0 && regularAvailability.length > 0 && unavailability.length === 0,
      conflictingAssignments,
      regularAvailability,
      unavailability,
    };
  }

  async getAvailableTimeSlots(doctorId: string, bookingDate: string) {
    // Get availability slots for the date
    const availability = await this.db
      .select()
      .from(doctorAvailability)
      .where(and(
        eq(doctorAvailability.doctorId, doctorId),
        eq(doctorAvailability.slotDate, bookingDate),
        eq(doctorAvailability.status, 'available')
      ));

    // Get existing assignments for the date
    const existingAssignments = await this.db
      .select()
      .from(assignments)
      .leftJoin(doctorAvailability, eq(assignments.availabilitySlotId, doctorAvailability.id))
      .where(and(
        eq(assignments.doctorId, doctorId),
        eq(doctorAvailability.slotDate, bookingDate),
        eq(assignments.status, 'confirmed')
      ));

    const unavailability = await this.db
      .select()
      .from(doctorLeaves)
      .where(and(
        eq(doctorLeaves.doctorId, doctorId),
        lte(doctorLeaves.startDate, bookingDate),
        gte(doctorLeaves.endDate, bookingDate)
      ));

    return {
      availability,
      existingAssignments,
      unavailability,
    };
  }

  async getBookingStats() {
    const result = await this.db
      .select({
        totalBookings: count(assignments.id),
        pendingBookings: sql<number>`COUNT(CASE WHEN ${assignments.status} = 'pending' THEN 1 END)`,
        confirmedBookings: sql<number>`COUNT(CASE WHEN ${assignments.status} = 'confirmed' THEN 1 END)`,
        completedBookings: sql<number>`COUNT(CASE WHEN ${assignments.status} = 'completed' THEN 1 END)`,
        cancelledBookings: sql<number>`COUNT(CASE WHEN ${assignments.status} = 'cancelled' THEN 1 END)`,
        // Revenue stats would come from assignmentPayments table
      })
      .from(assignments);

    return result[0] || null;
  }
}


