import { 
  ProceduresRepository, 
  CreateProcedureData, 
  CreateCategoryData, 
  CreateProcedureTypeData 
} from '@/lib/repositories/procedures.repository';

export class ProceduresService {
  private repository = new ProceduresRepository();

  // --- Procedures ---

  async getProcedures(filters: { specialtyId?: string; categoryId?: string; search?: string } = {}) {
    try {
      const data = await this.repository.findProcedures(filters);
      return { success: true, data };
    } catch (error) {
      return { success: false, message: 'Failed to fetch procedures', error };
    }
  }

  async getProcedureById(id: string) {
    try {
      const data = await this.repository.findProcedureById(id);
      if (!data) return { success: false, message: 'Procedure not found' };
      return { success: true, data };
    } catch (error) {
      return { success: false, message: 'Failed to fetch procedure', error };
    }
  }

  async createProcedure(data: CreateProcedureData) {
    try {
      const result = await this.repository.createProcedure(data);
      return { success: true, message: 'Procedure created successfully', data: result };
    } catch (error) {
      return { success: false, message: 'Failed to create procedure', error };
    }
  }

  async updateProcedure(id: string, data: Partial<CreateProcedureData>) {
    try {
      const result = await this.repository.updateProcedure(id, data);
      return { success: true, message: 'Procedure updated successfully', data: result };
    } catch (error) {
      return { success: false, message: 'Failed to update procedure', error };
    }
  }

  async deleteProcedure(id: string) {
    try {
      await this.repository.deleteProcedure(id);
      return { success: true, message: 'Procedure deleted successfully' };
    } catch (error) {
      return { success: false, message: 'Failed to delete procedure', error };
    }
  }

  // --- Categories ---

  async getCategories(specialtyId?: string) {
    try {
      const data = await this.repository.findCategories(specialtyId);
      return { success: true, data };
    } catch (error) {
      return { success: false, message: 'Failed to fetch categories', error };
    }
  }

  async createCategory(data: CreateCategoryData) {
    try {
      const result = await this.repository.createCategory(data);
      return { success: true, message: 'Category created successfully', data: Array.isArray(result) ? result[0] : result };
    } catch (error) {
      return { success: false, message: 'Failed to create category', error };
    }
  }

  async updateCategory(id: string, data: Partial<CreateCategoryData>) {
    try {
      const result = await this.repository.updateCategory(id, data);
      return { success: true, message: 'Category updated successfully', data: Array.isArray(result) ? result[0] : result };
    } catch (error) {
      return { success: false, message: 'Failed to update category', error };
    }
  }

  async deleteCategory(id: string) {
    try {
      await this.repository.deleteCategory(id);
      return { success: true, message: 'Category deleted successfully' };
    } catch (error) {
      return { success: false, message: 'Failed to delete category', error };
    }
  }

  // --- Procedure Types ---

  async getProcedureTypes() {
    try {
      const data = await this.repository.findProcedureTypes();
      return { success: true, data };
    } catch (error) {
      return { success: false, message: 'Failed to fetch procedure types', error };
    }
  }

  async createProcedureType(data: CreateProcedureTypeData) {
    try {
      const result = await this.repository.createProcedureType(data);
      return { success: true, message: 'Procedure type created successfully', data: Array.isArray(result) ? result[0] : result };
    } catch (error) {
      return { success: false, message: 'Failed to create procedure type', error };
    }
  }

  async updateProcedureType(id: string, data: Partial<CreateProcedureTypeData>) {
    try {
      const result = await this.repository.updateProcedureType(id, data);
      return { success: true, message: 'Procedure type updated successfully', data: Array.isArray(result) ? result[0] : result };
    } catch (error) {
      return { success: false, message: 'Failed to update procedure type', error };
    }
  }

  async deleteProcedureType(id: string) {
    try {
      await this.repository.deleteProcedureType(id);
      return { success: true, message: 'Procedure type deleted successfully' };
    } catch (error) {
      return { success: false, message: 'Failed to delete procedure type', error };
    }
  }
}
