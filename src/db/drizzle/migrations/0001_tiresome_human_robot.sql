CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid,
	"event_type" varchar(50) NOT NULL,
	"event_name" varchar(100) NOT NULL,
	"properties" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"booking_updates_push" boolean DEFAULT true,
	"booking_updates_email" boolean DEFAULT true,
	"payment_push" boolean DEFAULT true,
	"reminders_push" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "notification_preferences_user_id_key" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid,
	"booking_id" uuid,
	"subject" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"category" varchar(50),
	"priority" varchar(20) DEFAULT 'medium',
	"status" varchar(20) DEFAULT 'open',
	"assigned_to" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_devices" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_type" varchar(20) NOT NULL,
	"device_token" text NOT NULL,
	"app_version" varchar(20),
	"os_version" varchar(20),
	"device_name" varchar(100),
	"is_active" boolean DEFAULT true,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_devices_user_id_device_token_key" UNIQUE("user_id","device_token"),
	CONSTRAINT "user_devices_device_type_check" CHECK ((device_type)::text = ANY ((ARRAY['ios'::character varying, 'android'::character varying, 'web'::character varying])::text[]))
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_verified" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "doctors" ADD COLUMN "full_address" text;--> statement-breakpoint
ALTER TABLE "doctors" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "doctors" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "doctors" ADD COLUMN "pincode" varchar(10);--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_notification_preferences_user_id" ON "notification_preferences" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_user_devices_device_token" ON "user_devices" USING btree ("device_token" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_devices_is_active" ON "user_devices" USING btree ("is_active" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_user_devices_user_id" ON "user_devices" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_doctors_city" ON "doctors" USING btree ("city" text_ops);--> statement-breakpoint
CREATE INDEX "idx_doctors_location_details" ON "doctors" USING btree ("city" text_ops,"state" text_ops,"pincode" text_ops);--> statement-breakpoint
CREATE INDEX "idx_doctors_pincode" ON "doctors" USING btree ("pincode" text_ops);--> statement-breakpoint
CREATE INDEX "idx_doctors_state" ON "doctors" USING btree ("state" text_ops);