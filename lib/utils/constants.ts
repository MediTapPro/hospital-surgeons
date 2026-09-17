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

export const HOME_VISIT_PAYMENT_TIMINGS = [
  {
    value: 'pay_after_completion',
    label: 'Pay after completion',
    description: 'The patient is asked to pay after the doctor completes the visit.',
  },
] as const;

export type HomeVisitPaymentTiming =
  (typeof HOME_VISIT_PAYMENT_TIMINGS)[number]['value'];
