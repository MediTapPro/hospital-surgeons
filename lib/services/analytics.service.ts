import { AnalyticsRepository, CreateAnalyticsEventData, AnalyticsEventQuery } from '@/lib/repositories/analytics.repository';

export class AnalyticsService {
  private repo = new AnalyticsRepository();

  async create(dto: CreateAnalyticsEventData) {
    try {
      const event = await this.repo.create(dto);
      return {
        success: true,
        message: 'Analytics event created successfully',
        data: event,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create analytics event',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async list(query: AnalyticsEventQuery) {
    try {
      const result = await this.repo.list(query);
      return {
        success: true,
        message: 'Analytics events retrieved successfully',
        data: result.data,
        pagination: {
          page: result.page,
          limit: result.limit,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve analytics events',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}









































