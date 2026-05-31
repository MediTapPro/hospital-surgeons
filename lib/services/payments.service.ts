import { PaymentsRepository, CreatePaymentData, PaymentQuery } from '@/lib/repositories/payments.repository';

export class PaymentsService {
  private repo = new PaymentsRepository();

  async create(dto: CreatePaymentData) {
    try {
      const payment = await this.repo.create(dto);
      return {
        success: true,
        message: 'Payment created successfully',
        data: payment,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create payment',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async list(query: PaymentQuery) {
    try {
      const result = await this.repo.list(query);
      return {
        success: true,
        message: 'Payments retrieved successfully',
        data: result.data,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve payments',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async get(id: string) {
    try {
      const data = await this.repo.get(id);
      if (!data) {
        return {
          success: false,
          message: 'Payment not found',
        };
      }
      return {
        success: true,
        message: 'Payment retrieved successfully',
        data,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve payment',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async update(id: string, dto: Partial<CreatePaymentData>) {
    try {
      const existing = await this.repo.get(id);
      if (!existing) {
        return {
          success: false,
          message: 'Payment not found',
        };
      }
      const payment = await this.repo.update(id, dto);
      return {
        success: true,
        message: 'Payment updated successfully',
        data: payment,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update payment',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async remove(id: string) {
    try {
      const existing = await this.repo.get(id);
      if (!existing) {
        return {
          success: false,
          message: 'Payment not found',
        };
      }
      await this.repo.remove(id);
      return {
        success: true,
        message: 'Payment deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete payment',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}









































