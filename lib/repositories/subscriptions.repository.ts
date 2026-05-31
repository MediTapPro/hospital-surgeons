import { getDb } from '@/lib/db';
import { subscriptionPlans, subscriptions, hospitalPlanFeatures, doctorPlanFeatures, planPricing } from '@/src/db/drizzle/migrations/schema';
import { eq, and, sql, desc, gte, lte, inArray } from 'drizzle-orm';

export interface CreateSubscriptionPlanData {
  name: string;
  tier: 'free' | 'basic' | 'premium' | 'enterprise';
  userRole: 'doctor' | 'hospital' | 'admin';
  price: number;
  billingCycle: string;
  maxBookings?: number;
  commissionRate: number;
  features?: Record<string, any>;
  isActive?: boolean;
}

export interface CreateSubscriptionData {
  userId: string;
  planId: string;
  pricingId?: string; // Optional: pricing option ID from plan_pricing table
  status?: 'active' | 'expired' | 'cancelled' | 'suspended'; // Schema only allows these values
  startDate: string;
  endDate: string;
  autoRenew?: boolean;
  bookingsUsed?: number;
  // Upgrade tracking fields
  previousSubscriptionId?: string;
  upgradeFromPlanId?: string;
  upgradeFromPricingId?: string;
}

export interface UpdateSubscriptionData {
  userId?: string;
  planId?: string;
  status?: 'active' | 'expired' | 'cancelled' | 'pending';
  startDate?: string;
  endDate?: string;
  autoRenew?: boolean;
  bookingsUsed?: number;
}

export interface SubscriptionQuery {
  page?: number;
  limit?: number;
  userId?: string;
  planId?: string;
  status?: string;
  startDateFrom?: string;
  startDateTo?: string;
}

export class SubscriptionsRepository {
  private db = getDb();

  async createPlan(dto: CreateSubscriptionPlanData) {
    // Note: price and currency are no longer in subscription_plans (moved to plan_pricing)
    // This method is kept for backward compatibility but should not be used directly
    // Use the admin API which creates plan and pricing separately
    const [row] = await this.db
      .insert(subscriptionPlans)
      .values({
        name: dto.name,
        tier: dto.tier as any,
        userRole: dto.userRole as any,
        isActive: dto.isActive ?? true,
      })
      .returning();
    return row;
  }

  async listPlans() {
    try {
      // Get all active plans with both doctor and hospital features
      // Select only columns that actually exist in the database
      // Filter by isActive = true to exclude soft-deleted plans
      const plans = await this.db
        .select({
          plan: subscriptionPlans,
          doctorFeatures: {
            id: doctorPlanFeatures.id,
            planId: doctorPlanFeatures.planId,
            visibilityWeight: doctorPlanFeatures.visibilityWeight,
            maxAffiliations: doctorPlanFeatures.maxAffiliations,
            maxAssignmentsPerMonth: doctorPlanFeatures.maxAssignmentsPerMonth,
            notes: doctorPlanFeatures.notes,
          },
          hospitalFeatures: hospitalPlanFeatures,
        })
        .from(subscriptionPlans)
        .leftJoin(
          doctorPlanFeatures,
          eq(subscriptionPlans.id, doctorPlanFeatures.planId)
        )
        .leftJoin(
          hospitalPlanFeatures,
          eq(subscriptionPlans.id, hospitalPlanFeatures.planId)
        )
        .where(eq(subscriptionPlans.isActive, true))
        .orderBy(desc(subscriptionPlans.id));

      // Group plans with their features
      const plansMap = new Map();
      plans.forEach((row) => {
        const planId = row.plan.id;
        if (!plansMap.has(planId)) {
          plansMap.set(planId, {
            ...row.plan,
            doctorFeatures: row.doctorFeatures?.id ? row.doctorFeatures : null,
            hospitalFeatures: [],
            pricingOptions: [],
          });
        }
        // Add hospital features to array (in case there are multiple, though typically one per plan)
        const hospitalFeature = row.hospitalFeatures;
        if (hospitalFeature && hospitalFeature.id) {
          const plan = plansMap.get(planId);
          if (plan) {
            if (!plan.hospitalFeatures.some((f: any) => f.id === hospitalFeature.id)) {
              plan.hospitalFeatures.push(hospitalFeature);
            }
          }
        }
      });

      const plansList = Array.from(plansMap.values());

      // Fetch pricing options for all plans
      const planIds = plansList.map(p => p.id);
      if (planIds.length > 0) {
        const pricingOptions = await this.db
          .select()
          .from(planPricing)
          .where(
            and(
              inArray(planPricing.planId, planIds),
              eq(planPricing.isActive, true)
            )
          )
          .orderBy(planPricing.billingPeriodMonths);

        // Group pricing options by planId
        const pricingMap = new Map();
        pricingOptions.forEach((pricing) => {
          if (!pricingMap.has(pricing.planId)) {
            pricingMap.set(pricing.planId, []);
          }
          pricingMap.get(pricing.planId).push({
            id: pricing.id,
            billingCycle: pricing.billingCycle,
            billingPeriodMonths: pricing.billingPeriodMonths,
            price: Number(pricing.price), // Convert from bigint
            currency: pricing.currency,
            setupFee: Number(pricing.setupFee || 0),
            discountPercentage: pricing.discountPercentage ? Number(pricing.discountPercentage) : 0,
            isActive: pricing.isActive,
          });
        });

        // Attach pricing options to each plan
        plansList.forEach((plan) => {
          plan.pricingOptions = pricingMap.get(plan.id) || [];
        });
      }

      return plansList;
    } catch (error) {
      console.error('Error in listPlans repository:', error);
      throw error;
    }
  }

  async getPlan(id: string) {
    const [row] = await this.db
      .select({
        plan: subscriptionPlans,
        doctorFeatures: {
          id: doctorPlanFeatures.id,
          planId: doctorPlanFeatures.planId,
          visibilityWeight: doctorPlanFeatures.visibilityWeight,
          maxAffiliations: doctorPlanFeatures.maxAffiliations,
          maxAssignmentsPerMonth: doctorPlanFeatures.maxAssignmentsPerMonth,
          notes: doctorPlanFeatures.notes,
        },
        hospitalFeatures: hospitalPlanFeatures,
      })
      .from(subscriptionPlans)
      .leftJoin(
        doctorPlanFeatures,
        eq(subscriptionPlans.id, doctorPlanFeatures.planId)
      )
      .leftJoin(
        hospitalPlanFeatures,
        eq(subscriptionPlans.id, hospitalPlanFeatures.planId)
      )
      .where(
        and(
          eq(subscriptionPlans.id, id),
          eq(subscriptionPlans.isActive, true)
        )
      )
      .limit(1);
    
    if (!row) return null;

    // Fetch pricing options for this plan
    const pricingOptions = await this.db
      .select()
      .from(planPricing)
      .where(
        and(
          eq(planPricing.planId, id),
          eq(planPricing.isActive, true)
        )
      )
      .orderBy(planPricing.billingPeriodMonths);

    const formattedPricingOptions = pricingOptions.map((pricing) => ({
      id: pricing.id,
      billingCycle: pricing.billingCycle,
      billingPeriodMonths: pricing.billingPeriodMonths,
      price: Number(pricing.price), // Convert from bigint
      currency: pricing.currency,
      setupFee: Number(pricing.setupFee || 0),
      discountPercentage: pricing.discountPercentage ? Number(pricing.discountPercentage) : 0,
      isActive: pricing.isActive,
    }));
    
    return {
      ...row.plan,
      doctorFeatures: row.doctorFeatures?.id ? row.doctorFeatures : null,
      hospitalFeatures: row.hospitalFeatures?.id ? row.hospitalFeatures : null,
      pricingOptions: formattedPricingOptions,
    };
  }

  async updatePlan(id: string, dto: Partial<CreateSubscriptionPlanData>) {
    const updateFields: any = {};
    
    if (dto.name) updateFields.name = dto.name;
    if (dto.tier) updateFields.tier = dto.tier as any;
    if (dto.userRole) updateFields.userRole = dto.userRole as any;
    if (dto.price !== undefined) updateFields.price = dto.price.toString();
    if (dto.billingCycle) updateFields.billingCycle = dto.billingCycle;
    if (dto.maxBookings !== undefined) updateFields.maxBookings = dto.maxBookings;
    if (dto.commissionRate !== undefined) updateFields.commissionRate = dto.commissionRate.toString();
    if (dto.features !== undefined) updateFields.features = dto.features;
    if (dto.isActive !== undefined) updateFields.isActive = dto.isActive;

    const [row] = await this.db
      .update(subscriptionPlans)
      .set(updateFields)
      .where(eq(subscriptionPlans.id, id))
      .returning();
    return row;
  }

  async deletePlan(id: string) {
    await this.db.delete(subscriptionPlans).where(eq(subscriptionPlans.id, id));
  }

  async create(dto: CreateSubscriptionData) {
    // Get plan details first (needed for defaultBillingCycle)
    const [plan] = await this.db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, dto.planId))
      .limit(1);

    if (!plan) {
      throw new Error('Plan not found');
    }

    // Fetch pricing information if pricingId is provided
    let priceAtPurchase = 0;
    let currencyAtPurchase = 'USD';
    let billingCycle = plan.defaultBillingCycle || 'monthly'; // Use plan's default if available
    let billingPeriodMonths = 1;
    let pricingId = dto.pricingId;

    // Helper function to calculate billingPeriodMonths from billingCycle
    const calculateBillingPeriodMonths = (cycle: string): number => {
      switch (cycle) {
        case 'monthly':
          return 1;
        case 'quarterly':
          return 3;
        case 'yearly':
          return 12;
        case 'custom':
          return 1; // Default for custom, should be set explicitly
        default:
          return 1;
      }
    };

    if (dto.pricingId) {
      const [pricing] = await this.db
        .select()
        .from(planPricing)
        .where(eq(planPricing.id, dto.pricingId))
        .limit(1);
      
      if (pricing) {
        priceAtPurchase = Number(pricing.price);
        currencyAtPurchase = pricing.currency;
        billingCycle = pricing.billingCycle;
        billingPeriodMonths = pricing.billingPeriodMonths;
      } else {
        // Pricing ID provided but not found, use plan defaults
        billingPeriodMonths = calculateBillingPeriodMonths(billingCycle);
      }
    } else {
      // If no pricingId provided, try to get default pricing for the plan
      const [defaultPricing] = await this.db
        .select()
        .from(planPricing)
        .where(
          and(
            eq(planPricing.planId, dto.planId),
            eq(planPricing.isActive, true)
          )
        )
        .orderBy(planPricing.billingPeriodMonths)
        .limit(1);
      
      if (defaultPricing) {
        priceAtPurchase = Number(defaultPricing.price);
        currencyAtPurchase = defaultPricing.currency;
        billingCycle = defaultPricing.billingCycle;
        billingPeriodMonths = defaultPricing.billingPeriodMonths;
        pricingId = defaultPricing.id;
      } else {
        // No pricing found (e.g., free plans) - use plan's defaultBillingCycle
        // billingCycle already set from plan.defaultBillingCycle || 'monthly'
        billingPeriodMonths = calculateBillingPeriodMonths(billingCycle);
      }
    }

    // Build plan snapshot
    const planSnapshot = {
      plan_id: plan.id,
      plan_name: plan.name,
      tier: plan.tier,
      user_role: plan.userRole,
      description: plan.description,
      price: priceAtPurchase,
      currency: currencyAtPurchase,
      billing_cycle: billingCycle,
      billing_period_months: billingPeriodMonths,
      purchased_at: new Date().toISOString(),
    };

    // Get features at purchase time (lock in features)
    let featuresAtPurchase: any = null;
    
    if (plan.userRole === 'doctor') {
      const [doctorFeatures] = await this.db
        .select()
        .from(doctorPlanFeatures)
        .where(eq(doctorPlanFeatures.planId, dto.planId))
        .limit(1);
      
      if (doctorFeatures) {
        featuresAtPurchase = {
          visibilityWeight: doctorFeatures.visibilityWeight,
          maxAffiliations: doctorFeatures.maxAffiliations,
          maxAssignmentsPerMonth: doctorFeatures.maxAssignmentsPerMonth,
          notes: doctorFeatures.notes,
        };
      }
    } else if (plan.userRole === 'hospital') {
      const [hospitalFeatures] = await this.db
        .select()
        .from(hospitalPlanFeatures)
        .where(eq(hospitalPlanFeatures.planId, dto.planId))
        .limit(1);
      
      if (hospitalFeatures) {
        featuresAtPurchase = {
          maxPatientsPerMonth: hospitalFeatures.maxPatientsPerMonth,
          includesPremiumDoctors: hospitalFeatures.includesPremiumDoctors,
          maxAssignmentsPerMonth: hospitalFeatures.maxAssignmentsPerMonth,
          notes: hospitalFeatures.notes,
        };
      }
    }

    const result = await this.db
      .insert(subscriptions)
      .values({
        userId: dto.userId,
        planId: dto.planId,
        pricingId: pricingId,
        status: (dto.status || 'active') as any, // Default to 'active' (schema allows: active, expired, cancelled, suspended)
        startDate: dto.startDate,
        endDate: dto.endDate,
        autoRenew: dto.autoRenew ?? true,
        billingCycle: billingCycle,
        billingPeriodMonths: billingPeriodMonths,
        // Note: The following fields may exist in the database but are not in the Drizzle schema:
        // - priceAtPurchase, currencyAtPurchase, planSnapshot, featuresAtPurchase
        // - previousSubscriptionId, upgradeFromPlanId, upgradeFromPricingId
        // They should be added to the schema via migration if needed
      })
      .returning();
    
    const row = Array.isArray(result) ? result[0] : result;
    if (!row) {
      throw new Error('Failed to create subscription');
    }
    return row;
  }

  async list(query: SubscriptionQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    const whereConditions = [];
    if (query.userId) whereConditions.push(eq(subscriptions.userId, query.userId));
    if (query.planId) whereConditions.push(eq(subscriptions.planId, query.planId));
    if (query.status) whereConditions.push(eq(subscriptions.status, query.status as any));
    if (query.startDateFrom) whereConditions.push(gte(subscriptions.startDate, query.startDateFrom));
    if (query.startDateTo) whereConditions.push(lte(subscriptions.startDate, query.startDateTo));

    const data = await this.db
      .select({ subscription: subscriptions, plan: subscriptionPlans })
      .from(subscriptions)
      .leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(subscriptions.createdAt))
      .limit(limit)
      .offset(offset);

    return { data, page, limit };
  }

  async get(id: string) {
    const [row] = await this.db
      .select({ subscription: subscriptions, plan: subscriptionPlans })
      .from(subscriptions)
      .leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
      .where(eq(subscriptions.id, id))
      .limit(1);
    return row;
  }

  async getActiveSubscriptionByUserId(userId: string) {
    const now = new Date().toISOString();
    const [row] = await this.db
      .select({
        subscription: subscriptions,
        plan: subscriptionPlans,
        pricing: planPricing,
        doctorFeatures: {
          id: doctorPlanFeatures.id,
          planId: doctorPlanFeatures.planId,
          visibilityWeight: doctorPlanFeatures.visibilityWeight,
          maxAffiliations: doctorPlanFeatures.maxAffiliations,
          notes: doctorPlanFeatures.notes,
        },
        hospitalFeatures: hospitalPlanFeatures,
      })
      .from(subscriptions)
      .leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
      .leftJoin(
        planPricing,
        eq(subscriptions.pricingId, planPricing.id)
      )
      .leftJoin(
        doctorPlanFeatures,
        eq(subscriptionPlans.id, doctorPlanFeatures.planId)
      )
      .leftJoin(
        hospitalPlanFeatures,
        eq(subscriptionPlans.id, hospitalPlanFeatures.planId)
      )
      .where(
        and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.status, 'active' as any),
          gte(subscriptions.endDate, now)
        )
      )
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);
    
    if (!row) return null;
    
    return {
      subscription: row.subscription,
      plan: {
        ...row.plan,
        doctorFeatures: row.doctorFeatures?.id ? row.doctorFeatures : null,
        hospitalFeatures: row.hospitalFeatures?.id ? row.hospitalFeatures : null,
      },
      pricing: row.pricing ? {
        id: row.pricing.id,
        billingCycle: row.pricing.billingCycle,
        billingPeriodMonths: row.pricing.billingPeriodMonths,
        price: Number(row.pricing.price),
        currency: row.pricing.currency,
        setupFee: row.pricing.setupFee ? Number(row.pricing.setupFee) : 0,
        discountPercentage: row.pricing.discountPercentage ? Number(row.pricing.discountPercentage) : 0,
      } : null,
    };
  }

  async update(id: string, dto: UpdateSubscriptionData) {
    const updateFields: any = {};
    
    if (dto.userId) updateFields.userId = dto.userId;
    if (dto.planId) updateFields.planId = dto.planId;
    if (dto.status) updateFields.status = dto.status as any;
    if (dto.startDate) updateFields.startDate = dto.startDate;
    if (dto.endDate) updateFields.endDate = dto.endDate;
    if (dto.autoRenew !== undefined) updateFields.autoRenew = dto.autoRenew;
    if (dto.bookingsUsed !== undefined) updateFields.bookingsUsed = dto.bookingsUsed;

    const [row] = await this.db
      .update(subscriptions)
      .set(updateFields)
      .where(eq(subscriptions.id, id))
      .returning();
    return row;
  }

  async remove(id: string) {
    await this.db.delete(subscriptions).where(eq(subscriptions.id, id));
  }
}


