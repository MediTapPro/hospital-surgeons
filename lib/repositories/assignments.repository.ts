import { getDb } from '@/lib/db';
import {
  assignments,
  doctorAvailability,
  doctors,
  subscriptions,
  doctorAssignmentUsage,
  assignmentExpiryConfig,
  enumPriority,
} from '@/src/db/drizzle/migrations/schema';
import { eq, and, sql, lte, gt } from 'drizzle-orm';

export class AssignmentsRepository {
  constructor(private db: any = getDb()) {}

  async findActiveSubscription(doctorId: string, tx?: any) {
    const client = tx || this.db;
    const result = await client
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .innerJoin(doctors, eq(doctors.userId, subscriptions.userId))
      .where(and(eq(doctors.id, doctorId), eq(subscriptions.status, 'active')))
      .limit(1);
    return result[0] || null;
  }

  async findDoctorUsage(doctorId: string, subscriptionId: string, tx?: any) {
    const client = tx || this.db;
    const result = await client
      .select()
      .from(doctorAssignmentUsage)
      .where(
        and(
          eq(doctorAssignmentUsage.doctorId, doctorId),
          eq(doctorAssignmentUsage.subscriptionId, subscriptionId),
          lte(doctorAssignmentUsage.periodStart, sql`NOW()`),
          gt(doctorAssignmentUsage.periodEnd, sql`NOW()`)
        )
      )
      .limit(1);
    return result[0] || null;
  }

  async incrementDoctorUsage(usageId: string, tx?: any) {
    const client = tx || this.db;
    return await client
      .update(doctorAssignmentUsage)
      .set({
        count: sql`${doctorAssignmentUsage.count} + 1`,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(doctorAssignmentUsage.id, usageId));
  }

  async findDoctorUser(doctorId: string, tx?: any) {
    const client = tx || this.db;
    const result = await client
      .select({ userId: doctors.userId, firstName: doctors.firstName, lastName: doctors.lastName })
      .from(doctors)
      .where(eq(doctors.id, doctorId))
      .limit(1);
    return result[0] || null;
  }

  async findExpiryConfig(priority: string, tx?: any) {
    const client = tx || this.db;
    const result = await client
      .select({ expiryHours: assignmentExpiryConfig.expiryHours })
      .from(assignmentExpiryConfig)
      .where(
        and(
          eq(assignmentExpiryConfig.priority, priority),
          eq(assignmentExpiryConfig.isActive, true)
        )
      )
      .limit(1);
    return result[0] || null;
  }

  async findParentSlot(parentSlotId: string, tx?: any) {
    const client = tx || this.db;
    const result = await client
      .select()
      .from(doctorAvailability)
      .where(
        and(
          eq(doctorAvailability.id, parentSlotId),
          sql`${doctorAvailability.parentSlotId} IS NULL`
        )
      )
      .limit(1);
    return result[0] || null;
  }

  async findAvailabilitySlot(slotId: string, tx?: any) {
    const client = tx || this.db;
    const result = await client
      .select()
      .from(doctorAvailability)
      .where(eq(doctorAvailability.id, slotId))
      .limit(1);
    return result[0] || null;
  }

  async createSubSlot(data: {
    doctorId: string;
    slotDate: string;
    startTime: string;
    endTime: string;
    parentSlotId: string;
    status: string;
    isManual: boolean;
    notes: string;
    hospitalId?: string;
  }, tx?: any) {
    const client = tx || this.db;
    const result = await client
      .insert(doctorAvailability)
      .values(data)
      .returning();
    return result[0];
  }

  async updateSlotStatus(slotId: string, status: string, hospitalId?: string, tx?: any) {
    const client = tx || this.db;
    const updateData: any = {
      status,
      bookedAt: new Date().toISOString(),
    };
    if (hospitalId) {
      updateData.bookedByHospitalId = hospitalId;
    }
    return await client
      .update(doctorAvailability)
      .set(updateData)
      .where(eq(doctorAvailability.id, slotId));
  }

  async createAssignment(data: {
    hospitalId?: string;
    doctorId: string;
    patientId?: string;
    patientProfileId?: string;
    availabilitySlotId: string;
    priority: string;
    status: string;
    source: string;
    expiresAt: string;
    consultationFee?: string | null;
    procedureId?: string | null;
    procedureTypeId?: string | null;
    roomTypeId?: string | null;
    specialtyId?: string | null;
    treatmentNotes?: string | null;
  }, tx?: any) {
    const client = tx || this.db;
    const result = await client
      .insert(assignments)
      .values(data)
      .returning();
    return result[0];
  }

  async ensurePriorityExists(priority: string, tx?: any) {
    const client = tx || this.db;
    const result = await client
      .select()
      .from(enumPriority)
      .where(eq(enumPriority.priority, priority))
      .limit(1);

    if (result.length === 0) {
      await client.insert(enumPriority).values({
        priority,
        description: `${priority} priority assignment`,
      }).onConflictDoNothing();
    }
  }
}
