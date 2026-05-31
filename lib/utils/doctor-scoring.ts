/**
 * Doctor Scoring Algorithm
 * 
 * This algorithm calculates a composite score for doctors based on multiple factors
 * to determine their ranking in search results. The score is designed to reflect
 * real-world quality indicators and business priorities.
 * 
 * Scoring Factors:
 * 1. Experience (0-30 points) - Years of experience
 * 2. Subscription Plan (0-40 points) - Premium plans get higher visibility
 * 3. Rating & Reviews (0-20 points) - Quality and reliability
 * 4. Performance (0-10 points) - Completed assignments
 * 5. Verification Status (0-10 points) - License verification
 * 
 * Total: 0-110 points
 */

export interface DoctorScoringData {
  yearsOfExperience: number;
  averageRating: number | null;
  totalRatings: number;
  completedAssignments: number;
  licenseVerificationStatus: 'pending' | 'verified' | 'rejected';
  subscriptionTier?: 'free' | 'basic' | 'premium' | 'enterprise' | null;
  visibilityWeight?: number | null;
}

export interface DoctorScore {
  totalScore: number;
  breakdown: {
    experienceScore: number;
    planScore: number;
    ratingScore: number;
    performanceScore: number;
    verificationScore: number;
  };
}

/**
 * Calculate doctor score based on multiple factors
 */
export function calculateDoctorScore(data: DoctorScoringData): DoctorScore {
  // 1. Experience Score (0-30 points)
  // Linear scaling: 0 years = 0 points, 30+ years = 30 points
  const experienceScore = Math.min(data.yearsOfExperience || 0, 30);

  // 2. Subscription Plan Score (0-40 points)
  // Premium plans get higher visibility boost
  let planScore = 0;
  const tierWeights: Record<string, number> = {
    enterprise: 40,
    premium: 30,
    basic: 15,
    free: 5,
  };
  
  if (data.subscriptionTier) {
    planScore = tierWeights[data.subscriptionTier] || 5;
  } else {
    planScore = 5; // Default for no subscription
  }
  
  // Add visibility weight multiplier (if available)
  if (data.visibilityWeight && data.visibilityWeight > 1) {
    planScore = Math.min(planScore * (data.visibilityWeight / 10), 40);
  }

  // 3. Rating & Reviews Score (0-20 points)
  // Combines rating quality with review count (reliability)
  let ratingScore = 0;
  const rating = data.averageRating || 0;
  const reviewCount = data.totalRatings || 0;
  
  // Base rating score (0-12 points): 0 stars = 0, 5 stars = 12
  const baseRatingScore = (rating / 5) * 12;
  
  // Review count bonus (0-8 points): More reviews = more reliable
  // Logarithmic scaling to prevent too much weight on review count alone
  const reviewBonus = Math.min(Math.log10(Math.max(reviewCount, 1)) * 2.5, 8);
  
  ratingScore = baseRatingScore + reviewBonus;

  // 4. Performance Score (0-10 points)
  // Based on completed assignments (shows reliability and activity)
  // Logarithmic scaling: 0 = 0, 100+ = 10
  const performanceScore = Math.min(
    Math.log10(Math.max(data.completedAssignments || 0, 1)) * 3.33,
    10
  );

  // 5. Verification Status Score (0-10 points)
  // Verified doctors get full points, pending gets partial, rejected gets 0
  let verificationScore = 0;
  switch (data.licenseVerificationStatus) {
    case 'verified':
      verificationScore = 10;
      break;
    case 'pending':
      verificationScore = 3; // Partial credit while pending
      break;
    case 'rejected':
      verificationScore = 0;
      break;
    default:
      verificationScore = 0;
  }

  // Calculate total score
  const totalScore = 
    experienceScore +
    planScore +
    ratingScore +
    performanceScore +
    verificationScore;

  return {
    totalScore: Math.round(totalScore * 100) / 100, // Round to 2 decimal places
    breakdown: {
      experienceScore: Math.round(experienceScore * 100) / 100,
      planScore: Math.round(planScore * 100) / 100,
      ratingScore: Math.round(ratingScore * 100) / 100,
      performanceScore: Math.round(performanceScore * 100) / 100,
      verificationScore: Math.round(verificationScore * 100) / 100,
    },
  };
}

/**
 * Sort doctors by score (highest first)
 */
export function sortDoctorsByScore<T extends { score?: DoctorScore }>(
  doctors: T[]
): T[] {
  return [...doctors].sort((a, b) => {
    const scoreA = a.score?.totalScore || 0;
    const scoreB = b.score?.totalScore || 0;
    return scoreB - scoreA; // Descending order
  });
}

/**
 * Get score explanation for debugging/display
 */
export function getScoreExplanation(score: DoctorScore): string {
  const { breakdown, totalScore } = score;
  return `
    Total Score: ${totalScore.toFixed(2)}/110
    - Experience: ${breakdown.experienceScore.toFixed(2)}/30
    - Plan: ${breakdown.planScore.toFixed(2)}/40
    - Rating: ${breakdown.ratingScore.toFixed(2)}/20
    - Performance: ${breakdown.performanceScore.toFixed(2)}/10
    - Verification: ${breakdown.verificationScore.toFixed(2)}/10
  `.trim();
}

