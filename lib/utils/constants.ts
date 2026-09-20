export const PATIENT_SEARCH_DEFAULT_RADIUS = 50;
export const PATIENT_SEARCH_DEFAULT_LIMIT = 10;

export const PATIENT_SEARCH_RADIUS_OPTIONS = [5, 10, 25, 50, 100];

export const PATIENT_SEARCH_SORT_OPTIONS = [
  { value: 'distance', label: 'Nearest first' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'experience', label: 'Most experienced' },
] as const;

export const PATIENT_SEARCH_QUERY_KEYS = {
  search: 'search',
  specialtyId: 'specialtyId',
  lat: 'lat',
  lon: 'lon',
  radius: 'radius',
  sortBy: 'sortBy',
  page: 'page',
  limit: 'limit',
} as const;

export const PATIENT_SEARCH_LOCATION_DEFAULT = 'default';
export const PATIENT_SEARCH_LOCATION_GPS = 'gps';

export const HOME_VISIT_SETTINGS_SCOPE = 'global';

export const PATIENT_PAYMENTS_DEFAULT_LIMIT = 10;
export const PATIENT_PAYMENTS_MAX_LIMIT = 50;

export const PATIENT_PROFILE_PHOTO_BUCKET = 'images';
export const PATIENT_PROFILE_PHOTO_MAX_SIZE_BYTES = 5 * 1024 * 1024;
export const PATIENT_PROFILE_PHOTO_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const;

export const ASSIGNMENT_PAYMENTS_DEFAULT_LIMIT = 20;
export const ASSIGNMENT_PAYMENTS_MAX_LIMIT = 50;

export const ADMIN_DASHBOARD_TRENDS_DEFAULT_MONTHS = 6;
export const ADMIN_DASHBOARD_TRENDS_MAX_MONTHS = 24;
export const ADMIN_DASHBOARD_ACTIVITY_DEFAULT_LIMIT = 10;
export const ADMIN_DASHBOARD_ACTIVITY_MAX_LIMIT = 50;

export const HOME_VISIT_PAYMENT_TIMINGS = [
  {
    value: 'pay_after_completion',
    label: 'Pay after completion',
    description: 'The patient is asked to pay after the doctor completes the visit.',
  },
] as const;

export type HomeVisitPaymentTiming =
  (typeof HOME_VISIT_PAYMENT_TIMINGS)[number]['value'];
