import { PlatformFeesRepository } from '@/lib/repositories/platform-fees.repository';

export class PlatformFeesService {
  private repo = new PlatformFeesRepository();

  async getPlatformFees() {
    try {
      const fees = await this.repo.listAll();
      return {
        success: true,
        message: 'Platform fees retrieved successfully',
        data: fees,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve platform fees',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getPlatformFeeById(id: string) {
    try {
      const feeConfig = await this.repo.findById(id);
      if (!feeConfig) {
        return {
          success: false,
          message: 'Platform fee configuration not found',
        };
      }
      return {
        success: true,
        message: 'Platform fee configuration retrieved successfully',
        data: feeConfig,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve platform fee configuration',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getPlatformFeeForSpecialty(specialtyId: string | null) {
    try {
      const feeConfig = await this.repo.findBySpecialtyId(specialtyId);
      if (!feeConfig) {
        // Fallback: If specialty fee is not defined, get the default platform fee (where specialtyId IS NULL)
        const defaultFee = await this.repo.findBySpecialtyId(null);
        if (!defaultFee) {
          return {
            success: false,
            message: 'No fee configuration found (neither specialty-specific nor platform-default)',
          };
        }
        return {
          success: true,
          message: 'Default platform fee retrieved as fallback',
          data: defaultFee,
          isFallback: true,
        };
      }
      return {
        success: true,
        message: 'Specialty fee configuration retrieved successfully',
        data: feeConfig,
        isFallback: false,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve fee configuration',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async upsertPlatformFee(data: {
    specialtyId: string | null;
    fee: number;
    platformCommissionPercentage: number;
  }) {
    try {
      // Validate data
      if (data.fee < 0) {
        return {
          success: false,
          message: 'Consultation fee cannot be negative',
        };
      }
      if (data.platformCommissionPercentage < 0 || data.platformCommissionPercentage > 100) {
        return {
          success: false,
          message: 'Platform commission percentage must be between 0 and 100',
        };
      }

      // Check if a configuration for this specialty (or default) already exists
      const existing = await this.repo.findBySpecialtyId(data.specialtyId);

      const feeString = data.fee.toFixed(2);
      const commissionString = data.platformCommissionPercentage.toFixed(2);

      if (existing) {
        // Update existing record
        const updated = await this.repo.update(existing.id, {
          fee: feeString,
          platformCommissionPercentage: commissionString,
        });
        return {
          success: true,
          message: 'Platform fee configuration updated successfully',
          data: updated,
        };
      } else {
        // Create new record
        const created = await this.repo.create({
          specialtyId: data.specialtyId,
          fee: feeString,
          platformCommissionPercentage: commissionString,
        });
        return {
          success: true,
          message: 'Platform fee configuration created successfully',
          data: created,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: 'Failed to save platform fee configuration',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async deletePlatformFee(id: string) {
    try {
      const feeConfig = await this.repo.findById(id);
      if (!feeConfig) {
        return {
          success: false,
          message: 'Platform fee configuration not found',
        };
      }

      // Prevent deleting the default fee configuration unless there are others, or just allow it with warning
      // Standard practice: default fee can be updated, but deleting it should be guarded if possible
      if (feeConfig.specialtyId === null) {
        return {
          success: false,
          message: 'Cannot delete the platform-wide default fee configuration. You can only edit it.',
        };
      }

      await this.repo.delete(id);
      return {
        success: true,
        message: 'Platform fee configuration deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to delete platform fee configuration',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
