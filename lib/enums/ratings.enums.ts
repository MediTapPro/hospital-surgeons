export const RATING_REVIEWER_TYPES = ['hospital', 'patient'] as const;

export type RatingReviewerType = (typeof RATING_REVIEWER_TYPES)[number];
