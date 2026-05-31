import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { subscriptionPlans, doctorPlanFeatures, hospitalPlanFeatures } from '@/src/db/drizzle/migrations/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const planId = id;

    // Check if plan exists
    const plan = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId))
      .limit(1);

    if (plan.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Subscription plan not found' },
        { status: 404 }
      );
    }

    const planData = plan[0];

    // Get plan features based on user role
    if (planData.userRole === 'doctor') {
      const features = await db
        .select()
        .from(doctorPlanFeatures)
        .where(eq(doctorPlanFeatures.planId, planId))
        .limit(1);

      if (features.length > 0) {
        return NextResponse.json({
          success: true,
          data: {
            planId: planId,
            userRole: planData.userRole,
            visibilityWeight: features[0].visibilityWeight,
            maxAffiliations: features[0].maxAffiliations,
            maxAssignmentsPerMonth: features[0].maxAssignmentsPerMonth,
            notes: features[0].notes,
          },
        });
      }
    } else if (planData.userRole === 'hospital') {
      const features = await db
        .select()
        .from(hospitalPlanFeatures)
        .where(eq(hospitalPlanFeatures.planId, planId))
        .limit(1);

      if (features.length > 0) {
        return NextResponse.json({
          success: true,
          data: {
            planId: planId,
            userRole: planData.userRole,
            maxPatientsPerMonth: features[0].maxPatientsPerMonth,
            maxAssignmentsPerMonth: features[0].maxAssignmentsPerMonth,
            includesPremiumDoctors: features[0].includesPremiumDoctors,
            notes: features[0].notes,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: null,
      message: 'No features configured for this plan',
    });
  } catch (error) {
    console.error('Error fetching plan features:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch plan features',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const planId = id;
    const body = await req.json();

    // Check if plan exists
    const plan = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId))
      .limit(1);

    if (plan.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Subscription plan not found' },
        { status: 404 }
      );
    }

    const planData = plan[0];

    // Update or create features based on user role
    if (planData.userRole === 'doctor') {
      const { visibilityWeight, maxAffiliations, maxAssignmentsPerMonth, notes } = body;

      const existing = await db
        .select()
        .from(doctorPlanFeatures)
        .where(eq(doctorPlanFeatures.planId, planId))
        .limit(1);

      if (existing.length > 0) {
        // Update existing
        const [updated] = await db
          .update(doctorPlanFeatures)
          .set({
            visibilityWeight: visibilityWeight !== undefined ? visibilityWeight : existing[0].visibilityWeight,
            maxAffiliations: maxAffiliations !== undefined ? maxAffiliations : existing[0].maxAffiliations,
            maxAssignmentsPerMonth: maxAssignmentsPerMonth !== undefined ? maxAssignmentsPerMonth : existing[0].maxAssignmentsPerMonth,
            notes: notes !== undefined ? notes : existing[0].notes,
          })
          .where(eq(doctorPlanFeatures.planId, planId))
          .returning();

        return NextResponse.json({
          success: true,
          message: 'Doctor plan features updated successfully',
          data: updated,
        });
      } else {
        // Create new
        const [created] = await db
          .insert(doctorPlanFeatures)
          .values({
            planId: planId,
            visibilityWeight: visibilityWeight || 1,
            maxAffiliations: maxAffiliations || 1,
            maxAssignmentsPerMonth: maxAssignmentsPerMonth !== undefined ? maxAssignmentsPerMonth : null,
            notes: notes || null,
          })
          .returning();

        return NextResponse.json({
          success: true,
          message: 'Doctor plan features created successfully',
          data: created,
        });
      }
    } else if (planData.userRole === 'hospital') {
      const { maxPatientsPerMonth, maxAssignmentsPerMonth, includesPremiumDoctors, notes } = body;

      const existing = await db
        .select()
        .from(hospitalPlanFeatures)
        .where(eq(hospitalPlanFeatures.planId, planId))
        .limit(1);

      if (existing.length > 0) {
        // Update existing
        const [updated] = await db
          .update(hospitalPlanFeatures)
          .set({
            maxPatientsPerMonth: maxPatientsPerMonth !== undefined ? maxPatientsPerMonth : existing[0].maxPatientsPerMonth,
            maxAssignmentsPerMonth: maxAssignmentsPerMonth !== undefined ? maxAssignmentsPerMonth : existing[0].maxAssignmentsPerMonth,
            includesPremiumDoctors: includesPremiumDoctors !== undefined ? includesPremiumDoctors : existing[0].includesPremiumDoctors,
            notes: notes !== undefined ? notes : existing[0].notes,
          })
          .where(eq(hospitalPlanFeatures.planId, planId))
          .returning();

        return NextResponse.json({
          success: true,
          message: 'Hospital plan features updated successfully',
          data: updated,
        });
      } else {
        // Create new
        const [created] = await db
          .insert(hospitalPlanFeatures)
          .values({
            planId: planId,
            maxPatientsPerMonth: maxPatientsPerMonth !== undefined ? maxPatientsPerMonth : null,
            maxAssignmentsPerMonth: maxAssignmentsPerMonth !== undefined ? maxAssignmentsPerMonth : null,
            includesPremiumDoctors: includesPremiumDoctors || false,
            notes: notes || null,
          })
          .returning();

        return NextResponse.json({
          success: true,
          message: 'Hospital plan features created successfully',
          data: created,
        });
      }
    }

    return NextResponse.json(
      { success: false, message: 'Invalid plan user role' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating plan features:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to update plan features',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


