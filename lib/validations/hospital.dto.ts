import { z } from 'zod';

// Device schema (reusable)
const DeviceSchema = z.object({
  device_token: z.string().min(1, 'Device token is required'),
  device_type: z.enum(['ios', 'android', 'web']),
  app_version: z.string().optional(),
  os_version: z.string().optional(),
  is_active: z.boolean().optional().default(true),
});

// Hospital Department DTO
const HospitalDepartmentSchema = z.object({
  specialtyId: z.string().uuid('Invalid specialty ID format'),
});

// Hospital Registration DTO
export const HospitalRegisterDtoSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().min(1, 'Phone is required'),
  name: z.string().min(1, 'Hospital name is required'),
  registrationNumber: z.string().min(1, 'Registration number is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  fullAddress: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().max(10).optional(),
  hospitalType: z.enum(['general', 'specialty', 'clinic', 'trauma_center', 'teaching', 'other']).optional(),
  numberOfBeds: z.number().int().min(0, 'Number of beds must be non-negative').optional(),
  contactEmail: z.string().email('Invalid contact email format').optional(),
  contactPhone: z.string().optional(),
  websiteUrl: z.string().url('Invalid website URL format').optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  departments: z.array(HospitalDepartmentSchema).min(1, 'At least one department is required'),
  device: DeviceSchema.optional(),
});

export type HospitalRegisterDto = z.infer<typeof HospitalRegisterDtoSchema>;

// Update Hospital DTO
export const UpdateHospitalDtoSchema = z.object({
  name: z.string().optional(),
  hospitalType: z.enum(['general', 'specialty', 'clinic', 'trauma_center', 'teaching', 'other']).optional(),
  registrationNumber: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  fullAddress: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().max(10).optional(),
  phone: z.string().optional(),
  website: z.string().url().optional(),
  logoId: z.string().uuid().optional(),
  numberOfBeds: z.number().int().min(0).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  contactEmail: z.string().email().optional(),
});

export type UpdateHospitalDto = z.infer<typeof UpdateHospitalDtoSchema>;

// Create Hospital Document DTO (for upload endpoint - FormData)
// Note: 'file' is validated separately as it's a File object
export const CreateHospitalDocumentFormDataSchema = z.object({
  file: z.any(), // File object - validated separately
  documentType: z.enum(['license', 'accreditation', 'insurance', 'other'], {
    message: 'Document type must be license, accreditation, insurance, or other',
  }),
});

export type CreateHospitalDocumentFormData = z.infer<typeof CreateHospitalDocumentFormDataSchema>;

