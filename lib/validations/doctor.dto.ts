import { z } from 'zod';

// Device schema (reusable)
const DeviceSchema = z.object({
  device_token: z.string().min(1, 'Device token is required'),
  device_type: z.enum(['ios', 'android', 'web']),
  app_version: z.string().optional(),
  os_version: z.string().optional(),
  is_active: z.boolean().optional().default(true),
});

// Doctor Specialty DTO
const DoctorSpecialtySchema = z.object({
  specialtyId: z.string().uuid('Invalid specialty ID format'),
  isPrimary: z.boolean().optional().default(false),
  yearsOfExperience: z.number().int().min(0).optional(),
});

// Doctor Registration DTO
export const DoctorRegisterDtoSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().min(1, 'Phone is required'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  medicalLicenseNumber: z.string().min(1, 'Medical license number is required'),
  yearsOfExperience: z.number().int().min(0, 'Years of experience must be non-negative'),
  bio: z.string().optional(),
  profilePhotoId: z.string().uuid('Invalid profile photo ID format').optional(),
  fullAddress: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().max(10).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  specialties: z.array(DoctorSpecialtySchema).min(1, 'At least one specialty is required'),
  device: DeviceSchema.optional(),
});

export type DoctorRegisterDto = z.infer<typeof DoctorRegisterDtoSchema>;

// Update Doctor DTO
export const UpdateDoctorDtoSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  medicalLicenseNumber: z.string().optional(),
  yearsOfExperience: z.number().int().min(0).optional(),
  bio: z.string().optional(),
  profilePhotoId: z.string().uuid().optional(),
  fullAddress: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().max(10).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export type UpdateDoctorDto = z.infer<typeof UpdateDoctorDtoSchema>;

// Create Doctor Credential DTO (for upload endpoint - FormData)
// Note: 'file' is validated separately as it's a File object
export const CreateDoctorCredentialFormDataSchema = z.object({
  file: z.any(), // File object - validated separately
  credentialType: z.enum(['degree', 'certificate', 'license', 'other'], {
    message: 'Credential type must be degree, certificate, license, or other',
  }),
  title: z.string().min(1, 'Title is required'),
  institution: z.string().optional().or(z.literal('')),
});

export type CreateDoctorCredentialFormData = z.infer<typeof CreateDoctorCredentialFormDataSchema>;

