import { getDb } from '@/lib/db';
import {
  assignmentPayments,
  assignments,
  doctorAvailability,
  doctors,
  hospitals,
  patientProfiles,
  patients,
} from '@/src/db/drizzle/migrations/schema';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { AssignmentPaymentSource, AssignmentSettlementStatus } from '@/lib/enums/assignment-payments.enums';

export type AssignmentPaymentsFilter = {
  doctorId?: string;
  source?: AssignmentPaymentSource;
  status?: AssignmentSettlementStatus;
  page: number;
  limit: number;
};

export class AssignmentPaymentsRepository {
  constructor(private readonly db: any = getDb()) {}

  private conditions(filter: AssignmentPaymentsFilter) {
    const conditions: any[] = [];
    if (filter.doctorId) conditions.push(eq(assignmentPayments.doctorId, filter.doctorId));
    if (filter.source) conditions.push(eq(assignmentPayments.paymentSource, filter.source));
    if (filter.status) conditions.push(eq(assignmentPayments.paymentStatus, filter.status));
    return conditions;
  }

  async count(filter: AssignmentPaymentsFilter) {
    const conditions = this.conditions(filter);
    const [result] = await this.db
      .select({ total: sql<number>`COUNT(*)` })
      .from(assignmentPayments)
      .where(conditions.length ? and(...conditions) : undefined);
    return Number(result?.total ?? 0);
  }

  async list(filter: AssignmentPaymentsFilter) {
    const conditions = this.conditions(filter);
    return this.db
      .select({
        id: assignmentPayments.id,
        assignmentId: assignmentPayments.assignmentId,
        paymentSource: assignmentPayments.paymentSource,
        patientPaymentStatus: assignmentPayments.patientPaymentStatus,
        patientPaidAt: assignmentPayments.patientPaidAt,
        consultationFee: assignmentPayments.consultationFee,
        platformCommission: assignmentPayments.platformCommission,
        doctorPayout: assignmentPayments.doctorPayout,
        paymentStatus: assignmentPayments.paymentStatus,
        paymentMethod: assignmentPayments.paymentMethod,
        paidToDoctorAt: assignmentPayments.paidToDoctorAt,
        createdAt: assignmentPayments.createdAt,
        assignmentCompletedAt: assignments.completedAt,
        assignmentStatus: assignments.status,
        assignmentRequestedAt: assignments.requestedAt,
        slotDate: doctorAvailability.slotDate,
        hospitalId: hospitals.id,
        hospitalName: hospitals.name,
        patientId: patients.id,
        patientName: patients.fullName,
        patientProfileId: patientProfiles.id,
        patientProfileName: patientProfiles.fullName,
        doctorFirstName: doctors.firstName,
        doctorLastName: doctors.lastName,
      })
      .from(assignmentPayments)
      .innerJoin(assignments, eq(assignments.id, assignmentPayments.assignmentId))
      .innerJoin(doctors, eq(doctors.id, assignmentPayments.doctorId))
      .leftJoin(hospitals, eq(hospitals.id, assignmentPayments.hospitalId))
      .leftJoin(patients, eq(patients.id, assignments.patientId))
      .leftJoin(patientProfiles, eq(patientProfiles.id, assignments.patientProfileId))
      .leftJoin(doctorAvailability, eq(doctorAvailability.id, assignments.availabilitySlotId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(assignmentPayments.createdAt))
      .limit(filter.limit)
      .offset((filter.page - 1) * filter.limit);
  }

  async doctorEarnings(doctorId: string) {
    const [completed, pending] = await Promise.all([
      this.db.select({ total: sql<number>`COALESCE(SUM(${assignmentPayments.doctorPayout}), 0)` }).from(assignmentPayments).where(and(eq(assignmentPayments.doctorId, doctorId), eq(assignmentPayments.paymentStatus, 'completed'))),
      this.db.select({ total: sql<number>`COALESCE(SUM(${assignmentPayments.doctorPayout}), 0)` }).from(assignmentPayments).where(and(eq(assignmentPayments.doctorId, doctorId), inArray(assignmentPayments.paymentStatus, ['pending', 'processing']))),
    ]);
    return { totalEarnings: Number(completed[0]?.total ?? 0), pendingEarnings: Number(pending[0]?.total ?? 0) };
  }

  async findSettlementById(id: string, tx?: any) {
    const client = tx || this.db;
    const [payment] = await client
      .select({
        id: assignmentPayments.id,
        paymentSource: assignmentPayments.paymentSource,
        patientPaymentStatus: assignmentPayments.patientPaymentStatus,
        paymentStatus: assignmentPayments.paymentStatus,
      })
      .from(assignmentPayments)
      .where(eq(assignmentPayments.id, id))
      .limit(1);
    return payment || null;
  }

  async markSettlementPaid(id: string, tx?: any) {
    const client = tx || this.db;
    return client
      .update(assignmentPayments)
      .set({ paymentStatus: 'completed', paidToDoctorAt: new Date().toISOString() })
      .where(and(eq(assignmentPayments.id, id), eq(assignmentPayments.paymentStatus, 'pending')))
      .returning({ id: assignmentPayments.id, paymentStatus: assignmentPayments.paymentStatus, paidToDoctorAt: assignmentPayments.paidToDoctorAt });
  }
}
