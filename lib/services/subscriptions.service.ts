import { SubscriptionsRepository, CreateSubscriptionPlanData, CreateSubscriptionData, UpdateSubscriptionData, SubscriptionQuery } from '@/lib/repositories/subscriptions.repository';
import { getDb } from '@/lib/db';
import { subscriptions, planPricing } from '@/src/db/drizzle/migrations/schema';
import { eq, and, sql, lte } from 'drizzle-orm';

export class SubscriptionsService {
  private repo = new SubscriptionsRepository();

  async createPlan(dto: CreateSubscriptionPlanData) {
    try {
      const plan = await this.repo.createPlan(dto);
      return {
        success: true,
        message: 'Subscription plan created successfully',
        data: plan,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create subscription plan',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async listPlans() {
    try {
      const plans = await this.repo.listPlans();
      return {
        success: true,
        message: 'Subscription plans retrieved successfully',
        data: plans || [],
      };
    } catch (error) {
      console.error('Error in listPlans service:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      return {
        success: false,
        message: 'Failed to retrieve subscription plans',
        error: errorMessage,
        data: [], // Always include data field to prevent frontend errors
        ...(errorStack && { stack: errorStack }),
      };
    }
  }

  async getPlan(id: string) {
    try {
      const plan = await this.repo.getPlan(id);
      if (!plan) {
        return {
          success: false,
          message: 'Plan not found',
        };
      }
      return {
        success: true,
        message: 'Subscription plan retrieved successfully',
        data: plan,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve subscription plan',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async updatePlan(id: string, dto: Partial<CreateSubscriptionPlanData>) {
    try {
      const existing = await this.repo.getPlan(id);
      if (!existing) {
        return {
          success: false,
          message: 'Plan not found',
        };
      }
      const plan = await this.repo.updatePlan(id, dto);
      return {
        success: true,
        message: 'Subscription plan updated successfully',
        data: plan,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update subscription plan',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async deletePlan(id: string) {
    try {
      const existing = await this.repo.getPlan(id);
      if (!existing) {
        return {
          success: false,
          message: 'Plan not found',
        };
      }
      await this.repo.deletePlan(id);
      return {
        success: true,
        message: 'Subscription plan deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete subscription plan',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getActiveSubscriptionByUserId(userId: string) {
    try {
      const subscription = await this.repo.getActiveSubscriptionByUserId(userId);
      return {
        success: true,
        message: subscription ? 'Active subscription found' : 'No active subscription found',
        data: subscription || null,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve active subscription',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async create(dto: CreateSubscriptionData) {
    try {
      const plan = await this.repo.getPlan(dto.planId);
      if (!plan) {
        return {
          success: false,
          message: 'Invalid plan',
        };
      }
      const subscription = await this.repo.create(dto);
      return {
        success: true,
        message: 'Subscription created successfully',
        data: subscription,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create subscription',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async list(query: SubscriptionQuery) {
    try {
      const result = await this.repo.list(query);
      return {
        success: true,
        message: 'Subscriptions retrieved successfully',
        data: result.data,
        pagination: {
          page: result.page,
          limit: result.limit,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve subscriptions',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async get(id: string) {
    try {
      const data = await this.repo.get(id);
      if (!data) {
        return {
          success: false,
          message: 'Subscription not found',
        };
      }
      return {
        success: true,
        message: 'Subscription retrieved successfully',
        data,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve subscription',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async update(id: string, dto: UpdateSubscriptionData) {
    try {
      const existing = await this.repo.get(id);
      if (!existing) {
        return {
          success: false,
          message: 'Subscription not found',
        };
      }
      const subscription = await this.repo.update(id, dto);
      return {
        success: true,
        message: 'Subscription updated successfully',
        data: subscription,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update subscription',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async remove(id: string) {
    try {
      const existing = await this.repo.get(id);
      if (!existing) {
        return {
          success: false,
          message: 'Subscription not found',
        };
      }
      await this.repo.remove(id);
      return {
        success: true,
        message: 'Subscription deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete subscription',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check if a plan is an upgrade over the current subscription's plan
   * Uses tier comparison: free < basic < premium < enterprise
   */
  private isUpgrade(currentPlanTier: string, newPlanTier: string): boolean {
    const tierOrder: Record<string, number> = {
      'free': 0,
      'basic': 1,
      'premium': 2,
      'enterprise': 3,
    };
    return (tierOrder[newPlanTier] || 0) > (tierOrder[currentPlanTier] || 0);
  }

  /**
   * Upgrade subscription immediately (for higher tier plans)
   * Cancels old subscription and creates new one
   */
  async upgradeSubscription(subscriptionId: string, newPlanId: string, newPricingId: string) {
    try {
      // Get current subscription
      const currentSubData = await this.repo.get(subscriptionId);
      if (!currentSubData || !currentSubData.subscription) {
        return {
          success: false,
          message: 'Subscription not found',
        };
      }

      const currentSub = currentSubData.subscription;

      if (currentSub.status !== 'active') {
        return {
          success: false,
          message: 'Only active subscriptions can be upgraded',
        };
      }

      // Get current and new plan details
      const currentPlan = currentSubData.plan || await this.repo.getPlan(currentSub.planId);
      const newPlan = await this.repo.getPlan(newPlanId);

      if (!currentPlan || !newPlan) {
        return {
          success: false,
          message: 'Plan not found',
        };
      }

      // Check if it's actually an upgrade
      if (!this.isUpgrade(currentPlan.tier, newPlan.tier)) {
        return {
          success: false,
          message: 'This is not an upgrade. Use change plan for same tier or downgrades.',
        };
      }

      // Get pricing details
      const db = getDb();
      const pricingResult = await db
        .select()
        .from(planPricing)
        .where(
          and(
            eq(planPricing.id, newPricingId),
            eq(planPricing.planId, newPlanId),
            eq(planPricing.isActive, true)
          )
        )
        .limit(1);

      if (pricingResult.length === 0) {
        return {
          success: false,
          message: 'Pricing option not found or inactive',
        };
      }

      const pricing = pricingResult[0];

      // Calculate new subscription dates (starts now)
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + (pricing.billingPeriodMonths || 1));

      // Create new subscription and cancel old one atomically
      let newSubscription: any;

      await db.transaction(async (tx) => {
        const [created] = (await tx
          .insert(subscriptions)
          .values({
            userId: currentSub.userId,
            planId: newPlanId,
            pricingId: newPricingId,
            status: 'active',
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            autoRenew: true,
            previousSubscriptionId: currentSub.id,
          })
          .returning()) as any[];
        newSubscription = created;

        await tx
          .update(subscriptions)
          .set({
            status: 'cancelled',
            replacedBySubscriptionId: created.id,
            cancelledAt: new Date().toISOString(),
            cancellationReason: 'upgraded',
          })
          .where(eq(subscriptions.id, currentSub.id));
      });

      return {
        success: true,
        message: 'Subscription upgraded successfully',
        data: {
          oldSubscription: currentSub,
          newSubscription,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to upgrade subscription',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Schedule plan change for when current subscription expires
   * For same tier changes or downgrades
   */
  async changePlan(subscriptionId: string, newPlanId: string, newPricingId: string) {
    try {
      // Get current subscription
      const currentSubData = await this.repo.get(subscriptionId);
      if (!currentSubData || !currentSubData.subscription) {
        return {
          success: false,
          message: 'Subscription not found',
        };
      }

      const currentSub = currentSubData.subscription;

      if (currentSub.status !== 'active') {
        return {
          success: false,
          message: 'Only active subscriptions can be changed',
        };
      }

      // Get current and new plan details
      const currentPlan = currentSubData.plan || await this.repo.getPlan(currentSub.planId);
      const newPlan = await this.repo.getPlan(newPlanId);

      if (!currentPlan || !newPlan) {
        return {
          success: false,
          message: 'Plan not found',
        };
      }

      // Check if it's an upgrade (should use upgrade method instead)
      if (this.isUpgrade(currentPlan.tier, newPlan.tier)) {
        return {
          success: false,
          message: 'This is an upgrade. Use upgrade endpoint for immediate activation.',
        };
      }

      // Validate pricing
      const db = getDb();
      const pricingResult = await db
        .select()
        .from(planPricing)
        .where(
          and(
            eq(planPricing.id, newPricingId),
            eq(planPricing.planId, newPlanId),
            eq(planPricing.isActive, true)
          )
        )
        .limit(1);

      if (pricingResult.length === 0) {
        return {
          success: false,
          message: 'Pricing option not found or inactive',
        };
      }

      // Update subscription with next plan/pricing
      const updated = await db
        .update(subscriptions)
        .set({
          nextPlanId: newPlanId,
          nextPricingId: newPricingId,
          planChangeStatus: 'pending',
        })
        .where(eq(subscriptions.id, subscriptionId))
        .returning();

      return {
        success: true,
        message: 'Plan change scheduled. New plan will activate when current subscription expires.',
        data: updated[0],
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to schedule plan change',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Cancel pending plan change
   */
  async cancelPlanChange(subscriptionId: string) {
    try {
      const currentSub = await this.repo.get(subscriptionId);
      if (!currentSub) {
        return {
          success: false,
          message: 'Subscription not found',
        };
      }

      const db = getDb();
      const updated = await db
        .update(subscriptions)
        .set({
          nextPlanId: null,
          nextPricingId: null,
          planChangeStatus: 'cancelled',
        })
        .where(eq(subscriptions.id, subscriptionId))
        .returning();

      return {
        success: true,
        message: 'Plan change cancelled successfully',
        data: updated[0],
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to cancel plan change',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Process expired subscriptions with pending plan changes
   * This should be called by a cron job or scheduled task
   */
  async processExpiredSubscriptionsWithPendingChanges() {
    try {
      const db = getDb();

      // Find expired active subscriptions with pending plan changes
      const expiredSubs = await db
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.status, 'active'),
            lte(subscriptions.endDate, sql`NOW()`),
            eq(subscriptions.planChangeStatus, 'pending'),
            sql`${subscriptions.nextPlanId} IS NOT NULL`,
            sql`${subscriptions.nextPricingId} IS NOT NULL`
          )
        );

      const results = [];

      for (const oldSub of expiredSubs) {
        try {
          // Validate plan and pricing still exist and are active
          const newPlan = await this.repo.getPlan(oldSub.nextPlanId!);
          if (!newPlan || !newPlan.isActive) {
            // Mark as failed
            await db
              .update(subscriptions)
              .set({
                status: 'expired',
                planChangeStatus: 'failed',
              })
              .where(eq(subscriptions.id, oldSub.id));
            
            results.push({
              subscriptionId: oldSub.id,
              status: 'failed',
              reason: 'Plan no longer exists or inactive',
            });
            continue;
          }

          // Get pricing details
          const pricingResult = await db
            .select()
            .from(planPricing)
            .where(
              and(
                eq(planPricing.id, oldSub.nextPricingId!),
                eq(planPricing.planId, oldSub.nextPlanId!),
                eq(planPricing.isActive, true)
              )
            )
            .limit(1);

          if (pricingResult.length === 0) {
            // Mark as failed
            await db
              .update(subscriptions)
              .set({
                status: 'expired',
                planChangeStatus: 'failed',
              })
              .where(eq(subscriptions.id, oldSub.id));
            
            results.push({
              subscriptionId: oldSub.id,
              status: 'failed',
              reason: 'Pricing no longer exists or inactive',
            });
            continue;
          }

          const pricing = pricingResult[0];

          // Calculate new subscription dates
          const startDate = new Date(oldSub.endDate);
          const endDate = new Date(startDate);
          endDate.setMonth(endDate.getMonth() + (pricing.billingPeriodMonths || 1));

          // Create new subscription and expire old one atomically
          let newSubscription: any;

          await db.transaction(async (tx) => {
            const [created] = (await tx
              .insert(subscriptions)
              .values({
                userId: oldSub.userId,
                planId: oldSub.nextPlanId!,
                pricingId: oldSub.nextPricingId!,
                status: 'active',
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                autoRenew: true,
                previousSubscriptionId: oldSub.id,
              })
              .returning()) as any[];
            newSubscription = created;

            await tx
              .update(subscriptions)
              .set({
                status: 'expired',
                replacedBySubscriptionId: created.id,
                nextPlanId: null,
                nextPricingId: null,
                planChangeStatus: null,
              })
              .where(eq(subscriptions.id, oldSub.id));
          });

          results.push({
            subscriptionId: oldSub.id,
            status: 'success',
            newSubscriptionId: newSubscription.id,
          });
        } catch (error) {
          console.error(`Error processing subscription ${oldSub.id}:`, error);
          results.push({
            subscriptionId: oldSub.id,
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return {
        success: true,
        message: `Processed ${expiredSubs.length} expired subscriptions`,
        data: results,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to process expired subscriptions',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}







