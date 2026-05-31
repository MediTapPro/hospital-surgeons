import { z } from 'zod';

// Time format validation (HH:mm)
const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

// Create Assignment DTO
// Supports two modes:
// 1. parentSlotId + startTime + endTime (create sub-slot from parent)
// 2. availabilitySlotId (direct slot reference - for backward compatibility)
export const CreateAssignmentDtoSchema = z.object({
  patientId: z.string().uuid('Invalid patient ID format'),
  doctorId: z.string().uuid('Invalid doctor ID format'),
  // Option 1: Parent slot with time range (preferred for new bookings)
  parentSlotId: z.string().uuid('Invalid parent slot ID format').optional(),
  startTime: z.string().regex(timeRegex, 'Invalid start time format. Expected HH:mm').optional(),
  endTime: z.string().regex(timeRegex, 'Invalid end time format. Expected HH:mm').optional(),
  // Option 2: Direct availability slot (backward compatibility)
  availabilitySlotId: z.string().uuid('Invalid availability slot ID format').optional(),
  priority: z.enum(['routine', 'urgent', 'emergency']).optional().default('routine'),
  consultationFee: z.coerce.number().optional(),
  procedureId: z.string().uuid('Invalid procedure ID format').optional(),
  procedureTypeId: z.string().uuid('Invalid procedure type ID format').optional(),
  roomTypeId: z.string().uuid('Invalid room type ID format').optional(),
  specialtyId: z.string().uuid('Invalid specialty ID format').optional(),
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

export type CreateAssignmentDto = z.infer<typeof CreateAssignmentDtoSchema>;

