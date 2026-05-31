import { z } from 'zod';

// Create Patient DTO
export const CreatePatientDtoSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format'),
  gender: z.enum(['male', 'female', 'other'], {
    message: 'Gender must be male, female, or other',
  }),
  phone: z.string().min(1, 'Phone is required'),
  emergencyContact: z.string().optional(),
  address: z.string().optional(),
  condition: z.string().optional(),
  medicalCondition: z.string().optional(),
  roomType: z.enum(['general', 'private', 'semi_private', 'semi-private', 'icu', 'emergency'], {
    message: 'Room type must be general, private, semi_private, icu, or emergency',
  }),
  costPerDay: z.number().min(0, 'Cost per day must be non-negative').optional(),
  medicalNotes: z.string().optional(),
  // Consent fields
  dataPrivacy: z.boolean().optional(),
  doctorAssignment: z.boolean().optional(),
  treatmentConsent: z.boolean().optional(),
  consentGiverName: z.string().optional(),
  relationship: z.string().optional(),
}).transform((data) => {
  // Normalize room type: convert 'semi-private' to 'semi_private'
  if (data.roomType === 'semi-private') {
    return { ...data, roomType: 'semi_private' as const };
  }
  return data;
});

export type CreatePatientDto = z.infer<typeof CreatePatientDtoSchema>;

