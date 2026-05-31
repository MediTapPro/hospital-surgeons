ALTER TABLE "payment_transactions" DROP CONSTRAINT "payment_transactions_order_id_fkey";
--> statement-breakpoint
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_order_id_fkey";
--> statement-breakpoint
DROP INDEX "idx_orders_created_at";--> statement-breakpoint
DROP INDEX "idx_orders_status";--> statement-breakpoint
DROP INDEX "idx_orders_user_id";--> statement-breakpoint
DROP INDEX "idx_orders_user_plan";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "webhook_received" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "pricing_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "gateway_name" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "gateway_order_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "user_role" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "attempt_number" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_pricing_id_fkey" FOREIGN KEY ("pricing_id") REFERENCES "public"."plan_pricing"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_role_check" CHECK ((user_role IS NULL) OR (user_role = ANY (ARRAY['doctor'::text, 'hospital'::text])));