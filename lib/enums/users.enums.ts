export const USER_ROLES = ['doctor', 'hospital', 'admin', 'patient'] as const;

export const USER_ACCOUNT_STATUSES = [
  'active',
  'inactive',
  'pending',
  'suspended',
] as const;

export const PATIENT_REGISTRATION_ACCOUNT_STATUS = 'active' as const;

export const USER_ACCOUNT_STATUS_ACTIONS = {
  active: { label: 'Suspend', nextStatus: 'suspended' },
  inactive: { label: 'Reactivate', nextStatus: 'active' },
  pending: { label: 'Activate', nextStatus: 'active' },
  suspended: { label: 'Reactivate', nextStatus: 'active' },
} as const;

export const ADMIN_MANAGEABLE_USER_ROLES = ['doctor', 'hospital', 'admin'] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type UserAccountStatus = (typeof USER_ACCOUNT_STATUSES)[number];

export function isUserAccountStatus(value: unknown): value is UserAccountStatus {
  return typeof value === 'string' && USER_ACCOUNT_STATUSES.includes(value as UserAccountStatus);
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && USER_ROLES.includes(value as UserRole);
}

export function isAdminManageableUserRole(value: unknown): value is (typeof ADMIN_MANAGEABLE_USER_ROLES)[number] {
  return typeof value === 'string' && ADMIN_MANAGEABLE_USER_ROLES.includes(value as (typeof ADMIN_MANAGEABLE_USER_ROLES)[number]);
}
