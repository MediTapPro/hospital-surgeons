import { getDb } from '@/lib/db';
import type { VerificationProviderType, VerificationStatus } from '@/lib/enums/verification.enums';
import {
  auditLogs,
  doctorCredentials,
  doctorSpecialties,
  doctors,
  files,
  hospitalDepartments,
  hospitalDocuments,
  hospitals,
  specialties,
  users,
} from '@/src/db/drizzle/migrations/schema';
import { and, asc, desc, eq, like, or, sql } from 'drizzle-orm';

export class ProviderVerificationsRepository {
  constructor(private readonly db: any = getDb()) {}

  async findProvider(providerType: VerificationProviderType, providerId: string) {
    if (providerType === 'doctor') {
      const [doctor] = await this.db
        .select({
          id: doctors.id,
          userId: doctors.userId,
          name: doctors.firstName,
          lastName: doctors.lastName,
          registrationNumber: doctors.medicalLicenseNumber,
          verificationStatus: doctors.licenseVerificationStatus,
          email: users.email,
        })
        .from(doctors)
        .leftJoin(users, eq(doctors.userId, users.id))
        .where(eq(doctors.id, providerId))
        .limit(1);

      return doctor
        ? { ...doctor, name: `Dr. ${doctor.name} ${doctor.lastName}`, entityName: doctor.name }
        : null;
    }

    const [hospital] = await this.db
      .select({
        id: hospitals.id,
        userId: hospitals.userId,
        name: hospitals.name,
        registrationNumber: hospitals.registrationNumber,
        verificationStatus: hospitals.licenseVerificationStatus,
        email: users.email,
      })
      .from(hospitals)
      .leftJoin(users, eq(hospitals.userId, users.id))
      .where(eq(hospitals.id, providerId))
      .limit(1);

    return hospital ? { ...hospital, entityName: hospital.name } : null;
  }

  async updateStatus(providerType: VerificationProviderType, providerId: string, status: VerificationStatus) {
    if (providerType === 'doctor') {
      const [doctor] = await this.db
        .update(doctors)
        .set({ licenseVerificationStatus: status })
        .where(eq(doctors.id, providerId))
        .returning({ id: doctors.id, verificationStatus: doctors.licenseVerificationStatus });
      return doctor;
    }

    const [hospital] = await this.db
      .update(hospitals)
      .set({ licenseVerificationStatus: status })
      .where(eq(hospitals.id, providerId))
      .returning({ id: hospitals.id, verificationStatus: hospitals.licenseVerificationStatus });
    return hospital;
  }

  async activatePendingProviderUser(userId: string) {
    const [user] = await this.db
      .update(users)
      .set({ status: 'active', updatedAt: new Date().toISOString() })
      .where(and(eq(users.id, userId), eq(users.status, 'pending')))
      .returning({ id: users.id, status: users.status });

    return user ?? null;
  }

  async createAuditLog(values: {
    userId: string;
    action: 'verify' | 'reject';
    entityType: VerificationProviderType;
    entityId: string;
    details: Record<string, unknown>;
  }) {
    await this.db.insert(auditLogs).values({
      userId: values.userId,
      actorType: 'admin',
      action: values.action,
      entityType: values.entityType,
      entityId: values.entityId,
      details: values.details,
      createdAt: new Date().toISOString(),
    });
  }

  async findDoctorCredential(credentialId: string) {
    const [credential] = await this.db
      .select({
        id: doctorCredentials.id,
        doctorId: doctorCredentials.doctorId,
        title: doctorCredentials.title,
        credentialType: doctorCredentials.credentialType,
        institution: doctorCredentials.institution,
        verificationStatus: doctorCredentials.verificationStatus,
      })
      .from(doctorCredentials)
      .where(eq(doctorCredentials.id, credentialId))
      .limit(1);
    return credential ?? null;
  }

  async updateDoctorCredentialStatus(credentialId: string, verificationStatus: VerificationStatus) {
    const [credential] = await this.db
      .update(doctorCredentials)
      .set({ verificationStatus })
      .where(eq(doctorCredentials.id, credentialId))
      .returning({
        id: doctorCredentials.id,
        doctorId: doctorCredentials.doctorId,
        verificationStatus: doctorCredentials.verificationStatus,
      });
    return credential;
  }

  async listDoctors(filter: {
    status?: VerificationStatus;
    search?: string;
    page: number;
    limit: number;
    sortOrder: 'asc' | 'desc';
  }) {
    const conditions: any[] = [];
    if (filter.status) conditions.push(eq(doctors.licenseVerificationStatus, filter.status));
    if (filter.search) {
      conditions.push(or(
        like(doctors.firstName, `%${filter.search}%`),
        like(doctors.lastName, `%${filter.search}%`),
        like(doctors.medicalLicenseNumber, `%${filter.search}%`),
      ));
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [countResult, rows] = await Promise.all([
      this.db.select({ count: sql<number>`count(*)` }).from(doctors).where(where),
      this.db
        .select({
          id: doctors.id,
          userId: doctors.userId,
          firstName: doctors.firstName,
          lastName: doctors.lastName,
          medicalLicenseNumber: doctors.medicalLicenseNumber,
          licenseVerificationStatus: doctors.licenseVerificationStatus,
          yearsOfExperience: doctors.yearsOfExperience,
          primaryLocation: doctors.primaryLocation,
          averageRating: doctors.averageRating,
          totalRatings: doctors.totalRatings,
          email: users.email,
          phone: users.phone,
          createdAt: users.createdAt,
          credentialsCount: sql<number>`(SELECT COUNT(*)::int FROM doctor_credentials WHERE doctor_id = ${doctors.id})`,
          pendingCredentialsCount: sql<number>`(SELECT COUNT(*)::int FROM doctor_credentials WHERE doctor_id = ${doctors.id} AND verification_status = 'pending')`,
        })
        .from(doctors)
        .leftJoin(users, eq(doctors.userId, users.id))
        .where(where)
        .orderBy(filter.sortOrder === 'asc' ? asc(users.createdAt) : desc(users.createdAt))
        .limit(filter.limit)
        .offset((filter.page - 1) * filter.limit),
    ]);
    return { rows, total: Number(countResult[0]?.count ?? 0) };
  }

  async listHospitals(filter: {
    status?: VerificationStatus;
    search?: string;
    page: number;
    limit: number;
    sortOrder: 'asc' | 'desc';
  }) {
    const conditions: any[] = [];
    if (filter.status) conditions.push(eq(hospitals.licenseVerificationStatus, filter.status));
    if (filter.search) {
      conditions.push(or(
        like(hospitals.name, `%${filter.search}%`),
        like(hospitals.registrationNumber, `%${filter.search}%`),
        like(hospitals.city, `%${filter.search}%`),
      ));
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [countResult, rows] = await Promise.all([
      this.db.select({ count: sql<number>`count(*)` }).from(hospitals).where(where),
      this.db
        .select({
          id: hospitals.id,
          userId: hospitals.userId,
          name: hospitals.name,
          registrationNumber: hospitals.registrationNumber,
          licenseVerificationStatus: hospitals.licenseVerificationStatus,
          hospitalType: hospitals.hospitalType,
          address: hospitals.address,
          city: hospitals.city,
          numberOfBeds: hospitals.numberOfBeds,
          contactEmail: hospitals.contactEmail,
          contactPhone: hospitals.contactPhone,
          email: users.email,
          phone: users.phone,
          createdAt: users.createdAt,
          documentsCount: sql<number>`(SELECT COUNT(*)::int FROM hospital_documents WHERE hospital_id = ${hospitals.id})`,
          pendingDocumentsCount: sql<number>`(SELECT COUNT(*)::int FROM hospital_documents WHERE hospital_id = ${hospitals.id} AND verification_status = 'pending')`,
        })
        .from(hospitals)
        .leftJoin(users, eq(hospitals.userId, users.id))
        .where(where)
        .orderBy(filter.sortOrder === 'asc' ? asc(users.createdAt) : desc(users.createdAt))
        .limit(filter.limit)
        .offset((filter.page - 1) * filter.limit),
    ]);
    return { rows, total: Number(countResult[0]?.count ?? 0) };
  }

  async getDoctorDetails(doctorId: string) {
    const [doctor] = await this.db
      .select({
        id: doctors.id, userId: doctors.userId, firstName: doctors.firstName, lastName: doctors.lastName,
        medicalLicenseNumber: doctors.medicalLicenseNumber, licenseVerificationStatus: doctors.licenseVerificationStatus,
        yearsOfExperience: doctors.yearsOfExperience, bio: doctors.bio, primaryLocation: doctors.primaryLocation,
        latitude: doctors.latitude, longitude: doctors.longitude, averageRating: doctors.averageRating,
        totalRatings: doctors.totalRatings, completedAssignments: doctors.completedAssignments, email: users.email,
        phone: users.phone, emailVerified: users.emailVerified, phoneVerified: users.phoneVerified, createdAt: users.createdAt,
      })
      .from(doctors).leftJoin(users, eq(doctors.userId, users.id)).where(eq(doctors.id, doctorId)).limit(1);
    if (!doctor) return null;

    const [credentials, specialtiesRows, history] = await Promise.all([
      this.db.select({ id: doctorCredentials.id, credentialType: doctorCredentials.credentialType, title: doctorCredentials.title, institution: doctorCredentials.institution, verificationStatus: doctorCredentials.verificationStatus, uploadedAt: doctorCredentials.uploadedAt, fileId: doctorCredentials.fileId, filename: files.filename, url: files.url, mimetype: files.mimetype, size: files.size }).from(doctorCredentials).leftJoin(files, eq(doctorCredentials.fileId, files.id)).where(eq(doctorCredentials.doctorId, doctorId)).orderBy(desc(doctorCredentials.uploadedAt)),
      this.db.select({ specialtyId: doctorSpecialties.specialtyId, specialtyName: specialties.name, isPrimary: doctorSpecialties.isPrimary, yearsOfExperience: doctorSpecialties.yearsOfExperience }).from(doctorSpecialties).leftJoin(specialties, eq(doctorSpecialties.specialtyId, specialties.id)).where(eq(doctorSpecialties.doctorId, doctorId)),
      this.db.execute(sql`SELECT * FROM audit_logs WHERE entity_type = 'doctor' AND entity_id = ${doctorId} AND action IN ('verify', 'reject', 'verification_requested') ORDER BY created_at DESC LIMIT 20`),
    ]);
    return { doctor, credentials, specialtiesRows, history: history.rows || [] };
  }

  async getHospitalDetails(hospitalId: string) {
    const [hospital] = await this.db
      .select({
        id: hospitals.id, userId: hospitals.userId, name: hospitals.name, registrationNumber: hospitals.registrationNumber,
        licenseVerificationStatus: hospitals.licenseVerificationStatus, hospitalType: hospitals.hospitalType,
        address: hospitals.address, city: hospitals.city, latitude: hospitals.latitude, longitude: hospitals.longitude,
        numberOfBeds: hospitals.numberOfBeds, contactEmail: hospitals.contactEmail, contactPhone: hospitals.contactPhone,
        websiteUrl: hospitals.websiteUrl, email: users.email, phone: users.phone, emailVerified: users.emailVerified,
        phoneVerified: users.phoneVerified, createdAt: users.createdAt,
      })
      .from(hospitals).leftJoin(users, eq(hospitals.userId, users.id)).where(eq(hospitals.id, hospitalId)).limit(1);
    if (!hospital) return null;

    const [documents, departments, history] = await Promise.all([
      this.db.select({ id: hospitalDocuments.id, documentType: hospitalDocuments.documentType, verificationStatus: hospitalDocuments.verificationStatus, uploadedAt: hospitalDocuments.uploadedAt, fileId: hospitalDocuments.fileId, filename: files.filename, url: files.url, mimetype: files.mimetype, size: files.size }).from(hospitalDocuments).leftJoin(files, eq(hospitalDocuments.fileId, files.id)).where(eq(hospitalDocuments.hospitalId, hospitalId)).orderBy(desc(hospitalDocuments.uploadedAt)),
      this.db.select({ specialtyId: hospitalDepartments.specialtyId, specialtyName: specialties.name }).from(hospitalDepartments).leftJoin(specialties, eq(hospitalDepartments.specialtyId, specialties.id)).where(eq(hospitalDepartments.hospitalId, hospitalId)),
      this.db.execute(sql`SELECT * FROM audit_logs WHERE entity_type = 'hospital' AND entity_id = ${hospitalId} AND action IN ('verify', 'reject', 'verification_requested') ORDER BY created_at DESC LIMIT 20`),
    ]);
    return { hospital, documents, departments, history: history.rows || [] };
  }
}
