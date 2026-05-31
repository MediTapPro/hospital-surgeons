import { z } from 'zod';

// Verify Doctor/Hospital DTO Schema
export const VerifyDtoSchema = z.object({
  notes: z.string().optional().nullable(),
});

// Reject Doctor/Hospital DTO Schema
export const RejectDtoSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required').trim(),
  notes: z.string().optional().nullable(),
});

// Update Credential Status DTO Schema
export const UpdateCredentialStatusDtoSchema = z.object({
  verificationStatus: z.enum(['pending', 'verified', 'rejected'], {
    message: 'Invalid verification status. Must be one of: pending, verified, rejected',
  }),
  notes: z.string().optional().nullable(),
});

export type VerifyDto = z.infer<typeof VerifyDtoSchema>;
export type RejectDto = z.infer<typeof RejectDtoSchema>;
export type UpdateCredentialStatusDto = z.infer<typeof UpdateCredentialStatusDtoSchema>;

