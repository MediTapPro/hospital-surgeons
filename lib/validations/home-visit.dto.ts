import { z } from 'zod';

const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

export const CreateHomeVisitDtoSchema = z.object({
  doctorId: z.string().uuid('Invalid doctor ID format'),
  parentSlotId: z.string().uuid('Invalid parent slot ID format').optional(),
  startTime: z.string().regex(timeRegex, 'Invalid start time format. Expected HH:mm').optional(),
  endTime: z.string().regex(timeRegex, 'Invalid end time format. Expected HH:mm').optional(),
  availabilitySlotId: z.string().uuid('Invalid availability slot ID format').optional(),
  priority: z.enum(['routine', 'urgent', 'emergency']).optional().default('routine'),
  patientAddressId: z.string().uuid('Invalid address ID format'),
  patientFamilyMemberId: z.string().uuid('Invalid family member ID format').optional(),
  symptoms: z.string().optional(),
  treatmentNotes: z.string().optional(),
}).refine(
  (data) => {
    // Either parentSlotId + time range OR availabilitySlotId must be provided
    const hasParentSlot = data.parentSlotId && data.startTime && data.endTime;
    const hasDirectSlot = data.availabilitySlotId;
    return hasParentSlot || hasDirectSlot;
  },
  {
    message: 'Either provide parentSlotId with startTime and endTime, or provide availabilitySlotId',
  }
).refine(
  (data) => {
    // If parentSlotId is provided, startTime and endTime must also be provided
    if (data.parentSlotId) {
      return !!(data.startTime && data.endTime);
    }
    return true;
  },
  {
    message: 'startTime and endTime are required when parentSlotId is provided',
  }
);

export type CreateHomeVisitDto = z.infer<typeof CreateHomeVisitDtoSchema>;
