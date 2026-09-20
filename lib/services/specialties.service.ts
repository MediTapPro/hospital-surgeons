import { getDb } from '@/lib/db';
import {
  SpecialtiesRepository,
  CreateSpecialtyData,
  SpecialtyQuery,
  ListSpecialtiesForAdminInput,
} from '@/lib/repositories/specialties.repository';
import {
  SPECIALTY_ERROR_CODES,
  SPECIALTY_REFERENCE_LABELS,
  type SpecialtyReferenceCounts,
  type SpecialtyReferenceKey,
} from '@/lib/enums/specialties.enums';
import { createAuditLog, buildChangesObject } from '@/lib/utils/audit-logger';

export interface SpecialtyAuditContext {
  adminUserId: string;
  requestMetadata: {
    ipAddress?: string;
    userAgent?: string;
    endpoint?: string;
  };
}

export class SpecialtiesService {
  private specialtiesRepository = new SpecialtiesRepository();

  async listForAdmin(input: ListSpecialtiesForAdminInput) {
    const { rows, total } = await this.specialtiesRepository.listForAdmin(input);

    return {
      data: rows.map((specialty: any) => ({
        ...specialty,
        activeDoctors: Number(specialty.activeDoctors),
        activeHospitals: Number(specialty.activeHospitals),
      })),
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      },
    };
  }

  async getSpecialtyForAdmin(id: string) {
    const specialty = await this.specialtiesRepository.findSpecialtyById(id);

    if (!specialty) {
      return {
        success: false as const,
        code: SPECIALTY_ERROR_CODES.NOT_FOUND,
        message: 'Specialty not found',
      };
    }

    const counts = await this.specialtiesRepository.countReferences(id);

    return {
      success: true as const,
      message: 'Specialty retrieved successfully',
      data: {
        id: specialty.id,
        name: specialty.name,
        description: specialty.description,
        activeDoctors: counts.doctors,
        activeHospitals: counts.hospitals,
      },
    };
  }

  async createSpecialtyForAdmin(createSpecialtyDto: CreateSpecialtyData, audit?: SpecialtyAuditContext) {
    try {
      return await getDb().transaction(async (tx: any) => {
        const repository = new SpecialtiesRepository(tx);

        const existingSpecialty = await repository.findSpecialtyByNameInsensitive(createSpecialtyDto.name);
        if (existingSpecialty) {
          return {
            success: false as const,
            code: SPECIALTY_ERROR_CODES.DUPLICATE_NAME,
            message: 'Specialty with this name already exists',
          };
        }

        const [createdSpecialty] = await repository.createSpecialty({
          name: createSpecialtyDto.name.trim(),
          description: createSpecialtyDto.description?.trim() || null,
        });

        if (audit) {
          await createAuditLog({
            userId: audit.adminUserId,
            actorType: 'admin',
            action: 'create',
            entityType: 'specialty',
            entityId: createdSpecialty.id,
            entityName: createdSpecialty.name,
            httpMethod: 'POST',
            endpoint: '/api/admin/specialties',
            ...audit.requestMetadata,
            details: {
              description: createdSpecialty.description,
              createdAt: new Date().toISOString(),
            },
          }, tx);
        }

        return {
          success: true as const,
          message: 'Specialty created successfully',
          data: {
            id: createdSpecialty.id,
            name: createdSpecialty.name,
            description: createdSpecialty.description,
          },
        };
      });
    } catch (error) {
      return this.buildMutationFailure(error, 'Failed to create specialty');
    }
  }

  async updateSpecialtyForAdmin(
    id: string,
    updateSpecialtyDto: Partial<CreateSpecialtyData>,
    audit?: SpecialtyAuditContext
  ) {
    try {
      return await getDb().transaction(async (tx: any) => {
        const repository = new SpecialtiesRepository(tx);

        const existingSpecialty = await repository.findSpecialtyById(id);
        if (!existingSpecialty) {
          return {
            success: false as const,
            code: SPECIALTY_ERROR_CODES.NOT_FOUND,
            message: 'Specialty not found',
          };
        }

        if (updateSpecialtyDto.name !== undefined) {
          const duplicate = await repository.findSpecialtyByNameInsensitive(updateSpecialtyDto.name, id);
          if (duplicate) {
            return {
              success: false as const,
              code: SPECIALTY_ERROR_CODES.DUPLICATE_NAME,
              message: 'Specialty with this name already exists',
            };
          }
        }

        const updateData: Partial<CreateSpecialtyData> = {};
        if (updateSpecialtyDto.name !== undefined) updateData.name = updateSpecialtyDto.name.trim();
        if (updateSpecialtyDto.description !== undefined) {
          updateData.description = updateSpecialtyDto.description?.trim() || null;
        }

        const [updatedSpecialty] = await repository.updateSpecialty(id, updateData);

        if (audit) {
          await createAuditLog({
            userId: audit.adminUserId,
            actorType: 'admin',
            action: 'update',
            entityType: 'specialty',
            entityId: id,
            entityName: updatedSpecialty.name,
            httpMethod: 'PUT',
            endpoint: `/api/admin/specialties/${id}`,
            ...audit.requestMetadata,
            changes: buildChangesObject(
              { name: existingSpecialty.name, description: existingSpecialty.description },
              { name: updatedSpecialty.name, description: updatedSpecialty.description },
              ['name', 'description']
            ),
            details: {
              updatedAt: new Date().toISOString(),
            },
          }, tx);
        }

        return {
          success: true as const,
          message: 'Specialty updated successfully',
          data: {
            id: updatedSpecialty.id,
            name: updatedSpecialty.name,
            description: updatedSpecialty.description,
          },
        };
      });
    } catch (error) {
      return this.buildMutationFailure(error, 'Failed to update specialty');
    }
  }

  async deleteSpecialtyForAdmin(id: string, audit?: SpecialtyAuditContext) {
    try {
      return await getDb().transaction(async (tx: any) => {
        const repository = new SpecialtiesRepository(tx);

        const existingSpecialty = await repository.findSpecialtyById(id);
        if (!existingSpecialty) {
          return {
            success: false as const,
            code: SPECIALTY_ERROR_CODES.NOT_FOUND,
            message: 'Specialty not found',
          };
        }

        const references = await repository.countReferences(id);
        const inUse = (Object.keys(references) as SpecialtyReferenceKey[]).some(
          (key) => references[key] > 0
        );

        if (inUse) {
          return {
            success: false as const,
            code: SPECIALTY_ERROR_CODES.SPECIALTY_IN_USE,
            message: `Cannot delete specialty. It is referenced by ${this.describeReferences(references)}.`,
            data: references,
          };
        }

        await repository.deleteSpecialty(id);

        if (audit) {
          await createAuditLog({
            userId: audit.adminUserId,
            actorType: 'admin',
            action: 'delete',
            entityType: 'specialty',
            entityId: id,
            entityName: existingSpecialty.name,
            httpMethod: 'DELETE',
            endpoint: `/api/admin/specialties/${id}`,
            ...audit.requestMetadata,
            details: {
              description: existingSpecialty.description,
              references,
              deletedAt: new Date().toISOString(),
            },
          }, tx);
        }

        return {
          success: true as const,
          message: 'Specialty deleted successfully',
        };
      });
    } catch (error) {
      return this.buildMutationFailure(error, 'Failed to delete specialty');
    }
  }

  async findSpecialties(query: SpecialtyQuery) {
    try {
      const specialties = await this.specialtiesRepository.findSpecialties(query);
      
      return {
        success: true,
        message: 'Specialties retrieved successfully',
        data: specialties,
        pagination: {
          page: query.page || 1,
          limit: query.limit || 10,
          total: specialties.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve specialties',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async findSpecialtyById(id: string) {
    try {
      const specialty = await this.specialtiesRepository.findSpecialtyById(id);
      
      if (!specialty) {
        return {
          success: false,
          message: 'Specialty not found',
        };
      }

      return {
        success: true,
        message: 'Specialty retrieved successfully',
        data: specialty,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve specialty',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async findSpecialtyByName(name: string) {
    try {
      const specialty = await this.specialtiesRepository.findSpecialtyByName(name);
      
      if (!specialty) {
        return {
          success: false,
          message: 'Specialty not found',
        };
      }

      return {
        success: true,
        message: 'Specialty retrieved successfully',
        data: specialty,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve specialty',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getActiveSpecialties() {
    try {
      const specialties = await this.specialtiesRepository.getActiveSpecialties();

      return {
        success: true,
        message: 'Active specialties retrieved successfully',
        data: specialties,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve active specialties',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async createSpecialty(createSpecialtyDto: CreateSpecialtyData) {
    return this.createSpecialtyForAdmin(createSpecialtyDto);
  }

  async updateSpecialty(id: string, updateSpecialtyDto: Partial<CreateSpecialtyData>) {
    return this.updateSpecialtyForAdmin(id, updateSpecialtyDto);
  }

  async deleteSpecialty(id: string) {
    return this.deleteSpecialtyForAdmin(id);
  }

  async toggleSpecialtyStatus(id: string) {
    try {
      const specialty = await this.specialtiesRepository.findSpecialtyById(id);
      if (!specialty) {
        return {
          success: false,
          message: 'Specialty not found',
        };
      }

      // toggleSpecialtyStatus doesn't exist - specialties table doesn't have isActive field
      return {
        success: false,
        message: 'Specialty status toggle is not supported. The specialties table does not have an isActive field.',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to toggle specialty status',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getSpecialtyStats(id: string) {
    try {
      const stats = await this.specialtiesRepository.getSpecialtyStats(id);
      
      if (!stats) {
        return {
          success: false,
          message: 'Specialty not found',
        };
      }

      return {
        success: true,
        message: 'Specialty statistics retrieved successfully',
        data: stats,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve specialty statistics',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getAllSpecialtiesStats() {
    try {
      const stats = await this.specialtiesRepository.getAllSpecialtiesStats();

      return {
        success: true,
        message: 'All specialties statistics retrieved successfully',
        data: stats,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve specialties statistics',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async createBulkSpecialties(specialtiesData: CreateSpecialtyData[]) {
    try {
      return await getDb().transaction(async (tx: any) => {
        const repository = new SpecialtiesRepository(tx);

        const names = specialtiesData.map(s => s.name);
        const uniqueNames = new Set(names);
        if (names.length !== uniqueNames.size) {
          return {
            success: false as const,
            message: 'Duplicate specialty names found in the input data',
          };
        }

        for (const specialtyData of specialtiesData) {
          const existing = await repository.findSpecialtyByName(specialtyData.name);
          if (existing) {
            return {
              success: false as const,
              message: `Specialty with name '${specialtyData.name}' already exists`,
            };
          }
        }

        const specialties = await repository.createBulkSpecialties(specialtiesData);

        return {
          success: true as const,
          message: `${specialties.length} specialties created successfully`,
          data: specialties,
        };
      });
    } catch (error) {
      return {
        success: false,
        message: 'Failed to create specialties',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getSpecialtyUsageInfo(id: string) {
    try {
      const specialty = await this.specialtiesRepository.findSpecialtyById(id);
      if (!specialty) {
        return {
          success: false,
          message: 'Specialty not found',
        };
      }

      const usageInfo = await this.specialtiesRepository.isSpecialtyInUse(id);

      return {
        success: true,
        message: 'Specialty usage information retrieved successfully',
        data: {
          specialty,
          usage: usageInfo,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve specialty usage information',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private describeReferences(references: SpecialtyReferenceCounts): string {
    return (Object.keys(SPECIALTY_REFERENCE_LABELS) as SpecialtyReferenceKey[])
      .filter((key) => references[key] > 0)
      .map((key) => `${references[key]} ${SPECIALTY_REFERENCE_LABELS[key]}`)
      .join(' and ');
  }

  private buildMutationFailure(error: unknown, fallbackMessage: string) {
    if (this.isUniqueViolation(error)) {
      return {
        success: false as const,
        code: SPECIALTY_ERROR_CODES.DUPLICATE_NAME,
        message: 'Specialty with this name already exists',
      };
    }

    return {
      success: false as const,
      code: SPECIALTY_ERROR_CODES.UPDATE_FAILED,
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
