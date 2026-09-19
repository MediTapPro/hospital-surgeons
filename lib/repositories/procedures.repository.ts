import { getDb } from '@/lib/db';
import {
  procedures,
  procedureCategories,
  procedureTypes,
  specialties,
  procedureTypeMappings,
  doctorProcedureFees,
  assignments,
} from '@/src/db/drizzle/migrations/schema';
import { eq, asc, count, and, ilike, sql } from 'drizzle-orm';
import type {
  ProcedureReferenceCounts,
  CategoryReferenceCounts,
} from '@/lib/enums/procedures.enums';

export interface CreateProcedureData {
  specialtyId: string;
  categoryId?: string | null;
  name: string;
  description?: string | null;
  isActive?: boolean;
  typeIds?: string[];
}

export interface CreateCategoryData {
  specialtyId: string;
  name: string;
  description?: string | null;
}

export interface CreateProcedureTypeData {
  name: string;
  displayName: string;
}

export class ProceduresRepository {
  constructor(private readonly db: any = getDb()) {}

  // --- Procedures ---

  async createProcedure(data: CreateProcedureData) {
    const [procedure] = await this.db
      .insert(procedures)
      .values({
        specialtyId: data.specialtyId,
        categoryId: data.categoryId || null,
        name: data.name,
        description: data.description || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      })
      .returning();

    if (!procedure) return null;

    if (data.typeIds && data.typeIds.length > 0) {
      await this.db.insert(procedureTypeMappings).values(
        data.typeIds.map(typeId => ({
          procedureId: procedure.id,
          typeId,
        }))
      );
    }

    return procedure;
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
      .then((res: any[]) => res[0] || null);

    if (procedure) {
      const mappings = await this.db
        .select({ typeId: procedureTypeMappings.typeId })
        .from(procedureTypeMappings)
        .where(eq(procedureTypeMappings.procedureId, id));

      return {
        ...procedure,
        typeIds: mappings.map((m: any) => m.typeId)
      };
    }

    return null;
  }

  /**
   * Scoped case-insensitive name lookup. Procedure names are unique per specialty, so the
   * specialty is part of the match. Uses lower() equality rather than ILIKE so a name
   * containing % or _ cannot act as a wildcard. Pass `excludeId` when checking a rename.
   */
  async findProcedureByNameInsensitive(name: string, specialtyId: string, excludeId?: string) {
    const conditions = [
      eq(procedures.specialtyId, specialtyId),
      sql`lower(${procedures.name}) = ${name.trim().toLowerCase()}`,
    ];

    if (excludeId) {
      conditions.push(sql`${procedures.id} <> ${excludeId}`);
    }

    const result = await this.db
      .select()
      .from(procedures)
      .where(and(...conditions))
      .limit(1);

    return result[0] || null;
  }

  async updateProcedure(id: string, data: Partial<CreateProcedureData>) {
    const procedureData: any = { ...data };
    delete procedureData.typeIds;
    delete procedureData.updatedAt;

    const [procedure] = await this.db
      .update(procedures)
      .set(procedureData)
      .where(eq(procedures.id, id))
      .returning();

    if (!procedure) return null;

    if (data.typeIds !== undefined) {
      await this.db.delete(procedureTypeMappings).where(eq(procedureTypeMappings.procedureId, id));

      if (data.typeIds.length > 0) {
        await this.db.insert(procedureTypeMappings).values(
          data.typeIds.map(typeId => ({
            procedureId: id,
            typeId,
          }))
        );
      }
    }

    return procedure;
  }

  async deleteProcedure(id: string) {
    const [procedure] = await this.db
      .delete(procedures)
      .where(eq(procedures.id, id))
      .returning();

    return procedure ?? null;
  }

  /**
   * Counts the rows that reference this procedure and would be destroyed or detached by a
   * delete. `procedure_type_mappings` is intentionally not counted — those rows belong to the
   * procedure and cascade with it.
   */
  async countProcedureReferences(id: string): Promise<ProcedureReferenceCounts> {
    const toNumber = (rows: { count: unknown }[]) => Number(rows[0]?.count ?? 0);

    const [feeRows, assignmentRows] = await Promise.all([
      this.db.select({ count: count() }).from(doctorProcedureFees).where(eq(doctorProcedureFees.procedureId, id)),
      this.db.select({ count: count() }).from(assignments).where(eq(assignments.procedureId, id)),
    ]);

    return {
      doctorProcedureFees: toNumber(feeRows),
      assignments: toNumber(assignmentRows),
    };
  }

  // --- Categories ---

  async findCategories(specialtyId?: string, search?: string) {
    const conditions = [];
    if (specialtyId) conditions.push(eq(procedureCategories.specialtyId, specialtyId));
    if (search) conditions.push(ilike(procedureCategories.name, `%${search}%`));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    return await this.db
      .select()
      .from(procedureCategories)
      .where(whereClause)
      .orderBy(asc(procedureCategories.name));
  }

  async findCategoryById(id: string) {
    const result = await this.db
      .select()
      .from(procedureCategories)
      .where(eq(procedureCategories.id, id))
      .limit(1);

    return result[0] || null;
  }

  async findCategoryByNameInsensitive(name: string, specialtyId: string, excludeId?: string) {
    const conditions = [
      eq(procedureCategories.specialtyId, specialtyId),
      sql`lower(${procedureCategories.name}) = ${name.trim().toLowerCase()}`,
    ];

    if (excludeId) {
      conditions.push(sql`${procedureCategories.id} <> ${excludeId}`);
    }

    const result = await this.db
      .select()
      .from(procedureCategories)
      .where(and(...conditions))
      .limit(1);

    return result[0] || null;
  }

  async createCategory(data: CreateCategoryData) {
    const [category] = await this.db
      .insert(procedureCategories)
      .values({
        specialtyId: data.specialtyId,
        name: data.name,
        description: data.description || null,
      })
      .returning();

    return category ?? null;
  }

  async updateCategory(id: string, data: Partial<CreateCategoryData>) {
    const [category] = await this.db
      .update(procedureCategories)
      .set(data)
      .where(eq(procedureCategories.id, id))
      .returning();

    return category ?? null;
  }

  async deleteCategory(id: string) {
    const [category] = await this.db
      .delete(procedureCategories)
      .where(eq(procedureCategories.id, id))
      .returning();

    return category ?? null;
  }

  /** Procedures that would lose their category_id if this category were deleted. */
  async countCategoryReferences(id: string): Promise<CategoryReferenceCounts> {
    const rows = await this.db
      .select({ count: count() })
      .from(procedures)
      .where(eq(procedures.categoryId, id));

    return { procedures: Number(rows[0]?.count ?? 0) };
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
    const [procedureType] = await this.db
      .insert(procedureTypes)
      .values({
        name: data.name,
        displayName: data.displayName,
      })
      .returning();

    return procedureType ?? null;
  }

  async updateProcedureType(id: string, data: Partial<CreateProcedureTypeData>) {
    const [procedureType] = await this.db
      .update(procedureTypes)
      .set(data)
      .where(eq(procedureTypes.id, id))
      .returning();

    return procedureType ?? null;
  }

  async deleteProcedureType(id: string) {
    const [procedureType] = await this.db
      .delete(procedureTypes)
      .where(eq(procedureTypes.id, id))
      .returning();

    return procedureType ?? null;
  }
}
