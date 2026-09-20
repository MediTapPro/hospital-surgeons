import { z } from 'zod';
import { PROCEDURE_SEARCH_MAX_LENGTH } from '@/lib/enums/procedures.enums';

/**
 * Optional uuid fields arrive from the admin UI as empty strings when nothing is selected,
 * so treat "" and null as "not provided" instead of failing format validation.
 */
const optionalUuid = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.string().uuid().optional()
);

const optionalSearch = z.string().trim().max(PROCEDURE_SEARCH_MAX_LENGTH).optional();

export const CreateProcedureDtoSchema = z.object({
  specialtyId: z.string().uuid(),
  categoryId: optionalUuid,
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

export const ProceduresQuerySchema = z.object({
  specialtyId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  search: optionalSearch,
});

export const CategoriesQuerySchema = z.object({
  specialtyId: z.string().uuid().optional(),
  search: optionalSearch,
});

export const ProcedureTypesQuerySchema = z.object({
  procedureId: z.string().uuid().optional(),
});
