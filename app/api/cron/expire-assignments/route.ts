import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { assignments, doctorAvailability, enumStatus } from '@/src/db/drizzle/migrations/schema';
import { eq, and, sql, lt } from 'drizzle-orm';

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Auto-cancel expired assignments
 * 
 * Primary: pg_cron runs inside the DB every 5 minutes (migration 20260621000000).
 * This HTTP endpoint is kept as a manual fallback for testing/on-demand runs.
 * 
 * Finds all pending assignments where expiresAt < NOW() and:
 * 1. Updates status to 'cancelled'
 * 2. Sets cancelledBy to 'system'
 * 3. Sets cancelledAt timestamp
 * 4. Releases the availability slot back to 'available'
 */
async function handler(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const providedSecret = req.headers.get('x-cron-secret');
    
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}` && providedSecret !== CRON_SECRET) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    console.log('Expire-assignments cron job started');

    const db = getDb();
    const now = new Date().toISOString();

    // Find all pending assignments that have expired
    const expiredAssignments = await db
      .select({
        id: assignments.id,
        status: assignments.status,
        expiresAt: assignments.expiresAt,
        availabilitySlotId: assignments.availabilitySlotId,
      })
      .from(assignments)
      .where(
        and(
          eq(assignments.status, 'pending'),
          sql`${assignments.expiresAt} IS NOT NULL`,
          lt(assignments.expiresAt, now)
        )
      );

    if (expiredAssignments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No expired assignments found',
        data: {
          expiredCount: 0,
          cancelledCount: 0,
        },
      });
    }

    // Update expired assignments to cancelled (one by one to avoid SQL array issues)
    let cancelledCount = 0;
    const cancelledAssignments = [];
    
    for (const expiredAssignment of expiredAssignments) {
      const [cancelled] = await db
        .update(assignments)
        .set({
          status: 'cancelled',
          cancelledBy: 'system',
          cancelledAt: now,
          cancellationReason: 'Assignment expired - doctor did not respond within the time limit',
        })
        .where(eq(assignments.id, expiredAssignment.id))
        .returning();
      
      if (cancelled) {
        cancelledAssignments.push(cancelled);
        cancelledCount++;
      }
    }

    // Release availability slots for cancelled assignments
    const slotsToRelease = expiredAssignments
      .filter(a => a.availabilitySlotId)
      .map(a => a.availabilitySlotId);

    let releasedSlotsCount = 0;
    if (slotsToRelease.length > 0) {
      // Release each slot
      for (const slotId of slotsToRelease) {
        if (slotId) {
          await db
            .update(doctorAvailability)
            .set({
              status: 'available',
              bookedByHospitalId: null,
              bookedAt: null,
            })
            .where(eq(doctorAvailability.id, slotId));
          releasedSlotsCount++;
        }
      }
    }

    // Ensure 'cancelled' status exists in enum_status
    const statusCheck = await db
      .select()
      .from(enumStatus)
      .where(eq(enumStatus.status, 'cancelled'))
      .limit(1);

    if (statusCheck.length === 0) {
      await db.insert(enumStatus).values({
        status: 'cancelled',
        description: 'Assignment cancelled (expired or manually cancelled)',
      }).onConflictDoNothing();
    }

    return NextResponse.json({
      success: true,
      message: `Successfully cancelled ${cancelledAssignments.length} expired assignment(s)`,
      data: {
        expiredCount: expiredAssignments.length,
        cancelledCount: cancelledAssignments.length,
        releasedSlotsCount,
      },
    });
  } catch (error) {
    console.error('Cron job error (expire-assignments):', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to expire assignments', 
        error: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}

export const GET = handler;
export const POST = handler;

