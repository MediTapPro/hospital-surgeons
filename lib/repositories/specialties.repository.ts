import { getDb } from '@/lib/db';
import { specialties, doctorSpecialties, hospitalDepartments, assignments } from '@/src/db/drizzle/migrations/schema';
import { eq, desc, asc, count } from 'drizzle-orm';

export interface CreateSpecialtyData {
  name: string;
  description?: string;
}

export interface SpecialtyQuery {
  page?: number;
  limit?: number;
  sortBy?: 'name';
  sortOrder?: 'asc' | 'desc';
}

export class SpecialtiesRepository {
  private db = getDb();

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

  async updateSpecialty(id: string, updateData: Partial<CreateSpecialtyData>) {
    const updateFields: any = {};
    
    if (updateData.name) updateFields.name = updateData.name;
    if (updateData.description !== undefined) updateFields.description = updateData.description;
    // Remove isActive - doesn't exist in database

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
    // Note: assignments don't have specialtyId directly
    // Get specialty from doctorSpecialties via doctorId in assignments
    const result = await this.db
      .select({
        specialty: specialties,
        doctorCount: count(doctorSpecialties.id),
        hospitalCount: count(hospitalDepartments.id),
        // assignmentCount: Get via doctorSpecialties -> assignments (complex join)
        // For now, we'll get doctor count which indicates usage
      })
      .from(specialties)
      .leftJoin(doctorSpecialties, eq(specialties.id, doctorSpecialties.specialtyId))
      .leftJoin(hospitalDepartments, eq(specialties.id, hospitalDepartments.specialtyId))
      // Removed bookings join - assignments don't have specialtyId
      .where(eq(specialties.id, id))
      .groupBy(specialties.id);

    return result[0] || null;
  }

  async getAllSpecialtiesStats() {
    // Note: assignments don't have specialtyId directly
    return await this.db
      .select({
        specialty: specialties,
        doctorCount: count(doctorSpecialties.id),
        hospitalCount: count(hospitalDepartments.id),
        // assignmentCount: Removed - assignments don't have specialtyId
      })
      .from(specialties)
      .leftJoin(doctorSpecialties, eq(specialties.id, doctorSpecialties.specialtyId))
      .leftJoin(hospitalDepartments, eq(specialties.id, hospitalDepartments.specialtyId))
      // Removed bookings join - assignments don't have specialtyId
      .groupBy(specialties.id)
      .orderBy(asc(specialties.name));
  }

  async isSpecialtyInUse(id: string) {
    const doctorCount = await this.db
      .select({ count: count() })
      .from(doctorSpecialties)
      .where(eq(doctorSpecialties.specialtyId, id));

    const hospitalCount = await this.db
      .select({ count: count() })
      .from(hospitalDepartments)
      .where(eq(hospitalDepartments.specialtyId, id));

    // Note: assignments don't have specialtyId directly
    // Specialty is determined via doctorSpecialties -> assignments
    // For simplicity, we'll just check doctor and hospital usage
    const assignmentCount = { count: 0 }; // Placeholder - complex to calculate

    return {
      isInUse: doctorCount[0].count > 0 || hospitalCount[0].count > 0,
      doctorCount: doctorCount[0].count,
      hospitalCount: hospitalCount[0].count,
      assignmentCount: assignmentCount.count, // Replaced bookingCount
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

  // Removed toggleSpecialtyStatus - isActive field doesn't exist in database
}


