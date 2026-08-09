create extension if not exists "pg_net" with schema "extensions";

alter table "public"."user_devices" drop constraint "user_devices_device_type_check";

drop function if exists "public"."schedule_edge_function"(job_name text, schedule text, function_name text);


  create table "public"."patient_addresses" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "patient_profile_id" uuid not null,
    "label" text not null,
    "address_text" text not null,
    "latitude" numeric(10,8),
    "longitude" numeric(11,8),
    "is_default" boolean not null default false,
    "created_at" timestamp without time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone not null default CURRENT_TIMESTAMP
      );



  create table "public"."patient_family_members" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "patient_profile_id" uuid not null,
    "full_name" text not null,
    "phone" character varying(20) not null,
    "relationship" text not null,
    "created_at" timestamp without time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone not null default CURRENT_TIMESTAMP
      );



  create table "public"."patient_profiles" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "user_id" uuid not null,
    "full_name" text not null,
    "created_at" timestamp without time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone not null default CURRENT_TIMESTAMP
      );


CREATE UNIQUE INDEX patient_addresses_pkey ON public.patient_addresses USING btree (id);

CREATE UNIQUE INDEX patient_family_members_pkey ON public.patient_family_members USING btree (id);

CREATE UNIQUE INDEX patient_profiles_pkey ON public.patient_profiles USING btree (id);

CREATE UNIQUE INDEX patient_profiles_user_id_key ON public.patient_profiles USING btree (user_id);

alter table "public"."patient_addresses" add constraint "patient_addresses_pkey" PRIMARY KEY using index "patient_addresses_pkey";

alter table "public"."patient_family_members" add constraint "patient_family_members_pkey" PRIMARY KEY using index "patient_family_members_pkey";

alter table "public"."patient_profiles" add constraint "patient_profiles_pkey" PRIMARY KEY using index "patient_profiles_pkey";

alter table "public"."patient_addresses" add constraint "patient_addresses_patient_profile_id_fkey" FOREIGN KEY (patient_profile_id) REFERENCES public.patient_profiles(id) ON DELETE CASCADE not valid;

alter table "public"."patient_addresses" validate constraint "patient_addresses_patient_profile_id_fkey";

alter table "public"."patient_family_members" add constraint "patient_family_members_patient_profile_id_fkey" FOREIGN KEY (patient_profile_id) REFERENCES public.patient_profiles(id) ON DELETE CASCADE not valid;

alter table "public"."patient_family_members" validate constraint "patient_family_members_patient_profile_id_fkey";

alter table "public"."patient_profiles" add constraint "patient_profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE not valid;

alter table "public"."patient_profiles" validate constraint "patient_profiles_user_id_fkey";

alter table "public"."patient_profiles" add constraint "patient_profiles_user_id_key" UNIQUE using index "patient_profiles_user_id_key";

alter table "public"."user_devices" add constraint "user_devices_device_type_check" CHECK (((device_type)::text = ANY ((ARRAY['ios'::character varying, 'android'::character varying, 'web'::character varying])::text[]))) not valid;

alter table "public"."user_devices" validate constraint "user_devices_device_type_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.expire_pending_assignments()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  result json;
BEGIN
  WITH expired AS (
    SELECT id, availability_slot_id
    FROM assignments
    WHERE status = 'pending'
      AND expires_at IS NOT NULL
      AND expires_at < NOW()
    FOR UPDATE SKIP LOCKED
  ),
  cancelled AS (
    UPDATE assignments
    SET status = 'cancelled',
        cancelled_by = 'system',
        cancelled_at = NOW(),
        cancellation_reason = 'Assignment expired - doctor did not respond within the time limit'
    WHERE id IN (SELECT id FROM expired)
    RETURNING id, availability_slot_id
  ),
  released AS (
    UPDATE doctor_availability
    SET status = 'available',
        booked_by_hospital_id = NULL,
        booked_at = NULL
    WHERE id IN (
      SELECT availability_slot_id
      FROM cancelled
      WHERE availability_slot_id IS NOT NULL
    )
    RETURNING id
  )
  SELECT json_build_object(
    'expired_count', (SELECT count(*) FROM expired),
    'cancelled_count', (SELECT count(*) FROM cancelled),
    'released_slots', (SELECT count(*) FROM released)
  ) INTO result;

  RETURN result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.process_expired_subscriptions()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  sub_record RECORD;
  plan_record RECORD;
  pricing_record RECORD;
  new_sub_id UUID;
  results jsonb := '[]'::jsonb;
  doctor_id UUID;
  hospital_id UUID;
  limit_count INT;
  patients_limit INT;
  assignments_limit INT;
  period_start DATE;
  period_end DATE;
  sub_end_date DATE;
  billing_months INT;
BEGIN
  FOR sub_record IN
    SELECT * FROM subscriptions
    WHERE status = 'active'
      AND end_date <= NOW()
      AND plan_change_status = 'pending'
      AND next_plan_id IS NOT NULL
      AND next_pricing_id IS NOT NULL
    FOR UPDATE
  LOOP
    BEGIN
      SELECT * INTO plan_record FROM subscription_plans WHERE id = sub_record.next_plan_id;
      IF NOT FOUND OR plan_record.is_active = false THEN
        UPDATE subscriptions SET status = 'expired', plan_change_status = 'failed' WHERE id = sub_record.id;
        results := results || jsonb_build_object('subscription_id', sub_record.id, 'status', 'failed', 'reason', 'Plan no longer exists or inactive');
        CONTINUE;
      END IF;

      SELECT * INTO pricing_record FROM plan_pricing
      WHERE id = sub_record.next_pricing_id
        AND plan_id = sub_record.next_plan_id
        AND is_active = true;

      IF NOT FOUND THEN
        UPDATE subscriptions SET status = 'expired', plan_change_status = 'failed' WHERE id = sub_record.id;
        results := results || jsonb_build_object('subscription_id', sub_record.id, 'status', 'failed', 'reason', 'Pricing no longer exists or inactive');
        CONTINUE;
      END IF;

      billing_months := COALESCE(pricing_record.billing_period_months, 1);

      INSERT INTO subscriptions (
        user_id, plan_id, pricing_id, status, start_date, end_date,
        auto_renew, billing_period_months
      ) VALUES (
        sub_record.user_id, sub_record.next_plan_id, sub_record.next_pricing_id, 'active',
        sub_record.end_date, sub_record.end_date + (billing_months || ' months')::interval,
        true, billing_months
      ) RETURNING id INTO new_sub_id;

      UPDATE subscriptions
      SET status = 'expired',
          replaced_by_subscription_id = new_sub_id,
          next_plan_id = NULL,
          next_pricing_id = NULL,
          plan_change_status = NULL
      WHERE id = sub_record.id;

      -- Generate monthly usage records (always 1-month periods, matching original code)
      period_start := sub_record.end_date::date;
      sub_end_date := (sub_record.end_date + (billing_months || ' months')::interval)::date;

      WHILE period_start < sub_end_date LOOP
        period_end := (period_start + '1 month'::interval)::date;
        IF period_end > sub_end_date THEN
          period_end := sub_end_date;
        END IF;

        IF plan_record.user_role = 'doctor' THEN
          SELECT id INTO doctor_id FROM doctors WHERE user_id = sub_record.user_id;
          IF FOUND THEN
            SELECT max_assignments_per_month INTO limit_count FROM doctor_plan_features WHERE plan_id = sub_record.next_plan_id;
            limit_count := COALESCE(limit_count, 5);

            INSERT INTO doctor_assignment_usage
              (doctor_id, subscription_id, month, count, limit_count, reset_date, period_start, period_end)
            VALUES
              (doctor_id, new_sub_id, to_char(period_start, 'YYYY-MM'), 0, limit_count, period_end, period_start, period_end)
            ON CONFLICT (subscription_id, period_start) DO NOTHING;
          END IF;

        ELSIF plan_record.user_role = 'hospital' THEN
          SELECT id INTO hospital_id FROM hospitals WHERE user_id = sub_record.user_id;
          IF FOUND THEN
            SELECT max_patients_per_month, max_assignments_per_month
            INTO patients_limit, assignments_limit
            FROM hospital_plan_features
            WHERE plan_id = sub_record.next_plan_id;

            patients_limit := COALESCE(patients_limit, 10);
            assignments_limit := COALESCE(assignments_limit, 20);

            INSERT INTO hospital_usage_tracking
              (hospital_id, subscription_id, month, patients_count, assignments_count, patients_limit, assignments_limit, reset_date, period_start, period_end)
            VALUES
              (hospital_id, new_sub_id, to_char(period_start, 'YYYY-MM'), 0, 0, patients_limit, assignments_limit, period_end, period_start, period_end)
            ON CONFLICT (subscription_id, period_start) DO NOTHING;
          END IF;
        END IF;

        period_start := period_end;
      END LOOP;

      results := results || jsonb_build_object('subscription_id', sub_record.id, 'status', 'success', 'new_subscription_id', new_sub_id);

    EXCEPTION WHEN OTHERS THEN
      results := results || jsonb_build_object('subscription_id', sub_record.id, 'status', 'error', 'error', SQLERRM);
    END;
  END LOOP;

  RETURN json_build_object('processed_count', jsonb_array_length(results), 'results', results);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.schedule_app_cron(job_name text, cron_schedule text, endpoint_path text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  app_url text;
  cron_secret text;
  full_url text;
BEGIN
  SELECT value INTO app_url FROM cron_config WHERE key = 'app_url';
  SELECT value INTO cron_secret FROM cron_config WHERE key = 'cron_secret';

  IF app_url IS NULL THEN
    RAISE EXCEPTION 'cron_config.app_url not set';
  END IF;

  full_url := app_url || endpoint_path;

  PERFORM cron.schedule(job_name, cron_schedule, format(
    'SELECT net.http_post(
      url:=''%s'',
      headers:=''{"x-cron-secret": "%s", "Content-Type": "application/json"}''::jsonb
    );',
    full_url, cron_secret
  ));
END;
$function$
;

grant delete on table "public"."patient_addresses" to "anon";

grant insert on table "public"."patient_addresses" to "anon";

grant references on table "public"."patient_addresses" to "anon";

grant select on table "public"."patient_addresses" to "anon";

grant trigger on table "public"."patient_addresses" to "anon";

grant truncate on table "public"."patient_addresses" to "anon";

grant update on table "public"."patient_addresses" to "anon";

grant delete on table "public"."patient_addresses" to "authenticated";

grant insert on table "public"."patient_addresses" to "authenticated";

grant references on table "public"."patient_addresses" to "authenticated";

grant select on table "public"."patient_addresses" to "authenticated";

grant trigger on table "public"."patient_addresses" to "authenticated";

grant truncate on table "public"."patient_addresses" to "authenticated";

grant update on table "public"."patient_addresses" to "authenticated";

grant delete on table "public"."patient_addresses" to "service_role";

grant insert on table "public"."patient_addresses" to "service_role";

grant references on table "public"."patient_addresses" to "service_role";

grant select on table "public"."patient_addresses" to "service_role";

grant trigger on table "public"."patient_addresses" to "service_role";

grant truncate on table "public"."patient_addresses" to "service_role";

grant update on table "public"."patient_addresses" to "service_role";

grant delete on table "public"."patient_family_members" to "anon";

grant insert on table "public"."patient_family_members" to "anon";

grant references on table "public"."patient_family_members" to "anon";

grant select on table "public"."patient_family_members" to "anon";

grant trigger on table "public"."patient_family_members" to "anon";

grant truncate on table "public"."patient_family_members" to "anon";

grant update on table "public"."patient_family_members" to "anon";

grant delete on table "public"."patient_family_members" to "authenticated";

grant insert on table "public"."patient_family_members" to "authenticated";

grant references on table "public"."patient_family_members" to "authenticated";

grant select on table "public"."patient_family_members" to "authenticated";

grant trigger on table "public"."patient_family_members" to "authenticated";

grant truncate on table "public"."patient_family_members" to "authenticated";

grant update on table "public"."patient_family_members" to "authenticated";

grant delete on table "public"."patient_family_members" to "service_role";

grant insert on table "public"."patient_family_members" to "service_role";

grant references on table "public"."patient_family_members" to "service_role";

grant select on table "public"."patient_family_members" to "service_role";

grant trigger on table "public"."patient_family_members" to "service_role";

grant truncate on table "public"."patient_family_members" to "service_role";

grant update on table "public"."patient_family_members" to "service_role";

grant delete on table "public"."patient_profiles" to "anon";

grant insert on table "public"."patient_profiles" to "anon";

grant references on table "public"."patient_profiles" to "anon";

grant select on table "public"."patient_profiles" to "anon";

grant trigger on table "public"."patient_profiles" to "anon";

grant truncate on table "public"."patient_profiles" to "anon";

grant update on table "public"."patient_profiles" to "anon";

grant delete on table "public"."patient_profiles" to "authenticated";

grant insert on table "public"."patient_profiles" to "authenticated";

grant references on table "public"."patient_profiles" to "authenticated";

grant select on table "public"."patient_profiles" to "authenticated";

grant trigger on table "public"."patient_profiles" to "authenticated";

grant truncate on table "public"."patient_profiles" to "authenticated";

grant update on table "public"."patient_profiles" to "authenticated";

grant delete on table "public"."patient_profiles" to "service_role";

grant insert on table "public"."patient_profiles" to "service_role";

grant references on table "public"."patient_profiles" to "service_role";

grant select on table "public"."patient_profiles" to "service_role";

grant trigger on table "public"."patient_profiles" to "service_role";

grant truncate on table "public"."patient_profiles" to "service_role";

grant update on table "public"."patient_profiles" to "service_role";


