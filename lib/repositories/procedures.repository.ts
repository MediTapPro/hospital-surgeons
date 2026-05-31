import { getDb } from '@/lib/db';
import { 
  procedures, 
  procedureCategories, 
  procedureTypes, 
  specialties,
  procedureTypeMappings
} from '@/src/db/drizzle/migrations/schema';
import { eq, desc, asc, sql, and, ilike } from 'drizzle-orm';

export interface CreateProcedureData {
  specialtyId: string;
  categoryId?: string;
  name: string;
  description?: string;
  isActive?: boolean;
  typeIds?: string[];
}

export interface CreateCategoryData {
  specialtyId: string;
  name: string;
  description?: string;
}

export interface CreateProcedureTypeData {
  name: string;
  displayName: string;
}

export class ProceduresRepository {
  private db = getDb();

  // --- Procedures ---

  async createProcedure(data: CreateProcedureData) {
    return await this.db.transaction(async (tx) => {
      const [procedure] = await tx
        .insert(procedures)
        .values({
          specialtyId: data.specialtyId,
          categoryId: data.categoryId || null,
          name: data.name,
          description: data.description || null,
          isActive: data.isActive !== undefined ? data.isActive : true,
        })
        .returning();

      if (data.typeIds && data.typeIds.length > 0) {
        await tx.insert(procedureTypeMappings).values(
          data.typeIds.map(typeId => ({
            procedureId: procedure.id,
            typeId,
          }))
        );
      }

      return procedure;
    });
  }

  async findProcedures(filters: { specialtyId?: string; categoryId?: string; search?: string } = {}) {
    const conditions = [];
    if (filters.specialtyId) conditions.push(eq(procedures.specialtyId, filters.specialtyId));
    if (filters.categoryId) conditions.push(eq(procedures.categoryId, filters.categoryId));
    if (filters.search) conditions.push(ilike(procedures.name, `%${filters.search}%`));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    return await this.db
      .select({
        id: procedures.id,
        name: procedures.name,
        description: procedures.description,
        isActive: procedures.isActive,
        specialtyId: procedures.specialtyId,
        specialtyName: specialties.name,
        categoryId: procedures.categoryId,
        categoryName: procedureCategories.name,
      })
      .from(procedures)
      .leftJoin(specialties, eq(procedures.specialtyId, specialties.id))
      .leftJoin(procedureCategories, eq(procedures.categoryId, procedureCategories.id))
      .where(whereClause)
      .orderBy(asc(procedures.name));
  }

  async findProcedureById(id: string) {
    const procedure = await this.db
      .select()
      .from(procedures)
      .where(eq(procedures.id, id))
      .limit(1)
      .then(res => res[0] || null);

    if (procedure) {
      const mappings = await this.db
        .select({ typeId: procedureTypeMappings.typeId })
        .from(procedureTypeMappings)
        .where(eq(procedureTypeMappings.procedureId, id));

      return {
        ...procedure,
        typeIds: mappings.map(m => m.typeId)
      };
    }

    return null;
  }

  async updateProcedure(id: string, data: Partial<CreateProcedureData>) {
    return await this.db.transaction(async (tx) => {
      const procedureData = { ...data };
      delete procedureData.typeIds;
      delete (procedureData as any).updatedAt;

      const [procedure] = await tx
        .update(procedures)
        .set(procedureData as any)
        .where(eq(procedures.id, id))
        .returning();

      if (data.typeIds !== undefined) {
        // Delete all existing mappings
        await tx.delete(procedureTypeMappings).where(eq(procedureTypeMappings.procedureId, id));
        
        // Insert new mappings if any
        if (data.typeIds.length > 0) {
          await tx.insert(procedureTypeMappings).values(
            data.typeIds.map(typeId => ({
              procedureId: id,
              typeId,
            }))
          );
        }
      }

      return procedure;
    });
  }

  async deleteProcedure(id: string) {
    return await this.db
      .delete(procedures)
      .where(eq(procedures.id, id))
      .returning();
  }

  // --- Categories ---

  async findCategories(specialtyId?: string) {
    const whereClause = specialtyId ? eq(procedureCategories.specialtyId, specialtyId) : undefined;
    return await this.db
      .select()
      .from(procedureCategories)
      .where(whereClause)
      .orderBy(asc(procedureCategories.name));
  }

  async createCategory(data: CreateCategoryData) {
    return await this.db
      .insert(procedureCategories)
      .values({
        specialtyId: data.specialtyId,
        name: data.name,
        description: data.description || null,
      })
      .returning();
  }

  async updateCategory(id: string, data: Partial<CreateCategoryData>) {
    return await this.db
      .update(procedureCategories)
      .set(data)
      .where(eq(procedureCategories.id, id))
      .returning();
  }

  async deleteCategory(id: string) {
    return await this.db
      .delete(procedureCategories)
      .where(eq(procedureCategories.id, id))
      .returning();
  }

  // --- Procedure Types ---

  async findProcedureTypes(procedureId?: string) {
    if (procedureId) {
      return await this.db
        .select({
          id: procedureTypes.id,
          name: procedureTypes.name,
          displayName: procedureTypes.displayName,
          createdAt: procedureTypes.createdAt,
        })
        .from(procedureTypes)
        .innerJoin(procedureTypeMappings, eq(procedureTypeMappings.typeId, procedureTypes.id))
        .where(eq(procedureTypeMappings.procedureId, procedureId))
        .orderBy(asc(procedureTypes.displayName));
    }

    return await this.db
      .select()
      .from(procedureTypes)
      .orderBy(asc(procedureTypes.displayName));
  }

  async createProcedureType(data: CreateProcedureTypeData) {
    return await this.db
      .insert(procedureTypes)
      .values({
        name: data.name,
        displayName: data.displayName,
      })
      .returning();
  }

  async updateProcedureType(id: string, data: Partial<CreateProcedureTypeData>) {
    return await this.db
      .update(procedureTypes)
      .set(data)
      .where(eq(procedureTypes.id, id))
      .returning();
  }

  async deleteProcedureType(id: string) {
    return await this.db
      .delete(procedureTypes)
      .where(eq(procedureTypes.id, id))
      .returning();
  }
}
