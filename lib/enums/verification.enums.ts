export const VERIFICATION_STATUSES = ['pending', 'verified', 'rejected'] as const;
export const VERIFICATION_PROVIDER_TYPES = ['doctor', 'hospital'] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];
export type VerificationProviderType = (typeof VERIFICATION_PROVIDER_TYPES)[number];
