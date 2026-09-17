export const ASSIGNMENT_PAYMENT_SOURCES = ['hospital_assignment', 'home_visit'] as const;
export const ASSIGNMENT_SETTLEMENT_STATUSES = ['pending', 'processing', 'completed', 'failed'] as const;
export const PATIENT_PAYMENT_STATUSES = ['not_applicable', 'pending', 'paid', 'failed', 'refunded'] as const;

export type AssignmentPaymentSource = (typeof ASSIGNMENT_PAYMENT_SOURCES)[number];
export type AssignmentSettlementStatus = (typeof ASSIGNMENT_SETTLEMENT_STATUSES)[number];
export type PatientPaymentStatus = (typeof PATIENT_PAYMENT_STATUSES)[number];
