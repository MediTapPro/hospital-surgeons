import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { subscriptionPlans, subscriptions, doctorPlanFeatures, hospitalPlanFeatures, planPricing } from '@/src/db/drizzle/migrations/schema';
import { eq, sql, and, ne, count, asc, inArray } from 'drizzle-orm';
import { validateRequest } from '@/lib/utils/validate-request';
import { UpdatePlanDtoSchema } from '@/lib/validations/plan.dto';
import { createAuditLog, getRequestMetadata, buildChangesObject } from '@/lib/utils/audit-logger';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const planId = id;

    // Get plan
    const planResult = await db
      .select({
        id: subscriptionPlans.id,
        name: subscriptionPlans.name,
        tier: subscriptionPlans.tier,
        userRole: subscriptionPlans.userRole,
        isActive: subscriptionPlans.isActive,
        description: subscriptionPlans.description,
        defaultBillingCycle: subscriptionPlans.defaultBillingCycle,
      })
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId))
      .limit(1);

    // Get pricing options for this plan
    let pricingOptions: any[] = [];
    try {
      pricingOptions = await db
        .select()
        .from(planPricing)
        .where(
          and(
            eq(planPricing.planId, planId),
            eq(planPricing.isActive, true),
            sql`(${planPricing.validUntil} IS NULL OR ${planPricing.validUntil} > NOW())`
          )
        )
        .orderBy(asc(planPricing.billingPeriodMonths));
    } catch (error) {
      console.error('Error fetching pricing options:', error);
      // Continue without pricing if table doesn't exist yet
    }

    // Get subscriber count separately
    const subscriberCountResult = await db
      .select({ count: count() })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.planId, planId),
          eq(subscriptions.status, 'active')
        )
      );

    const subscriberCount = subscriberCountResult[0]?.count || 0;

    if (planResult.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Subscription plan not found' },
        { status: 404 }
      );
    }

    const plan = planResult[0];
    const primaryPricing = pricingOptions.find(p => p.billingCycle === 'monthly') || pricingOptions[0];

    // Get plan features
    let features = null;
    if (plan.userRole === 'doctor') {
      const doctorFeatures = await db
        .select()
        .from(doctorPlanFeatures)
        .where(eq(doctorPlanFeatures.planId, planId))
        .limit(1);
      
      if (doctorFeatures.length > 0) {
        features = {
          visibilityWeight: doctorFeatures[0].visibilityWeight,
          maxAffiliations: doctorFeatures[0].maxAffiliations,
          notes: doctorFeatures[0].notes,
        };
      }
    } else if (plan.userRole === 'hospital') {
      const hospitalFeatures = await db
        .select()
        .from(hospitalPlanFeatures)
        .where(eq(hospitalPlanFeatures.planId, planId))
        .limit(1);
      
      if (hospitalFeatures.length > 0) {
        features = {
          maxPatientsPerMonth: hospitalFeatures[0].maxPatientsPerMonth,
          includesPremiumDoctors: hospitalFeatures[0].includesPremiumDoctors,
          notes: hospitalFeatures[0].notes,
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: plan.id,
        name: plan.name,
        tier: plan.tier,
        userRole: plan.userRole,
        isActive: plan.isActive,
        description: plan.description,
        defaultBillingCycle: plan.defaultBillingCycle,
        pricingOptions: pricingOptions.map(p => ({
          id: p.id,
          billingCycle: p.billingCycle,
          billingPeriodMonths: p.billingPeriodMonths,
          price: Number(p.price),
          currency: p.currency,
          discountPercentage: Number(p.discountPercentage),
          isActive: p.isActive,
        })),
        price: primaryPricing ? Number(primaryPricing.price) : 0,
        currency: primaryPricing ? primaryPricing.currency : 'USD',
        priceFormatted: primaryPricing 
          ? `${primaryPricing.currency} ${Number(primaryPricing.price).toFixed(2)}`
          : 'No pricing',
        subscribers: Number(subscriberCount),
        features,
      },
    });
  } catch (error) {
    console.error('Error fetching subscription plan:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch subscription plan',
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
    
    // Validate request body with Zod schema
    const validation = await validateRequest(req, UpdatePlanDtoSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { name, tier, description, isActive, defaultBillingCycle, features } = validation.data;

    // Check if plan exists
    const existing = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Subscription plan not found' },
        { status: 404 }
      );
    }

    const planData = existing[0];
    const userRole = planData.userRole;

    // Build update object (no price/currency - Approach 3)
    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (tier !== undefined) updateData.tier = tier;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (defaultBillingCycle !== undefined) updateData.defaultBillingCycle = defaultBillingCycle;

    // Check for duplicate name if name is being updated (only for active plans with same userRole)
    if (name && name.trim() !== existing[0].name) {
      const duplicateByName = await db
        .select()
        .from(subscriptionPlans)
        .where(
          and(
            eq(subscriptionPlans.name, name.trim()),
            eq(subscriptionPlans.userRole, userRole),
            eq(subscriptionPlans.isActive, true),
            ne(subscriptionPlans.id, planId)
          )
        )
        .limit(1);

      if (duplicateByName.length > 0) {
        return NextResponse.json(
          { success: false, message: `An active plan with the name "${name.trim()}" already exists for ${userRole}s` },
          { status: 409 }
        );
      }
    }

    // Check for duplicate tier if tier is being updated (same tier for same userRole)
    if (tier && tier !== existing[0].tier) {
      const duplicateByTier = await db
        .select()
        .from(subscriptionPlans)
        .where(
          and(
            eq(subscriptionPlans.tier, tier),
            eq(subscriptionPlans.userRole, userRole),
            ne(subscriptionPlans.id, planId)
          )
        )
        .limit(1);

      if (duplicateByTier.length > 0) {
        return NextResponse.json(
          { success: false, message: `A ${tier} plan already exists for ${userRole}s` },
          { status: 409 }
        );
      }
    }

    // Pre-fetch feature rows outside the transaction (reads are safe outside)
    const existingDoctorFeatures = features && userRole === 'doctor'
      ? await db.select().from(doctorPlanFeatures).where(eq(doctorPlanFeatures.planId, planId)).limit(1)
      : [];
    const existingHospitalFeatures = features && userRole === 'hospital'
      ? await db.select().from(hospitalPlanFeatures).where(eq(hospitalPlanFeatures.planId, planId)).limit(1)
      : [];

    // Update plan + features atomically so they can never be out of sync
    let updatedPlan: typeof subscriptionPlans.$inferSelect = {} as any;

    await db.transaction(async (tx) => {
      [updatedPlan] = await tx
        .update(subscriptionPlans)
        .set(updateData)
        .where(eq(subscriptionPlans.id, planId))
        .returning();

      if (features) {
        if (userRole === 'doctor') {
          const doctorFeatures = features as { visibilityWeight?: number; maxAffiliations?: number; maxAssignmentsPerMonth?: number; notes?: string };
          const { visibilityWeight, maxAffiliations, maxAssignmentsPerMonth, notes } = doctorFeatures;

          if (existingDoctorFeatures.length > 0) {
            await tx
              .update(doctorPlanFeatures)
              .set({
                visibilityWeight: visibilityWeight !== undefined ? visibilityWeight : existingDoctorFeatures[0].visibilityWeight,
                maxAffiliations: maxAffiliations !== undefined ? maxAffiliations : existingDoctorFeatures[0].maxAffiliations,
                maxAssignmentsPerMonth: maxAssignmentsPerMonth !== undefined ? maxAssignmentsPerMonth : existingDoctorFeatures[0].maxAssignmentsPerMonth,
                notes: notes !== undefined ? notes : existingDoctorFeatures[0].notes,
              })
              .where(eq(doctorPlanFeatures.planId, planId));
          } else {
            await tx
              .insert(doctorPlanFeatures)
              .values({
                planId,
                visibilityWeight: visibilityWeight !== undefined ? visibilityWeight : 1,
                maxAffiliations: maxAffiliations !== undefined ? maxAffiliations : 1,
                maxAssignmentsPerMonth: maxAssignmentsPerMonth !== undefined ? maxAssignmentsPerMonth : null,
                notes: notes || null,
              });
          }
        } else if (userRole === 'hospital') {
          const hospitalFeatures = features as { maxPatientsPerMonth?: number; maxAssignmentsPerMonth?: number; includesPremiumDoctors?: boolean; notes?: string };
          const { maxPatientsPerMonth, maxAssignmentsPerMonth, includesPremiumDoctors, notes } = hospitalFeatures;

          if (existingHospitalFeatures.length > 0) {
            await tx
              .update(hospitalPlanFeatures)
              .set({
                maxPatientsPerMonth: maxPatientsPerMonth !== undefined ? maxPatientsPerMonth : existingHospitalFeatures[0].maxPatientsPerMonth,
                maxAssignmentsPerMonth: maxAssignmentsPerMonth !== undefined ? maxAssignmentsPerMonth : existingHospitalFeatures[0].maxAssignmentsPerMonth,
                includesPremiumDoctors: includesPremiumDoctors !== undefined ? includesPremiumDoctors : existingHospitalFeatures[0].includesPremiumDoctors,
                notes: notes !== undefined ? notes : existingHospitalFeatures[0].notes,
              })
              .where(eq(hospitalPlanFeatures.planId, planId));
          } else {
            await tx
              .insert(hospitalPlanFeatures)
              .values({
                planId,
                maxPatientsPerMonth: maxPatientsPerMonth !== undefined && maxPatientsPerMonth !== null ? maxPatientsPerMonth : null,
                maxAssignmentsPerMonth: maxAssignmentsPerMonth !== undefined && maxAssignmentsPerMonth !== null ? maxAssignmentsPerMonth : null,
                includesPremiumDoctors: includesPremiumDoctors !== undefined ? includesPremiumDoctors : false,
                notes: notes || null,
              });
          }
        }
      }
    });

    // Get request metadata
    const metadata = getRequestMetadata(req);
    const adminUserId = req.headers.get('x-user-id') || null;

    // Build changes object
    const oldData: any = {
      name: planData.name,
      tier: planData.tier,
      isActive: planData.isActive,
      description: planData.description,
      defaultBillingCycle: planData.defaultBillingCycle,
    };
    const newData: any = {
      name: updatedPlan.name,
      tier: updatedPlan.tier,
      isActive: updatedPlan.isActive,
      description: updatedPlan.description,
      defaultBillingCycle: updatedPlan.defaultBillingCycle,
    };
    const changes = buildChangesObject(oldData, newData, ['name', 'tier', 'isActive', 'description', 'defaultBillingCycle']);

    // Create comprehensive audit log
    await createAuditLog({
      userId: adminUserId,
      actorType: 'admin',
      action: 'update',
      entityType: 'subscription_plan',
      entityId: planId,
      entityName: updatedPlan.name,
      httpMethod: 'PUT',
      endpoint: `/api/admin/plans/${planId}`,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      changes: changes,
      details: {
        userRole: updatedPlan.userRole,
        featuresUpdated: !!features,
        features: features ? (userRole === 'doctor' 
          ? {
              visibilityWeight: (features as any).visibilityWeight,
              maxAffiliations: (features as any).maxAffiliations,
            }
          : {
              maxPatientsPerMonth: (features as any).maxPatientsPerMonth,
              maxAssignmentsPerMonth: (features as any).maxAssignmentsPerMonth,
              includesPremiumDoctors: (features as any).includesPremiumDoctors,
            }) : null,
      },
    });

    return NextResponse.json({
      success: true,
      message: features ? 'Subscription plan and features updated successfully' : 'Subscription plan updated successfully',
      data: {
        id: updatedPlan.id,
        name: updatedPlan.name,
        tier: updatedPlan.tier,
        userRole: updatedPlan.userRole,
        isActive: updatedPlan.isActive,
        description: updatedPlan.description,
        defaultBillingCycle: updatedPlan.defaultBillingCycle,
      },
    });
  } catch (error) {
    console.error('Error updating subscription plan:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to update subscription plan',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const planId = id;

    // Step 1: Check if plan exists
    const existing = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Subscription plan not found' },
        { status: 404 }
      );
    }

    // Step 2: Check if plan has any active or suspended subscriptions before soft deletion
    const blockingSubscriptions = await db
      .select({ count: count() })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.planId, planId),
          inArray(subscriptions.status, ['active', 'suspended'])
        )
      );

    const blockingSubscriptionCount = Number(blockingSubscriptions[0]?.count || 0);

    // Step 3: Prevent soft deletion if there are active or suspended subscriptions
    if (blockingSubscriptionCount > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Cannot delete plan. It has ${blockingSubscriptionCount} active or suspended subscription(s).`,
          data: {
            subscriptionCount: blockingSubscriptionCount,
          },
        },
        { status: 409 }
      );
    }

    // Step 4: Safe to soft delete - set isActive = false (preserves data for history/reporting)
    await db
      .update(subscriptionPlans)
      .set({ isActive: false })
      .where(eq(subscriptionPlans.id, planId));

    // Get request metadata
    const metadata = getRequestMetadata(req);
    const adminUserId = req.headers.get('x-user-id') || null;

    // Create comprehensive audit log
    await createAuditLog({
      userId: adminUserId,
      actorType: 'admin',
      action: 'delete',
      entityType: 'subscription_plan',
      entityId: planId,
      entityName: existing[0].name,
      httpMethod: 'DELETE',
      endpoint: `/api/admin/plans/${planId}`,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      details: {
        tier: existing[0].tier,
        userRole: existing[0].userRole,
        activeSubscriptionsAtDeletion: blockingSubscriptionCount,
        softDeletedAt: new Date().toISOString(),
        isActive: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Subscription plan soft deleted successfully (marked as inactive)',
    });
  } catch (error) {
    console.error('Error deleting subscription plan:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to delete subscription plan',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

