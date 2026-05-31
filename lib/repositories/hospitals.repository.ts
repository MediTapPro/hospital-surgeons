import { getDb } from '@/lib/db';
import { 
  hospitals, 
  hospitalDepartments,
  hospitalDocuments,
  // hospitalStaff, // Not in database - use doctorHospitalAffiliations instead
  // hospitalFavoriteDoctors, // Not in database
  users,
  specialties,
  doctors,
  assignments, // Use assignments instead of bookings
  files
} from '@/src/db/drizzle/migrations/schema';
import { eq, and, desc, asc, count, inArray } from 'drizzle-orm';

export interface CreateHospitalData {
  name: string;
  hospitalType?: string;
  registrationNumber: string;
  address: string;
  city: string;
  fullAddress?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  website?: string;
  logoId?: string; // UUID reference to files table
  numberOfBeds?: number;
  latitude?: number;
  longitude?: number;
  contactEmail?: string;
}

export interface CreateHospitalDepartmentData {
  specialtyId: string;
  isActive?: boolean;
}

export interface CreateHospitalDocumentData {
  fileId: string;
  documentType: 'license' | 'accreditation' | 'insurance' | 'other';
}

export interface CreateHospitalStaffData {
  userId: string;
  role: string;
  isActive?: boolean;
}

export interface CreateFavoriteDoctorData {
  doctorId: string;
}

export interface HospitalQuery {
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'rating' | 'beds' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export class HospitalsRepository {
  private db = getDb();

  async createHospital(hospitalData: CreateHospitalData, userId: string) {
    try {
      const values: any = {
        userId,
        name: hospitalData.name,
        registrationNumber: hospitalData.registrationNumber,
        address: hospitalData.address,
        city: hospitalData.city,
      };

      if (hospitalData.hospitalType) values.hospitalType = hospitalData.hospitalType;
      // Map phone → contactPhone
      if (hospitalData.phone) values.contactPhone = hospitalData.phone;
      // Map website → websiteUrl
      if (hospitalData.website) values.websiteUrl = hospitalData.website;
      // Map profilePhotoUrl → logoId (UUID reference)
      if (hospitalData.logoId) values.logoId = hospitalData.logoId;
      if (hospitalData.numberOfBeds) values.numberOfBeds = hospitalData.numberOfBeds;
      if (hospitalData.latitude !== undefined) values.latitude = hospitalData.latitude.toString();
      if (hospitalData.longitude !== undefined) values.longitude = hospitalData.longitude.toString();
      if (hospitalData.contactEmail) values.contactEmail = hospitalData.contactEmail;

      return await this.db
        .insert(hospitals)
        .values(values)
        .returning();
    } catch (error) {
      console.error('Error creating hospital:', error);
      throw error;
    }
  }

  async findHospitalById(id: string) {
    const result = await this.db
      .select({
        hospital: hospitals,
        user: users,
      })
      .from(hospitals)
      .leftJoin(users, eq(hospitals.userId, users.id))
      .where(eq(hospitals.id, id))
      .limit(1);

    return result[0] || null;
  }

  async findHospitalByUserId(userId: string) {
    const result = await this.db
      .select()
      .from(hospitals)
      .where(eq(hospitals.userId, userId))
      .limit(1);

    return result[0] || null;
  }

  async findHospitals(query: HospitalQuery) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const offset = (page - 1) * limit;

    let orderByClause;
    if (query.sortBy === 'createdAt') {
      // Hospitals table doesn't have createdAt, use users.createdAt via join or remove this sort option
      orderByClause = query.sortOrder === 'asc' ? asc(hospitals.id) : desc(hospitals.id);
    } else if (query.sortBy === 'rating') {
      // Hospitals table doesn't have averageRating, use name as fallback
      orderByClause = query.sortOrder === 'asc' ? asc(hospitals.name) : desc(hospitals.name);
    } else if (query.sortBy === 'beds') {
      orderByClause = query.sortOrder === 'asc' ? asc(hospitals.numberOfBeds) : desc(hospitals.numberOfBeds);
    } else {
      orderByClause = query.sortOrder === 'asc' ? asc(hospitals.name) : desc(hospitals.name);
    }

    return await this.db
      .select({
        hospital: hospitals,
        user: users,
      })
      .from(hospitals)
      .leftJoin(users, eq(hospitals.userId, users.id))
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);
  }

  async updateHospital(id: string, updateData: Partial<CreateHospitalData>) {
    const updateFields: any = {};
    
    if (updateData.name) updateFields.name = updateData.name;
    if (updateData.hospitalType) updateFields.hospitalType = updateData.hospitalType;
    if (updateData.registrationNumber) updateFields.registrationNumber = updateData.registrationNumber;
    if (updateData.address) updateFields.address = updateData.address;
    if (updateData.city) updateFields.city = updateData.city;
    if (updateData.fullAddress !== undefined) updateFields.fullAddress = updateData.fullAddress;
    if (updateData.state !== undefined) updateFields.state = updateData.state;
    if (updateData.pincode !== undefined) updateFields.pincode = updateData.pincode;
    // Map phone → contactPhone
    if (updateData.phone) updateFields.contactPhone = updateData.phone;
    // Map website → websiteUrl
    if (updateData.website) updateFields.websiteUrl = updateData.website;
    // Map profilePhotoUrl → logoId
    if (updateData.logoId) updateFields.logoId = updateData.logoId;
    if (updateData.numberOfBeds !== undefined) updateFields.numberOfBeds = updateData.numberOfBeds;
    if (updateData.latitude !== undefined) updateFields.latitude = updateData.latitude.toString();
    if (updateData.longitude !== undefined) updateFields.longitude = updateData.longitude.toString();
    if (updateData.contactEmail) updateFields.contactEmail = updateData.contactEmail;

    return await this.db
      .update(hospitals)
      .set(updateFields)
      .where(eq(hospitals.id, id))
      .returning();
  }

  async deleteHospital(id: string) {
    return await this.db
      .delete(hospitals)
      .where(eq(hospitals.id, id))
      .returning();
  }

  // Hospital Departments
  async addDepartment(departmentData: CreateHospitalDepartmentData, hospitalId: string) {
    return await this.db
      .insert(hospitalDepartments)
      .values({
        hospitalId,
        specialtyId: departmentData.specialtyId,
      })
      .returning();
  }

  async getHospitalDepartments(hospitalId: string) {
    return await this.db
      .select({
        department: hospitalDepartments,
        specialty: specialties,
      })
      .from(hospitalDepartments)
      .leftJoin(specialties, eq(hospitalDepartments.specialtyId, specialties.id))
      .where(eq(hospitalDepartments.hospitalId, hospitalId))
      .orderBy(asc(specialties.name));
  }

  async updateDepartment(departmentId: string, updateData: Partial<CreateHospitalDepartmentData>) {
    const updateFields: any = {};
    
    if (updateData.specialtyId) updateFields.specialtyId = updateData.specialtyId;
    if (updateData.isActive !== undefined) updateFields.isActive = updateData.isActive;

    return await this.db
      .update(hospitalDepartments)
      .set(updateFields)
      .where(eq(hospitalDepartments.id, departmentId))
      .returning();
  }

  async deleteDepartment(departmentId: string) {
    return await this.db
      .delete(hospitalDepartments)
      .where(eq(hospitalDepartments.id, departmentId))
      .returning();
  }

  // Hospital Staff - Using doctorHospitalAffiliations (not in database schema)
  // Note: hospitalStaff table doesn't exist in database
  // TODO: Implement using doctorHospitalAffiliations or create new table
  async addStaff(staffData: CreateHospitalStaffData, hospitalId: string) {
    // Table doesn't exist in database - return error or implement alternative
    throw new Error('hospitalStaff table not found in database. Use doctorHospitalAffiliations instead.');
  }

  async getHospitalStaff(hospitalId: string) {
    // Table doesn't exist in database
    throw new Error('hospitalStaff table not found in database. Use doctorHospitalAffiliations instead.');
  }

  async updateStaff(staffId: string, updateData: Partial<CreateHospitalStaffData>) {
    // Table doesn't exist in database
    throw new Error('hospitalStaff table not found in database. Use doctorHospitalAffiliations instead.');
  }

  async deleteStaff(staffId: string) {
    // Table doesn't exist in database
    throw new Error('hospitalStaff table not found in database. Use doctorHospitalAffiliations instead.');
  }

  // Hospital Favorite Doctors - Using hospitalPreferences.preferredDoctorIds array
  async addFavoriteDoctor(favoriteData: CreateFavoriteDoctorData, hospitalId: string) {
    const db = getDb();
    const { hospitalPreferences } = await import('@/src/db/drizzle/migrations/schema');
    
    // Get existing preferences or create new record
    const existing = await db
      .select()
      .from(hospitalPreferences)
      .where(eq(hospitalPreferences.hospitalId, hospitalId))
      .limit(1);

    const currentFavoriteIds = existing[0]?.preferredDoctorIds || [];
    
    // Check if doctor is already in favorites
    if (currentFavoriteIds.includes(favoriteData.doctorId)) {
      // Already exists, just return
      return [];
    }

    // Add doctor ID to array
    const updatedFavoriteIds = [...currentFavoriteIds, favoriteData.doctorId];

    if (existing.length > 0) {
      // Update existing record
      return await db
        .update(hospitalPreferences)
        .set({ preferredDoctorIds: updatedFavoriteIds })
        .where(eq(hospitalPreferences.hospitalId, hospitalId))
        .returning();
    } else {
      // Create new record
      return await db
        .insert(hospitalPreferences)
        .values({
          hospitalId,
          preferredDoctorIds: updatedFavoriteIds,
        })
        .returning();
    }
  }

  async getHospitalFavoriteDoctors(hospitalId: string) {
    const db = getDb();
    const { hospitalPreferences, doctors, users } = await import('@/src/db/drizzle/migrations/schema');
    
    // Get hospital preferences
    const preferences = await db
      .select()
      .from(hospitalPreferences)
      .where(eq(hospitalPreferences.hospitalId, hospitalId))
      .limit(1);

    const favoriteDoctorIds = preferences[0]?.preferredDoctorIds || [];
    
    if (favoriteDoctorIds.length === 0) {
      return [];
    }

    // Fetch favorite doctors with their user info
    const favoriteDoctors = await db
      .select({
        id: doctors.id,
        userId: doctors.userId,
        firstName: doctors.firstName,
        lastName: doctors.lastName,
        medicalLicenseNumber: doctors.medicalLicenseNumber,
        yearsOfExperience: doctors.yearsOfExperience,
        bio: doctors.bio,
        profilePhotoId: doctors.profilePhotoId,
        averageRating: doctors.averageRating,
        totalRatings: doctors.totalRatings,
        completedAssignments: doctors.completedAssignments,
        licenseVerificationStatus: doctors.licenseVerificationStatus,
        primaryLocation: doctors.primaryLocation,
        fullAddress: doctors.fullAddress,
        city: doctors.city,
        state: doctors.state,
        pincode: doctors.pincode,
        latitude: doctors.latitude,
        longitude: doctors.longitude,
        email: users.email,
        phone: users.phone,
      })
      .from(doctors)
      .innerJoin(users, eq(doctors.userId, users.id))
      .where(inArray(doctors.id, favoriteDoctorIds));

    return favoriteDoctors;
  }

  async removeFavoriteDoctor(hospitalId: string, doctorId: string) {
    const db = getDb();
    const { hospitalPreferences } = await import('@/src/db/drizzle/migrations/schema');
    
    // Get existing preferences
    const existing = await db
      .select()
      .from(hospitalPreferences)
      .where(eq(hospitalPreferences.hospitalId, hospitalId))
      .limit(1);

    if (existing.length === 0) {
      // No preferences record, nothing to remove
      return [];
    }

    const currentFavoriteIds = existing[0].preferredDoctorIds || [];
    
    // Remove doctor ID from array
    const updatedFavoriteIds = currentFavoriteIds.filter((id: string) => id !== doctorId);

    // Update record
    return await db
      .update(hospitalPreferences)
      .set({ preferredDoctorIds: updatedFavoriteIds })
      .where(eq(hospitalPreferences.hospitalId, hospitalId))
      .returning();
  }

  // Hospital Documents
  async getHospitalDocuments(hospitalId: string) {
    return await this.db
      .select({
        id: hospitalDocuments.id,
        hospitalId: hospitalDocuments.hospitalId,
        fileId: hospitalDocuments.fileId,
        documentType: hospitalDocuments.documentType,
        verificationStatus: hospitalDocuments.verificationStatus,
        uploadedAt: hospitalDocuments.uploadedAt,
        file: {
          id: files.id,
          filename: files.filename,
          url: files.url,
          mimetype: files.mimetype,
          size: files.size,
        },
      })
      .from(hospitalDocuments)
      .leftJoin(files, eq(hospitalDocuments.fileId, files.id))
      .where(eq(hospitalDocuments.hospitalId, hospitalId))
      .orderBy(desc(hospitalDocuments.uploadedAt));
  }

  async addDocument(documentData: CreateHospitalDocumentData, hospitalId: string) {
    return await this.db
      .insert(hospitalDocuments)
      .values({
        hospitalId,
        fileId: documentData.fileId,
        documentType: documentData.documentType,
        verificationStatus: 'pending',
      })
      .returning();
  }

  async deleteDocument(documentId: string, hospitalId: string) {
    return await this.db
      .delete(hospitalDocuments)
      .where(and(
        eq(hospitalDocuments.id, documentId),
        eq(hospitalDocuments.hospitalId, hospitalId)
      ))
      .returning();
  }

  // Statistics
  async getHospitalStats(hospitalId: string) {
    const result = await this.db
      .select({
        hospital: hospitals,
        departmentCount: count(hospitalDepartments.id),
        // staffCount: count(hospitalStaff.id), // Table doesn't exist
        // favoriteDoctorCount: count(hospitalFavoriteDoctors.id), // Table doesn't exist
        bookingCount: count(assignments.id), // Use assignments instead of bookings
      })
      .from(hospitals)
      .leftJoin(hospitalDepartments, eq(hospitals.id, hospitalDepartments.hospitalId))
      // .leftJoin(hospitalStaff, eq(hospitals.id, hospitalStaff.hospitalId)) // Table doesn't exist
      // .leftJoin(hospitalFavoriteDoctors, eq(hospitals.id, hospitalFavoriteDoctors.hospitalId)) // Table doesn't exist
      .leftJoin(assignments, eq(hospitals.id, assignments.hospitalId)) // Use assignments instead of bookings
      .where(eq(hospitals.id, hospitalId))
      .groupBy(hospitals.id);

    return result[0] || null;
  }
}

