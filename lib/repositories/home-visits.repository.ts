import { getDb } from '@/lib/db';
import {
  assignments,
  doctorAvailability,
  doctors,
  subscriptions,
  doctorAssignmentUsage,
  assignmentExpiryConfig,
  homeVisitDetails
} from '@/src/db/drizzle/migrations/schema';
import { eq, and, sql, lte, gt } from 'drizzle-orm';

export class HomeVisitsRepository {
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
    slotType: string;
    isManual: boolean;
    notes: string;
  }, tx?: any) {
    const client = tx || this.db;
    const result = await client
      .insert(doctorAvailability)
      .values(data)
      .returning();
    return result[0];
  }

  async updateSlotStatus(slotId: string, status: string, tx?: any) {
    const client = tx || this.db;
    return await client
      .update(doctorAvailability)
      .set({
        status,
        bookedAt: new Date().toISOString(),
      })
      .where(eq(doctorAvailability.id, slotId));
  }

  async createAssignment(data: {
    doctorId: string;
    patientProfileId: string;
    availabilitySlotId: string;
    priority: string;
    status: string;
    source: string;
    expiresAt: string;
    treatmentNotes: string | null;
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
    const { enumPriority } = await import('@/src/db/drizzle/migrations/schema');
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

  async createHomeVisitDetails(data: {
    assignmentId: string;
    patientAddressId: string | null;
    patientFamilyMemberId: string | null;
    symptoms: string | null;
    addressLabel: string | null;
    addressText: string | null;
    addressLatitude: string | null;
    addressLongitude: string | null;
    recipientName: string | null;
    recipientPhone: string | null;
    recipientRelationship: string | null;
  }, tx?: any) {
    const client = tx || this.db;
    const result = await client
      .insert(homeVisitDetails)
      .values(data)
      .returning();
    return result[0];
  }
}
