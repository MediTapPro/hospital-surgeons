import { getDb } from '@/lib/db';
import {
  platformHomeVisitFees,
  specialties
} from '@/src/db/drizzle/migrations/schema';
import { eq, and, sql } from 'drizzle-orm';

export class PlatformFeesRepository {
  constructor(private db: any = getDb()) {}

  async listAll(tx?: any) {
    const client = tx || this.db;
    return await client
      .select({
        id: platformHomeVisitFees.id,
        specialtyId: platformHomeVisitFees.specialtyId,
        fee: platformHomeVisitFees.fee,
        platformCommissionPercentage: platformHomeVisitFees.platformCommissionPercentage,
        createdAt: platformHomeVisitFees.createdAt,
        updatedAt: platformHomeVisitFees.updatedAt,
        specialtyName: specialties.name,
      })
      .from(platformHomeVisitFees)
      .leftJoin(specialties, eq(specialties.id, platformHomeVisitFees.specialtyId))
      .orderBy(platformHomeVisitFees.specialtyId); // Null specialtyId (default fee) will appear first or last depending on database sort, but ordered consistently
  }

  async findById(id: string, tx?: any) {
    const client = tx || this.db;
    const result = await client
      .select({
        id: platformHomeVisitFees.id,
        specialtyId: platformHomeVisitFees.specialtyId,
        fee: platformHomeVisitFees.fee,
        platformCommissionPercentage: platformHomeVisitFees.platformCommissionPercentage,
        createdAt: platformHomeVisitFees.createdAt,
        updatedAt: platformHomeVisitFees.updatedAt,
        specialtyName: specialties.name,
      })
      .from(platformHomeVisitFees)
      .leftJoin(specialties, eq(specialties.id, platformHomeVisitFees.specialtyId))
      .where(eq(platformHomeVisitFees.id, id))
      .limit(1);
    return result[0] || null;
  }

  async findBySpecialtyId(specialtyId: string | null, tx?: any) {
    const client = tx || this.db;
    const result = await client
      .select({
        id: platformHomeVisitFees.id,
        specialtyId: platformHomeVisitFees.specialtyId,
        fee: platformHomeVisitFees.fee,
        platformCommissionPercentage: platformHomeVisitFees.platformCommissionPercentage,
        createdAt: platformHomeVisitFees.createdAt,
        updatedAt: platformHomeVisitFees.updatedAt,
      })
      .from(platformHomeVisitFees)
      .where(
        specialtyId === null
          ? sql`${platformHomeVisitFees.specialtyId} IS NULL`
          : eq(platformHomeVisitFees.specialtyId, specialtyId)
      )
      .limit(1);
    return result[0] || null;
  }

  async create(data: {
    specialtyId: string | null;
    fee: string;
    platformCommissionPercentage: string;
  }, tx?: any) {
    const client = tx || this.db;
    const result = await client
      .insert(platformHomeVisitFees)
      .values(data)
      .returning();
    return result[0];
  }

  async update(id: string, data: {
    specialtyId?: string | null;
    fee?: string;
    platformCommissionPercentage?: string;
    updatedAt?: string;
  }, tx?: any) {
    const client = tx || this.db;
    const result = await client
      .update(platformHomeVisitFees)
      .set({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(platformHomeVisitFees.id, id))
      .returning();
    return result[0];
  }

  async delete(id: string, tx?: any) {
    const client = tx || this.db;
    return await client
      .delete(platformHomeVisitFees)
      .where(eq(platformHomeVisitFees.id, id));
  }
}
