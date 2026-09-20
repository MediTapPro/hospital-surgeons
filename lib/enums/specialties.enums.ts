export const SPECIALTY_SORT_FIELDS = ['name', 'id'] as const;
export const SPECIALTY_SORT_ORDERS = ['asc', 'desc'] as const;

export type SpecialtySortField = (typeof SPECIALTY_SORT_FIELDS)[number];
export type SpecialtySortOrder = (typeof SPECIALTY_SORT_ORDERS)[number];

export const SPECIALTY_LIST_DEFAULT_LIMIT = 10;
export const SPECIALTY_LIST_MAX_LIMIT = 100;

export const SPECIALTY_ERROR_CODES = {
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_NAME: 'DUPLICATE_NAME',
  SPECIALTY_IN_USE: 'SPECIALTY_IN_USE',
  UPDATE_FAILED: 'UPDATE_FAILED',
} as const;

export type SpecialtyErrorCode =
  (typeof SPECIALTY_ERROR_CODES)[keyof typeof SPECIALTY_ERROR_CODES];

/**
 * Every table that holds a foreign key to `specialties`, keyed by the label used in
 * user-facing messages. All of these must be empty before a specialty can be deleted:
 * six are ON DELETE CASCADE and `assignments` is ON DELETE SET NULL, so an unchecked
 * delete silently destroys or detaches referencing rows.
 */
export const SPECIALTY_REFERENCE_LABELS = {
  doctors: 'doctor(s)',
  hospitals: 'hospital(s)',
  procedureCategories: 'procedure category(ies)',
  procedures: 'procedure(s)',
  assignments: 'assignment(s)',
  doctorProcedureFees: 'doctor procedure fee(s)',
  homeVisitFees: 'home visit fee configuration(s)',
} as const;

export type SpecialtyReferenceKey = keyof typeof SPECIALTY_REFERENCE_LABELS;
export type SpecialtyReferenceCounts = Record<SpecialtyReferenceKey, number>;
