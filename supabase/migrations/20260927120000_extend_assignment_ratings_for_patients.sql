alter table "public"."assignment_ratings"
  alter column "hospital_id" drop not null;

alter table "public"."assignment_ratings"
  add column "patient_profile_id" uuid;

alter table "public"."assignment_ratings"
  add column "reviewer_type" text not null default 'hospital'::text;

alter table "public"."assignment_ratings"
  add constraint "assignment_ratings_patient_profile_id_fkey"
  foreign key ("patient_profile_id") references "public"."patient_profiles"("id") on delete cascade;

alter table "public"."assignment_ratings"
  add constraint "assignment_ratings_reviewer_type_check"
  check ("reviewer_type" = any (array['hospital'::text, 'patient'::text])) not valid;

alter table "public"."assignment_ratings"
  validate constraint "assignment_ratings_reviewer_type_check";

alter table "public"."assignment_ratings"
  add constraint "assignment_ratings_reviewer_consistency_check"
  check (("reviewer_type" = 'hospital'::text and "hospital_id" is not null and "patient_profile_id" is null)
      or ("reviewer_type" = 'patient'::text and "hospital_id" is null and "patient_profile_id" is not null)) not valid;

alter table "public"."assignment_ratings"
  validate constraint "assignment_ratings_reviewer_consistency_check";

create index "idx_assignment_ratings_patient_profile_id"
  on "public"."assignment_ratings" using btree ("patient_profile_id");

create index "idx_assignment_ratings_reviewer_type"
  on "public"."assignment_ratings" using btree ("reviewer_type");
