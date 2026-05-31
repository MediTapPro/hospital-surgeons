import { z } from 'zod';

// Create Doctor Profile DTO
export const CreateDoctorProfileDtoSchema = z.object({
  medicalLicenseNumber: z.string().min(1, 'Medical license number is required'),
  yearsOfExperience: z.number().int().min(0, 'Years of experience must be non-negative').optional(),
  bio: z.string().optional(),
  profilePhotoId: z.string().uuid('Invalid profile photo ID format').optional(),
  fullAddress: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().max(10).optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export type CreateDoctorProfileDto = z.infer<typeof CreateDoctorProfileDtoSchema>;

