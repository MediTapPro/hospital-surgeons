/**
 * Hospital Usage Service
 * 
 * Handles hospital subscription limit checking and usage tracking
 * for both patient creation and assignment creation.
 */

import { getDb } from '@/lib/db';
import { 
  hospitals, 
  subscriptions, 
  subscriptionPlans, 
  hospitalPlanFeatures,
  hospitalUsageTracking 
} from '@/src/db/drizzle/migrations/schema';
import { eq, and, sql, lte, gt } from 'drizzle-orm';
import { 
  getMaxPatientsForHospital,
  getMaxAssignmentsForHospitalFromUser,
  DEFAULT_HOSPITAL_PATIENT_LIMIT,
  DEFAULT_HOSPITAL_ASSIGNMENT_LIMIT 
} from '@/lib/config/hospital-subscription-limits';

export class HospitalUsageService {
  private db = getDb();

  private async getCurrentPeriodUsage(hospitalId: string) {
    const sub = await this.db
      .select({
        id: subscriptions.id,
      })
      .from(subscriptions)
      .innerJoin(hospitals, eq(hospitals.userId, subscriptions.userId))
      .where(and(eq(hospitals.id, hospitalId), eq(subscriptions.status, 'active')))
      .limit(1);

    if (sub.length === 0) return null;

    const [usage] = await this.db
      .select()
      .from(hospitalUsageTracking)
      .where(
        and(
          eq(hospitalUsageTracking.hospitalId, hospitalId),
          eq(hospitalUsageTracking.subscriptionId, sub[0].id),
          lte(hospitalUsageTracking.periodStart, sql`NOW()`),
          gt(hospitalUsageTracking.periodEnd, sql`NOW()`)
        )
      )
      .limit(1);

    return usage || null;
  }

  /**
   * Check if hospital can create more patients
   * Throws error if limit reached
   */
  async checkPatientLimit(hospitalId: string): Promise<void> {
    // Get hospital's userId
    const hospital = await this.db
      .select({ userId: hospitals.userId })
      .from(hospitals)
      .where(eq(hospitals.id, hospitalId))
      .limit(1);

    if (hospital.length === 0) {
      throw new Error('Hospital not found');
    }

    // Get max patients from database (queries hospitalPlanFeatures.maxPatientsPerMonth)
    const maxPatients = await getMaxPatientsForHospital(hospital[0].userId);

    // If unlimited, skip check
    if (maxPatients === -1) {
      return;
    }

    // Get current period usage via subscription period
    const usageData = await this.getCurrentPeriodUsage(hospitalId);

    if (!usageData) return;

    // Check if limit reached
    if (usageData.patientsCount >= maxPatients) {
      throw new Error('PATIENT_LIMIT_REACHED');
    }
  }

  /**
   * Check if hospital can create more assignments
   * Throws error if limit reached
   */
  async checkAssignmentLimit(hospitalId: string): Promise<void> {
    // Get hospital's userId
    const hospital = await this.db
      .select({ userId: hospitals.userId })
      .from(hospitals)
      .where(eq(hospitals.id, hospitalId))
      .limit(1);

    if (hospital.length === 0) {
      throw new Error('Hospital not found');
    }

    // Get max assignments from database (queries hospitalPlanFeatures.maxAssignmentsPerMonth)
    const maxAssignments = await getMaxAssignmentsForHospitalFromUser(hospital[0].userId);

    // If unlimited, skip check
    if (maxAssignments === -1) {
      return;
    }

    // Get current period usage via subscription period
    const usageData = await this.getCurrentPeriodUsage(hospitalId);

    if (!usageData) return;

    // Check if limit reached
    if (usageData.assignmentsCount >= maxAssignments) {
      throw new Error('HOSPITAL_ASSIGNMENT_LIMIT_REACHED');
    }
  }

  /**
   * Increment patient usage count
   */
  async incrementPatientUsage(hospitalId: string): Promise<void> {
    const usageData = await this.getCurrentPeriodUsage(hospitalId);
    if (!usageData) return;

    // Increment existing count
    await this.db
      .update(hospitalUsageTracking)
      .set({
        patientsCount: sql`${hospitalUsageTracking.patientsCount} + 1`,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(hospitalUsageTracking.id, usageData.id));
  }

  /**
   * Increment assignment usage count
   */
  async incrementAssignmentUsage(hospitalId: string): Promise<void> {
    const usageData = await this.getCurrentPeriodUsage(hospitalId);
    if (!usageData) return;

    // Increment existing count
    await this.db
      .update(hospitalUsageTracking)
      .set({
        assignmentsCount: sql`${hospitalUsageTracking.assignmentsCount} + 1`,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(hospitalUsageTracking.id, usageData.id));
  }

  /**
   * Get current period usage for a hospital
   */
  async getUsage(hospitalId: string) {
    // Get hospital's userId
    const hospital = await this.db
      .select({ userId: hospitals.userId })
      .from(hospitals)
      .where(eq(hospitals.id, hospitalId))
      .limit(1);

    if (hospital.length === 0) {
      throw new Error('Hospital not found');
    }

    // Get active subscription with plan for plan name
    const subscription = await this.db
      .select({
        plan: {
          name: subscriptionPlans.name,
        },
      })
      .from(subscriptions)
      .leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
      .where(
        and(
          eq(subscriptions.userId, hospital[0].userId),
          eq(subscriptions.status, 'active')
        )
      )
      .limit(1);

    // Get limits from database (queries hospitalPlanFeatures)
    const maxPatients = await getMaxPatientsForHospital(hospital[0].userId);
    const maxAssignments = await getMaxAssignmentsForHospitalFromUser(hospital[0].userId);
    const planName = subscription.length > 0 && subscription[0].plan 
      ? subscription[0].plan.name 
      : 'Free Plan';

    // Get current period usage via subscription period
    const usageData = await this.getCurrentPeriodUsage(hospitalId) || {
      patientsCount: 0,
      assignmentsCount: 0,
      patientsLimit: maxPatients,
      assignmentsLimit: maxAssignments,
      periodEnd: null,
    };

    // Calculate percentages
    const patientsPercentage = maxPatients === -1 
      ? 0 
      : Math.round((usageData.patientsCount / maxPatients) * 100);
    
    const assignmentsPercentage = maxAssignments === -1 
      ? 0 
      : Math.round((usageData.assignmentsCount / maxAssignments) * 100);

    // Calculate status
    const calculateStatus = (used: number, limit: number, percentage: number): 'ok' | 'warning' | 'critical' | 'reached' => {
      if (limit === -1) return 'ok';
      if (used >= limit) return 'reached';
      if (percentage >= 80) return 'critical';
      if (percentage >= 60) return 'warning';
      return 'ok';
    };

    const patientsStatus = calculateStatus(usageData.patientsCount, maxPatients, patientsPercentage);
    const assignmentsStatus = calculateStatus(usageData.assignmentsCount, maxAssignments, assignmentsPercentage);

    const resetDate = usageData.periodEnd
      ? new Date(usageData.periodEnd).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    return {
      patients: {
        used: usageData.patientsCount,
        limit: maxPatients,
        percentage: patientsPercentage,
        status: patientsStatus,
        remaining: maxPatients === -1 ? -1 : Math.max(0, maxPatients - usageData.patientsCount),
      },
      assignments: {
        used: usageData.assignmentsCount,
        limit: maxAssignments,
        percentage: assignmentsPercentage,
        status: assignmentsStatus,
        remaining: maxAssignments === -1 ? -1 : Math.max(0, maxAssignments - usageData.assignmentsCount),
      },
      plan: planName,
      resetDate,
    };
  }
}

