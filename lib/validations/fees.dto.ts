import { z } from 'zod';

export const CreateMrpFeeDtoSchema = z.object({
  specialtyId: z.string().uuid(),
  procedureId: z.string().uuid().optional().nullable(),
  procedureTypeId: z.string().uuid().optional().nullable(),
  roomTypeId: z.string().uuid(),
  fee: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid fee format'),
  discountPercentage: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid discount format').optional().default('0'),
  notes: z.string().optional(),
  hospitalId: z.string().uuid().optional().nullable(),
});

export const UpdateMrpFeeDtoSchema = CreateMrpFeeDtoSchema.partial();

export const BulkMrpFeeDtoSchema = z.array(CreateMrpFeeDtoSchema);

export const BulkProposeDtoSchema = z.object({
  hospitalId: z.string().uuid(),
  specialtyId: z.string().uuid(),
  discountPercentage: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid discount format').optional(),
});
