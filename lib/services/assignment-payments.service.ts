import { AssignmentPaymentsRepository } from '@/lib/repositories/assignment-payments.repository';
import {
  ASSIGNMENT_PAYMENT_SOURCES,
  ASSIGNMENT_SETTLEMENT_STATUSES,
  type AssignmentPaymentSource,
  type AssignmentSettlementStatus,
} from '@/lib/enums/assignment-payments.enums';
import {
  ASSIGNMENT_PAYMENTS_DEFAULT_LIMIT,
  ASSIGNMENT_PAYMENTS_MAX_LIMIT,
} from '@/lib/utils/constants';

export class AssignmentPaymentsService {
  constructor(private readonly repository = new AssignmentPaymentsRepository()) {}

  private normalizeFilter(input: { page?: string | null; limit?: string | null; source?: string | null; status?: string | null; doctorId?: string }) {
    const pageValue = Number(input.page ?? '1');
    const limitValue = Number(input.limit ?? ASSIGNMENT_PAYMENTS_DEFAULT_LIMIT);
    return {
      doctorId: input.doctorId,
      page: Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1,
      limit: Number.isInteger(limitValue) && limitValue > 0 ? Math.min(limitValue, ASSIGNMENT_PAYMENTS_MAX_LIMIT) : ASSIGNMENT_PAYMENTS_DEFAULT_LIMIT,
      source: ASSIGNMENT_PAYMENT_SOURCES.includes(input.source as AssignmentPaymentSource) ? input.source as AssignmentPaymentSource : undefined,
      status: ASSIGNMENT_SETTLEMENT_STATUSES.includes(input.status as AssignmentSettlementStatus) ? input.status as AssignmentSettlementStatus : undefined,
    };
  }

  async list(input: { page?: string | null; limit?: string | null; source?: string | null; status?: string | null; doctorId?: string }) {
    const filter = this.normalizeFilter(input);
    const total = await this.repository.count(filter);
    const totalPages = Math.ceil(total / filter.limit);
    const page = totalPages === 0 ? 1 : Math.min(filter.page, totalPages);
    const payments = await this.repository.list({ ...filter, page });
    return {
      payments: payments.map((payment: any) => ({
        ...payment,
        consultationFee: Number(payment.consultationFee),
        platformCommission: Number(payment.platformCommission),
        doctorPayout: Number(payment.doctorPayout),
        doctor: `Dr. ${payment.doctorFirstName} ${payment.doctorLastName}`,
        patient: payment.patientName || payment.patientProfileName || 'Patient',
      })),
      pagination: { page, limit: filter.limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
    };
  }

  async listForDoctor(doctorId: string, input: { page?: string | null; limit?: string | null; source?: string | null; status?: string | null }) {
    const [result, earnings] = await Promise.all([this.list({ ...input, doctorId }), this.repository.doctorEarnings(doctorId)]);
    return { ...result, ...earnings };
  }
}
