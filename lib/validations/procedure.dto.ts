import { z } from 'zod';

export const CreateProcedureDtoSchema = z.object({
  specialtyId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  typeIds: z.array(z.string().uuid()).optional(),
});

export const UpdateProcedureDtoSchema = CreateProcedureDtoSchema.partial();

export const CreateCategoryDtoSchema = z.object({
  specialtyId: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
});

export const UpdateCategoryDtoSchema = CreateCategoryDtoSchema.partial();

export const CreateProcedureTypeDtoSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  displayName: z.string().min(1, 'Display name is required'),
});

export const UpdateProcedureTypeDtoSchema = CreateProcedureTypeDtoSchema.partial();
