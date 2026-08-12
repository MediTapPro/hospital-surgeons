import { getDb } from '@/lib/db';
import { 
  doctors, 
  doctorCredentials, 
  doctorSpecialties, 
  doctorAvailability, 
  doctorLeaves, // Use doctorLeaves instead of doctorUnavailability
  doctorProfilePhotos,
  specialties,
  users,
  availabilityTemplates,
  files,
  doctorHospitalAffiliations,
  hospitals
} from '@/src/db/drizzle/migrations/schema';
import { eq, and, desc, asc, sql, lte, gte, or, isNull, lt, gt, ne } from 'drizzle-orm';

export interface CreateDoctorData {
  firstName: string;
  lastName: string;
  profilePhotoId?: string; // UUID reference to files table
  medicalLicenseNumber: string;
  yearsOfExperience?: number;
  bio?: string;
  primaryLocation?: string;
  fullAddress?: string;
  city?: string;
  state?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  // consultationFee is in assignments table, not doctors table
  // isAvailable should be checked via doctorAvailability table
}

export interface CreateDoctorCredentialData {
  fileId: string;
  credentialType: string;
  title: string;
  institution: string;
  verificationStatus?: 'pending' | 'verified' | 'rejected';
}

export interface CreateDoctorSpecialtyData {
  specialtyId: string;
  isPrimary?: boolean;
  yearsOfExperience?: number;
}

export interface CreateDoctorAvailabilityData {
  slotDate: string;
  startTime: string;
  endTime: string;
  templateId?: string;
  status?: string;
  slotType?: 'hospital' | 'home_visit';
  isManual?: boolean;
  notes?: string;
  parentSlotId?: string | null; // NULL for parent slots, UUID for sub-slots
}

export interface CreateDoctorUnavailabilityData {
  startDate: string;
  endDate: string;
  leaveType?: 'sick' | 'vacation' | 'personal' | 'emergency' | 'other';
  reason?: string;
}

export interface CreateAvailabilityTemplateData {
  templateName: string;
  startTime: string;
  endTime: string;
  recurrencePattern: 'daily' | 'weekly' | 'monthly' | 'custom';
  recurrenceDays?: string[];
  validFrom: string;
  validUntil?: string;
  slotType?: 'hospital' | 'home_visit';
}

export type UpdateAvailabilityTemplateData = Partial<CreateAvailabilityTemplateData>;

export interface DoctorQuery {
  search?: string;
  specialtyId?: string;
  city?: string;
  minRating?: number;
  maxFee?: number;
  isAvailable?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'rating' | 'fee' | 'experience' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface PatientDoctorSearchParams {
  lat: number;
  lon: number;
  radiusKm: number;
  search?: string;
  specialtyId?: string;
  minRating?: number;
  sortBy?: 'distance' | 'rating' | 'experience';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface PatientDoctorSearchRow {
  id: string;
  firstName: string;
  lastName: string;
  yearsOfExperience: number;
  averageRating: string;
  totalRatings: number;
  completedAssignments: number;
  licenseVerificationStatus: string;
  city: string | null;
  state: string | null;
  distanceKm: string;
  profilePhotoId: string | null;
  specialties: Array<{ id: string; name: string }>;
  photoUrl: string | null;
  total: string;
}

type AvailabilityTemplateRow = typeof availabilityTemplates.$inferSelect;

export class DoctorsRepository {
  constructor(private db: any = getDb()) {}

  private mapTemplateRow(row: AvailabilityTemplateRow | null | undefined) {
    if (!row) return null;
    return {
      ...row,
      recurrenceDays: row.recurrenceDays
        ? row.recurrenceDays.split(',').map((day) => day.trim()).filter(Boolean)
        : [],
    } as AvailabilityTemplateRow & { recurrenceDays: string[] };
  }

  async createDoctor(doctorData: CreateDoctorData, userId: string) {
    // Note: consultationFee and isAvailable are not in doctors table
    // consultationFee is in assignments table
    // isAvailable should be checked via doctorAvailability table
    const values: any = {
      userId,
      firstName: doctorData.firstName,
      lastName: doctorData.lastName,
      medicalLicenseNumber: doctorData.medicalLicenseNumber,
      yearsOfExperience: doctorData.yearsOfExperience || 0,
      bio: doctorData.bio,
    };

    // Location fields
    if (doctorData.primaryLocation) {
      values.primaryLocation = doctorData.primaryLocation;
    }
    if (doctorData.fullAddress) {
      values.fullAddress = doctorData.fullAddress;
    }
    if (doctorData.city) {
      values.city = doctorData.city;
    }
    if (doctorData.state) {
      values.state = doctorData.state;
    }
    if (doctorData.pincode) {
      values.pincode = doctorData.pincode;
    }
    if (doctorData.latitude !== undefined) {
      values.latitude = doctorData.latitude;
    }
    if (doctorData.longitude !== undefined) {
      values.longitude = doctorData.longitude;
    }
    
    // Map profilePhotoId
    if (doctorData.profilePhotoId) {
      values.profilePhotoId = doctorData.profilePhotoId;
    }
    
    return await this.db
      .insert(doctors)
      .values(values)
      .returning();
  }

  async findDoctorByLicenseNumber(licenseNumber: string) {
    return this.db
      .select()
      .from(doctors)
      .where(eq(doctors.medicalLicenseNumber, licenseNumber))
      .limit(1);
  }

  async addSpecialties(specialtiesData: CreateDoctorSpecialtyData[], doctorId: string) {
    const values = specialtiesData.map(s => ({
      doctorId,
      specialtyId: s.specialtyId,
      isPrimary: s.isPrimary || false,
      yearsOfExperience: s.yearsOfExperience || null,
    }));
    return await this.db
      .insert(doctorSpecialties)
      .values(values)
      .returning();
  }

  async findDoctorById(id: string) {
    const result = await this.db
      .select({
        doctor: doctors,
        user: users,
      })
      .from(doctors)
      .leftJoin(users, eq(doctors.userId, users.id))
      .where(eq(doctors.id, id))
      .limit(1);

    return result[0] || null;
  }

  async findDoctorByUserId(userId: string) {
    const result = await this.db
      .select()
      .from(doctors)
      .where(eq(doctors.userId, userId))
      .limit(1);

    return result[0] || null;
  }

  async getDoctorAffiliatedHospitals(doctorId: string) {
    return await this.db
      .select({
        id: hospitals.id,
        name: hospitals.name,
      })
      .from(doctorHospitalAffiliations)
      .innerJoin(hospitals, eq(doctorHospitalAffiliations.hospitalId, hospitals.id))
      .where(
        and(
          eq(doctorHospitalAffiliations.doctorId, doctorId),
          eq(doctorHospitalAffiliations.status, 'active')
        )
      );
  }

  async findDoctors(query: DoctorQuery) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const offset = (page - 1) * limit;

    return await this.db
      .select({
        doctor: doctors,
        user: users,
      })
      .from(doctors)
      .leftJoin(users, eq(doctors.userId, users.id))
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Search verified doctors for patients by name/specialty within a radius.
   * Uses a single CTE query: radius filtering via PostGIS, distance calc,
   * specialty aggregation, pagination and total count in one round-trip.
   */
  async searchDoctorsForPatients(params: PatientDoctorSearchParams): Promise<PatientDoctorSearchRow[]> {
    const lat = Number(params.lat);
    const lon = Number(params.lon);
    const radiusKm = Number(params.radiusKm) || 50;
    const radiusMeters = radiusKm * 1000;
    const page = params.page || 1;
    const limit = params.limit || 10;
    const offset = (page - 1) * limit;

    const searchTerm = params.search?.trim() ? `%${params.search.trim().toLowerCase()}%` : undefined;

    const filters: ReturnType<typeof sql>[] = [];

    if (searchTerm) {
      filters.push(sql`
        AND (
          LOWER(d.first_name) ILIKE ${searchTerm}
          OR LOWER(d.last_name) ILIKE ${searchTerm}
          OR LOWER(d.first_name || ' ' || d.last_name) ILIKE ${searchTerm}
          OR LOWER(d.last_name || ' ' || d.first_name) ILIKE ${searchTerm}
          OR EXISTS (
            SELECT 1
            FROM doctor_specialties ds
            INNER JOIN specialties s ON s.id = ds.specialty_id
            WHERE ds.doctor_id = d.id
              AND LOWER(s.name) ILIKE ${searchTerm}
          )
        )
      `);
    }

    if (params.specialtyId) {
      filters.push(sql`
        AND EXISTS (
          SELECT 1
          FROM doctor_specialties ds
          WHERE ds.doctor_id = d.id
            AND ds.specialty_id = ${params.specialtyId}::uuid
        )
      `);
    }

    if (params.minRating !== undefined) {
      filters.push(sql`AND COALESCE(d.average_rating, 0) >= ${params.minRating}`);
    }

    const ORDER_EXPRESSIONS: Record<'distance' | 'rating' | 'experience', string> = {
      distance: 'dr.distance_km',
      rating: 'COALESCE(dr.average_rating, 0)',
      experience: 'dr.years_of_experience',
    };

    const sortKey = params.sortBy || 'distance';
    const sortDir = params.sortOrder === 'desc' ? 'DESC' : 'ASC';
    const orderClause = sql.raw(`${ORDER_EXPRESSIONS[sortKey]} ${sortDir} NULLS LAST, dr.id ASC`);

    const query = sql`
      WITH dr AS (
        SELECT
          d.id,
          d.first_name,
          d.last_name,
          d.years_of_experience,
          d.average_rating,
          d.total_ratings,
          d.completed_assignments,
          d.license_verification_status,
          d.city,
          d.state,
          d.profile_photo_id,
          ROUND(
            (
              ST_Distance(
                ST_SetSRID(ST_MakePoint(d.longitude::numeric, d.latitude::numeric), 4326)::geography,
                ST_SetSRID(ST_MakePoint(${lon}::numeric, ${lat}::numeric), 4326)::geography
              ) / 1000.0
            )::numeric,
            2
          ) AS distance_km
        FROM doctors d
        WHERE d.license_verification_status = 'verified'
          AND d.latitude IS NOT NULL
          AND d.longitude IS NOT NULL
          AND ST_DWithin(
            ST_SetSRID(ST_MakePoint(d.longitude::numeric, d.latitude::numeric), 4326)::geography,
            ST_SetSRID(ST_MakePoint(${lon}::numeric, ${lat}::numeric), 4326)::geography,
            ${radiusMeters}
          )
          ${sql.join(filters, sql.raw(' '))}
      ),
      ranked AS (
        SELECT
          dr.*,
          (
            SELECT COALESCE(
              json_agg(
                json_build_object('id', s.id, 'name', s.name)
                ORDER BY ds.is_primary DESC NULLS LAST, s.name
              ),
              '[]'::json
            )
            FROM doctor_specialties ds
            INNER JOIN specialties s ON s.id = ds.specialty_id
            WHERE ds.doctor_id = dr.id
          ) AS specialties,
          (
            SELECT f.url
            FROM files f
            WHERE f.id = dr.profile_photo_id
          ) AS photo_url,
          ROW_NUMBER() OVER (ORDER BY ${orderClause}) AS rn,
          COUNT(*) OVER () AS total
        FROM dr
      )
      SELECT
        id,
        first_name,
        last_name,
        years_of_experience,
        average_rating,
        total_ratings,
        completed_assignments,
        license_verification_status,
        city,
        state,
        profile_photo_id,
        distance_km,
        specialties,
        photo_url,
        total
      FROM ranked
      WHERE rn > ${offset} AND rn <= ${offset + limit}
      ORDER BY rn ASC
    `;

    const result = await this.db.execute(query);
    return (result.rows || []).map((row: any) => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      yearsOfExperience: row.years_of_experience,
      averageRating: row.average_rating != null ? String(row.average_rating) : '0',
      totalRatings: row.total_ratings,
      completedAssignments: row.completed_assignments,
      licenseVerificationStatus: row.license_verification_status,
      city: row.city || null,
      state: row.state || null,
      profilePhotoId: row.profile_photo_id || null,
      distanceKm: row.distance_km != null ? String(row.distance_km) : '0',
      specialties: row.specialties || [],
      photoUrl: row.photo_url || null,
      total: String(row.total ?? 0),
    }));
  }

  async updateDoctor(id: string, updateData: Partial<CreateDoctorData>) {
    const updateFields: any = {};
    
    if (updateData.firstName !== undefined) updateFields.firstName = updateData.firstName;
    if (updateData.lastName !== undefined) updateFields.lastName = updateData.lastName;
    if (updateData.profilePhotoId) {
      updateFields.profilePhotoId = updateData.profilePhotoId;
    }
    if (updateData.medicalLicenseNumber !== undefined) updateFields.medicalLicenseNumber = updateData.medicalLicenseNumber;
    if (updateData.yearsOfExperience !== undefined) updateFields.yearsOfExperience = updateData.yearsOfExperience;
    if (updateData.bio !== undefined) updateFields.bio = updateData.bio;
    if (updateData.primaryLocation !== undefined) updateFields.primaryLocation = updateData.primaryLocation;
    if (updateData.fullAddress !== undefined) updateFields.fullAddress = updateData.fullAddress;
    if (updateData.city !== undefined) updateFields.city = updateData.city;
    if (updateData.state !== undefined) updateFields.state = updateData.state;
    if (updateData.pincode !== undefined) updateFields.pincode = updateData.pincode;
    if (updateData.latitude !== undefined) updateFields.latitude = updateData.latitude;
    if (updateData.longitude !== undefined) updateFields.longitude = updateData.longitude;
    // Remove consultationFee and isAvailable - not in doctors table

    if (Object.keys(updateFields).length === 0) {
      return await this.db.select().from(doctors).where(eq(doctors.id, id));
    }

    return await this.db
      .update(doctors)
      .set(updateFields)
      .where(eq(doctors.id, id))
      .returning();
  }

  async deleteDoctor(id: string) {
    return await this.db
      .delete(doctors)
      .where(eq(doctors.id, id))
      .returning();
  }

  // Doctor Credentials
  async createCredential(credentialData: CreateDoctorCredentialData, doctorId: string) {
    return await this.db
      .insert(doctorCredentials)
      .values({
        doctorId,
        fileId: credentialData.fileId,
        credentialType: credentialData.credentialType,
        title: credentialData.title,
        institution: credentialData.institution,
        verificationStatus: credentialData.verificationStatus || 'pending',
      })
      .returning();
  }

  async getDoctorCredentials(doctorId: string) {
    return await this.db
      .select({
        credential: doctorCredentials,
        file: files,
      })
      .from(doctorCredentials)
      .leftJoin(files, eq(doctorCredentials.fileId, files.id))
      .where(eq(doctorCredentials.doctorId, doctorId))
      .orderBy(desc(doctorCredentials.uploadedAt));
  }

  async updateCredentialStatus(
    credentialId: string,
    verificationStatus: 'pending' | 'verified' | 'rejected'
  ) {
    return await this.db
      .update(doctorCredentials)
      .set({ verificationStatus })
      .where(eq(doctorCredentials.id, credentialId))
      .returning();
  }

  // Doctor Specialties
  async addSpecialty(specialtyData: CreateDoctorSpecialtyData, doctorId: string) {
    return await this.db
      .insert(doctorSpecialties)
      .values({
        doctorId,
        specialtyId: specialtyData.specialtyId,
        isPrimary: specialtyData.isPrimary || false,
        yearsOfExperience: specialtyData.yearsOfExperience || 0,
      })
      .returning();
  }

  async getDoctorSpecialties(doctorId: string) {
    return await this.db
      .select({
        doctorSpecialty: doctorSpecialties,
        specialty: specialties,
      })
      .from(doctorSpecialties)
      .leftJoin(specialties, eq(doctorSpecialties.specialtyId, specialties.id))
      .where(eq(doctorSpecialties.doctorId, doctorId))
      .orderBy(desc(doctorSpecialties.isPrimary));
  }

  async removeSpecialty(doctorId: string, specialtyId: string) {
    return await this.db
      .delete(doctorSpecialties)
      .where(and(
        eq(doctorSpecialties.doctorId, doctorId),
        eq(doctorSpecialties.specialtyId, specialtyId)
      ))
      .returning();
  }

  // Availability templates
  async createAvailabilityTemplate(templateData: CreateAvailabilityTemplateData, doctorId: string) {
    const [template] = await this.db
      .insert(availabilityTemplates)
      .values({
        doctorId,
        templateName: templateData.templateName,
        startTime: templateData.startTime,
        endTime: templateData.endTime,
        recurrencePattern: templateData.recurrencePattern,
        recurrenceDays: templateData.recurrenceDays?.length ? templateData.recurrenceDays.join(',') : null,
        validFrom: templateData.validFrom,
        validUntil: templateData.validUntil ?? null,
        slotType: templateData.slotType || 'hospital',
      })
      .returning();

    return this.mapTemplateRow(template);
  }

  async getAvailabilityTemplates(doctorId: string) {
    const templates = await this.db
      .select()
      .from(availabilityTemplates)
      .where(eq(availabilityTemplates.doctorId, doctorId))
      .orderBy(asc(availabilityTemplates.validFrom), asc(availabilityTemplates.startTime));

    return templates
      .map((row: any) => this.mapTemplateRow(row))
      .filter(Boolean) as Array<AvailabilityTemplateRow & { recurrenceDays: string[] }>;
  }

  async getAvailabilityTemplateById(templateId: string) {
    const [template] = await this.db
      .select()
      .from(availabilityTemplates)
      .where(eq(availabilityTemplates.id, templateId))
      .limit(1);

    return this.mapTemplateRow(template);
  }

  async updateAvailabilityTemplate(templateId: string, doctorId: string, updateData: UpdateAvailabilityTemplateData) {
    const updateFields: Record<string, any> = {};

    if (updateData.templateName !== undefined) updateFields.templateName = updateData.templateName;
    if (updateData.startTime !== undefined) updateFields.startTime = updateData.startTime;
    if (updateData.endTime !== undefined) updateFields.endTime = updateData.endTime;
    if (updateData.recurrencePattern !== undefined) updateFields.recurrencePattern = updateData.recurrencePattern;
    if (updateData.recurrenceDays !== undefined) {
      updateFields.recurrenceDays = updateData.recurrenceDays.length ? updateData.recurrenceDays.join(',') : null;
    }
    if (updateData.validFrom !== undefined) updateFields.validFrom = updateData.validFrom;
    if (updateData.validUntil !== undefined) updateFields.validUntil = updateData.validUntil ?? null;
    if (updateData.slotType !== undefined) updateFields.slotType = updateData.slotType;

    const [template] = await this.db
      .update(availabilityTemplates)
      .set(updateFields)
      .where(and(
        eq(availabilityTemplates.id, templateId),
        eq(availabilityTemplates.doctorId, doctorId)
      ))
      .returning();

    return this.mapTemplateRow(template);
  }

  async deleteAvailabilityTemplate(templateId: string, doctorId: string) {
    const [template] = await this.db
      .delete(availabilityTemplates)
      .where(and(
        eq(availabilityTemplates.id, templateId),
        eq(availabilityTemplates.doctorId, doctorId)
      ))
      .returning();

    return this.mapTemplateRow(template);
  }

  async getTemplatesActiveBetween(startDate: string, endDate: string) {
    const templates = await this.db
      .select()
      .from(availabilityTemplates)
      .where(and(
        lte(availabilityTemplates.validFrom, endDate),
        or(
          isNull(availabilityTemplates.validUntil),
          gte(availabilityTemplates.validUntil, startDate)
        )
      ));

    return templates
      .map((row: any) => this.mapTemplateRow(row))
      .filter(Boolean) as Array<AvailabilityTemplateRow & { recurrenceDays: string[] }>;
  }

  // Doctor Availability
  async createAvailability(availabilityData: CreateDoctorAvailabilityData, doctorId: string) {
    return await this.db
      .insert(doctorAvailability)
      .values({
        doctorId,
        slotDate: availabilityData.slotDate,
        startTime: availabilityData.startTime,
        endTime: availabilityData.endTime,
        templateId: availabilityData.templateId,
        status: availabilityData.status || 'available',
        slotType: availabilityData.slotType || 'hospital',
        isManual: availabilityData.isManual ?? false,
        notes: availabilityData.notes,
        parentSlotId: availabilityData.parentSlotId ?? null, // NULL for parent slots
      })
      .returning();
  }

  async getDoctorAvailability(doctorId: string) {
    return await this.db
      .select()
      .from(doctorAvailability)
      .where(eq(doctorAvailability.doctorId, doctorId))
      .orderBy(asc(doctorAvailability.slotDate), asc(doctorAvailability.startTime));
  }

  async getAvailabilityById(id: string) {
    const [slot] = await this.db
      .select()
      .from(doctorAvailability)
      .where(eq(doctorAvailability.id, id))
      .limit(1);
    return slot || null;
  }

  async updateAvailability(id: string, updateData: Partial<CreateDoctorAvailabilityData>) {
    return await this.db
      .update(doctorAvailability)
      .set(updateData)
      .where(eq(doctorAvailability.id, id))
      .returning();
  }

  async deleteAvailability(id: string) {
    return await this.db
      .delete(doctorAvailability)
      .where(eq(doctorAvailability.id, id))
      .returning();
  }

  async hasAvailabilityOverlap(
    doctorId: string,
    slotDate: string,
    startTime: string,
    endTime: string,
    excludeAvailabilityId?: string
  ) {
    let condition = and(
      eq(doctorAvailability.doctorId, doctorId),
      eq(doctorAvailability.slotDate, slotDate),
      isNull(doctorAvailability.parentSlotId), // Only check parent slots (not sub-slots)
      lt(doctorAvailability.startTime, endTime),
      gt(doctorAvailability.endTime, startTime)
    );

    if (excludeAvailabilityId) {
      condition = and(condition, ne(doctorAvailability.id, excludeAvailabilityId));
    }

    const [result] = await this.db
      .select({ id: doctorAvailability.id })
      .from(doctorAvailability)
      .where(condition)
      .limit(1);

    return !!result;
  }

  async hasExactAvailabilitySlot(
    doctorId: string,
    slotDate: string,
    startTime: string,
    endTime: string,
    templateId: string
  ) {
    const [result] = await this.db
      .select({ id: doctorAvailability.id })
      .from(doctorAvailability)
      .where(
        and(
          eq(doctorAvailability.doctorId, doctorId),
          eq(doctorAvailability.slotDate, slotDate),
          eq(doctorAvailability.startTime, startTime),
          eq(doctorAvailability.endTime, endTime),
          eq(doctorAvailability.templateId, templateId),
          isNull(doctorAvailability.parentSlotId) // Only check parent slots (not sub-slots)
        )
      )
      .limit(1);

    return !!result;
  }

  /**
   * Get parent slot by ID
   */
  async getParentSlot(parentSlotId: string) {
    const [result] = await this.db
      .select()
      .from(doctorAvailability)
      .where(
        and(
          eq(doctorAvailability.id, parentSlotId),
          isNull(doctorAvailability.parentSlotId) // Must be a parent slot
        )
      )
      .limit(1);
    
    return result || null;
  }

  /**
   * Check if sub-slot time range fits within parent slot
   */
  fitsWithinParent(
    parentStartTime: string,
    parentEndTime: string,
    subStartTime: string,
    subEndTime: string
  ): boolean {
    // Parse times (format: "HH:mm")
    const parseTime = (timeStr: string): number => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes; // Convert to minutes from midnight
    };

    const parentStart = parseTime(parentStartTime);
    const parentEnd = parseTime(parentEndTime);
    const subStart = parseTime(subStartTime);
    const subEnd = parseTime(subEndTime);

    // Sub-slot must start at or after parent start
    // Sub-slot must end at or before parent end
    return subStart >= parentStart && subEnd <= parentEnd && subStart < subEnd;
  }

  /**
   * Check for overlapping sub-slots within the same parent
   */
  async hasOverlappingSubSlots(
    parentSlotId: string,
    startTime: string,
    endTime: string,
    excludeSubSlotId?: string
  ): Promise<boolean> {
    let condition = and(
      eq(doctorAvailability.parentSlotId, parentSlotId),
      lt(doctorAvailability.startTime, endTime),
      gt(doctorAvailability.endTime, startTime)
    );

    if (excludeSubSlotId) {
      condition = and(condition, ne(doctorAvailability.id, excludeSubSlotId));
    }

    const [result] = await this.db
      .select({ id: doctorAvailability.id })
      .from(doctorAvailability)
      .where(condition)
      .limit(1);

    return !!result;
  }

  /**
   * Get all booked sub-slots for a parent slot
   */
  async getSubSlotsByParent(parentSlotId: string) {
    return await this.db
      .select()
      .from(doctorAvailability)
      .where(eq(doctorAvailability.parentSlotId, parentSlotId))
      .orderBy(asc(doctorAvailability.startTime));
  }

  /**
   * Check if a slot has any booked child slots (for parent slots)
   */
  async hasBookedChildSlots(slotId: string): Promise<boolean> {
    const [result] = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(doctorAvailability)
      .where(
        and(
          eq(doctorAvailability.parentSlotId, slotId),
          eq(doctorAvailability.status, 'booked')
        )
      );

    return Number(result?.count || 0) > 0;
  }

  /**
   * Calculate available time ranges for a parent slot
   * Returns array of {startTime, endTime} objects
   */
  async getAvailableRanges(parentSlotId: string): Promise<Array<{startTime: string, endTime: string}>> {
    const parent = await this.getParentSlot(parentSlotId);
    if (!parent) {
      return [];
    }

    // Get all booked sub-slots
    const subSlots = await this.getSubSlotsByParent(parentSlotId);
    
    // Parse times to minutes
    const parseTime = (timeStr: string): number => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const formatTime = (minutes: number): string => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    };

    const parentStart = parseTime(parent.startTime);
    const parentEnd = parseTime(parent.endTime);

    // Sort sub-slots by start time
    const bookedRanges = subSlots
      .map((slot: any) => ({
        start: parseTime(slot.startTime),
        end: parseTime(slot.endTime)
      }))
      .sort((a: any, b: any) => a.start - b.start);

    // Calculate available ranges
    const availableRanges: Array<{startTime: string, endTime: string}> = [];
    let currentStart = parentStart;

    for (const booked of bookedRanges) {
      // If there's a gap before this booked slot, it's available
      if (currentStart < booked.start) {
        availableRanges.push({
          startTime: formatTime(currentStart),
          endTime: formatTime(booked.start)
        });
      }
      // Move currentStart to end of booked slot
      currentStart = Math.max(currentStart, booked.end);
    }

    // If there's remaining time after last booked slot
    if (currentStart < parentEnd) {
      availableRanges.push({
        startTime: formatTime(currentStart),
        endTime: formatTime(parentEnd)
      });
    }

    return availableRanges;
  }

  // Doctor Leaves (replaces doctorUnavailability)
  async createUnavailability(unavailabilityData: CreateDoctorUnavailabilityData, doctorId: string) {
    // Use doctorLeaves table instead of doctorUnavailability
    return await this.db
      .insert(doctorLeaves)
      .values({
        doctorId,
        startDate: unavailabilityData.startDate,
        endDate: unavailabilityData.endDate,
        reason: unavailabilityData.reason,
        leaveType: unavailabilityData.leaveType || 'other',
      })
      .returning();
  }

  async updateUnavailability(id: string, doctorId: string, updateData: Partial<CreateDoctorUnavailabilityData>) {
    const updateFields: Record<string, any> = {};
    
    if (updateData.startDate !== undefined) updateFields.startDate = updateData.startDate;
    if (updateData.endDate !== undefined) updateFields.endDate = updateData.endDate;
    if (updateData.leaveType !== undefined) updateFields.leaveType = updateData.leaveType;
    if (updateData.reason !== undefined) updateFields.reason = updateData.reason;

    const [leave] = await this.db
      .update(doctorLeaves)
      .set(updateFields)
      .where(and(
        eq(doctorLeaves.id, id),
        eq(doctorLeaves.doctorId, doctorId)
      ))
      .returning();

    return leave;
  }

  async isDateOnLeave(doctorId: string, date: string): Promise<boolean> {
    const [leave] = await this.db
      .select({ id: doctorLeaves.id })
      .from(doctorLeaves)
      .where(and(
        eq(doctorLeaves.doctorId, doctorId),
        lte(doctorLeaves.startDate, date),
        gte(doctorLeaves.endDate, date)
      ))
      .limit(1);

    return !!leave;
  }

  async getDoctorUnavailability(doctorId: string) {
    // Use doctorLeaves table instead of doctorUnavailability
    return await this.db
      .select()
      .from(doctorLeaves)
      .where(eq(doctorLeaves.doctorId, doctorId))
      .orderBy(desc(doctorLeaves.startDate));
  }

  async deleteUnavailability(id: string) {
    // Use doctorLeaves table instead of doctorUnavailability
    return await this.db
      .delete(doctorLeaves)
      .where(eq(doctorLeaves.id, id))
      .returning();
  }

  // Statistics
  async getDoctorStats(doctorId: string) {
    // Schema maps totalBookings to completed_assignments column
    const result = await this.db
      .select({
        totalBookings: doctors.completedAssignments, // Maps to completed_assignments in DB
        averageRating: doctors.averageRating,
        totalRatings: doctors.totalRatings,
      })
      .from(doctors)
      .where(eq(doctors.id, doctorId))
      .limit(1);

    return result[0] || null;
  }

  // Doctor Profile Photos
  async getDoctorProfilePhotos(doctorId: string) {
    return await this.db
      .select({
        id: doctorProfilePhotos.id,
        doctorId: doctorProfilePhotos.doctorId,
        fileId: doctorProfilePhotos.fileId,
        isPrimary: doctorProfilePhotos.isPrimary,
        uploadedAt: doctorProfilePhotos.uploadedAt,
        file: {
          id: files.id,
          filename: files.filename,
          url: files.url,
          mimetype: files.mimetype,
          size: files.size,
        },
      })
      .from(doctorProfilePhotos)
      .leftJoin(files, eq(doctorProfilePhotos.fileId, files.id))
      .where(eq(doctorProfilePhotos.doctorId, doctorId))
      .orderBy(desc(doctorProfilePhotos.isPrimary), desc(doctorProfilePhotos.uploadedAt));
  }

  async addProfilePhoto(doctorId: string, fileId: string, isPrimary: boolean = false) {
    return await this.db.transaction(async (tx:any) => {
      // If setting as primary, unset all other primary photos first
      if (isPrimary) {
        await tx
          .update(doctorProfilePhotos)
          .set({ isPrimary: false })
          .where(eq(doctorProfilePhotos.doctorId, doctorId));
      }

      return await tx
        .insert(doctorProfilePhotos)
        .values({ doctorId, fileId, isPrimary })
        .returning();
    });
  }

  async setPrimaryPhoto(doctorId: string, photoId: string) {
    return await this.db.transaction(async (tx:any) => {
      // Unset all primary photos, then set the selected one
      await tx
        .update(doctorProfilePhotos)
        .set({ isPrimary: false })
        .where(eq(doctorProfilePhotos.doctorId, doctorId));

      return await tx
        .update(doctorProfilePhotos)
        .set({ isPrimary: true })
        .where(and(
          eq(doctorProfilePhotos.id, photoId),
          eq(doctorProfilePhotos.doctorId, doctorId)
        ))
        .returning();
    });
  }

  async deleteProfilePhoto(photoId: string, doctorId: string) {
    return await this.db
      .delete(doctorProfilePhotos)
      .where(and(
        eq(doctorProfilePhotos.id, photoId),
        eq(doctorProfilePhotos.doctorId, doctorId)
      ))
      .returning();
  }
}


