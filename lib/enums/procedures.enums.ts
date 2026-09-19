export const PROCEDURE_ERROR_CODES = {
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_NAME: 'DUPLICATE_NAME',
  PROCEDURE_IN_USE: 'PROCEDURE_IN_USE',
  CATEGORY_IN_USE: 'CATEGORY_IN_USE',
  UPDATE_FAILED: 'UPDATE_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ProcedureErrorCode =
  (typeof PROCEDURE_ERROR_CODES)[keyof typeof PROCEDURE_ERROR_CODES];

export const PROCEDURE_ERROR_STATUS: Record<ProcedureErrorCode, number> = {
  NOT_FOUND: 404,
  DUPLICATE_NAME: 409,
  PROCEDURE_IN_USE: 409,
  CATEGORY_IN_USE: 409,
  UPDATE_FAILED: 500,
  INTERNAL_ERROR: 500,
};

export const PROCEDURE_SEARCH_MAX_LENGTH = 100;

/**
 * Tables checked before a procedure may be deleted, keyed by the label used in
 * user-facing messages.
 *
 * `procedure_type_mappings` is deliberately excluded: those rows are the procedure's own
 * pricing-type junction data and cascade with it, so counting them would make almost every
 * procedure with assigned types undeletable.
 */
export const PROCEDURE_REFERENCE_LABELS = {
  doctorProcedureFees: 'doctor procedure fee(s)',
  assignments: 'assignment(s)',
} as const;

export type ProcedureReferenceKey = keyof typeof PROCEDURE_REFERENCE_LABELS;
export type ProcedureReferenceCounts = Record<ProcedureReferenceKey, number>;

/**
 * Deleting a category only nulls `procedures.category_id`, so the check is about avoiding a
 * silent uncategorisation rather than preventing row destruction.
 */
export const CATEGORY_REFERENCE_LABELS = {
  procedures: 'procedure(s)',
} as const;

export type CategoryReferenceKey = keyof typeof CATEGORY_REFERENCE_LABELS;
export type CategoryReferenceCounts = Record<CategoryReferenceKey, number>;
