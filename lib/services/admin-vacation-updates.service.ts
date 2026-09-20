import { AdminVacationUpdatesRepository, type VacationUpdateQuery } from '@/lib/repositories/admin-vacation-updates.repository';

export class AdminVacationUpdatesService {
  constructor(private readonly repository = new AdminVacationUpdatesRepository()) {}
  async list(query: VacationUpdateQuery) {
    const result = await this.repository.list(query);
    return { data: result.rows.map((update: any) => { const start = new Date(update.startDate); const end = new Date(update.endDate); return { id: update.id, doctorId: update.doctorId, doctorName: `Dr. ${update.doctorFirstName || ''} ${update.doctorLastName || ''}`.trim() || 'Unknown', leaveType: update.leaveType, startDate: update.startDate, endDate: update.endDate, durationDays: Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1), reason: update.reason || null, createdAt: update.createdAt }; }), total: result.total };
  }
}
