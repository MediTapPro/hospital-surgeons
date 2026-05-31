import { getDb } from '@/lib/db';
import { 
  doctorProcedureFees, 
  doctorHospitalDiscounts, 
  specialties, 
  procedures, 
  procedureTypes, 
  roomTypes,
  hospitals,
  doctors
} from '@/src/db/drizzle/migrations/schema';
import { eq, and, sql, isNull, inArray, ne } from 'drizzle-orm';

export interface CreateFeeData {
  doctorId: string;
  specialtyId: string;
  procedureId?: string | null;
  procedureTypeId?: string | null;
  roomTypeId: string;
  fee: string;
  discountPercentage?: string;
  hospitalId?: string | null;
  notes?: string;
}

export class FeesRepository {
  private db = getDb();

  async createOrUpdateFee(data: CreateFeeData) {
    return await this.db.transaction(async (tx) => {
      // 1. Enforce 5-hospital limit for custom fees
      if (data.hospitalId) {
        const existingCountResult = await tx
          .select({ count: sql<number>`count(distinct hospital_id)` })
          .from(doctorProcedureFees)
          .where(
            and(
              eq(doctorProcedureFees.doctorId, data.doctorId),
              sql`hospital_id IS NOT NULL`,
              // Exclude the current hospital if we're updating it
              ne(doctorProcedureFees.hospitalId, data.hospitalId)
            )
          );
        
        const count = existingCountResult[0]?.count || 0;
        if (count >= 5) {
          throw new Error('Limit reached: You can only set fees for up to 5 hospitals.');
        }
      }

      const conditions = [
        eq(doctorProcedureFees.doctorId, data.doctorId),
        eq(doctorProcedureFees.specialtyId, data.specialtyId),
        eq(doctorProcedureFees.roomTypeId, data.roomTypeId),
        data.hospitalId ? eq(doctorProcedureFees.hospitalId, data.hospitalId) : isNull(doctorProcedureFees.hospitalId),
        data.procedureId ? eq(doctorProcedureFees.procedureId, data.procedureId) : isNull(doctorProcedureFees.procedureId),
        data.procedureTypeId ? eq(doctorProcedureFees.procedureTypeId, data.procedureTypeId) : isNull(doctorProcedureFees.procedureTypeId),
      ];

      const existingFees = await tx
        .select()
        .from(doctorProcedureFees)
        .where(and(...conditions));

      const values = {
        doctorId: data.doctorId,
        specialtyId: data.specialtyId,
        procedureId: data.procedureId || null,
        procedureTypeId: data.procedureTypeId || null,
        roomTypeId: data.roomTypeId,
        hospitalId: data.hospitalId || null,
        fee: data.fee,
        discountPercentage: data.discountPercentage || '0',
        notes: data.notes || null,
        status: data.hospitalId ? 'pending' : 'pending', // Both start as pending but Global MRP ignores the approval loop
        updatedAt: new Date().toISOString(),
      };

      if (existingFees.length > 0) {
        // Check if locked - Only specific hospital fees can be locked
        if (data.hospitalId && existingFees.some(f => f.status === 'approved')) {
          throw new Error('This hospital fee is approved (locked) and cannot be modified.');
        }

        // Update the first one found
        const [updated] = await tx
          .update(doctorProcedureFees)
          .set(values)
          .where(eq(doctorProcedureFees.id, existingFees[0].id))
          .returning();

        // If there were multiple (duplicates), clean them up
        if (existingFees.length > 1) {
          const idsToDelete = existingFees.slice(1).map(f => f.id);
          await tx.delete(doctorProcedureFees).where(inArray(doctorProcedureFees.id, idsToDelete));
        }

        return [updated];
      }

      // No existing fee, insert new one
      return await tx
        .insert(doctorProcedureFees)
        .values(values)
        .returning();
    });
  }

  async findMrpFees(doctorId: string, filters: { specialtyId?: string } = {}) {
    const conditions = [
      eq(doctorProcedureFees.doctorId, doctorId),
      isNull(doctorProcedureFees.hospitalId),
    ];

    if (filters.specialtyId) {
      conditions.push(eq(doctorProcedureFees.specialtyId, filters.specialtyId));
    }

    return await this.db
      .select({
        id: doctorProcedureFees.id,
        specialtyId: doctorProcedureFees.specialtyId,
        specialtyName: specialties.name,
        procedureId: doctorProcedureFees.procedureId,
        procedureName: procedures.name,
        procedureTypeId: doctorProcedureFees.procedureTypeId,
        procedureTypeName: procedureTypes.displayName,
        roomTypeId: doctorProcedureFees.roomTypeId,
        roomTypeName: roomTypes.name,
        fee: doctorProcedureFees.fee,
        discountPercentage: doctorProcedureFees.discountPercentage,
        notes: doctorProcedureFees.notes,
        createdAt: doctorProcedureFees.createdAt,
      })
      .from(doctorProcedureFees)
      .leftJoin(specialties, eq(doctorProcedureFees.specialtyId, specialties.id))
      .leftJoin(procedures, eq(doctorProcedureFees.procedureId, procedures.id))
      .leftJoin(procedureTypes, eq(doctorProcedureFees.procedureTypeId, procedureTypes.id))
      .leftJoin(roomTypes, eq(doctorProcedureFees.roomTypeId, roomTypes.id))
      .where(and(...conditions));
  }

  async findAllFeesByDoctorId(doctorId: string) {
    return await this.db
      .select({
        id: doctorProcedureFees.id,
        doctorId: doctorProcedureFees.doctorId,
        specialtyId: doctorProcedureFees.specialtyId,
        specialtyName: specialties.name,
        procedureId: doctorProcedureFees.procedureId,
        procedureName: procedures.name,
        procedureTypeId: doctorProcedureFees.procedureTypeId,
        procedureTypeName: procedureTypes.displayName,
        roomTypeId: doctorProcedureFees.roomTypeId,
        roomTypeName: roomTypes.displayName,
        hospitalId: doctorProcedureFees.hospitalId,
        hospitalName: hospitals.name,
        fee: doctorProcedureFees.fee,
        discountPercentage: doctorProcedureFees.discountPercentage,
        notes: doctorProcedureFees.notes,
        status: doctorProcedureFees.status,
        createdAt: doctorProcedureFees.createdAt,
      })
      .from(doctorProcedureFees)
      .leftJoin(specialties, eq(doctorProcedureFees.specialtyId, specialties.id))
      .leftJoin(procedures, eq(doctorProcedureFees.procedureId, procedures.id))
      .leftJoin(procedureTypes, eq(doctorProcedureFees.procedureTypeId, procedureTypes.id))
      .leftJoin(roomTypes, eq(doctorProcedureFees.roomTypeId, roomTypes.id))
      .leftJoin(hospitals, eq(doctorProcedureFees.hospitalId, hospitals.id))
      .where(eq(doctorProcedureFees.doctorId, doctorId))
      .orderBy(sql`${doctorProcedureFees.hospitalId} IS NOT NULL`, doctorProcedureFees.createdAt);
  }

  async deleteFee(id: string, doctorId: string) {
    return await this.db
      .delete(doctorProcedureFees)
      .where(and(eq(doctorProcedureFees.id, id), eq(doctorProcedureFees.doctorId, doctorId)))
      .returning();
  }

  // --- Hospital Discounts ---

  async upsertHospitalDiscount(doctorId: string, hospitalId: string, discountPercentage: string) {
    return await this.db
      .insert(doctorHospitalDiscounts)
      .values({
        doctorId,
        hospitalId,
        discountPercentage,
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: [doctorHospitalDiscounts.doctorId, doctorHospitalDiscounts.hospitalId],
        set: { discountPercentage, updatedAt: new Date().toISOString() },
      })
      .returning();
  }

  async findHospitalDiscounts(doctorId: string) {
    return await this.db
      .select()
      .from(doctorHospitalDiscounts)
      .where(eq(doctorHospitalDiscounts.doctorId, doctorId));
  }

  async deleteHospitalDiscount(doctorId: string, hospitalId: string) {
    return await this.db
      .delete(doctorHospitalDiscounts)
      .where(and(eq(doctorHospitalDiscounts.doctorId, doctorId), eq(doctorHospitalDiscounts.hospitalId, hospitalId)))
      .returning();
  }

  async findFeesForHospital(hospitalId: string, status?: string | null, page: number = 1, limit: number = 50) {
    const conditions = [eq(doctorProcedureFees.hospitalId, hospitalId)];
    if (status && status !== 'all') {
      conditions.push(eq(doctorProcedureFees.status, status));
    }

    const whereClause = and(...conditions);

    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(doctorProcedureFees)
      .where(whereClause);
      
    const total = Number(countResult[0]?.count || 0);
    const offset = (page - 1) * limit;

    const data = await this.db
      .select({
        id: doctorProcedureFees.id,
        doctorId: doctorProcedureFees.doctorId,
        doctorName: sql<string>`concat(${doctors.firstName}, ' ', ${doctors.lastName})`,
        doctorCity: doctors.city,
        doctorState: doctors.state,
        doctorPincode: doctors.pincode,
        doctorFullAddress: doctors.fullAddress,
        doctorYearsOfExperience: doctors.yearsOfExperience,
        doctorMedicalLicenseNumber: doctors.medicalLicenseNumber,
        specialtyId: doctorProcedureFees.specialtyId,
        specialtyName: specialties.name,
        procedureId: doctorProcedureFees.procedureId,
        procedureName: procedures.name,
        procedureTypeId: doctorProcedureFees.procedureTypeId,
        procedureTypeName: procedureTypes.displayName,
        roomTypeId: doctorProcedureFees.roomTypeId,
        roomTypeName: roomTypes.displayName,
        fee: doctorProcedureFees.fee,
        discountPercentage: doctorProcedureFees.discountPercentage,
        notes: doctorProcedureFees.notes,
        status: doctorProcedureFees.status,
        createdAt: doctorProcedureFees.createdAt,
      })
      .from(doctorProcedureFees)
      .leftJoin(specialties, eq(doctorProcedureFees.specialtyId, specialties.id))
      .leftJoin(procedures, eq(doctorProcedureFees.procedureId, procedures.id))
      .leftJoin(procedureTypes, eq(doctorProcedureFees.procedureTypeId, procedureTypes.id))
      .leftJoin(roomTypes, eq(doctorProcedureFees.roomTypeId, roomTypes.id))
      .leftJoin(doctors, eq(doctorProcedureFees.doctorId, doctors.id))
      .where(whereClause)
      .orderBy(doctorProcedureFees.createdAt)
      .limit(limit)
      .offset(offset);

    return { data, total };
  }

  async updateFeeStatus(id: string, hospitalId: string, status: string, reason?: string) {
    return await this.db
      .update(doctorProcedureFees)
      .set({ 
        status: status as any,
        statusReason: reason || null,
        updatedAt: new Date().toISOString()
      })
      .where(
        and(
          eq(doctorProcedureFees.id, id),
          eq(doctorProcedureFees.hospitalId, hospitalId)
        )
      )
      .returning();
  }

  async findEffectiveFee(params: {
    doctorId: string;
    specialtyId: string;
    procedureId?: string | null;
    procedureTypeId?: string | null;
    roomTypeId: string;
    hospitalId: string;
  }) {
    const { doctorId, specialtyId, procedureId, procedureTypeId, roomTypeId, hospitalId } = params;

    // 1. Try to find an approved hospital-specific fee
    const hospitalConditions = [
      eq(doctorProcedureFees.doctorId, doctorId),
      eq(doctorProcedureFees.hospitalId, hospitalId),
      eq(doctorProcedureFees.specialtyId, specialtyId),
      eq(doctorProcedureFees.roomTypeId, roomTypeId),
      eq(doctorProcedureFees.status, 'approved'),
      procedureId ? eq(doctorProcedureFees.procedureId, procedureId) : isNull(doctorProcedureFees.procedureId),
      procedureTypeId ? eq(doctorProcedureFees.procedureTypeId, procedureTypeId) : isNull(doctorProcedureFees.procedureTypeId),
    ];

    const [hospitalFee] = await this.db
      .select({
        id: doctorProcedureFees.id,
        fee: doctorProcedureFees.fee,
        discountPercentage: doctorProcedureFees.discountPercentage,
        hospitalId: doctorProcedureFees.hospitalId,
        status: doctorProcedureFees.status
      })
      .from(doctorProcedureFees)
      .where(and(...hospitalConditions))
      .limit(1);

    if (hospitalFee) {
      const baseFee = parseFloat(hospitalFee.fee);
      const discount = parseFloat(hospitalFee.discountPercentage || '0');
      const effectiveFee = (baseFee * (1 - discount / 100)).toFixed(2);
      return { 
        ...hospitalFee, 
        baseFee: hospitalFee.fee,
        effectiveFee, 
        source: 'hospital_specific' as const 
      };
    }

    // 2. Fallback to Global MRP (hospitalId IS NULL)
    const mrpConditions = [
      eq(doctorProcedureFees.doctorId, doctorId),
      isNull(doctorProcedureFees.hospitalId),
      eq(doctorProcedureFees.specialtyId, specialtyId),
      eq(doctorProcedureFees.roomTypeId, roomTypeId),
      procedureId ? eq(doctorProcedureFees.procedureId, procedureId) : isNull(doctorProcedureFees.procedureId),
      procedureTypeId ? eq(doctorProcedureFees.procedureTypeId, procedureTypeId) : isNull(doctorProcedureFees.procedureTypeId),
    ];

    const [mrpFee] = await this.db
      .select({
        id: doctorProcedureFees.id,
        fee: doctorProcedureFees.fee,
        discountPercentage: doctorProcedureFees.discountPercentage,
        hospitalId: doctorProcedureFees.hospitalId,
        status: doctorProcedureFees.status
      })
      .from(doctorProcedureFees)
      .where(and(...mrpConditions))
      .limit(1);

    if (mrpFee) {
      const baseFee = parseFloat(mrpFee.fee);
      const discount = parseFloat(mrpFee.discountPercentage || '0');
      const effectiveFee = (baseFee * (1 - discount / 100)).toFixed(2);
      return { 
        ...mrpFee, 
        baseFee: mrpFee.fee,
        effectiveFee, 
        source: 'global_mrp' as const 
      };
    }

    return null;
  }

  async bulkProposeFromMrp(params: {
    doctorId: string;
    hospitalId: string;
    specialtyId: string;
    discountPercentage?: string;
  }) {
    const { doctorId, hospitalId, specialtyId, discountPercentage } = params;

    return await this.db.transaction(async (tx) => {
      // 1. Enforce 5-hospital limit check (similar to createOrUpdateFee)
      const existingHospitals = await tx
        .select({ count: sql<number>`count(distinct hospital_id)` })
        .from(doctorProcedureFees)
        .where(
          and(
            eq(doctorProcedureFees.doctorId, doctorId),
            sql`hospital_id IS NOT NULL`,
            ne(doctorProcedureFees.hospitalId, hospitalId)
          )
        );
      
      const count = existingHospitals[0]?.count || 0;
      if (count >= 5) {
        throw new Error('Limit reached: You can only set fees for up to 5 hospitals.');
      }

      // 2. Get all Global MRPs for this specialty
      const mrpFees = await tx
        .select()
        .from(doctorProcedureFees)
        .where(
          and(
            eq(doctorProcedureFees.doctorId, doctorId),
            eq(doctorProcedureFees.specialtyId, specialtyId),
            isNull(doctorProcedureFees.hospitalId)
          )
        );

      if (mrpFees.length === 0) {
        return { success: false, message: 'No Global MRPs found for this specialty.' };
      }

      // 3. Process each MRP
      const results = [];
      for (const mrp of mrpFees) {
        const newFee = mrp.fee;
        const newDiscount = discountPercentage ?? mrp.discountPercentage;

        const conditions = [
          eq(doctorProcedureFees.doctorId, doctorId),
          eq(doctorProcedureFees.hospitalId, hospitalId),
          eq(doctorProcedureFees.specialtyId, specialtyId),
          eq(doctorProcedureFees.roomTypeId, mrp.roomTypeId),
          mrp.procedureId ? eq(doctorProcedureFees.procedureId, mrp.procedureId) : isNull(doctorProcedureFees.procedureId),
          mrp.procedureTypeId ? eq(doctorProcedureFees.procedureTypeId, mrp.procedureTypeId) : isNull(doctorProcedureFees.procedureTypeId),
        ];

        const [existing] = await tx
          .select()
          .from(doctorProcedureFees)
          .where(and(...conditions))
          .limit(1);

        if (existing) {
          if (existing.status === 'approved') continue;

          const [updated] = await tx
            .update(doctorProcedureFees)
            .set({
              fee: newFee,
              discountPercentage: newDiscount,
              status: 'pending',
              updatedAt: new Date().toISOString(),
            })
            .where(eq(doctorProcedureFees.id, existing.id))
            .returning();
          results.push(updated);
        } else {
          const [inserted] = await tx
            .insert(doctorProcedureFees)
            .values({
              doctorId,
              hospitalId,
              specialtyId,
              procedureId: mrp.procedureId,
              procedureTypeId: mrp.procedureTypeId,
              roomTypeId: mrp.roomTypeId,
              fee: newFee,
              discountPercentage: newDiscount,
              status: 'pending',
              updatedAt: new Date().toISOString(),
            })
            .returning();
          results.push(inserted);
        }
      }

      return { success: true, count: results.length, data: results };
    });
  }

  async findEffectiveFeesForDoctorAtHospital(doctorId: string, hospitalId: string, specialtyId?: string) {
    const conditions = [
      eq(doctorProcedureFees.doctorId, doctorId),
      // Only Global MRPs OR specific approved hospital fees
      sql`(${doctorProcedureFees.hospitalId} IS NULL OR (${doctorProcedureFees.hospitalId} = ${hospitalId} AND ${doctorProcedureFees.status} = 'approved'))`
    ];

    if (specialtyId) {
      conditions.push(eq(doctorProcedureFees.specialtyId, specialtyId));
    }

    // Using DISTINCT ON to pick the best row per combination
    // Priority: Hospital Approved (hospitalId != null) > Global MRP (hospitalId == null)
    const rows = await this.db
      .select({
        id: doctorProcedureFees.id,
        doctorId: doctorProcedureFees.doctorId,
        specialtyId: doctorProcedureFees.specialtyId,
        specialtyName: specialties.name,
        procedureId: doctorProcedureFees.procedureId,
        procedureName: procedures.name,
        procedureTypeId: doctorProcedureFees.procedureTypeId,
        procedureTypeName: procedureTypes.displayName,
        roomTypeId: doctorProcedureFees.roomTypeId,
        roomTypeName: roomTypes.displayName,
        hospitalId: doctorProcedureFees.hospitalId,
        fee: doctorProcedureFees.fee,
        discountPercentage: doctorProcedureFees.discountPercentage,
        status: doctorProcedureFees.status,
      })
      .from(doctorProcedureFees)
      .leftJoin(specialties, eq(doctorProcedureFees.specialtyId, specialties.id))
      .leftJoin(procedures, eq(doctorProcedureFees.procedureId, procedures.id))
      .leftJoin(procedureTypes, eq(doctorProcedureFees.procedureTypeId, procedureTypes.id))
      .leftJoin(roomTypes, eq(doctorProcedureFees.roomTypeId, roomTypes.id))
      .where(and(...conditions))
      .orderBy(
        doctorProcedureFees.specialtyId,
        doctorProcedureFees.procedureId,
        doctorProcedureFees.procedureTypeId,
        doctorProcedureFees.roomTypeId,
        // Priority: Hospital Specific Approved (not null) comes first
        sql`${doctorProcedureFees.hospitalId} IS NOT NULL DESC`,
        doctorProcedureFees.createdAt
      );

    // Drizzle doesn't have a direct distinctOn() method for all PG queries yet, 
    // but the orderBy logic above combined with a simple group/filter or just distinct works.
    // Actually, in Postgres, DISTINCT ON requires the first ORDER BY columns to match the DISTINCT ON columns.
    
    // Let's use a raw query or a more explicit distinct filter.
    // For now, since the result set is pre-filtered by the WHERE to only contain MRP or Approved Fees,
    // and we order by (hospitalId != null) DESC, the grouping logic below is extremely fast.

    const combinationsMap = new Map<string, any>();
    for (const row of rows) {
      const key = `${row.specialtyId}-${row.procedureId || 'null'}-${row.procedureTypeId || 'null'}-${row.roomTypeId}`;
      if (!combinationsMap.has(key)) {
        combinationsMap.set(key, row);
      }
    }

    return Array.from(combinationsMap.values()).map(item => {
      const baseFee = parseFloat(item.fee);
      const discount = parseFloat(item.discountPercentage || '0');
      const effectiveFee = (baseFee * (1 - discount / 100)).toFixed(2);
      return {
        ...item,
        baseFee: item.fee,
        effectiveFee,
        source: item.hospitalId ? 'hospital_specific' : 'global_mrp'
      };
    });
  }
}
