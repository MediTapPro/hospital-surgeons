CREATE TABLE "assignment_expiry_config" (
	"priority" text PRIMARY KEY NOT NULL,
	"expiry_hours" integer NOT NULL,
	"is_active" boolean DEFAULT true,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "assignment_expiry_config_expiry_hours_check" CHECK (expiry_hours > 0),
	CONSTRAINT "assignment_expiry_config_priority_check" CHECK (priority = ANY (ARRAY['routine'::text, 'urgent'::text, 'emergency'::text]))
);
--> statement-breakpoint
CREATE TABLE "chat_conversations" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"doctor_id" uuid NOT NULL,
	"hospital_id" uuid,
	"patient_profile_id" uuid,
	"last_message_at" timestamp,
	"doctor_unread_count" integer DEFAULT 0 NOT NULL,
	"hospital_unread_count" integer DEFAULT 0 NOT NULL,
	"patient_unread_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_message_attachments" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"message_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"uploaded_by" text NOT NULL,
	"uploaded_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "chat_message_attachments_uploaded_by_check" CHECK (uploaded_by = ANY (ARRAY['doctor'::text, 'hospital'::text, 'patient'::text]))
);
--> statement-breakpoint
CREATE TABLE "chat_message_reactions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"message_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"reactor_type" text NOT NULL,
	"reactor_id" uuid NOT NULL,
	"emoji" varchar(10) NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "chat_message_reactions_message_id_reactor_id_key" UNIQUE("message_id","reactor_id"),
	CONSTRAINT "chat_message_reactions_reactor_type_check" CHECK (reactor_type = ANY (ARRAY['doctor'::text, 'hospital'::text, 'patient'::text]))
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_type" text NOT NULL,
	"sender_id" uuid NOT NULL,
	"content" text NOT NULL,
	"message_type" text DEFAULT 'text' NOT NULL,
	"reply_to_id" uuid,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"is_edited" boolean DEFAULT false NOT NULL,
	"edited_at" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "chat_messages_message_type_check" CHECK (message_type = ANY (ARRAY['text'::text, 'attachment'::text, 'system'::text])),
	CONSTRAINT "chat_messages_sender_type_check" CHECK (sender_type = ANY (ARRAY['doctor'::text, 'hospital'::text, 'patient'::text]))
);
--> statement-breakpoint
CREATE TABLE "cron_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doctor_hospital_discounts" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"doctor_id" uuid NOT NULL,
	"hospital_id" uuid NOT NULL,
	"discount_percentage" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "doctor_hospital_discounts_unique" UNIQUE("doctor_id","hospital_id")
);
--> statement-breakpoint
CREATE TABLE "doctor_procedure_fees" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"doctor_id" uuid NOT NULL,
	"procedure_id" uuid,
	"room_type_id" uuid NOT NULL,
	"fee" numeric(10, 2) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"procedure_type_id" uuid,
	"hospital_id" uuid,
	"discount_percentage" numeric(5, 2) DEFAULT '0',
	"status" text DEFAULT 'pending',
	"notes" text,
	"specialty_id" uuid,
	"status_reason" text,
	CONSTRAINT "doctor_fee_unique_idx" UNIQUE("doctor_id","procedure_id","room_type_id","procedure_type_id","hospital_id","specialty_id"),
	CONSTRAINT "doctor_procedure_fees_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))
);
--> statement-breakpoint
CREATE TABLE "home_visit_details" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"patient_address_id" uuid,
	"patient_family_member_id" uuid,
	"symptoms" text,
	"clinical_notes" text,
	"prescription" text,
	"attachment_file_id" uuid,
	"address_label" text,
	"address_text" text,
	"address_latitude" numeric(10, 8),
	"address_longitude" numeric(11, 8),
	"recipient_name" text,
	"recipient_phone" text,
	"recipient_relationship" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "home_visit_details_assignment_id_key" UNIQUE("assignment_id")
);
--> statement-breakpoint
CREATE TABLE "patient_addresses" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"patient_profile_id" uuid NOT NULL,
	"label" text NOT NULL,
	"address_text" text NOT NULL,
	"latitude" numeric(10, 8),
	"longitude" numeric(11, 8),
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_family_members" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"patient_profile_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"phone" varchar(20) NOT NULL,
	"relationship" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_profiles" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "patient_profiles_user_id_key" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "procedure_categories" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"specialty_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "procedure_categories_specialty_id_name_key" UNIQUE("specialty_id","name")
);
--> statement-breakpoint
CREATE TABLE "procedure_type_mappings" (
	"procedure_id" uuid NOT NULL,
	"type_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "procedure_type_mappings_procedure_id_type_id_pk" PRIMARY KEY("procedure_id","type_id")
);
--> statement-breakpoint
CREATE TABLE "procedure_types" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "procedure_types_name_key" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "procedures" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"specialty_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"category_id" uuid,
	"mrp" numeric(10, 2) DEFAULT '0',
	CONSTRAINT "procedures_specialty_id_name_key" UNIQUE("specialty_id","name")
);
--> statement-breakpoint
CREATE TABLE "room_types" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"base_cost_per_day" numeric(10, 2) DEFAULT '0.00',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "room_types_name_key" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "spatial_ref_sys" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "spatial_ref_sys" CASCADE;--> statement-breakpoint
ALTER TABLE "doctor_assignment_usage" DROP CONSTRAINT "doctor_assignment_usage_doctor_id_month_key";--> statement-breakpoint
ALTER TABLE "hospital_usage_tracking" DROP CONSTRAINT "hospital_usage_tracking_hospital_id_month_key";--> statement-breakpoint
ALTER TABLE "assignments" DROP CONSTRAINT "assignments_cancelled_by_check";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_role_check";--> statement-breakpoint
DROP INDEX "idx_hospital_usage_tracking_hospital_month";--> statement-breakpoint
ALTER TABLE "assignments" ALTER COLUMN "hospital_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "assignments" ALTER COLUMN "patient_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_events" ALTER COLUMN "id" SET MAXVALUE 9223372036854775807;--> statement-breakpoint
ALTER TABLE "assignment_payments" ADD COLUMN "payment_method" text;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "patient_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "source" text DEFAULT 'hospital' NOT NULL;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "procedure_id" uuid;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "procedure_type_id" uuid;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "room_type_id" uuid;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "specialty_id" uuid;--> statement-breakpoint
ALTER TABLE "availability_templates" ADD COLUMN "slot_type" text DEFAULT 'hospital' NOT NULL;--> statement-breakpoint
ALTER TABLE "doctor_assignment_usage" ADD COLUMN "subscription_id" uuid;--> statement-breakpoint
ALTER TABLE "doctor_assignment_usage" ADD COLUMN "period_start" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "doctor_assignment_usage" ADD COLUMN "period_end" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "doctor_availability" ADD COLUMN "slot_type" text DEFAULT 'hospital' NOT NULL;--> statement-breakpoint
ALTER TABLE "hospital_usage_tracking" ADD COLUMN "subscription_id" uuid;--> statement-breakpoint
ALTER TABLE "hospital_usage_tracking" ADD COLUMN "period_start" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hospital_usage_tracking" ADD COLUMN "period_end" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_patient_profile_id_fkey" FOREIGN KEY ("patient_profile_id") REFERENCES "public"."patient_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message_attachments" ADD CONSTRAINT "chat_message_attachments_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message_attachments" ADD CONSTRAINT "chat_message_attachments_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message_attachments" ADD CONSTRAINT "chat_message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message_reactions" ADD CONSTRAINT "chat_message_reactions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message_reactions" ADD CONSTRAINT "chat_message_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "public"."chat_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_hospital_discounts" ADD CONSTRAINT "doctor_hospital_discounts_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_hospital_discounts" ADD CONSTRAINT "doctor_hospital_discounts_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_procedure_fees" ADD CONSTRAINT "doctor_procedure_fees_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_procedure_fees" ADD CONSTRAINT "doctor_procedure_fees_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_procedure_fees" ADD CONSTRAINT "doctor_procedure_fees_procedure_id_fkey" FOREIGN KEY ("procedure_id") REFERENCES "public"."procedures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_procedure_fees" ADD CONSTRAINT "doctor_procedure_fees_procedure_type_id_fkey" FOREIGN KEY ("procedure_type_id") REFERENCES "public"."procedure_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_procedure_fees" ADD CONSTRAINT "doctor_procedure_fees_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_procedure_fees" ADD CONSTRAINT "doctor_procedure_fees_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "public"."specialties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "home_visit_details" ADD CONSTRAINT "home_visit_details_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "home_visit_details" ADD CONSTRAINT "home_visit_details_patient_address_id_fkey" FOREIGN KEY ("patient_address_id") REFERENCES "public"."patient_addresses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "home_visit_details" ADD CONSTRAINT "home_visit_details_patient_family_member_id_fkey" FOREIGN KEY ("patient_family_member_id") REFERENCES "public"."patient_family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "home_visit_details" ADD CONSTRAINT "home_visit_details_attachment_file_id_fkey" FOREIGN KEY ("attachment_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_addresses" ADD CONSTRAINT "patient_addresses_patient_profile_id_fkey" FOREIGN KEY ("patient_profile_id") REFERENCES "public"."patient_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_family_members" ADD CONSTRAINT "patient_family_members_patient_profile_id_fkey" FOREIGN KEY ("patient_profile_id") REFERENCES "public"."patient_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_profiles" ADD CONSTRAINT "patient_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedure_categories" ADD CONSTRAINT "procedure_categories_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "public"."specialties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedure_type_mappings" ADD CONSTRAINT "procedure_type_mappings_procedure_id_fkey" FOREIGN KEY ("procedure_id") REFERENCES "public"."procedures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedure_type_mappings" ADD CONSTRAINT "procedure_type_mappings_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "public"."procedure_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedures" ADD CONSTRAINT "procedures_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."procedure_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedures" ADD CONSTRAINT "procedures_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "public"."specialties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_chat_conversations_doctor_id" ON "chat_conversations" USING btree ("doctor_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_chat_conversations_hospital_id" ON "chat_conversations" USING btree ("hospital_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_chat_conversations_patient_profile_id" ON "chat_conversations" USING btree ("patient_profile_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_chat_conversations_updated_at" ON "chat_conversations" USING btree ("updated_at" timestamp_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "chat_conversations_doctor_hospital_key" ON "chat_conversations" USING btree ("doctor_id","hospital_id") WHERE "chat_conversations"."hospital_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_conversations_doctor_patient_key" ON "chat_conversations" USING btree ("doctor_id","patient_profile_id") WHERE "chat_conversations"."patient_profile_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_chat_message_attachments_conversation_id" ON "chat_message_attachments" USING btree ("conversation_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_chat_message_attachments_message_id" ON "chat_message_attachments" USING btree ("message_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_chat_message_reactions_message_id" ON "chat_message_reactions" USING btree ("message_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_chat_messages_conversation_id" ON "chat_messages" USING btree ("conversation_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_chat_messages_created_at" ON "chat_messages" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_chat_messages_sender_id" ON "chat_messages" USING btree ("sender_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_doctor_procedure_fees_doctor_id" ON "doctor_procedure_fees" USING btree ("doctor_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_doctor_procedure_fees_procedure_id" ON "doctor_procedure_fees" USING btree ("procedure_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_doctor_procedure_fees_room_type_id" ON "doctor_procedure_fees" USING btree ("room_type_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_procedures_is_active" ON "procedures" USING btree ("is_active" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_procedures_specialty_id" ON "procedures" USING btree ("specialty_id" uuid_ops);--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_patient_profile_id_fkey" FOREIGN KEY ("patient_profile_id") REFERENCES "public"."patient_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_procedure_id_fkey" FOREIGN KEY ("procedure_id") REFERENCES "public"."procedures"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_procedure_type_id_fkey" FOREIGN KEY ("procedure_type_id") REFERENCES "public"."procedure_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "public"."specialties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_assignment_usage" ADD CONSTRAINT "doctor_assignment_usage_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hospital_usage_tracking" ADD CONSTRAINT "hospital_usage_tracking_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_dau_period" ON "doctor_assignment_usage" USING btree ("period_start" timestamptz_ops,"period_end" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_dau_subscription" ON "doctor_assignment_usage" USING btree ("subscription_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_hut_period" ON "hospital_usage_tracking" USING btree ("period_start" timestamptz_ops,"period_end" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_hut_subscription" ON "hospital_usage_tracking" USING btree ("subscription_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_hospital_usage_tracking_hospital_month" ON "hospital_usage_tracking" USING btree ("hospital_id" uuid_ops,"month" uuid_ops);--> statement-breakpoint
ALTER TABLE "doctor_assignment_usage" ADD CONSTRAINT "doctor_assignment_usage_sub_period_key" UNIQUE("subscription_id","period_start");--> statement-breakpoint
ALTER TABLE "hospital_usage_tracking" ADD CONSTRAINT "hospital_usage_tracking_sub_period_key" UNIQUE("subscription_id","period_start");--> statement-breakpoint
ALTER TABLE "assignment_payments" ADD CONSTRAINT "assignment_payments_payment_method_check" CHECK ((payment_method IS NULL) OR (payment_method = ANY (ARRAY['upi'::text, 'cash'::text, 'online'::text])));--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_source_check" CHECK (source = ANY (ARRAY['hospital'::text, 'patient'::text]));--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_cancelled_by_check" CHECK (cancelled_by = ANY (ARRAY['hospital'::text, 'doctor'::text, 'system'::text, 'patient'::text]));--> statement-breakpoint
ALTER TABLE "availability_templates" ADD CONSTRAINT "availability_templates_slot_type_check" CHECK (slot_type = ANY (ARRAY['hospital'::text, 'home_visit'::text]));--> statement-breakpoint
ALTER TABLE "doctor_availability" ADD CONSTRAINT "doctor_availability_slot_type_check" CHECK (slot_type = ANY (ARRAY['hospital'::text, 'home_visit'::text]));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK (role = ANY (ARRAY['doctor'::text, 'hospital'::text, 'admin'::text, 'patient'::text]));