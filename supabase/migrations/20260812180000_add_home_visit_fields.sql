CREATE TABLE "public"."home_visit_details" (
  "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY NOT NULL,
  "assignment_id" uuid NOT NULL,
  "patient_address_id" uuid,
  "patient_family_member_id" uuid,
  "symptoms" text,
  "clinical_notes" text,
  "prescription" text,
  "attachment_file_id" uuid,
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "home_visit_details_assignment_id_key" UNIQUE ("assignment_id"),
  CONSTRAINT "home_visit_details_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE,
  CONSTRAINT "home_visit_details_patient_address_id_fkey" FOREIGN KEY ("patient_address_id") REFERENCES "public"."patient_addresses"("id") ON DELETE SET NULL,
  CONSTRAINT "home_visit_details_patient_family_member_id_fkey" FOREIGN KEY ("patient_family_member_id") REFERENCES "public"."patient_family_members"("id") ON DELETE SET NULL,
  CONSTRAINT "home_visit_details_attachment_file_id_fkey" FOREIGN KEY ("attachment_file_id") REFERENCES "public"."files"("id") ON DELETE SET NULL
);
