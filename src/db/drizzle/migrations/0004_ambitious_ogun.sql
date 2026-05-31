CREATE TABLE "plan_pricing" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"plan_id" uuid NOT NULL,
	"billing_cycle" text NOT NULL,
	"billing_period_months" integer NOT NULL,
	"price" bigint NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"setup_fee" bigint DEFAULT 0,
	"discount_percentage" numeric(5, 2) DEFAULT '0.00',
	"is_active" boolean DEFAULT true,
	"valid_from" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"valid_until" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "plan_pricing_plan_id_billing_cycle_key" UNIQUE("plan_id","billing_cycle"),
	CONSTRAINT "plan_pricing_billing_cycle_check" CHECK (billing_cycle = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'yearly'::text, 'custom'::text]))
);
--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "is_active" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "default_billing_cycle" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "billing_cycle" text DEFAULT 'monthly';--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "billing_period_months" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "price_at_purchase" bigint DEFAULT 0;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "currency_at_purchase" text DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "pricing_id" uuid;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "plan_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "features_at_purchase" jsonb;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "renewal_price_strategy" text DEFAULT 'current';--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "next_renewal_date" timestamp;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "last_renewal_date" timestamp;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "renewal_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "cancelled_at" timestamp;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "cancelled_by" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "previous_subscription_id" uuid;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "upgrade_from_plan_id" uuid;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "upgrade_from_pricing_id" uuid;--> statement-breakpoint
ALTER TABLE "plan_pricing" ADD CONSTRAINT "plan_pricing_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_plan_pricing_active" ON "plan_pricing" USING btree ("is_active" bool_ops) WHERE (is_active = true);--> statement-breakpoint
CREATE INDEX "idx_plan_pricing_plan_id" ON "plan_pricing" USING btree ("plan_id" uuid_ops);--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_previous_subscription_id_fkey" FOREIGN KEY ("previous_subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_pricing_id_fkey" FOREIGN KEY ("pricing_id") REFERENCES "public"."plan_pricing"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_upgrade_from_plan_id_fkey" FOREIGN KEY ("upgrade_from_plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_upgrade_from_pricing_id_fkey" FOREIGN KEY ("upgrade_from_pricing_id") REFERENCES "public"."plan_pricing"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_plans" DROP COLUMN "price";--> statement-breakpoint
ALTER TABLE "subscription_plans" DROP COLUMN "currency";--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_default_billing_cycle_check" CHECK (default_billing_cycle = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'yearly'::text, 'custom'::text]));--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_billing_cycle_check" CHECK (billing_cycle = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'yearly'::text, 'custom'::text]));--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_cancelled_by_check" CHECK (cancelled_by = ANY (ARRAY['user'::text, 'admin'::text, 'system'::text]));--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_renewal_price_strategy_check" CHECK (renewal_price_strategy = ANY (ARRAY['locked'::text, 'current'::text, 'user_choice'::text]));