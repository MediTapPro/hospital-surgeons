import { PlatformFeesRepository } from '@/lib/repositories/platform-fees.repository';
import { getDb } from '@/lib/db';
import { buildChangesObject, createAuditLog, type AuditLogData } from '@/lib/utils/audit-logger';

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
  }, actor: { userId: string; requestMetadata?: Pick<AuditLogData, 'ipAddress' | 'userAgent' | 'endpoint'> }) {
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

      const feeString = data.fee.toFixed(2);
      const commissionString = data.platformCommissionPercentage.toFixed(2);
      const db = getDb();
      return await db.transaction(async (tx) => {
        const repository = new PlatformFeesRepository(tx);
        const existing = await repository.findBySpecialtyId(data.specialtyId, tx);
        const saved = existing
          ? await repository.update(existing.id, { fee: feeString, platformCommissionPercentage: commissionString }, tx)
          : await repository.create({ specialtyId: data.specialtyId, fee: feeString, platformCommissionPercentage: commissionString }, tx);
        if (!saved) throw new Error('Failed to save platform fee configuration');
        await createAuditLog({
          userId: actor.userId,
          actorType: 'admin',
          action: existing ? 'update' : 'create',
          entityType: 'platform_home_visit_fee',
          entityId: saved.id,
          details: { specialtyId: data.specialtyId },
          changes: existing ? buildChangesObject(existing, saved, ['fee', 'platformCommissionPercentage']) : undefined,
          ...actor.requestMetadata,
        }, tx, { throwOnError: true });
        return { success: true, message: existing ? 'Platform fee configuration updated successfully' : 'Platform fee configuration created successfully', data: saved };
      });
    } catch (error) {
      return {
        success: false,
        message: 'Failed to save platform fee configuration',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async deletePlatformFee(id: string, actor: { userId: string; requestMetadata?: Pick<AuditLogData, 'ipAddress' | 'userAgent' | 'endpoint'> }) {
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

      const db = getDb();
      return await db.transaction(async (tx) => {
        const repository = new PlatformFeesRepository(tx);
        const deleted = await repository.delete(id, tx);
        await createAuditLog({
          userId: actor.userId,
          actorType: 'admin',
          action: 'delete',
          entityType: 'platform_home_visit_fee',
          entityId: id,
          details: { specialtyId: feeConfig.specialtyId, fee: feeConfig.fee, platformCommissionPercentage: feeConfig.platformCommissionPercentage },
          ...actor.requestMetadata,
        }, tx, { throwOnError: true });
        return { success: true, message: 'Platform fee configuration deleted successfully', data: deleted };
      });
    } catch (error) {
      return {
        success: false,
        message: 'Failed to delete platform fee configuration',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
