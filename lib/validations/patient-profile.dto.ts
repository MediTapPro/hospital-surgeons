import { z } from 'zod';

export const PatientSignupDtoSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits').optional(),
  fullName: z.string().min(1, 'Full name is required'),
  device: z.object({
    device_token: z.string(),
    device_type: z.enum(['ios', 'android', 'web']),
    app_version: z.string().optional(),
    os_version: z.string().optional(),
    device_name: z.string().optional(),
    is_active: z.boolean().optional(),
  }).optional(),
});

export type PatientSignupDto = z.infer<typeof PatientSignupDtoSchema>;

export const PatientAddressDtoSchema = z.object({
  label: z.string().min(1, 'Address label is required (e.g., Home, Work)'),
  addressText: z.string().min(1, 'Address details are required'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  isDefault: z.boolean().default(false),
});

export type PatientAddressDto = z.infer<typeof PatientAddressDtoSchema>;

export const PatientFamilyMemberDtoSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  relationship: z.string().min(1, 'Relationship is required (e.g., Spouse, Child, Parent)'),
});

export type PatientFamilyMemberDto = z.infer<typeof PatientFamilyMemberDtoSchema>;

export const PatientProfileUpdateDtoSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
});

export type PatientProfileUpdateDto = z.infer<typeof PatientProfileUpdateDtoSchema>;

