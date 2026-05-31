import { z } from 'zod';

// Create Specialty DTO Schema
export const CreateSpecialtyDtoSchema = z.object({
  name: z.string().min(1, 'Specialty name is required').trim(),
  description: z.string().optional().nullable(),
});

// Update Specialty DTO Schema
export const UpdateSpecialtyDtoSchema = z.object({
  name: z.string().min(1, 'Specialty name is required').trim().optional(),
  description: z.string().optional().nullable(),
});

export type CreateSpecialtyDto = z.infer<typeof CreateSpecialtyDtoSchema>;
export type UpdateSpecialtyDto = z.infer<typeof UpdateSpecialtyDtoSchema>;

