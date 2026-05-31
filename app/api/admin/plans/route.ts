import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { subscriptionPlans, subscriptions, doctorPlanFeatures, hospitalPlanFeatures, planPricing } from '@/src/db/drizzle/migrations/schema';
import { eq, sql, desc, asc, and, count } from 'drizzle-orm';
import { validateRequest } from '@/lib/utils/validate-request';
import { CreatePlanDtoSchema } from '@/lib/validations/plan.dto';
import { createAuditLog, getRequestMetadata } from '@/lib/utils/audit-logger';

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const searchParams = req.nextUrl.searchParams;
    
    // Filters
    const userRole = searchParams.get('userRole') || undefined;
    const tier = searchParams.get('tier') || undefined;

    // Build where conditions
    const conditions = [];
    
    // Always filter by active plans only
    conditions.push(eq(subscriptionPlans.isActive, true));
    
    if (userRole && userRole !== 'all') {
      conditions.push(eq(subscriptionPlans.userRole, userRole));
    }
    
    if (tier && tier !== 'all') {
      conditions.push(eq(subscriptionPlans.tier, tier));
    }

    // Get only active plans
    const plansList = await db
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
      .where(conditions.length > 0 ? and(...conditions) : eq(subscriptionPlans.isActive, true))
      .orderBy(asc(subscriptionPlans.userRole), asc(subscriptionPlans.tier));

    // Get pricing and subscriber counts for all plans
    const planIds = plansList.map(p => p.id);
    const pricingMap = new Map<string, any[]>();
    const countMap = new Map<string, number>();
    
    if (planIds.length > 0) {
      // Get pricing options
      try {
        const allPricing = await db
          .select()
          .from(planPricing)
          .where(
            and(
              sql`${planPricing.planId} IN (${sql.join(planIds.map(id => sql`${id}`), sql`, `)})`,
              eq(planPricing.isActive, true),
              sql`(${planPricing.validUntil} IS NULL OR ${planPricing.validUntil} > NOW())`
            )
          );

        allPricing.forEach(p => {
          if (!pricingMap.has(p.planId)) {
            pricingMap.set(p.planId, []);
          }
          pricingMap.get(p.planId)!.push({
            id: p.id,
            billingCycle: p.billingCycle,
            billingPeriodMonths: p.billingPeriodMonths,
            price: Number(p.price),
            currency: p.currency,
            discountPercentage: Number(p.discountPercentage),
            isActive: p.isActive,
          });
        });
      } catch (error) {
        console.error('Error fetching pricing:', error);
        // Continue without pricing if table doesn't exist yet
      }

      // Get subscriber counts
      // Query subscriber counts grouped by planId
      const subscriberCounts = await db
        .select({
          planId: subscriptions.planId,
          count: sql<number>`COUNT(*)::int`.as('count'),
        })
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.status, 'active'),
            sql`${subscriptions.planId} IN (${sql.join(planIds.map(id => sql`${id}`), sql`, `)})`
          )
        )
        .groupBy(subscriptions.planId);

      // Create a map of planId -> subscriber count
      subscriberCounts.forEach(sc => {
        countMap.set(sc.planId, Number(sc.count));
      });
    }

    // Format response
    const formattedPlans = plansList.map((plan) => {
      const pricingOptions = pricingMap.get(plan.id) || [];
      // Get default/primary price (monthly if available, or first one)
      const primaryPricing = pricingOptions.find(p => p.billingCycle === 'monthly') || pricingOptions[0];
      
      return {
        id: plan.id,
        name: plan.name,
        tier: plan.tier,
        userRole: plan.userRole,
        isActive: plan.isActive,
        description: plan.description,
        defaultBillingCycle: plan.defaultBillingCycle,
        pricingOptions: pricingOptions,
        price: primaryPricing ? primaryPricing.price : 0,
        currency: primaryPricing ? primaryPricing.currency : 'USD',
        priceFormatted: primaryPricing 
          ? `${primaryPricing.currency} ${Number(primaryPricing.price).toFixed(2)}`
          : 'No pricing',
        subscribers: countMap.get(plan.id) || 0,
      };
    });

    // Group by user role
    const doctorPlans = formattedPlans.filter(p => p.userRole === 'doctor');
    const hospitalPlans = formattedPlans.filter(p => p.userRole === 'hospital');

    return NextResponse.json({
      success: true,
      data: formattedPlans,
      grouped: {
        doctors: doctorPlans,
        hospitals: hospitalPlans,
      },
    });
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch subscription plans',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    
    // Validate request body with Zod schema
    const validation = await validateRequest(req, CreatePlanDtoSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { name, tier, userRole, description, isActive = true, defaultBillingCycle, features } = validation.data;

    // Check for duplicate: same name should not exist
    const existingByName = await db
      .select()
      .from(subscriptionPlans)
      .where(and(eq(subscriptionPlans.name, name.trim()), eq(subscriptionPlans.isActive, true ), eq(subscriptionPlans.userRole, userRole)))

      .limit(1);

    if (existingByName.length > 0) {
      return NextResponse.json(
        { success: false, message: 'Plan with this name already exists' },
        { status: 409 }
      );
    }

    // Check for duplicate: same tier for same userRole should not exist
    const existingByTier = await db
      .select()
      .from(subscriptionPlans)
      .where(
        and(
          eq(subscriptionPlans.tier, tier),
          eq(subscriptionPlans.userRole, userRole),
          eq(subscriptionPlans.isActive, true)
        )
      )
      .limit(1);

    if (existingByTier.length > 0) {
      return NextResponse.json(
        { success: false, message: `A ${tier} plan already exists for ${userRole}s` },
        { status: 409 }
      );
    }

    // Create new plan (no price/currency - Approach 3)
    const [newPlan] = await db
      .insert(subscriptionPlans)
      .values({
        name: name.trim(),
        tier: tier,
        userRole: userRole,
        description: description || null,
        isActive: isActive,
        defaultBillingCycle: defaultBillingCycle || null,
      })
      .returning();

    const planId = newPlan.id;

    // Save features if provided
    if (features) {
      if (userRole === 'doctor') {
        const doctorFeatures = features as { visibilityWeight?: number; maxAffiliations?: number; notes?: string };
        const { visibilityWeight, maxAffiliations, notes } = doctorFeatures;
        await db
          .insert(doctorPlanFeatures)
          .values({
            planId: planId,
            visibilityWeight: visibilityWeight !== undefined ? visibilityWeight : 1,
            maxAffiliations: maxAffiliations !== undefined ? maxAffiliations : 1,
            notes: notes || null,
          });
      } else if (userRole === 'hospital') {
        const hospitalFeatures = features as { maxPatientsPerMonth?: number; maxAssignmentsPerMonth?: number; includesPremiumDoctors?: boolean; notes?: string };
        const { maxPatientsPerMonth, maxAssignmentsPerMonth, includesPremiumDoctors, notes } = hospitalFeatures;
        await db
          .insert(hospitalPlanFeatures)
          .values({
            planId: planId,
            maxPatientsPerMonth: maxPatientsPerMonth !== undefined && maxPatientsPerMonth !== null ? maxPatientsPerMonth : null,
            maxAssignmentsPerMonth: maxAssignmentsPerMonth !== undefined && maxAssignmentsPerMonth !== null ? maxAssignmentsPerMonth : null,
            includesPremiumDoctors: includesPremiumDoctors !== undefined ? includesPremiumDoctors : false,
            notes: notes || null,
          });
      }
    }

    // Get request metadata
    const metadata = getRequestMetadata(req);
    const adminUserId = req.headers.get('x-user-id') || null;

    // Create comprehensive audit log
    await createAuditLog({
      userId: adminUserId,
      actorType: 'admin',
      action: 'create',
      entityType: 'subscription_plan',
      entityId: planId,
      entityName: newPlan.name,
      httpMethod: 'POST',
      endpoint: '/api/admin/plans',
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      details: {
        tier: newPlan.tier,
        userRole: newPlan.userRole,
        isActive: newPlan.isActive,
        hasFeatures: !!features,
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
      message: features ? 'Subscription plan and features created successfully' : 'Subscription plan created successfully',
      data: {
        id: newPlan.id,
        name: newPlan.name,
        tier: newPlan.tier,
        userRole: newPlan.userRole,
        isActive: newPlan.isActive,
        description: newPlan.description,
        defaultBillingCycle: newPlan.defaultBillingCycle,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating subscription plan:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to create subscription plan',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

