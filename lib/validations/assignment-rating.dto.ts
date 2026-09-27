import { z } from 'zod';

export const CreateAssignmentRatingDtoSchema = z.object({
  rating: z.number().int().min(1).max(5),
  reviewText: z.string().trim().max(2000).optional(),
  positiveTags: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
  negativeTags: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
});

export type CreateAssignmentRatingDto = z.infer<typeof CreateAssignmentRatingDtoSchema>;
