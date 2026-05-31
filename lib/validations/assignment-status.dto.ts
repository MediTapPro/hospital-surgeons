import { z } from 'zod';

// Update Assignment Status DTO
export const UpdateAssignmentStatusDtoSchema = z.object({
  status: z.enum(['accepted', 'declined', 'completed', 'cancelled'], {
    message: 'Status must be accepted, declined, completed, or cancelled',
  }),
  cancellationReason: z.string().optional(),
  treatmentNotes: z.string().optional(),
});

export type UpdateAssignmentStatusDto = z.infer<typeof UpdateAssignmentStatusDtoSchema>;

