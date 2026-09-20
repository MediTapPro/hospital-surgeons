alter table "public"."assignment_payments" add column "patient_paid_at" timestamp without time zone;

alter table "public"."assignment_payments" add column "patient_payment_status" text not null default 'not_applicable'::text;

alter table "public"."assignment_payments" add column "payment_order_id" uuid;

alter table "public"."assignment_payments" add column "payment_source" text not null default 'hospital_assignment'::text;

alter table "public"."assignment_payments" add column "payment_transaction_id" uuid;

alter table "public"."assignment_payments" alter column "hospital_id" drop not null;

alter table "public"."home_visit_details" add column "platform_commission" numeric(10, 2) not null default '0.00';

alter table "public"."home_visit_details" add column "doctor_payout" numeric(10, 2) not null default '0.00';

with legacy_home_visit_fees as (
  select
    hvd.assignment_id,
    coalesce(a.consultation_fee, 0) as consultation_fee,
    coalesce(specialty_fee.platform_commission_percentage, default_fee.platform_commission_percentage, 0) as commission_percentage
  from public.home_visit_details hvd
  inner join public.assignments a on a.id = hvd.assignment_id
  left join public.platform_home_visit_fees specialty_fee on specialty_fee.specialty_id = a.specialty_id
  left join public.platform_home_visit_fees default_fee on default_fee.specialty_id is null
  where hvd.is_free_trial = false
    and hvd.doctor_payout = 0
)
update public.home_visit_details hvd
set
  platform_commission = round(legacy.consultation_fee * legacy.commission_percentage / 100, 2),
  doctor_payout = round(legacy.consultation_fee - (legacy.consultation_fee * legacy.commission_percentage / 100), 2)
from legacy_home_visit_fees legacy
where hvd.assignment_id = legacy.assignment_id;

CREATE INDEX idx_assignment_payments_patient_payment_status ON public.assignment_payments USING btree (patient_payment_status);

CREATE INDEX idx_assignment_payments_payment_source ON public.assignment_payments USING btree (payment_source);

CREATE INDEX idx_assignment_payments_payment_transaction_id ON public.assignment_payments USING btree (payment_transaction_id);

alter table "public"."assignment_payments" add constraint "assignment_payments_patient_payment_status_check" CHECK ((patient_payment_status = ANY (ARRAY['not_applicable'::text, 'pending'::text, 'paid'::text, 'failed'::text, 'refunded'::text]))) not valid;

alter table "public"."assignment_payments" validate constraint "assignment_payments_patient_payment_status_check";

alter table "public"."assignment_payments" add constraint "assignment_payments_payment_source_check" CHECK ((payment_source = ANY (ARRAY['hospital_assignment'::text, 'home_visit'::text]))) not valid;

alter table "public"."assignment_payments" validate constraint "assignment_payments_payment_source_check";

alter table "public"."assignment_payments" add constraint "assignment_payments_source_consistency_check" CHECK ((((payment_source = 'hospital_assignment'::text) AND (hospital_id IS NOT NULL) AND (patient_payment_status = 'not_applicable'::text)) OR ((payment_source = 'home_visit'::text) AND (hospital_id IS NULL)))) not valid;

alter table "public"."assignment_payments" validate constraint "assignment_payments_source_consistency_check";
