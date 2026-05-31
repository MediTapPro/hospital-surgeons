/**
 * Hospital Subscription Plan Limits Configuration
 * 
 * This file provides functions to get hospital limits from the database.
 * Limits are now stored in hospitalPlanFeatures.maxPatientsPerMonth and maxAssignmentsPerMonth.
 * 
 * To update limits, modify the plan features in the admin panel.
 */

import { getDb } from '@/lib/db';
import { subscriptionPlans, hospitalPlanFeatures, subscriptions } from '@/src/db/drizzle/migrations/schema';
import { eq, and } from 'drizzle-orm';

export type HospitalPlanTier = 'free' | 'basic' | 'premium' | 'enterprise';

/**
 * Patient creation limits per plan tier
 * - free: 10 patients per month
 * - basic: 50 patients per month
 * - premium/enterprise: -1 (unlimited)
 */
export const HOSPITAL_PATIENT_LIMITS: Record<HospitalPlanTier, number> = {
  free: 10,
  basic: 50,
  premium: -1, // Unlimited
  enterprise: -1, // Unlimited
};

/**
 * Assignment creation limits per plan tier
 * - free: 20 assignments per month
 * - basic: 100 assignments per month
 * - premium/enterprise: -1 (unlimited)
 */
export const HOSPITAL_ASSIGNMENT_LIMITS: Record<HospitalPlanTier, number> = {
  free: 20,
  basic: 100,
  premium: -1, // Unlimited
  enterprise: -1, // Unlimited
};

/**
 * Default patient limit when no subscription is found
 */
export const DEFAULT_HOSPITAL_PATIENT_LIMIT = 10;

/**
 * Default assignment limit when no subscription is found
 */
export const DEFAULT_HOSPITAL_ASSIGNMENT_LIMIT = 20;

/**
 * Get the maximum patients allowed for a given plan tier
 * 
 * @param tier - The subscription plan tier
 * @returns The maximum patients allowed (-1 for unlimited)
 */
export function getMaxPatients(tier: HospitalPlanTier | string | null | undefined): number {
  if (!tier) {
    return DEFAULT_HOSPITAL_PATIENT_LIMIT;
  }

  const normalizedTier = tier.toLowerCase() as HospitalPlanTier;
  
  // Return the limit for the tier, or default if tier is invalid
  return HOSPITAL_PATIENT_LIMITS[normalizedTier] ?? DEFAULT_HOSPITAL_PATIENT_LIMIT;
}

/**
 * Get the maximum assignments allowed for a given plan tier
 * 
 * @param tier - The subscription plan tier
 * @returns The maximum assignments allowed (-1 for unlimited)
 */
export function getMaxAssignmentsForHospital(tier: HospitalPlanTier | string | null | undefined): number {
  if (!tier) {
    return DEFAULT_HOSPITAL_ASSIGNMENT_LIMIT;
  }

  const normalizedTier = tier.toLowerCase() as HospitalPlanTier;
  
  // Return the limit for the tier, or default if tier is invalid
  return HOSPITAL_ASSIGNMENT_LIMITS[normalizedTier] ?? DEFAULT_HOSPITAL_ASSIGNMENT_LIMIT;
}

/**
 * Check if a plan tier has unlimited patients
 * 
 * @param tier - The subscription plan tier
 * @returns true if unlimited, false otherwise
 */
export function isUnlimitedPatients(tier: HospitalPlanTier | string | null | undefined): boolean {
  return getMaxPatients(tier) === -1;
}

/**
 * Check if a plan tier has unlimited assignments
 * 
 * @param tier - The subscription plan tier
 * @returns true if unlimited, false otherwise
 */
export function isUnlimitedAssignmentsForHospital(tier: HospitalPlanTier | string | null | undefined): boolean {
  return getMaxAssignmentsForHospital(tier) === -1;
}

/**
 * Get the maximum patients allowed for a plan from the database
 * 
 * @param planId - The subscription plan ID
 * @returns The maximum patients allowed (-1 for unlimited, null if not set, defaults to 10)
 */
export async function getMaxPatientsFromPlan(planId: string | null | undefined): Promise<number> {
  if (!planId) {
    return DEFAULT_HOSPITAL_PATIENT_LIMIT;
  }

  try {
    const db = getDb();
    
    // Get plan features from database
    const features = await db
      .select({
        maxPatientsPerMonth: hospitalPlanFeatures.maxPatientsPerMonth,
      })
      .from(hospitalPlanFeatures)
      .where(eq(hospitalPlanFeatures.planId, planId))
      .limit(1);

    if (features.length > 0 && features[0].maxPatientsPerMonth !== null && features[0].maxPatientsPerMonth !== undefined) {
      return features[0].maxPatientsPerMonth;
    }

    // If no features found or maxPatientsPerMonth is null, return default
    return DEFAULT_HOSPITAL_PATIENT_LIMIT;
  } catch (error) {
    console.error('Error fetching max patients from plan:', error);
    // Return default on error
    return DEFAULT_HOSPITAL_PATIENT_LIMIT;
  }
}

/**
 * Get the maximum assignments allowed for a hospital plan from the database
 * 
 * @param planId - The subscription plan ID
 * @returns The maximum assignments allowed (-1 for unlimited, null if not set, defaults to 20)
 */
export async function getMaxAssignmentsForHospitalFromPlan(planId: string | null | undefined): Promise<number> {
  if (!planId) {
    return DEFAULT_HOSPITAL_ASSIGNMENT_LIMIT;
  }

  try {
    const db = getDb();
    
    // Get plan features from database
    const features = await db
      .select({
        maxAssignmentsPerMonth: hospitalPlanFeatures.maxAssignmentsPerMonth,
      })
      .from(hospitalPlanFeatures)
      .where(eq(hospitalPlanFeatures.planId, planId))
      .limit(1);

    if (features.length > 0 && features[0].maxAssignmentsPerMonth !== null && features[0].maxAssignmentsPerMonth !== undefined) {
      return features[0].maxAssignmentsPerMonth;
    }

    // If no features found or maxAssignmentsPerMonth is null, return default
    return DEFAULT_HOSPITAL_ASSIGNMENT_LIMIT;
  } catch (error) {
    console.error('Error fetching max assignments from plan:', error);
    // Return default on error
    return DEFAULT_HOSPITAL_ASSIGNMENT_LIMIT;
  }
}

/**
 * Get the maximum patients allowed for a hospital based on their subscription
 * 
 * @param userId - The hospital's user ID
 * @returns The maximum patients allowed (-1 for unlimited, defaults to 10)
 */
export async function getMaxPatientsForHospital(userId: string): Promise<number> {
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
      return await getMaxPatientsFromPlan(subscription[0].planId);
    }

    // No subscription found, return default
    return DEFAULT_HOSPITAL_PATIENT_LIMIT;
  } catch (error) {
    console.error('Error fetching max patients for hospital:', error);
    return DEFAULT_HOSPITAL_PATIENT_LIMIT;
  }
}

/**
 * Get the maximum assignments allowed for a hospital based on their subscription
 * 
 * @param userId - The hospital's user ID
 * @returns The maximum assignments allowed (-1 for unlimited, defaults to 20)
 */
export async function getMaxAssignmentsForHospitalFromUser(userId: string): Promise<number> {
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
      return await getMaxAssignmentsForHospitalFromPlan(subscription[0].planId);
    }

    // No subscription found, return default
    return DEFAULT_HOSPITAL_ASSIGNMENT_LIMIT;
  } catch (error) {
    console.error('Error fetching max assignments for hospital:', error);
    return DEFAULT_HOSPITAL_ASSIGNMENT_LIMIT;
  }
}

