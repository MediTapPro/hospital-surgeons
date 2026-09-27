import { getDb } from '@/lib/db';
import { AdminAssignmentsRepository, type AdminAssignmentQuery } from '@/lib/repositories/admin-assignments.repository';
import { buildChangesObject, createAuditLog, type AuditLogData } from '@/lib/utils/audit-logger';

const formatAssignment = (a: any) => ({
  id: a.id,
  source: a.display_source || (a.source === 'patient' ? 'home_visit' : 'hospital_assignment'),
  hospital: a.hospital_id ? { id: a.hospital_id, name: a.hospital_name || 'Unknown' } : null,
  doctor: { id: a.doctor_id, name: `Dr. ${a.doctor_first_name || ''} ${a.doctor_last_name || ''}`.trim() || 'Unknown' },
  patient: { id: a.patient_id || a.patient_profile_id, name: a.patient_name || 'Unknown' },
  visit: a.display_source === 'home_visit' ? {
    addressLabel: a.visit_address_label,
    address: a.visit_address,
    recipientPhone: a.recipient_phone,
    relationship: a.recipient_relationship,
  } : null,
  priority: a.priority,
  status: a.status,
  requestedAt: a.requested_at,
  expiresAt: a.expires_at,
  actualStartTime: a.actual_start_time,
  actualEndTime: a.actual_end_time,
  treatmentNotes: a.treatment_notes,
  consultationFee: a.consultation_fee ? Number(a.consultation_fee) : null,
  cancellationReason: a.cancellation_reason,
  cancelledBy: a.cancelled_by,
  cancelledAt: a.cancelled_at,
  completedAt: a.completed_at,
  paidAt: a.paid_at,
});

export class AdminAssignmentsService {
  private readonly repo = new AdminAssignmentsRepository();

  async list(query: AdminAssignmentQuery) {
    const result = await this.repo.list(query);
    return { data: result.rows.map(formatAssignment), total: result.total };
  }

  async get(id: string) {
    const result = await this.repo.findById(id);
    if (!result) return null;
    const assignment = formatAssignment(result.row);
    return {
      ...assignment,
      hospital: result.row.hospital_id ? { ...assignment.hospital, email: result.row.hospital_email, phone: result.row.hospital_phone } : null,
      doctor: { ...assignment.doctor, email: result.row.doctor_email, phone: result.row.doctor_phone },
      patient: { ...assignment.patient, dateOfBirth: result.row.patient_dob, gender: result.row.patient_gender, phone: result.row.patient_phone, medicalCondition: result.row.patient_condition },
      rating: result.rating ? { rating: result.rating.rating, comment: result.rating.reviewText } : null,
      payment: result.payment ? { consultationFee: Number(result.payment.consultationFee), platformCommission: Number(result.payment.platformCommission), doctorPayout: Number(result.payment.doctorPayout), paymentStatus: result.payment.paymentStatus, paidToDoctorAt: result.payment.paidToDoctorAt } : null,
      history: result.history.map((log) => ({ id: log.id, action: log.action, details: log.details, createdAt: log.created_at })),
    };
  }

  async update(id: string, data: Record<string, unknown>, audit: Omit<AuditLogData, 'entityId' | 'details' | 'changes' | 'previousStatus' | 'newStatus'> & { details?: Record<string, any> }) {
    const db = getDb();
    return db.transaction(async (tx) => {
      const result = await this.repo.update(id, data, tx as any);
      if (!result) return null;
      const { oldAssignment, updatedAssignment } = result;
      await createAuditLog({
        ...audit,
        entityId: id,
        entityName: `Assignment ${id}`,
        changes: buildChangesObject(oldAssignment, updatedAssignment, ['status', 'treatmentNotes', 'cancellationReason']),
        previousStatus: oldAssignment.status,
        newStatus: updatedAssignment.status,
        details: { ...(audit.details || {}), doctorId: oldAssignment.doctorId, hospitalId: oldAssignment.hospitalId, patientId: oldAssignment.patientId },
      }, tx as any, { throwOnError: true });
      return updatedAssignment;
    });
  }

  async stats() {
    const result = await this.repo.stats();
    return {
      byStatus: result.byStatus.map((row) => ({ status: row.status, count: Number(row.count || 0) })),
      byPriority: result.byPriority.map((row) => ({ priority: row.priority, count: Number(row.count || 0) })),
      today: { total: Number(result.today.total || 0), pending: Number(result.today.pending || 0), accepted: Number(result.today.accepted || 0), completed: Number(result.today.completed || 0), cancelled: Number(result.today.cancelled || 0) },
    };
  }
}
