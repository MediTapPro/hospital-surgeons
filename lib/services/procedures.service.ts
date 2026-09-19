import { getDb } from '@/lib/db';
import {
  ProceduresRepository,
  CreateProcedureData,
  CreateCategoryData,
  CreateProcedureTypeData,
} from '@/lib/repositories/procedures.repository';
import {
  PROCEDURE_ERROR_CODES,
  PROCEDURE_REFERENCE_LABELS,
  CATEGORY_REFERENCE_LABELS,
} from '@/lib/enums/procedures.enums';
import { createAuditLog, buildChangesObject } from '@/lib/utils/audit-logger';

export interface ProcedureAuditContext {
  adminUserId: string;
  requestMetadata: {
    ipAddress?: string;
    userAgent?: string;
    endpoint?: string;
  };
}

const TRACKED_PROCEDURE_FIELDS = ['name', 'description', 'specialtyId', 'categoryId', 'isActive'];
const TRACKED_CATEGORY_FIELDS = ['name', 'description', 'specialtyId'];

export class ProceduresService {
  private repository = new ProceduresRepository();

  // --- Procedures ---

  async getProcedures(filters: { specialtyId?: string; categoryId?: string; search?: string } = {}) {
    try {
      const data = await this.repository.findProcedures(filters);
      return { success: true as const, data };
    } catch (error) {
      return {
        success: false as const,
        code: PROCEDURE_ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to fetch procedures',
        error,
      };
    }
  }

  async getProcedureById(id: string) {
    try {
      const data = await this.repository.findProcedureById(id);
      if (!data) {
        return { success: false as const, code: PROCEDURE_ERROR_CODES.NOT_FOUND, message: 'Procedure not found' };
      }
      return { success: true as const, data };
    } catch (error) {
      return {
        success: false as const,
        code: PROCEDURE_ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to fetch procedure',
        error,
      };
    }
  }

  async createProcedure(data: CreateProcedureData, audit?: ProcedureAuditContext) {
    try {
      return await getDb().transaction(async (tx: any) => {
        const repository = new ProceduresRepository(tx);

        const duplicate = await repository.findProcedureByNameInsensitive(data.name, data.specialtyId);
        if (duplicate) {
          return {
            success: false as const,
            code: PROCEDURE_ERROR_CODES.DUPLICATE_NAME,
            message: 'A procedure with this name already exists for this specialty',
          };
        }

        const created = await repository.createProcedure({
          ...data,
          name: data.name.trim(),
          description: data.description?.trim() || null,
        });

        if (!created) {
          throw new Error('Procedure insert did not return a row');
        }

        if (audit) {
          await createAuditLog({
            userId: audit.adminUserId,
            actorType: 'admin',
            action: 'create',
            entityType: 'procedure',
            entityId: created.id,
            entityName: created.name,
            httpMethod: 'POST',
            endpoint: '/api/admin/procedures',
            ...audit.requestMetadata,
            details: {
              specialtyId: created.specialtyId,
              categoryId: created.categoryId,
              typeIds: data.typeIds ?? [],
              createdAt: new Date().toISOString(),
            },
          }, tx);
        }

        return { success: true as const, message: 'Procedure created successfully', data: created };
      });
    } catch (error) {
      return this.buildMutationFailure(error, 'Failed to create procedure');
    }
  }

  async updateProcedure(id: string, data: Partial<CreateProcedureData>, audit?: ProcedureAuditContext) {
    try {
      return await getDb().transaction(async (tx: any) => {
        const repository = new ProceduresRepository(tx);

        const existing = await repository.findProcedureById(id);
        if (!existing) {
          return {
            success: false as const,
            code: PROCEDURE_ERROR_CODES.NOT_FOUND,
            message: 'Procedure not found',
          };
        }

        if (data.name !== undefined) {
          const specialtyId = data.specialtyId ?? existing.specialtyId;
          const duplicate = await repository.findProcedureByNameInsensitive(data.name, specialtyId, id);
          if (duplicate) {
            return {
              success: false as const,
              code: PROCEDURE_ERROR_CODES.DUPLICATE_NAME,
              message: 'A procedure with this name already exists for this specialty',
            };
          }
        }

        const updated = await repository.updateProcedure(id, data);
        if (!updated) {
          return {
            success: false as const,
            code: PROCEDURE_ERROR_CODES.NOT_FOUND,
            message: 'Procedure not found',
          };
        }

        if (audit) {
          await createAuditLog({
            userId: audit.adminUserId,
            actorType: 'admin',
            action: 'update',
            entityType: 'procedure',
            entityId: id,
            entityName: updated.name,
            httpMethod: 'PUT',
            endpoint: `/api/admin/procedures/${id}`,
            ...audit.requestMetadata,
            changes: buildChangesObject(existing, updated, TRACKED_PROCEDURE_FIELDS),
            details: {
              typeIds: data.typeIds,
              updatedAt: new Date().toISOString(),
            },
          }, tx);
        }

        return { success: true as const, message: 'Procedure updated successfully', data: updated };
      });
    } catch (error) {
      return this.buildMutationFailure(error, 'Failed to update procedure');
    }
  }

  async deleteProcedure(id: string, audit?: ProcedureAuditContext) {
    try {
      return await getDb().transaction(async (tx: any) => {
        const repository = new ProceduresRepository(tx);

        const existing = await repository.findProcedureById(id);
        if (!existing) {
          return {
            success: false as const,
            code: PROCEDURE_ERROR_CODES.NOT_FOUND,
            message: 'Procedure not found',
          };
        }

        const references = await repository.countProcedureReferences(id);
        if (Object.values(references).some((referenceCount) => referenceCount > 0)) {
          return {
            success: false as const,
            code: PROCEDURE_ERROR_CODES.PROCEDURE_IN_USE,
            message: `Cannot delete procedure. It is referenced by ${this.describeReferences(references, PROCEDURE_REFERENCE_LABELS)}.`,
            data: references,
          };
        }

        const deleted = await repository.deleteProcedure(id);
        if (!deleted) {
          return {
            success: false as const,
            code: PROCEDURE_ERROR_CODES.NOT_FOUND,
            message: 'Procedure not found',
          };
        }

        if (audit) {
          await createAuditLog({
            userId: audit.adminUserId,
            actorType: 'admin',
            action: 'delete',
            entityType: 'procedure',
            entityId: id,
            entityName: deleted.name,
            httpMethod: 'DELETE',
            endpoint: `/api/admin/procedures/${id}`,
            ...audit.requestMetadata,
            details: {
              specialtyId: deleted.specialtyId,
              categoryId: deleted.categoryId,
              references,
              deletedAt: new Date().toISOString(),
            },
          }, tx);
        }

        return { success: true as const, message: 'Procedure deleted successfully' };
      });
    } catch (error) {
      return this.buildMutationFailure(error, 'Failed to delete procedure');
    }
  }

  // --- Categories ---

  async getCategories(specialtyId?: string, search?: string) {
    try {
      const data = await this.repository.findCategories(specialtyId, search);
      return { success: true as const, data };
    } catch (error) {
      return {
        success: false as const,
        code: PROCEDURE_ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to fetch categories',
        error,
      };
    }
  }

  async createCategory(data: CreateCategoryData, audit?: ProcedureAuditContext) {
    try {
      return await getDb().transaction(async (tx: any) => {
        const repository = new ProceduresRepository(tx);

        const duplicate = await repository.findCategoryByNameInsensitive(data.name, data.specialtyId);
        if (duplicate) {
          return {
            success: false as const,
            code: PROCEDURE_ERROR_CODES.DUPLICATE_NAME,
            message: 'A category with this name already exists for this specialty',
          };
        }

        const created = await repository.createCategory({
          ...data,
          name: data.name.trim(),
          description: data.description?.trim() || null,
        });

        if (!created) {
          throw new Error('Category insert did not return a row');
        }

        if (audit) {
          await createAuditLog({
            userId: audit.adminUserId,
            actorType: 'admin',
            action: 'create',
            entityType: 'procedure_category',
            entityId: created.id,
            entityName: created.name,
            httpMethod: 'POST',
            endpoint: '/api/admin/procedures/categories',
            ...audit.requestMetadata,
            details: {
              specialtyId: created.specialtyId,
              createdAt: new Date().toISOString(),
            },
          }, tx);
        }

        return { success: true as const, message: 'Category created successfully', data: created };
      });
    } catch (error) {
      return this.buildMutationFailure(error, 'Failed to create category');
    }
  }

  async updateCategory(id: string, data: Partial<CreateCategoryData>, audit?: ProcedureAuditContext) {
    try {
      return await getDb().transaction(async (tx: any) => {
        const repository = new ProceduresRepository(tx);

        const existing = await repository.findCategoryById(id);
        if (!existing) {
          return {
            success: false as const,
            code: PROCEDURE_ERROR_CODES.NOT_FOUND,
            message: 'Category not found',
          };
        }

        if (data.name !== undefined) {
          const specialtyId = data.specialtyId ?? existing.specialtyId;
          const duplicate = await repository.findCategoryByNameInsensitive(data.name, specialtyId, id);
          if (duplicate) {
            return {
              success: false as const,
              code: PROCEDURE_ERROR_CODES.DUPLICATE_NAME,
              message: 'A category with this name already exists for this specialty',
            };
          }
        }

        const updated = await repository.updateCategory(id, data);
        if (!updated) {
          return {
            success: false as const,
            code: PROCEDURE_ERROR_CODES.NOT_FOUND,
            message: 'Category not found',
          };
        }

        if (audit) {
          await createAuditLog({
            userId: audit.adminUserId,
            actorType: 'admin',
            action: 'update',
            entityType: 'procedure_category',
            entityId: id,
            entityName: updated.name,
            httpMethod: 'PUT',
            endpoint: `/api/admin/procedures/categories/${id}`,
            ...audit.requestMetadata,
            changes: buildChangesObject(existing, updated, TRACKED_CATEGORY_FIELDS),
            details: {
              updatedAt: new Date().toISOString(),
            },
          }, tx);
        }

        return { success: true as const, message: 'Category updated successfully', data: updated };
      });
    } catch (error) {
      return this.buildMutationFailure(error, 'Failed to update category');
    }
  }

  async deleteCategory(id: string, audit?: ProcedureAuditContext) {
    try {
      return await getDb().transaction(async (tx: any) => {
        const repository = new ProceduresRepository(tx);

        const existing = await repository.findCategoryById(id);
        if (!existing) {
          return {
            success: false as const,
            code: PROCEDURE_ERROR_CODES.NOT_FOUND,
            message: 'Category not found',
          };
        }

        const references = await repository.countCategoryReferences(id);
        if (Object.values(references).some((referenceCount) => referenceCount > 0)) {
          return {
            success: false as const,
            code: PROCEDURE_ERROR_CODES.CATEGORY_IN_USE,
            message: `Cannot delete category. It is referenced by ${this.describeReferences(references, CATEGORY_REFERENCE_LABELS)}.`,
            data: references,
          };
        }

        const deleted = await repository.deleteCategory(id);
        if (!deleted) {
          return {
            success: false as const,
            code: PROCEDURE_ERROR_CODES.NOT_FOUND,
            message: 'Category not found',
          };
        }

        if (audit) {
          await createAuditLog({
            userId: audit.adminUserId,
            actorType: 'admin',
            action: 'delete',
            entityType: 'procedure_category',
            entityId: id,
            entityName: deleted.name,
            httpMethod: 'DELETE',
            endpoint: `/api/admin/procedures/categories/${id}`,
            ...audit.requestMetadata,
            details: {
              specialtyId: deleted.specialtyId,
              references,
              deletedAt: new Date().toISOString(),
            },
          }, tx);
        }

        return { success: true as const, message: 'Category deleted successfully' };
      });
    } catch (error) {
      return this.buildMutationFailure(error, 'Failed to delete category');
    }
  }

  // --- Procedure Types ---

  async getProcedureTypes(procedureId?: string) {
    try {
      const data = await this.repository.findProcedureTypes(procedureId);
      return { success: true as const, data };
    } catch (error) {
      return {
        success: false as const,
        code: PROCEDURE_ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to fetch procedure types',
        error,
      };
    }
  }

  async createProcedureType(data: CreateProcedureTypeData) {
    try {
      const result = await this.repository.createProcedureType(data);
      return { success: true, message: 'Procedure type created successfully', data: result };
    } catch (error) {
      return this.buildMutationFailure(error, 'Failed to create procedure type');
    }
  }

  async updateProcedureType(id: string, data: Partial<CreateProcedureTypeData>) {
    try {
      const result = await this.repository.updateProcedureType(id, data);
      return { success: true, message: 'Procedure type updated successfully', data: result };
    } catch (error) {
      return this.buildMutationFailure(error, 'Failed to update procedure type');
    }
  }

  async deleteProcedureType(id: string) {
    try {
      await this.repository.deleteProcedureType(id);
      return { success: true, message: 'Procedure type deleted successfully' };
    } catch (error) {
      return this.buildMutationFailure(error, 'Failed to delete procedure type');
    }
  }

  private describeReferences(
    references: Record<string, number>,
    labels: Record<string, string>
  ): string {
    return Object.keys(labels)
      .filter((key) => (references[key] ?? 0) > 0)
      .map((key) => `${references[key]} ${labels[key]}`)
      .join(' and ');
  }

  private buildMutationFailure(error: unknown, fallbackMessage: string) {
    if (this.isUniqueViolation(error)) {
      return {
        success: false as const,
        code: PROCEDURE_ERROR_CODES.DUPLICATE_NAME,
        message: 'A record with this name already exists',
      };
    }

    return {
      success: false as const,
      code: PROCEDURE_ERROR_CODES.UPDATE_FAILED,
      message: fallbackMessage,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: string }).code === '23505'
    );
  }
}
