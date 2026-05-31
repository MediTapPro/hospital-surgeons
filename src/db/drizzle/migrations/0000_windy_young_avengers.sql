-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"name" text NOT NULL,
	"tier" text NOT NULL,
	"user_role" text NOT NULL,
	"price" bigint DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	CONSTRAINT "subscription_plans_name_key" UNIQUE("name"),
	CONSTRAINT "subscription_plans_tier_check" CHECK (tier = ANY (ARRAY['free'::text, 'basic'::text, 'premium'::text, 'enterprise'::text])),
	CONSTRAINT "subscription_plans_user_role_check" CHECK (user_role = ANY (ARRAY['doctor'::text, 'hospital'::text]))
);
--> statement-breakpoint
CREATE TABLE "hospital_plan_features" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"plan_id" uuid NOT NULL,
	"max_patients_per_month" integer,
	"includes_premium_doctors" boolean DEFAULT false,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "doctor_plan_features" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"plan_id" uuid NOT NULL,
	"visibility_weight" integer DEFAULT 1,
	"max_affiliations" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"subscription_status" text,
	"subscription_tier" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "users_email_key" UNIQUE("email"),
	CONSTRAINT "users_role_check" CHECK (role = ANY (ARRAY['doctor'::text, 'hospital'::text, 'admin'::text])),
	CONSTRAINT "users_status_check" CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'pending'::text, 'suspended'::text])),
	CONSTRAINT "users_subscription_status_check" CHECK (subscription_status = ANY (ARRAY['active'::text, 'expired'::text, 'cancelled'::text, 'trial'::text]))
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"order_type" text NOT NULL,
	"plan_id" uuid,
	"amount" bigint NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"description" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"expires_at" timestamp,
	"paid_at" timestamp,
	"failure_reason" text,
	"webhook_received" boolean DEFAULT false,
	CONSTRAINT "orders_order_type_check" CHECK (order_type = ANY (ARRAY['subscription'::text, 'consultation'::text, 'other'::text])),
	CONSTRAINT "orders_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'expired'::text, 'refunded'::text]))
);
--> statement-breakpoint
CREATE TABLE "payment_transactions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"order_id" uuid NOT NULL,
	"payment_gateway" text NOT NULL,
	"payment_id" text NOT NULL,
	"payment_method" text,
	"amount" bigint NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" text NOT NULL,
	"gateway_response" json,
	"verified_at" timestamp,
	"refunded_at" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "payment_transactions_payment_id_key" UNIQUE("payment_id"),
	CONSTRAINT "payment_transactions_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'success'::text, 'failed'::text, 'refunded'::text]))
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"order_id" uuid,
	"payment_transaction_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"auto_renew" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "subscriptions_status_check" CHECK (status = ANY (ARRAY['active'::text, 'expired'::text, 'cancelled'::text, 'suspended'::text]))
);
--> statement-breakpoint
CREATE TABLE "doctors" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"profile_photo_id" uuid,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"medical_license_number" text NOT NULL,
	"years_of_experience" integer NOT NULL,
	"bio" text,
	"primary_location" text,
	"latitude" numeric(10, 8),
	"longitude" numeric(11, 8),
	"license_verification_status" text DEFAULT 'pending' NOT NULL,
	"average_rating" numeric(3, 2) DEFAULT '0.00',
	"total_ratings" integer DEFAULT 0,
	"completed_assignments" integer DEFAULT 0,
	CONSTRAINT "doctors_user_id_key" UNIQUE("user_id"),
	CONSTRAINT "doctors_medical_license_number_key" UNIQUE("medical_license_number"),
	CONSTRAINT "doctors_average_rating_check" CHECK ((average_rating >= (0)::numeric) AND (average_rating <= (5)::numeric)),
	CONSTRAINT "doctors_license_verification_status_check" CHECK (license_verification_status = ANY (ARRAY['pending'::text, 'verified'::text, 'rejected'::text])),
	CONSTRAINT "doctors_years_of_experience_check" CHECK (years_of_experience >= 0)
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"filename" text NOT NULL,
	"url" text NOT NULL,
	"mimetype" text NOT NULL,
	"size" bigint NOT NULL,
	"thumbnail" text,
	"storage_bucket" varchar(255),
	"storage_key" text,
	"cdn_url" text,
	"is_public" boolean DEFAULT false,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doctor_specialties" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"doctor_id" uuid NOT NULL,
	"specialty_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false,
	"years_of_experience" integer,
	CONSTRAINT "doctor_specialties_doctor_id_specialty_id_key" UNIQUE("doctor_id","specialty_id"),
	CONSTRAINT "doctor_specialties_years_of_experience_check" CHECK (years_of_experience >= 0)
);
--> statement-breakpoint
CREATE TABLE "specialties" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	CONSTRAINT "specialties_name_key" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "doctor_credentials" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"doctor_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"credential_type" text NOT NULL,
	"title" text NOT NULL,
	"institution" text,
	"verification_status" text DEFAULT 'pending' NOT NULL,
	"uploaded_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "doctor_credentials_credential_type_check" CHECK (credential_type = ANY (ARRAY['degree'::text, 'certificate'::text, 'license'::text, 'other'::text])),
	CONSTRAINT "doctor_credentials_verification_status_check" CHECK (verification_status = ANY (ARRAY['pending'::text, 'verified'::text, 'rejected'::text]))
);
--> statement-breakpoint
CREATE TABLE "doctor_profile_photos" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"doctor_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false,
	"uploaded_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doctor_preferences" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"doctor_id" uuid NOT NULL,
	"max_travel_distance_km" integer,
	"accept_emergency_only" boolean DEFAULT false,
	"preferred_hospital_ids" text[],
	"blocked_hospital_ids" text[],
	CONSTRAINT "doctor_preferences_doctor_id_key" UNIQUE("doctor_id")
);
--> statement-breakpoint
CREATE TABLE "doctor_leaves" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"doctor_id" uuid NOT NULL,
	"leave_type" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "doctor_leaves_check" CHECK (end_date >= start_date),
	CONSTRAINT "doctor_leaves_leave_type_check" CHECK (leave_type = ANY (ARRAY['sick'::text, 'vacation'::text, 'personal'::text, 'emergency'::text, 'other'::text]))
);
--> statement-breakpoint
CREATE TABLE "hospitals" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"logo_id" uuid,
	"name" text NOT NULL,
	"hospital_type" text,
	"registration_number" text NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"latitude" numeric(10, 8),
	"longitude" numeric(11, 8),
	"number_of_beds" integer,
	"contact_email" text,
	"contact_phone" text,
	"website_url" text,
	"license_verification_status" text DEFAULT 'pending' NOT NULL,
	CONSTRAINT "hospitals_user_id_key" UNIQUE("user_id"),
	CONSTRAINT "hospitals_registration_number_key" UNIQUE("registration_number"),
	CONSTRAINT "hospitals_hospital_type_check" CHECK (hospital_type = ANY (ARRAY['general'::text, 'specialty'::text, 'clinic'::text, 'trauma_center'::text, 'teaching'::text, 'other'::text])),
	CONSTRAINT "hospitals_license_verification_status_check" CHECK (license_verification_status = ANY (ARRAY['pending'::text, 'verified'::text, 'rejected'::text])),
	CONSTRAINT "hospitals_number_of_beds_check" CHECK (number_of_beds >= 0)
);
--> statement-breakpoint
CREATE TABLE "hospital_documents" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"document_type" text NOT NULL,
	"verification_status" text DEFAULT 'pending' NOT NULL,
	"uploaded_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "hospital_documents_document_type_check" CHECK (document_type = ANY (ARRAY['license'::text, 'accreditation'::text, 'insurance'::text, 'other'::text])),
	CONSTRAINT "hospital_documents_verification_status_check" CHECK (verification_status = ANY (ARRAY['pending'::text, 'verified'::text, 'rejected'::text]))
);
--> statement-breakpoint
CREATE TABLE "hospital_departments" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"specialty_id" uuid NOT NULL,
	CONSTRAINT "hospital_departments_hospital_id_specialty_id_key" UNIQUE("hospital_id","specialty_id")
);
--> statement-breakpoint
CREATE TABLE "hospital_preferences" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"max_search_distance_km" integer,
	"prefer_affiliated_only" boolean DEFAULT false,
	"preferred_doctor_ids" text[],
	"blocked_doctor_ids" text[],
	CONSTRAINT "hospital_preferences_hospital_id_key" UNIQUE("hospital_id")
);
--> statement-breakpoint
CREATE TABLE "doctor_hospital_affiliations" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"doctor_id" uuid NOT NULL,
	"hospital_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"is_preferred" boolean DEFAULT false,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "doctor_hospital_affiliations_doctor_id_hospital_id_key" UNIQUE("doctor_id","hospital_id"),
	CONSTRAINT "doctor_hospital_affiliations_status_check" CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'pending'::text, 'suspended'::text]))
);
--> statement-breakpoint
CREATE TABLE "availability_templates" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"doctor_id" uuid NOT NULL,
	"template_name" text NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"recurrence_pattern" text NOT NULL,
	"recurrence_days" text,
	"valid_from" date NOT NULL,
	"valid_until" date,
	CONSTRAINT "availability_templates_check" CHECK (end_time > start_time),
	CONSTRAINT "availability_templates_recurrence_pattern_check" CHECK (recurrence_pattern = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'custom'::text]))
);
--> statement-breakpoint
CREATE TABLE "doctor_availability" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"doctor_id" uuid NOT NULL,
	"template_id" uuid,
	"slot_date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"is_manual" boolean DEFAULT false,
	"booked_by_hospital_id" uuid,
	"booked_at" timestamp,
	"notes" text,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "doctor_availability_check" CHECK (end_time > start_time)
);
--> statement-breakpoint
CREATE TABLE "enum_status" (
	"status" text PRIMARY KEY NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "doctor_availability_history" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"availability_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"old_status" text,
	"new_status" text,
	"changed_by" text NOT NULL,
	"changed_by_id" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "doctor_availability_history_changed_by_check" CHECK (changed_by = ANY (ARRAY['doctor'::text, 'hospital'::text, 'system'::text, 'admin'::text])),
	CONSTRAINT "doctor_availability_history_event_type_check" CHECK (event_type = ANY (ARRAY['created'::text, 'updated'::text, 'booked'::text, 'released'::text, 'cancelled'::text]))
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"date_of_birth" date NOT NULL,
	"gender" text,
	"phone" text,
	"emergency_contact" text,
	"address" text,
	"medical_condition" text,
	"room_type" text,
	"cost_per_day" numeric(10, 2),
	"medical_notes" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "patients_gender_check" CHECK (gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text, 'prefer_not_to_say'::text])),
	CONSTRAINT "patients_room_type_check" CHECK (room_type = ANY (ARRAY['general'::text, 'private'::text, 'semi_private'::text, 'icu'::text, 'emergency'::text]))
);
--> statement-breakpoint
CREATE TABLE "patient_consents" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"patient_id" uuid NOT NULL,
	"consent_type" text NOT NULL,
	"granted" boolean NOT NULL,
	"granted_by" text NOT NULL,
	"relation_to_patient" text,
	"digital_signature" text,
	"granted_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "patient_consents_consent_type_check" CHECK (consent_type = ANY (ARRAY['treatment'::text, 'data_sharing'::text, 'research'::text, 'photography'::text, 'other'::text]))
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"availability_slot_id" uuid,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"expires_at" timestamp,
	"actual_start_time" timestamp,
	"actual_end_time" timestamp,
	"treatment_notes" text,
	"consultation_fee" numeric(10, 2),
	"cancellation_reason" text,
	"cancelled_by" text,
	"cancelled_at" timestamp,
	"completed_at" timestamp,
	"paid_at" timestamp,
	CONSTRAINT "assignments_cancelled_by_check" CHECK (cancelled_by = ANY (ARRAY['hospital'::text, 'doctor'::text, 'system'::text]))
);
--> statement-breakpoint
CREATE TABLE "enum_priority" (
	"priority" text PRIMARY KEY NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "assignment_ratings" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"hospital_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"review_text" text,
	"positive_tags" text[],
	"negative_tags" text[],
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "assignment_ratings_assignment_id_key" UNIQUE("assignment_id"),
	CONSTRAINT "assignment_ratings_rating_check" CHECK ((rating >= 1) AND (rating <= 5))
);
--> statement-breakpoint
CREATE TABLE "assignment_payments" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"hospital_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"consultation_fee" numeric(10, 2) NOT NULL,
	"platform_commission" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"doctor_payout" numeric(10, 2) NOT NULL,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"paid_to_doctor_at" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "assignment_payments_assignment_id_key" UNIQUE("assignment_id"),
	CONSTRAINT "assignment_payments_payment_status_check" CHECK (payment_status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text]))
);
--> statement-breakpoint
CREATE TABLE "hospital_cancellation_flags" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"assignment_id" uuid NOT NULL,
	"severity" text NOT NULL,
	"policy_window" text NOT NULL,
	"recorded_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "hospital_cancellation_flags_severity_check" CHECK (severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))
);
--> statement-breakpoint
CREATE TABLE "webhook_logs" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"source" text NOT NULL,
	"event_type" text NOT NULL,
	"event_id" text NOT NULL,
	"payload" json NOT NULL,
	"processed_at" timestamp,
	"status" text NOT NULL,
	"error_message" text,
	CONSTRAINT "webhook_logs_event_id_key" UNIQUE("event_id"),
	CONSTRAINT "webhook_logs_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'processed'::text, 'failed'::text, 'ignored'::text]))
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid,
	"actor_type" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"details" json,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "audit_logs_actor_type_check" CHECK (actor_type = ANY (ARRAY['user'::text, 'system'::text, 'admin'::text, 'webhook'::text]))
);
--> statement-breakpoint
CREATE TABLE "enum_channel" (
	"channel" text PRIMARY KEY NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"recipient_type" text NOT NULL,
	"recipient_id" uuid,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"channel" text NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"assignment_id" uuid,
	"payload" json,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"read" boolean DEFAULT false,
	CONSTRAINT "notifications_priority_check" CHECK (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text])),
	CONSTRAINT "notifications_recipient_type_check" CHECK (recipient_type = ANY (ARRAY['user'::text, 'role'::text, 'all'::text]))
);
--> statement-breakpoint
CREATE TABLE "notification_recipients" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"notification_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"delivered_at" timestamp,
	"read_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "hospital_plan_features" ADD CONSTRAINT "hospital_plan_features_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_plan_features" ADD CONSTRAINT "doctor_plan_features_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_payment_transaction_id_fkey" FOREIGN KEY ("payment_transaction_id") REFERENCES "public"."payment_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_profile_photo_id_fkey" FOREIGN KEY ("profile_photo_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_specialties" ADD CONSTRAINT "doctor_specialties_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_specialties" ADD CONSTRAINT "doctor_specialties_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "public"."specialties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_credentials" ADD CONSTRAINT "doctor_credentials_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_credentials" ADD CONSTRAINT "doctor_credentials_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_profile_photos" ADD CONSTRAINT "doctor_profile_photos_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_profile_photos" ADD CONSTRAINT "doctor_profile_photos_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_preferences" ADD CONSTRAINT "doctor_preferences_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_leaves" ADD CONSTRAINT "doctor_leaves_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hospitals" ADD CONSTRAINT "hospitals_logo_id_fkey" FOREIGN KEY ("logo_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hospitals" ADD CONSTRAINT "hospitals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hospital_documents" ADD CONSTRAINT "hospital_documents_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hospital_documents" ADD CONSTRAINT "hospital_documents_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hospital_departments" ADD CONSTRAINT "hospital_departments_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hospital_departments" ADD CONSTRAINT "hospital_departments_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "public"."specialties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hospital_preferences" ADD CONSTRAINT "hospital_preferences_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_hospital_affiliations" ADD CONSTRAINT "doctor_hospital_affiliations_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_hospital_affiliations" ADD CONSTRAINT "doctor_hospital_affiliations_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_templates" ADD CONSTRAINT "availability_templates_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_availability" ADD CONSTRAINT "doctor_availability_booked_by_hospital_id_fkey" FOREIGN KEY ("booked_by_hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_availability" ADD CONSTRAINT "doctor_availability_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_availability" ADD CONSTRAINT "doctor_availability_status_fkey" FOREIGN KEY ("status") REFERENCES "public"."enum_status"("status") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_availability" ADD CONSTRAINT "doctor_availability_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."availability_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_availability_history" ADD CONSTRAINT "doctor_availability_history_availability_id_fkey" FOREIGN KEY ("availability_id") REFERENCES "public"."doctor_availability"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_availability_history" ADD CONSTRAINT "doctor_availability_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_consents" ADD CONSTRAINT "patient_consents_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_availability_slot_id_fkey" FOREIGN KEY ("availability_slot_id") REFERENCES "public"."doctor_availability"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_priority_fkey" FOREIGN KEY ("priority") REFERENCES "public"."enum_priority"("priority") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_status_fkey" FOREIGN KEY ("status") REFERENCES "public"."enum_status"("status") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_ratings" ADD CONSTRAINT "assignment_ratings_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_ratings" ADD CONSTRAINT "assignment_ratings_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_ratings" ADD CONSTRAINT "assignment_ratings_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_payments" ADD CONSTRAINT "assignment_payments_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_payments" ADD CONSTRAINT "assignment_payments_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_payments" ADD CONSTRAINT "assignment_payments_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hospital_cancellation_flags" ADD CONSTRAINT "hospital_cancellation_flags_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hospital_cancellation_flags" ADD CONSTRAINT "hospital_cancellation_flags_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_channel_fkey" FOREIGN KEY ("channel") REFERENCES "public"."enum_channel"("channel") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email" text_ops);--> statement-breakpoint
CREATE INDEX "idx_users_role" ON "users" USING btree ("role" text_ops);--> statement-breakpoint
CREATE INDEX "idx_users_status" ON "users" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_orders_created_at" ON "orders" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_orders_status" ON "orders" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_orders_user_id" ON "orders" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_subscriptions_end_date" ON "subscriptions" USING btree ("end_date" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_subscriptions_status" ON "subscriptions" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_subscriptions_user_id" ON "subscriptions" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_doctors_license" ON "doctors" USING btree ("medical_license_number" text_ops);--> statement-breakpoint
CREATE INDEX "idx_doctors_location" ON "doctors" USING btree ("latitude" numeric_ops,"longitude" numeric_ops);--> statement-breakpoint
CREATE INDEX "idx_doctors_rating" ON "doctors" USING btree ("average_rating" numeric_ops);--> statement-breakpoint
CREATE INDEX "idx_doctors_user_id" ON "doctors" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_hospitals_city" ON "hospitals" USING btree ("city" text_ops);--> statement-breakpoint
CREATE INDEX "idx_hospitals_location" ON "hospitals" USING btree ("latitude" numeric_ops,"longitude" numeric_ops);--> statement-breakpoint
CREATE INDEX "idx_hospitals_user_id" ON "hospitals" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_availability_date" ON "doctor_availability" USING btree ("slot_date" date_ops);--> statement-breakpoint
CREATE INDEX "idx_availability_doctor_date" ON "doctor_availability" USING btree ("doctor_id" date_ops,"slot_date" date_ops);--> statement-breakpoint
CREATE INDEX "idx_availability_status" ON "doctor_availability" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_assignments_doctor" ON "assignments" USING btree ("doctor_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_assignments_hospital" ON "assignments" USING btree ("hospital_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_assignments_patient" ON "assignments" USING btree ("patient_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_assignments_requested_at" ON "assignments" USING btree ("requested_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_assignments_status" ON "assignments" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_audit_logs_entity" ON "audit_logs" USING btree ("entity_type" uuid_ops,"entity_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_audit_logs_user_id" ON "audit_logs" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_notifications_created_at" ON "notifications" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_notifications_read" ON "notifications" USING btree ("read" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_notifications_recipient" ON "notifications" USING btree ("recipient_id" uuid_ops);
*/