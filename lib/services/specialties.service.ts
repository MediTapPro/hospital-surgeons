import { SpecialtiesRepository, CreateSpecialtyData, SpecialtyQuery } from '@/lib/repositories/specialties.repository';

export class SpecialtiesService {
  private specialtiesRepository = new SpecialtiesRepository();

  async createSpecialty(createSpecialtyDto: CreateSpecialtyData) {
    try {
      const existingSpecialty = await this.specialtiesRepository.findSpecialtyByName(createSpecialtyDto.name);
      if (existingSpecialty) {
        return {
          success: false,
          message: 'Specialty with this name already exists',
        };
      }

      const specialty = await this.specialtiesRepository.createSpecialty(createSpecialtyDto);

      return {
        success: true,
        message: 'Specialty created successfully',
        data: specialty[0],
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create specialty',
        error: error instanceof Error ? error.message : String(error),
      };
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
        message: error instanceof Error ? error.message : 'Failed to retrieve specialty',
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
        message: error instanceof Error ? error.message : 'Failed to retrieve specialty',
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

  async updateSpecialty(id: string, updateSpecialtyDto: Partial<CreateSpecialtyData>) {
    try {
      const specialty = await this.specialtiesRepository.findSpecialtyById(id);
      if (!specialty) {
        return {
          success: false,
          message: 'Specialty not found',
        };
      }

      if (updateSpecialtyDto.name && updateSpecialtyDto.name !== specialty.name) {
        const existingSpecialty = await this.specialtiesRepository.findSpecialtyByName(updateSpecialtyDto.name);
        if (existingSpecialty) {
          return {
            success: false,
            message: 'Specialty with this name already exists',
          };
        }
      }

      const updatedSpecialty = await this.specialtiesRepository.updateSpecialty(id, updateSpecialtyDto);

      return {
        success: true,
        message: 'Specialty updated successfully',
        data: updatedSpecialty[0],
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update specialty',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async deleteSpecialty(id: string) {
    try {
      const specialty = await this.specialtiesRepository.findSpecialtyById(id);
      if (!specialty) {
        return {
          success: false,
          message: 'Specialty not found',
        };
      }

      const usageInfo = await this.specialtiesRepository.isSpecialtyInUse(id);
      if (usageInfo.isInUse) {
        return {
          success: false,
          message: `Cannot delete specialty. It is currently being used by ${usageInfo.doctorCount} doctors, ${usageInfo.hospitalCount} hospitals, and ${usageInfo.assignmentCount} assignments.`,
        };
      }

      await this.specialtiesRepository.deleteSpecialty(id);

      return {
        success: true,
        message: 'Specialty deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete specialty',
        error: error instanceof Error ? error.message : String(error),
      };
    }
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
      // Return error or implement alternative logic
      return {
        success: false,
        message: 'Specialty status toggle is not supported. The specialties table does not have an isActive field.',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to toggle specialty status',
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
      const names = specialtiesData.map(s => s.name);
      const uniqueNames = new Set(names);
      if (names.length !== uniqueNames.size) {
        return {
          success: false,
          message: 'Duplicate specialty names found in the input data',
        };
      }

      for (const specialtyData of specialtiesData) {
        const existing = await this.specialtiesRepository.findSpecialtyByName(specialtyData.name);
        if (existing) {
          return {
            success: false,
            message: `Specialty with name '${specialtyData.name}' already exists`,
          };
        }
      }

      const specialties = await this.specialtiesRepository.createBulkSpecialties(specialtiesData);

      return {
        success: true,
        message: `${specialties.length} specialties created successfully`,
        data: specialties,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create specialties',
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
}









































