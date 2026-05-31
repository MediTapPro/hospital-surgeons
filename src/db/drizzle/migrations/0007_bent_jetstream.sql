ALTER TABLE "subscriptions" ADD COLUMN "next_plan_id" uuid;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "next_pricing_id" uuid;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "plan_change_status" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "replaced_by_subscription_id" uuid;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_next_plan_id_fkey" FOREIGN KEY ("next_plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_next_pricing_id_fkey" FOREIGN KEY ("next_pricing_id") REFERENCES "public"."plan_pricing"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_replaced_by_subscription_id_fkey" FOREIGN KEY ("replaced_by_subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_subscriptions_next_plan_id" ON "subscriptions" USING btree ("next_plan_id" uuid_ops) WHERE (next_plan_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_subscriptions_plan_change_status" ON "subscriptions" USING btree ("plan_change_status" text_ops) WHERE (plan_change_status IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_subscriptions_replaced_by_subscription_id" ON "subscriptions" USING btree ("replaced_by_subscription_id" uuid_ops) WHERE (replaced_by_subscription_id IS NOT NULL);--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_change_status_check" CHECK ((plan_change_status IS NULL) OR (plan_change_status = ANY (ARRAY['pending'::text, 'cancelled'::text, 'failed'::text])));