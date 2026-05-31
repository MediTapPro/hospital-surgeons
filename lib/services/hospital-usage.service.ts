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
import { eq, and, sql } from 'drizzle-orm';
import { 
  getMaxPatientsForHospital,
  getMaxAssignmentsForHospitalFromUser,
  DEFAULT_HOSPITAL_PATIENT_LIMIT,
  DEFAULT_HOSPITAL_ASSIGNMENT_LIMIT 
} from '@/lib/config/hospital-subscription-limits';

export class HospitalUsageService {
  private db = getDb();

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

    // Get or create usage record for current month
    const currentMonth = new Date().toISOString().slice(0, 7); // "2024-03"
    
    let usage = await this.db
      .select()
      .from(hospitalUsageTracking)
      .where(
        and(
          eq(hospitalUsageTracking.hospitalId, hospitalId),
          eq(hospitalUsageTracking.month, currentMonth)
        )
      )
      .limit(1);

    if (usage.length === 0) {
      // Create new usage record
      const resetDate = new Date();
      resetDate.setMonth(resetDate.getMonth() + 1);
      resetDate.setDate(1);
      resetDate.setHours(0, 0, 0, 0);

      // Get assignment limit from database too
      const maxAssignments = await getMaxAssignmentsForHospitalFromUser(hospital[0].userId);

      const usageResult = await this.db
        .insert(hospitalUsageTracking)
        .values({
          hospitalId,
          month: currentMonth,
          patientsCount: 0,
          assignmentsCount: 0,
          patientsLimit: maxPatients,
          assignmentsLimit: maxAssignments,
          resetDate: resetDate.toISOString(),
        })
        .returning();
      usage = usageResult;
    } else {
      // Update limits if plan changed
      const usageData = usage[0];
      // Get current limits from database to check if they changed
      const currentMaxPatients = await getMaxPatientsForHospital(hospital[0].userId);
      const currentMaxAssignments = await getMaxAssignmentsForHospitalFromUser(hospital[0].userId);
      
      if (usageData.patientsLimit !== currentMaxPatients || usageData.assignmentsLimit !== currentMaxAssignments) {
        await this.db
          .update(hospitalUsageTracking)
          .set({
            patientsLimit: currentMaxPatients,
            assignmentsLimit: currentMaxAssignments,
            updatedAt: new Date().toISOString(),
          })
          .where(
            and(
              eq(hospitalUsageTracking.hospitalId, hospitalId),
              eq(hospitalUsageTracking.month, currentMonth)
            )
          );
      }
    }

    const usageData = usage[0] || usage;

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

    // Get or create usage record for current month
    const currentMonth = new Date().toISOString().slice(0, 7); // "2024-03"
    
    let usage = await this.db
      .select()
      .from(hospitalUsageTracking)
      .where(
        and(
          eq(hospitalUsageTracking.hospitalId, hospitalId),
          eq(hospitalUsageTracking.month, currentMonth)
        )
      )
      .limit(1);

    if (usage.length === 0) {
      // Create new usage record
      const resetDate = new Date();
      resetDate.setMonth(resetDate.getMonth() + 1);
      resetDate.setDate(1);
      resetDate.setHours(0, 0, 0, 0);

      // Get patient limit from database too
      const maxPatients = await getMaxPatientsForHospital(hospital[0].userId);

      const usageResult = await this.db
        .insert(hospitalUsageTracking)
        .values({
          hospitalId,
          month: currentMonth,
          patientsCount: 0,
          assignmentsCount: 0,
          patientsLimit: maxPatients,
          assignmentsLimit: maxAssignments,
          resetDate: resetDate.toISOString(),
        })
        .returning();
      usage = usageResult;
    } else {
      // Update limits if plan changed
      const usageData = usage[0];
      // Get current limits from database to check if they changed
      const currentMaxPatients = await getMaxPatientsForHospital(hospital[0].userId);
      const currentMaxAssignments = await getMaxAssignmentsForHospitalFromUser(hospital[0].userId);
      
      if (usageData.assignmentsLimit !== currentMaxAssignments || usageData.patientsLimit !== currentMaxPatients) {
        await this.db
          .update(hospitalUsageTracking)
          .set({
            patientsLimit: currentMaxPatients,
            assignmentsLimit: currentMaxAssignments,
            updatedAt: new Date().toISOString(),
          })
          .where(
            and(
              eq(hospitalUsageTracking.hospitalId, hospitalId),
              eq(hospitalUsageTracking.month, currentMonth)
            )
          );
      }
    }

    const usageData = usage[0] || usage;

    // Check if limit reached
    if (usageData.assignmentsCount >= maxAssignments) {
      throw new Error('HOSPITAL_ASSIGNMENT_LIMIT_REACHED');
    }
  }

  /**
   * Increment patient usage count
   */
  async incrementPatientUsage(hospitalId: string): Promise<void> {
    const currentMonth = new Date().toISOString().slice(0, 7);

    // Get or create usage record
    let usage = await this.db
      .select()
      .from(hospitalUsageTracking)
      .where(
        and(
          eq(hospitalUsageTracking.hospitalId, hospitalId),
          eq(hospitalUsageTracking.month, currentMonth)
        )
      )
      .limit(1);

    if (usage.length === 0) {
      // Get hospital's userId to determine limits
      const hospital = await this.db
        .select({ userId: hospitals.userId })
        .from(hospitals)
        .where(eq(hospitals.id, hospitalId))
        .limit(1);

      if (hospital.length === 0) return;

      // Get limits from database (queries hospitalPlanFeatures)
      const maxPatients = await getMaxPatientsForHospital(hospital[0].userId);
      const maxAssignments = await getMaxAssignmentsForHospitalFromUser(hospital[0].userId);

      const resetDate = new Date();
      resetDate.setMonth(resetDate.getMonth() + 1);
      resetDate.setDate(1);
      resetDate.setHours(0, 0, 0, 0);

      await this.db.insert(hospitalUsageTracking).values({
        hospitalId,
        month: currentMonth,
        patientsCount: 1,
        assignmentsCount: 0,
        patientsLimit: maxPatients,
        assignmentsLimit: maxAssignments,
        resetDate: resetDate.toISOString(),
      });
    } else {
      // Increment existing count
      await this.db
        .update(hospitalUsageTracking)
        .set({
          patientsCount: sql`${hospitalUsageTracking.patientsCount} + 1`,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(hospitalUsageTracking.hospitalId, hospitalId),
            eq(hospitalUsageTracking.month, currentMonth)
          )
        );
    }
  }

  /**
   * Increment assignment usage count
   */
  async incrementAssignmentUsage(hospitalId: string): Promise<void> {
    const currentMonth = new Date().toISOString().slice(0, 7);

    // Get or create usage record
    let usage = await this.db
      .select()
      .from(hospitalUsageTracking)
      .where(
        and(
          eq(hospitalUsageTracking.hospitalId, hospitalId),
          eq(hospitalUsageTracking.month, currentMonth)
        )
      )
      .limit(1);

    if (usage.length === 0) {
      // Get hospital's userId to determine limits
      const hospital = await this.db
        .select({ userId: hospitals.userId })
        .from(hospitals)
        .where(eq(hospitals.id, hospitalId))
        .limit(1);

      if (hospital.length === 0) return;

      // Get limits from database (queries hospitalPlanFeatures)
      const maxPatients = await getMaxPatientsForHospital(hospital[0].userId);
      const maxAssignments = await getMaxAssignmentsForHospitalFromUser(hospital[0].userId);

      const resetDate = new Date();
      resetDate.setMonth(resetDate.getMonth() + 1);
      resetDate.setDate(1);
      resetDate.setHours(0, 0, 0, 0);

      await this.db.insert(hospitalUsageTracking).values({
        hospitalId,
        month: currentMonth,
        patientsCount: 0,
        assignmentsCount: 1,
        patientsLimit: maxPatients,
        assignmentsLimit: maxAssignments,
        resetDate: resetDate.toISOString(),
      });
    } else {
      // Increment existing count
      await this.db
        .update(hospitalUsageTracking)
        .set({
          assignmentsCount: sql`${hospitalUsageTracking.assignmentsCount} + 1`,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(hospitalUsageTracking.hospitalId, hospitalId),
            eq(hospitalUsageTracking.month, currentMonth)
          )
        );
    }
  }

  /**
   * Get current month usage for a hospital
   */
  async getUsage(hospitalId: string) {
    const currentMonth = new Date().toISOString().slice(0, 7);

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

    // Get usage record
    const usage = await this.db
      .select()
      .from(hospitalUsageTracking)
      .where(
        and(
          eq(hospitalUsageTracking.hospitalId, hospitalId),
          eq(hospitalUsageTracking.month, currentMonth)
        )
      )
      .limit(1);

    const usageData = usage.length > 0 ? usage[0] : {
      patientsCount: 0,
      assignmentsCount: 0,
      patientsLimit: maxPatients,
      assignmentsLimit: maxAssignments,
      month: currentMonth,
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

    // Calculate reset date (1st of next month)
    const resetDate = new Date();
    resetDate.setMonth(resetDate.getMonth() + 1);
    resetDate.setDate(1);
    resetDate.setHours(0, 0, 0, 0);

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
      resetDate: resetDate.toISOString(),
    };
  }
}

