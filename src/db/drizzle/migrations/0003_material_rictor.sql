CREATE TABLE "doctor_assignment_usage" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"doctor_id" uuid NOT NULL,
	"month" varchar(7) NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"limit_count" integer NOT NULL,
	"reset_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "doctor_assignment_usage_doctor_id_month_key" UNIQUE("doctor_id","month")
);
--> statement-breakpoint
CREATE TABLE "hospital_usage_tracking" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"month" varchar(7) NOT NULL,
	"patients_count" integer DEFAULT 0 NOT NULL,
	"assignments_count" integer DEFAULT 0 NOT NULL,
	"patients_limit" integer NOT NULL,
	"assignments_limit" integer NOT NULL,
	"reset_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "hospital_usage_tracking_hospital_id_month_key" UNIQUE("hospital_id","month")
);
--> statement-breakpoint
ALTER TABLE "hospital_plan_features" ADD COLUMN "max_assignments_per_month" integer;--> statement-breakpoint
ALTER TABLE "doctor_assignment_usage" ADD CONSTRAINT "doctor_assignment_usage_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hospital_usage_tracking" ADD CONSTRAINT "hospital_usage_tracking_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_doctor_assignment_usage_doctor_month" ON "doctor_assignment_usage" USING btree ("doctor_id" text_ops,"month" text_ops);--> statement-breakpoint
CREATE INDEX "idx_hospital_usage_tracking_hospital_month" ON "hospital_usage_tracking" USING btree ("hospital_id" text_ops,"month" text_ops);