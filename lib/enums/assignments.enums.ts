export const ASSIGNMENT_SOURCES = ['hospital', 'patient'] as const;

export type AssignmentSource = (typeof ASSIGNMENT_SOURCES)[number];

export const ASSIGNMENT_PRIORITIES = ['routine', 'urgent', 'emergency'] as const;
export type AssignmentPriority = (typeof ASSIGNMENT_PRIORITIES)[number];
