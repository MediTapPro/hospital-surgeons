import { z } from 'zod';

export const PatientDoctorSearchQuerySchema = z.object({
  search: z.string().trim().min(1, 'Search term cannot be empty').max(100).optional(),
  specialtyId: z.string().uuid('Invalid specialty id provided').optional(),
  lat: z.coerce.number().min(-90, 'Invalid latitude').max(90, 'Invalid latitude').optional(),
  lon: z.coerce.number().min(-180, 'Invalid longitude').max(180, 'Invalid longitude').optional(),
  radius: z.coerce.number().int('Radius must be a whole number').min(1, 'Radius must be at least 1 km').max(100, 'Radius cannot exceed 100 km').default(50),
  minRating: z.coerce.number().min(0).max(5, 'Rating must be between 0 and 5').optional(),
  sortBy: z.enum(['distance', 'rating', 'experience']).default('distance'),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int('Page must be a whole number').min(1).default(1),
  limit: z.coerce.number().int('Limit must be a whole number').min(1).max(50, 'Limit cannot exceed 50').default(10),
});

export type PatientDoctorSearchQuery = z.infer<typeof PatientDoctorSearchQuerySchema>;