alter table "public"."user_devices" drop constraint "user_devices_device_type_check";

alter table "public"."assignments" add column "patient_profile_id" uuid;

alter table "public"."assignments" add column "source" text not null default 'hospital'::text;

alter table "public"."assignments" alter column "hospital_id" drop not null;

alter table "public"."assignments" alter column "patient_id" drop not null;

alter table "public"."availability_templates" add column "slot_type" text not null default 'hospital'::text;

alter table "public"."doctor_availability" add column "slot_type" text not null default 'hospital'::text;

alter table "public"."assignments" add constraint "assignments_patient_profile_id_fkey" FOREIGN KEY (patient_profile_id) REFERENCES public.patient_profiles(id) ON DELETE SET NULL not valid;

alter table "public"."assignments" validate constraint "assignments_patient_profile_id_fkey";

alter table "public"."assignments" add constraint "assignments_source_check" CHECK ((source = ANY (ARRAY['hospital'::text, 'patient'::text]))) not valid;

alter table "public"."assignments" validate constraint "assignments_source_check";

alter table "public"."availability_templates" add constraint "availability_templates_slot_type_check" CHECK ((slot_type = ANY (ARRAY['hospital'::text, 'home_visit'::text]))) not valid;

alter table "public"."availability_templates" validate constraint "availability_templates_slot_type_check";

alter table "public"."doctor_availability" add constraint "doctor_availability_slot_type_check" CHECK ((slot_type = ANY (ARRAY['hospital'::text, 'home_visit'::text]))) not valid;

alter table "public"."doctor_availability" validate constraint "doctor_availability_slot_type_check";

alter table "public"."user_devices" add constraint "user_devices_device_type_check" CHECK (((device_type)::text = ANY ((ARRAY['ios'::character varying, 'android'::character varying, 'web'::character varying])::text[]))) not valid;

alter table "public"."user_devices" validate constraint "user_devices_device_type_check";


