import { PatientPaymentsRepository } from '@/lib/repositories/patient-payments.repository';

export class PatientPaymentsService {
  private repository = new PatientPaymentsRepository();

  async getHomeVisitPayments(userId: string, page: number, limit: number) {
    const total = await this.repository.countHomeVisitPaymentsByUserId(userId);
    const totalPages = Math.ceil(total / limit);
    const resolvedPage = totalPages === 0 ? 1 : Math.min(page, totalPages);
    const payments = await this.repository.findHomeVisitPaymentsByUserId(
      userId,
      limit,
      (resolvedPage - 1) * limit
    );

    return {
      payments,
      pagination: {
        page: resolvedPage,
        limit,
        total,
        totalPages,
      },
    };
  }
}
