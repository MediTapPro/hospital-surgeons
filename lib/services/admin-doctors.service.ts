import { AdminDoctorsRepository } from '@/lib/repositories/admin-doctors.repository';

export class AdminDoctorsService {
  constructor(private readonly repository = new AdminDoctorsRepository()) {}
  async list() {
    const doctors = await this.repository.list();
    return doctors.map((doctor: any) => ({ id: doctor.id, name: `Dr. ${doctor.firstName || ''} ${doctor.lastName || ''}`.trim() || 'Unknown' }));
  }
}
