import { AdminScheduleUpdatesRepository, type ScheduleUpdateQuery } from '@/lib/repositories/admin-schedule-updates.repository';

export class AdminScheduleUpdatesService {
  constructor(private readonly repository = new AdminScheduleUpdatesRepository()) {}
  async list(query: ScheduleUpdateQuery) {
    const result = await this.repository.list(query);
    return { data: result.rows.map((row: any) => ({ id: row.id, doctorId: row.doctorId, doctorName: `Dr. ${row.doctorFirstName || ''} ${row.doctorLastName || ''}`.trim() || 'Unknown', slotType: row.parentSlotId ? 'sub' : 'parent', slotDate: row.slotDate, startTime: row.startTime, endTime: row.endTime, status: row.status, isManual: row.isManual, templateId: row.templateId || null, parentSlotId: row.parentSlotId || null, hospitalId: row.bookedByHospitalId || null, hospitalName: row.hospitalName || null, assignmentId: row.assignmentId || null, updatedAt: row.updatedAt })), total: result.total };
  }
  async parentDetail(id: string) {
    const result = await this.repository.parentDetail(id);
    if (!result) return null;
    return { parentSlot: { id: result.parent.id, doctorId: result.parent.doctorId, doctorName: `Dr. ${result.parent.doctorFirstName || ''} ${result.parent.doctorLastName || ''}`.trim() || 'Unknown', slotDate: result.parent.slotDate, startTime: result.parent.startTime, endTime: result.parent.endTime, status: result.parent.status, isManual: result.parent.isManual, templateId: result.parent.templateId || null, updatedAt: result.parent.updatedAt }, subSlots: result.subSlots.map((slot: any) => ({ id: slot.id, slotDate: slot.slotDate, startTime: slot.startTime, endTime: slot.endTime, status: slot.status, hospitalId: slot.bookedByHospitalId || null, hospitalName: slot.hospitalName || null, assignmentId: slot.assignmentId || null, assignmentStatus: slot.assignmentStatus || null, bookedAt: slot.bookedAt || null, updatedAt: slot.updatedAt })), totalSubSlots: result.subSlots.length };
  }
}
