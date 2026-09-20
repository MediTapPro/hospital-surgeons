import { getDb } from '@/lib/db';
import type { UserAccountStatus, UserRole } from '@/lib/enums/users.enums';
import { AdminUsersRepository } from '@/lib/repositories/admin-users.repository';
import bcrypt from 'bcrypt';

type RequestMetadata = { ipAddress?: string; userAgent?: string };

type UpdateAccountStatusInput = {
  targetUserId: string;
  adminUserId: string;
  status: UserAccountStatus;
  reason?: string;
  requestMetadata: RequestMetadata;
};

export class AdminUsersService {
  private repository = new AdminUsersRepository();

  async listUsers(filter: {
    page: number;
    limit: number;
    role?: UserRole;
    status?: UserAccountStatus;
    search?: string;
    sortBy: 'createdAt' | 'email' | 'status' | 'role' | 'id';
    sortOrder: 'asc' | 'desc';
  }) {
    const { rows, total, counts } = await this.repository.listUsers(filter);
    const countsByRole = Object.fromEntries(counts.map((item: any) => [item.role, Number(item.count)]));

    return {
      data: rows.map((user: any) => this.formatListUser(user)),
      pagination: { page: filter.page, limit: filter.limit, total, totalPages: Math.ceil(total / filter.limit) },
      counts: {
        doctor: countsByRole.doctor ?? 0,
        hospital: countsByRole.hospital ?? 0,
        admin: countsByRole.admin ?? 0,
        patient: countsByRole.patient ?? 0,
        all: total === 0 ? 0 : Object.values(countsByRole).reduce((sum: number, value: unknown) => sum + Number(value), 0),
      },
    };
  }

  async getUserDetail(userId: string) {
    const result = await this.repository.getUserDetail(userId);
    if (!result) return null;

    const { user, activeSubscription, recentAuditLogs, assignmentStats } = result;
    const { name, verificationStatus, profileData } = this.formatDetailUser(user);
    return {
      id: user.id,
      name,
      email: user.email,
      role: user.role,
      status: user.status,
      verificationStatus,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionTier: user.subscriptionTier,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      phone: user.phone,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      profileData,
      activeSubscription,
      recentAuditLogs: recentAuditLogs.map((log: any) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        details: log.details,
        createdAt: log.createdAt,
      })),
      assignmentStats,
    };
  }

  async updateAccountStatus(input: UpdateAccountStatusInput) {
    if (input.targetUserId === input.adminUserId) {
      return { success: false as const, code: 'SELF_UPDATE_FORBIDDEN' as const };
    }

    return await getDb().transaction(async (tx: any) => {
      const repository = new AdminUsersRepository(tx);
      const existingUser = await repository.findUserById(input.targetUserId);
      if (!existingUser) return { success: false as const, code: 'NOT_FOUND' as const };
      if (existingUser.status === input.status) {
        return { success: true as const, data: { id: existingUser.id, status: existingUser.status }, unchanged: true };
      }

      const updatedUser = await repository.updateAccountStatus(input.targetUserId, input.status);
      if (!updatedUser) throw new Error('User status update did not return a user');
      await repository.createUserAuditLog({
        adminUserId: input.adminUserId,
        targetUserId: input.targetUserId,
        targetUserEmail: existingUser.email,
        action: 'update_status',
        details: {
          userRole: existingUser.role,
          previousStatus: existingUser.status,
          newStatus: input.status,
          reason: input.reason,
          httpMethod: 'PUT',
          endpoint: `/api/admin/users/${input.targetUserId}/status`,
          ...input.requestMetadata,
        },
      });
      return { success: true as const, data: updatedUser, unchanged: false };
    });
  }

  async updateUserRole(input: { targetUserId: string; adminUserId: string; role: UserRole; reason?: string; requestMetadata: RequestMetadata }) {
    if (input.targetUserId === input.adminUserId) {
      return { success: false as const, code: 'SELF_UPDATE_FORBIDDEN' as const };
    }

    return await getDb().transaction(async (tx: any) => {
      const repository = new AdminUsersRepository(tx);
      const existingUser = await repository.findUserById(input.targetUserId);
      if (!existingUser) return { success: false as const, code: 'NOT_FOUND' as const };
      if (existingUser.role === 'admin' && input.role !== 'admin') {
        return { success: false as const, code: 'ADMIN_ROLE_PROTECTED' as const };
      }
      if (existingUser.role === input.role) {
        return { success: true as const, data: { id: existingUser.id, role: existingUser.role }, unchanged: true };
      }

      const updatedUser = await repository.updateUserRole(input.targetUserId, input.role);
      if (!updatedUser) throw new Error('User role update did not return a user');
      await repository.createUserAuditLog({
        adminUserId: input.adminUserId,
        targetUserId: input.targetUserId,
        targetUserEmail: existingUser.email,
        action: 'update_role',
        details: {
          previousRole: existingUser.role,
          newRole: input.role,
          reason: input.reason,
          httpMethod: 'PUT',
          endpoint: `/api/admin/users/${input.targetUserId}/role`,
          ...input.requestMetadata,
        },
      });
      return { success: true as const, data: updatedUser, unchanged: false };
    });
  }

  async suspendUser(input: { targetUserId: string; adminUserId: string; requestMetadata: RequestMetadata }) {
    if (input.targetUserId === input.adminUserId) {
      return { success: false as const, code: 'SELF_UPDATE_FORBIDDEN' as const };
    }

    return await getDb().transaction(async (tx: any) => {
      const repository = new AdminUsersRepository(tx);
      const existingUser = await repository.findUserById(input.targetUserId);
      if (!existingUser) return { success: false as const, code: 'NOT_FOUND' as const };
      if (existingUser.role === 'admin') return { success: false as const, code: 'ADMIN_SUSPEND_FORBIDDEN' as const };
      if (existingUser.status === 'suspended') {
        return { success: true as const, data: { id: existingUser.id, status: existingUser.status }, unchanged: true };
      }

      const updatedUser = await repository.updateAccountStatus(input.targetUserId, 'suspended');
      if (!updatedUser) throw new Error('User suspension did not return a user');
      await repository.createUserAuditLog({
        adminUserId: input.adminUserId,
        targetUserId: input.targetUserId,
        targetUserEmail: existingUser.email,
        action: 'delete',
        details: {
          userRole: existingUser.role,
          previousStatus: existingUser.status,
          newStatus: 'suspended',
          reason: 'User deleted (soft delete) by admin',
          httpMethod: 'DELETE',
          endpoint: `/api/admin/users/${input.targetUserId}`,
          ...input.requestMetadata,
        },
      });
      return { success: true as const, data: updatedUser, unchanged: false };
    });
  }

  async createAdmin(input: { email: string; password: string; adminUserId: string; requestMetadata: RequestMetadata }) {
    const normalizedEmail = input.email.trim().toLowerCase();
    return await getDb().transaction(async (tx: any) => {
      const repository = new AdminUsersRepository(tx);
      if (await repository.findUserByEmail(normalizedEmail)) {
        return { success: false as const, code: 'EMAIL_EXISTS' as const };
      }
      const passwordHash = await bcrypt.hash(input.password, 10);
      const createdUser = await repository.createAdminUser(normalizedEmail, passwordHash);
      if (!createdUser) throw new Error('Admin creation did not return a user');
      await repository.createUserAuditLog({
        adminUserId: input.adminUserId,
        targetUserId: createdUser.id,
        targetUserEmail: createdUser.email,
        action: 'create_admin',
        details: { userRole: 'admin', newStatus: 'active', httpMethod: 'POST', endpoint: '/api/admin/users/admin', ...input.requestMetadata },
      });
      return { success: true as const, data: createdUser };
    });
  }

  private formatListUser(user: any) {
    let name = 'Unknown';
    let verificationStatus = 'not applicable';
    if (user.role === 'doctor') {
      name = user.doctorFirstName && user.doctorLastName ? `Dr. ${user.doctorFirstName} ${user.doctorLastName}` : 'Doctor';
      verificationStatus = user.doctorLicenseStatus || 'pending';
    } else if (user.role === 'hospital') {
      name = user.hospitalName || 'Hospital';
      verificationStatus = user.hospitalLicenseStatus || 'pending';
    } else if (user.role === 'admin') {
      name = 'Admin User';
      verificationStatus = 'verified';
    } else if (user.role === 'patient') {
      name = user.patientFullName || 'Patient';
    }
    return { ...user, name, verificationStatus };
  }

  private formatDetailUser(user: any) {
    if (user.role === 'doctor') {
      return {
        name: user.doctorFirstName && user.doctorLastName ? `Dr. ${user.doctorFirstName} ${user.doctorLastName}` : 'Doctor',
        verificationStatus: user.doctorLicenseStatus || 'pending',
        profileData: {
          firstName: user.doctorFirstName, lastName: user.doctorLastName, licenseNumber: user.doctorLicenseNumber,
          licenseStatus: user.doctorLicenseStatus, yearsOfExperience: user.doctorYearsOfExperience, bio: user.doctorBio,
          averageRating: user.doctorAverageRating, totalRatings: user.doctorTotalRatings, completedAssignments: user.doctorCompletedAssignments,
        },
      };
    }
    if (user.role === 'hospital') {
      return {
        name: user.hospitalName || 'Hospital', verificationStatus: user.hospitalLicenseStatus || 'pending',
        profileData: {
          name: user.hospitalName, type: user.hospitalType, registrationNumber: user.hospitalRegistrationNumber,
          licenseStatus: user.hospitalLicenseStatus, address: user.hospitalAddress, city: user.hospitalCity, numberOfBeds: user.hospitalNumberOfBeds,
        },
      };
    }
    if (user.role === 'patient') {
      return { name: user.patientFullName || 'Patient', verificationStatus: 'not applicable', profileData: { fullName: user.patientFullName || 'N/A' } };
    }
    return { name: 'Admin User', verificationStatus: 'verified', profileData: null };
  }
}
