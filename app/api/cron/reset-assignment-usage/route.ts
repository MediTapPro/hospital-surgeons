import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { doctors, hospitals, subscriptions, subscriptionPlans, doctorPlanFeatures, doctorAssignmentUsage, hospitalUsageTracking } from '@/src/db/drizzle/migrations/schema';
import { eq, and, gte } from 'drizzle-orm';
import { getMaxAssignmentsForDoctor, DEFAULT_ASSIGNMENT_LIMIT } from '@/lib/config/subscription-limits';
import { getMaxPatientsForHospital, getMaxAssignmentsForHospitalFromUser } from '@/lib/config/hospital-subscription-limits';

const CRON_SECRET = process.env.CRON_SECRET;

async function handler(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    const providedSecret = req.headers.get('x-cron-secret');
    const isVercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    const isManualCall = CRON_SECRET && providedSecret === CRON_SECRET;

    if (CRON_SECRET && !isVercelCron && !isManualCall) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7); // "2024-03"

    // Calculate reset date once (1st of next month)
    const resetDate = new Date();
    resetDate.setMonth(resetDate.getMonth() + 1);
    resetDate.setDate(1);
    resetDate.setHours(0, 0, 0, 0);
    const resetDateIso = resetDate.toISOString();

    // --- Phase 1: Pre-fetch all data outside transaction (reads + limit lookups) ---
    const allDoctors = await db.select({ id: doctors.id, userId: doctors.userId }).from(doctors);
    const allHospitals = await db.select({ id: hospitals.id, userId: hospitals.userId }).from(hospitals);

    type DoctorOp = { doctorId: string; maxAssignments: number; hasExisting: boolean };
    type HospitalOp = { hospitalId: string; maxPatients: number; maxAssignments: number; hasExisting: boolean };

    const doctorOps: DoctorOp[] = [];
    for (const doctor of allDoctors) {
      const maxAssignments = await getMaxAssignmentsForDoctor(doctor.userId);
      const existing = await db
        .select({ id: doctorAssignmentUsage.doctorId })
        .from(doctorAssignmentUsage)
        .where(and(eq(doctorAssignmentUsage.doctorId, doctor.id), eq(doctorAssignmentUsage.month, currentMonth)))
        .limit(1);
      doctorOps.push({ doctorId: doctor.id, maxAssignments, hasExisting: existing.length > 0 });
    }

    const hospitalOps: HospitalOp[] = [];
    for (const hospital of allHospitals) {
      const maxPatients = await getMaxPatientsForHospital(hospital.userId);
      const maxAssignments = await getMaxAssignmentsForHospitalFromUser(hospital.userId);
      const existing = await db
        .select({ id: hospitalUsageTracking.hospitalId })
        .from(hospitalUsageTracking)
        .where(and(eq(hospitalUsageTracking.hospitalId, hospital.id), eq(hospitalUsageTracking.month, currentMonth)))
        .limit(1);
      hospitalOps.push({ hospitalId: hospital.id, maxPatients, maxAssignments, hasExisting: existing.length > 0 });
    }

    // --- Phase 2: All writes in a single atomic transaction ---
    let resetCount = 0;
    let updatedCount = 0;
    let hospitalResetCount = 0;
    let hospitalUpdatedCount = 0;

    await db.transaction(async (tx) => {
      for (const op of doctorOps) {
        if (!op.hasExisting) {
          await tx.insert(doctorAssignmentUsage).values({
            doctorId: op.doctorId,
            month: currentMonth,
            count: 0,
            limitCount: op.maxAssignments,
            resetDate: resetDateIso,
          });
          resetCount++;
        } else {
          await tx
            .update(doctorAssignmentUsage)
            .set({ count: 0, limitCount: op.maxAssignments, resetDate: resetDateIso, updatedAt: now.toISOString() })
            .where(and(eq(doctorAssignmentUsage.doctorId, op.doctorId), eq(doctorAssignmentUsage.month, currentMonth)));
          updatedCount++;
        }
      }

      for (const op of hospitalOps) {
        if (!op.hasExisting) {
          await tx.insert(hospitalUsageTracking).values({
            hospitalId: op.hospitalId,
            month: currentMonth,
            patientsCount: 0,
            assignmentsCount: 0,
            patientsLimit: op.maxPatients,
            assignmentsLimit: op.maxAssignments,
            resetDate: resetDateIso,
          });
          hospitalResetCount++;
        } else {
          await tx
            .update(hospitalUsageTracking)
            .set({
              patientsCount: 0,
              assignmentsCount: 0,
              patientsLimit: op.maxPatients,
              assignmentsLimit: op.maxAssignments,
              resetDate: resetDateIso,
              updatedAt: now.toISOString(),
            })
            .where(and(eq(hospitalUsageTracking.hospitalId, op.hospitalId), eq(hospitalUsageTracking.month, currentMonth)));
          hospitalUpdatedCount++;
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: `Reset usage for ${resetCount + updatedCount} doctors and ${hospitalResetCount + hospitalUpdatedCount} hospitals`,
      data: { 
        doctors: {
          resetCount, 
          updatedCount,
          totalProcessed: resetCount + updatedCount,
        },
        hospitals: {
          resetCount: hospitalResetCount,
          updatedCount: hospitalUpdatedCount,
          totalProcessed: hospitalResetCount + hospitalUpdatedCount,
        },
        month: currentMonth 
      },
    });
  } catch (error) {
    console.error('Error resetting assignment usage:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to reset usage', error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export const GET = handler;
export const POST = handler;



