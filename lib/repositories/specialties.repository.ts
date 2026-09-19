import { getDb } from '@/lib/db';
import {
  specialties,
  doctorSpecialties,
  hospitalDepartments,
  assignments,
  procedureCategories,
  procedures,
  doctorProcedureFees,
  platformHomeVisitFees,
} from '@/src/db/drizzle/migrations/schema';
import { eq, desc, asc, count, countDistinct, ilike, sql, and } from 'drizzle-orm';
import type {
  SpecialtyReferenceCounts,
  SpecialtySortField,
  SpecialtySortOrder,
} from '@/lib/enums/specialties.enums';

export interface CreateSpecialtyData {
  name: string;
  description?: string | null;
}

export interface SpecialtyQuery {
  page?: number;
  limit?: number;
  sortBy?: 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface ListSpecialtiesForAdminInput {
  page: number;
  limit: number;
  search?: string;
  sortBy: SpecialtySortField;
  sortOrder: SpecialtySortOrder;
}

export class SpecialtiesRepository {
  constructor(private readonly db: any = getDb()) {}

  async createSpecialty(specialtyData: CreateSpecialtyData) {
    return await this.db
      .insert(specialties)
      .values({
        name: specialtyData.name,
        description: specialtyData.description,
      })
      .returning();
  }

  async findSpecialtyById(id: string) {
    const result = await this.db
      .select()
      .from(specialties)
      .where(eq(specialties.id, id))
      .limit(1);

    return result[0] || null;
  }

  async findSpecialtyByName(name: string) {
    const result = await this.db
      .select()
      .from(specialties)
      .where(eq(specialties.name, name))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Case-insensitive exact-name lookup. Uses lower() equality rather than ILIKE so a
   * name containing % or _ cannot act as a wildcard. Pass `excludeId` when checking a
   * rename so the record being updated does not match itself.
   */
  async findSpecialtyByNameInsensitive(name: string, excludeId?: string) {
    const normalizedName = name.trim().toLowerCase();
    const conditions = [sql`lower(${specialties.name}) = ${normalizedName}`];

    if (excludeId) {
      conditions.push(sql`${specialties.id} <> ${excludeId}`);
    }

    const result = await this.db
      .select()
      .from(specialties)
      .where(and(...conditions))
      .limit(1);

    return result[0] || null;
  }

  async findSpecialties(query: SpecialtyQuery) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const offset = (page - 1) * limit;

    // Remove createdAt sorting since it doesn't exist in database
    const orderByClause = query.sortOrder === 'asc' ? asc(specialties.name) : desc(specialties.name);

    return await this.db
      .select()
      .from(specialties)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);
  }

  async listForAdmin(input: ListSpecialtiesForAdminInput) {
    const whereClause = input.search
      ? ilike(specialties.name, `%${input.search}%`)
      : undefined;

    const sortColumns: Record<SpecialtySortField, any> = {
      name: specialties.name,
      id: specialties.id,
    };
    const sortColumn = sortColumns[input.sortBy] ?? specialties.name;

    const [totalRows, rows] = await Promise.all([
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(specialties)
        .where(whereClause),
      this.db
        .select({
          id: specialties.id,
          name: specialties.name,
          description: specialties.description,
          activeDoctors: countDistinct(doctorSpecialties.doctorId),
          activeHospitals: countDistinct(hospitalDepartments.hospitalId),
        })
        .from(specialties)
        .leftJoin(doctorSpecialties, eq(doctorSpecialties.specialtyId, specialties.id))
        .leftJoin(hospitalDepartments, eq(hospitalDepartments.specialtyId, specialties.id))
        .where(whereClause)
        .groupBy(specialties.id)
        .orderBy(input.sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn))
        .limit(input.limit)
        .offset((input.page - 1) * input.limit),
    ]);

    return { rows, total: Number(totalRows[0]?.count ?? 0) };
  }

  async updateSpecialty(id: string, updateData: Partial<CreateSpecialtyData>) {
    const updateFields: any = {};

    if (updateData.name) updateFields.name = updateData.name;
    if (updateData.description !== undefined) updateFields.description = updateData.description;

    return await this.db
      .update(specialties)
      .set(updateFields)
      .where(eq(specialties.id, id))
      .returning();
  }

  async deleteSpecialty(id: string) {
    return await this.db
      .delete(specialties)
      .where(eq(specialties.id, id))
      .returning();
  }

  async getActiveSpecialties() {
    // Since isActive doesn't exist, return all specialties
    return await this.db
      .select()
      .from(specialties)
      .orderBy(asc(specialties.name));
  }

  async getSpecialtyStats(id: string) {
    const result = await this.db
      .select({
        specialty: specialties,
        doctorCount: count(doctorSpecialties.id),
        hospitalCount: count(hospitalDepartments.id),
      })
      .from(specialties)
      .leftJoin(doctorSpecialties, eq(specialties.id, doctorSpecialties.specialtyId))
      .leftJoin(hospitalDepartments, eq(specialties.id, hospitalDepartments.specialtyId))
      .where(eq(specialties.id, id))
      .groupBy(specialties.id);

    return result[0] || null;
  }

  async getAllSpecialtiesStats() {
    return await this.db
      .select({
        specialty: specialties,
        doctorCount: count(doctorSpecialties.id),
        hospitalCount: count(hospitalDepartments.id),
      })
      .from(specialties)
      .leftJoin(doctorSpecialties, eq(specialties.id, doctorSpecialties.specialtyId))
      .leftJoin(hospitalDepartments, eq(specialties.id, hospitalDepartments.specialtyId))
      .groupBy(specialties.id)
      .orderBy(asc(specialties.name));
  }

  /**
   * Counts every row that references this specialty. All seven foreign keys must be
   * checked because six cascade on delete and `assignments` is set to null, so a
   * partial check would destroy or detach referencing data silently.
   */
  async countReferences(id: string): Promise<SpecialtyReferenceCounts> {
    const toNumber = (rows: { count: unknown }[]) => Number(rows[0]?.count ?? 0);

    const [
      doctorRows,
      hospitalRows,
      procedureCategoryRows,
      procedureRows,
      assignmentRows,
      doctorProcedureFeeRows,
      homeVisitFeeRows,
    ] = await Promise.all([
      this.db.select({ count: count() }).from(doctorSpecialties).where(eq(doctorSpecialties.specialtyId, id)),
      this.db.select({ count: count() }).from(hospitalDepartments).where(eq(hospitalDepartments.specialtyId, id)),
      this.db.select({ count: count() }).from(procedureCategories).where(eq(procedureCategories.specialtyId, id)),
      this.db.select({ count: count() }).from(procedures).where(eq(procedures.specialtyId, id)),
      this.db.select({ count: count() }).from(assignments).where(eq(assignments.specialtyId, id)),
      this.db.select({ count: count() }).from(doctorProcedureFees).where(eq(doctorProcedureFees.specialtyId, id)),
      this.db.select({ count: count() }).from(platformHomeVisitFees).where(eq(platformHomeVisitFees.specialtyId, id)),
    ]);

    return {
      doctors: toNumber(doctorRows),
      hospitals: toNumber(hospitalRows),
      procedureCategories: toNumber(procedureCategoryRows),
      procedures: toNumber(procedureRows),
      assignments: toNumber(assignmentRows),
      doctorProcedureFees: toNumber(doctorProcedureFeeRows),
      homeVisitFees: toNumber(homeVisitFeeRows),
    };
  }

  async isSpecialtyInUse(id: string) {
    const counts = await this.countReferences(id);

    return {
      isInUse: Object.values(counts).some((referenceCount) => referenceCount > 0),
      doctorCount: counts.doctors,
      hospitalCount: counts.hospitals,
      assignmentCount: counts.assignments,
      counts,
    };
  }

  async createBulkSpecialties(specialtiesData: CreateSpecialtyData[]) {
    return await this.db
      .insert(specialties)
      .values(specialtiesData.map(specialty => ({
        name: specialty.name,
        description: specialty.description,
      })))
      .returning();
  }
}
