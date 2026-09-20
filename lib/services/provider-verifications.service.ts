import { getDb } from '@/lib/db';
import type { VerificationProviderType, VerificationStatus } from '@/lib/enums/verification.enums';
import { ProviderVerificationsRepository } from '@/lib/repositories/provider-verifications.repository';
import { auditLogs } from '@/src/db/drizzle/migrations/schema';

type UpdateProviderVerificationInput = {
  providerType: VerificationProviderType;
  providerId: string;
  verificationStatus: Extract<VerificationStatus, 'verified' | 'rejected'>;
  adminUserId: string;
  notes?: string | null;
  reason?: string;
  requestMetadata: { ipAddress?: string; userAgent?: string; endpoint?: string };
};

export class ProviderVerificationsService {
  private repository = new ProviderVerificationsRepository();

  async listDoctors(filter: {
    status?: VerificationStatus;
    search?: string;
    page: number;
    limit: number;
    sortOrder: 'asc' | 'desc';
  }) {
    const { rows, total } = await this.repository.listDoctors(filter);
    return {
      data: rows.map((doctor: any) => ({
        id: doctor.id,
        userId: doctor.userId,
        name: `Dr. ${doctor.firstName} ${doctor.lastName}`,
        firstName: doctor.firstName,
        lastName: doctor.lastName,
        email: doctor.email,
        phone: doctor.phone,
        medicalLicenseNumber: doctor.medicalLicenseNumber,
        licenseVerificationStatus: doctor.licenseVerificationStatus,
        yearsOfExperience: doctor.yearsOfExperience,
        primaryLocation: doctor.primaryLocation,
        averageRating: doctor.averageRating,
        totalRatings: doctor.totalRatings,
        credentialsCount: doctor.credentialsCount || 0,
        pendingCredentialsCount: doctor.pendingCredentialsCount || 0,
        createdAt: doctor.createdAt,
      })),
      pagination: { page: filter.page, limit: filter.limit, total, totalPages: Math.ceil(total / filter.limit) },
    };
  }

  async listHospitals(filter: {
    status?: VerificationStatus;
    search?: string;
    page: number;
    limit: number;
    sortOrder: 'asc' | 'desc';
  }) {
    const { rows, total } = await this.repository.listHospitals(filter);
    return {
      data: rows.map((hospital: any) => ({
        id: hospital.id,
        userId: hospital.userId,
        name: hospital.name,
        email: hospital.email || hospital.contactEmail,
        phone: hospital.phone || hospital.contactPhone,
        registrationNumber: hospital.registrationNumber,
        licenseVerificationStatus: hospital.licenseVerificationStatus,
        hospitalType: hospital.hospitalType,
        address: hospital.address,
        city: hospital.city,
        numberOfBeds: hospital.numberOfBeds,
        documentsCount: hospital.documentsCount || 0,
        pendingDocumentsCount: hospital.pendingDocumentsCount || 0,
        createdAt: hospital.createdAt,
      })),
      pagination: { page: filter.page, limit: filter.limit, total, totalPages: Math.ceil(total / filter.limit) },
    };
  }

  async getDoctorDetails(doctorId: string) {
    const result = await this.repository.getDoctorDetails(doctorId);
    if (!result) return null;
    const { doctor, credentials, specialtiesRows, history } = result;
    return {
      id: doctor.id, userId: doctor.userId, name: `Dr. ${doctor.firstName} ${doctor.lastName}`,
      firstName: doctor.firstName, lastName: doctor.lastName, email: doctor.email, phone: doctor.phone,
      emailVerified: doctor.emailVerified, phoneVerified: doctor.phoneVerified,
      medicalLicenseNumber: doctor.medicalLicenseNumber, licenseVerificationStatus: doctor.licenseVerificationStatus,
      yearsOfExperience: doctor.yearsOfExperience, bio: doctor.bio, primaryLocation: doctor.primaryLocation,
      latitude: doctor.latitude, longitude: doctor.longitude, averageRating: doctor.averageRating,
      totalRatings: doctor.totalRatings, completedAssignments: doctor.completedAssignments,
      credentials: credentials.map((credential: any) => ({
        id: credential.id, credentialType: credential.credentialType, title: credential.title,
        institution: credential.institution, verificationStatus: credential.verificationStatus, uploadedAt: credential.uploadedAt,
        file: { id: credential.fileId, filename: credential.filename, url: credential.url, mimetype: credential.mimetype, size: credential.size },
      })),
      specialties: specialtiesRows.map((specialty: any) => ({ id: specialty.specialtyId, name: specialty.specialtyName, isPrimary: specialty.isPrimary, yearsOfExperience: specialty.yearsOfExperience })),
      verificationHistory: history.map((log: any) => ({ id: log.id, action: log.action, details: log.details, createdAt: log.created_at })),
      createdAt: doctor.createdAt,
    };
  }

  async getHospitalDetails(hospitalId: string) {
    const result = await this.repository.getHospitalDetails(hospitalId);
    if (!result) return null;
    const { hospital, documents, departments, history } = result;
    return {
      id: hospital.id, userId: hospital.userId, name: hospital.name,
      email: hospital.email || hospital.contactEmail, phone: hospital.phone || hospital.contactPhone,
      emailVerified: hospital.emailVerified, phoneVerified: hospital.phoneVerified,
      registrationNumber: hospital.registrationNumber, licenseVerificationStatus: hospital.licenseVerificationStatus,
      hospitalType: hospital.hospitalType, address: hospital.address, city: hospital.city,
      latitude: hospital.latitude, longitude: hospital.longitude, numberOfBeds: hospital.numberOfBeds,
      contactEmail: hospital.contactEmail, contactPhone: hospital.contactPhone, websiteUrl: hospital.websiteUrl,
      documents: documents.map((document: any) => ({
        id: document.id, documentType: document.documentType, verificationStatus: document.verificationStatus,
        uploadedAt: document.uploadedAt,
        file: { id: document.fileId, filename: document.filename, url: document.url, mimetype: document.mimetype, size: document.size },
      })),
      departments: departments.map((department: any) => ({ id: department.specialtyId, name: department.specialtyName })),
      verificationHistory: history.map((log: any) => ({ id: log.id, action: log.action, details: log.details, createdAt: log.created_at })),
      createdAt: hospital.createdAt,
    };
  }

  async updateProviderVerification(input: UpdateProviderVerificationInput) {
    try {
      const data = await getDb().transaction(async (tx: any) => {
        const repository = new ProviderVerificationsRepository(tx);
        const provider = await repository.findProvider(input.providerType, input.providerId);

        if (!provider) return null;

        const updatedProvider = await repository.updateStatus(
          input.providerType,
          input.providerId,
          input.verificationStatus,
        );

        const activatedUser = input.verificationStatus === 'verified'
          ? await repository.activatePendingProviderUser(provider.userId)
          : null;

        const action = input.verificationStatus === 'verified' ? 'verify' : 'reject';
        await repository.createAuditLog({
          userId: input.adminUserId,
          action,
          entityType: input.providerType,
          entityId: input.providerId,
          details: {
            providerName: provider.name,
            providerEmail: provider.email || undefined,
            registrationNumber: provider.registrationNumber,
            previousStatus: provider.verificationStatus,
            newStatus: input.verificationStatus,
            accountStatus: activatedUser?.status,
            notes: input.notes || undefined,
            reason: input.reason || undefined,
            httpMethod: 'PUT',
            endpoint: input.requestMetadata.endpoint,
            ipAddress: input.requestMetadata.ipAddress,
            userAgent: input.requestMetadata.userAgent,
            updatedAt: new Date().toISOString(),
          },
        });

        return { ...updatedProvider, accountStatus: activatedUser?.status };
      });

      if (!data) {
        return { success: false as const, code: 'NOT_FOUND' as const };
      }

      return { success: true as const, data };
    } catch (error) {
      console.error('Error updating provider verification:', error);
      return {
        success: false as const,
        code: 'UPDATE_FAILED' as const,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async updateDoctorCredentialVerification(input: {
    credentialId: string;
    verificationStatus: VerificationStatus;
    adminUserId: string;
    notes?: string | null;
    requestMetadata: { ipAddress?: string; userAgent?: string; endpoint?: string };
  }) {
    try {
      const data = await getDb().transaction(async (tx: any) => {
        const repository = new ProviderVerificationsRepository(tx);
        const credential = await repository.findDoctorCredential(input.credentialId);
        if (!credential) return null;

        const updatedCredential = await repository.updateDoctorCredentialStatus(
          input.credentialId,
          input.verificationStatus,
        );
        const action = input.verificationStatus === 'verified'
          ? 'credential_verified'
          : input.verificationStatus === 'rejected'
            ? 'credential_rejected'
            : 'credential_reset';

        await tx.insert(auditLogs).values({
          userId: input.adminUserId,
          actorType: 'admin',
          action,
          entityType: 'doctor_credential',
          entityId: input.credentialId,
          details: {
            doctorId: credential.doctorId,
            credentialTitle: credential.title,
            credentialType: credential.credentialType,
            institution: credential.institution || undefined,
            previousStatus: credential.verificationStatus,
            newStatus: input.verificationStatus,
            notes: input.notes || undefined,
            httpMethod: 'PUT',
            endpoint: input.requestMetadata.endpoint,
            ipAddress: input.requestMetadata.ipAddress,
            userAgent: input.requestMetadata.userAgent,
            updatedAt: new Date().toISOString(),
          },
          createdAt: new Date().toISOString(),
        });

        return updatedCredential;
      });

      if (!data) return { success: false as const, code: 'NOT_FOUND' as const };
      return { success: true as const, data };
    } catch (error) {
      console.error('Error updating doctor credential verification:', error);
      return {
        success: false as const,
        code: 'UPDATE_FAILED' as const,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
