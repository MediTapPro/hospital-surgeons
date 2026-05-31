/**
 * Subscription Plan Limits Configuration
 * 
 * This file provides functions to get assignment limits from the database.
 * Limits are now stored in doctorPlanFeatures.maxAssignmentsPerMonth.
 * 
 * To update limits, modify the plan features in the admin panel.
 */

import { getDb } from '@/lib/db';
import { subscriptionPlans, doctorPlanFeatures, subscriptions } from '@/src/db/drizzle/migrations/schema';
import { eq, and } from 'drizzle-orm';

export type PlanTier = 'free' | 'basic' | 'premium' | 'enterprise';

/**
 * Default assignment limit when no subscription is found or plan has no features configured
 */
export const DEFAULT_ASSIGNMENT_LIMIT = 5;

/**
 * Get the maximum assignments allowed for a plan from the database
 * 
 * @param planId - The subscription plan ID
 * @returns The maximum assignments allowed (-1 for unlimited, null if not set, defaults to 5)
 */
export async function getMaxAssignmentsFromPlan(planId: string | null | undefined): Promise<number> {
  if (!planId) {
    return DEFAULT_ASSIGNMENT_LIMIT;
  }

  try {
    const db = getDb();
    
    // Get plan features from database
    const features = await db
      .select({
        maxAssignmentsPerMonth: doctorPlanFeatures.maxAssignmentsPerMonth,
      })
      .from(doctorPlanFeatures)
      .where(eq(doctorPlanFeatures.planId, planId))
      .limit(1);

    if (features.length > 0 && features[0].maxAssignmentsPerMonth !== null && features[0].maxAssignmentsPerMonth !== undefined) {
      return features[0].maxAssignmentsPerMonth;
    }

    // If no features found or maxAssignmentsPerMonth is null, return default
    return DEFAULT_ASSIGNMENT_LIMIT;
  } catch (error) {
    console.error('Error fetching max assignments from plan:', error);
    // Return default on error
    return DEFAULT_ASSIGNMENT_LIMIT;
  }
}

/**
 * Get the maximum assignments allowed for a doctor based on their subscription
 * 
 * @param userId - The doctor's user ID
 * @returns The maximum assignments allowed (-1 for unlimited, defaults to 5)
 */
export async function getMaxAssignmentsForDoctor(userId: string): Promise<number> {
  try {
    const db = getDb();
    
    // Get active subscription with plan
    const subscription = await db
      .select({
        planId: subscriptionPlans.id,
      })
      .from(subscriptions)
      .leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
      .where(
        and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.status, 'active')
        )
      )
      .limit(1);

    if (subscription.length > 0 && subscription[0].planId) {
      return await getMaxAssignmentsFromPlan(subscription[0].planId);
    }

    // No subscription found, return default
    return DEFAULT_ASSIGNMENT_LIMIT;
  } catch (error) {
    console.error('Error fetching max assignments for doctor:', error);
    return DEFAULT_ASSIGNMENT_LIMIT;
  }
}

/**
 * Check if a plan has unlimited assignments
 * 
 * @param planId - The subscription plan ID
 * @returns true if unlimited, false otherwise
 */
export async function isUnlimitedAssignments(planId: string | null | undefined): Promise<boolean> {
  const maxAssignments = await getMaxAssignmentsFromPlan(planId);
  return maxAssignments === -1;
}

