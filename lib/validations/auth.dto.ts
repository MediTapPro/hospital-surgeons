import { z } from 'zod';

// Device schema (reusable)
export const DeviceSchema = z.object({
  device_token: z.string().min(1, 'Device token is required'),
  device_type: z.enum(['ios', 'android', 'web'], {
    message: 'Device type must be ios, android, or web',
  }),
  app_version: z.string().optional(),
  os_version: z.string().optional(),
  device_name: z.string().optional(),
  is_active: z.boolean().optional().default(true),
});

// Login DTO
export const LoginDtoSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  accountType: z.enum(['doctor', 'hospital', 'admin']).optional(),
});

export type LoginDto = z.infer<typeof LoginDtoSchema>;

// Signup DTO
export const SignupDtoSchema = z.object({
  email: z.string().email('Invalid email format'),
  phone: z.string().min(1, 'Phone is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export type SignupDto = z.infer<typeof SignupDtoSchema>;

