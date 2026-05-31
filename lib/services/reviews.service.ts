import { ReviewsRepository, CreateReviewData, ReviewQuery } from '@/lib/repositories/reviews.repository';

export class ReviewsService {
  private repo = new ReviewsRepository();

  async create(dto: CreateReviewData) {
    try {
      if (dto.rating < 1 || dto.rating > 5) {
        return {
          success: false,
          message: 'Rating must be between 1 and 5',
        };
      }

      const review = await this.repo.create(dto);
      return {
        success: true,
        message: 'Review created successfully',
        data: review,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create review',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async list(query: ReviewQuery) {
    try {
      const result = await this.repo.list(query);
      return {
        success: true,
        message: 'Reviews retrieved successfully',
        data: result.data,
        pagination: {
          page: result.page,
          limit: result.limit,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve reviews',
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
          message: 'Review not found',
        };
      }
      return {
        success: true,
        message: 'Review retrieved successfully',
        data,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve review',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async update(id: string, dto: Partial<CreateReviewData>) {
    try {
      const existing = await this.repo.get(id);
      if (!existing) {
        return {
          success: false,
          message: 'Review not found',
        };
      }
      const review = await this.repo.update(id, dto);
      return {
        success: true,
        message: 'Review updated successfully',
        data: review,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update review',
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
          message: 'Review not found',
        };
      }
      await this.repo.remove(id);
      return {
        success: true,
        message: 'Review deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete review',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}







































