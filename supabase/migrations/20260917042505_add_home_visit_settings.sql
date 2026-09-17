alter table "public"."user_devices" drop constraint "user_devices_device_type_check";


  create table "public"."platform_home_visit_settings" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "scope" text not null default 'global'::text,
    "home_visit_enabled" boolean not null default true,
    "free_trial_enabled" boolean not null default true,
    "free_trial_visit_limit" integer not null default 1,
    "free_trial_active_booking_limit" integer not null default 1,
    "paid_payment_timing" text not null default 'pay_after_completion'::text,
    "created_at" timestamp without time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone not null default CURRENT_TIMESTAMP
      );


alter table "public"."home_visit_details" add column "is_free_trial" boolean not null default true;

alter table "public"."home_visit_details" add column "payment_mode" text not null default 'free_trial'::text;

CREATE UNIQUE INDEX platform_home_visit_settings_pkey ON public.platform_home_visit_settings USING btree (id);

CREATE UNIQUE INDEX platform_home_visit_settings_scope_key ON public.platform_home_visit_settings USING btree (scope);

alter table "public"."platform_home_visit_settings" add constraint "platform_home_visit_settings_pkey" PRIMARY KEY using index "platform_home_visit_settings_pkey";

alter table "public"."home_visit_details" add constraint "home_visit_details_payment_mode_check" CHECK ((payment_mode = ANY (ARRAY['free_trial'::text, 'pay_before_booking'::text, 'pay_after_completion'::text]))) not valid;

alter table "public"."home_visit_details" validate constraint "home_visit_details_payment_mode_check";

alter table "public"."platform_home_visit_settings" add constraint "platform_home_visit_settings_paid_payment_timing_check" CHECK ((paid_payment_timing = ANY (ARRAY['pay_before_booking'::text, 'pay_after_completion'::text]))) not valid;

alter table "public"."platform_home_visit_settings" validate constraint "platform_home_visit_settings_paid_payment_timing_check";

alter table "public"."platform_home_visit_settings" add constraint "platform_home_visit_settings_scope_check" CHECK ((scope = 'global'::text)) not valid;

alter table "public"."platform_home_visit_settings" validate constraint "platform_home_visit_settings_scope_check";

alter table "public"."platform_home_visit_settings" add constraint "platform_home_visit_settings_scope_key" UNIQUE using index "platform_home_visit_settings_scope_key";

alter table "public"."platform_home_visit_settings" add constraint "platform_home_visit_settings_trial_active_booking_limit_check" CHECK ((free_trial_active_booking_limit >= 1)) not valid;

alter table "public"."platform_home_visit_settings" validate constraint "platform_home_visit_settings_trial_active_booking_limit_check";

alter table "public"."platform_home_visit_settings" add constraint "platform_home_visit_settings_trial_visit_limit_check" CHECK ((free_trial_visit_limit >= 0)) not valid;

alter table "public"."platform_home_visit_settings" validate constraint "platform_home_visit_settings_trial_visit_limit_check";

alter table "public"."user_devices" add constraint "user_devices_device_type_check" CHECK (((device_type)::text = ANY ((ARRAY['ios'::character varying, 'android'::character varying, 'web'::character varying])::text[]))) not valid;

alter table "public"."user_devices" validate constraint "user_devices_device_type_check";

grant delete on table "public"."platform_home_visit_settings" to "anon";

grant insert on table "public"."platform_home_visit_settings" to "anon";

grant references on table "public"."platform_home_visit_settings" to "anon";

grant select on table "public"."platform_home_visit_settings" to "anon";

grant trigger on table "public"."platform_home_visit_settings" to "anon";

grant truncate on table "public"."platform_home_visit_settings" to "anon";

grant update on table "public"."platform_home_visit_settings" to "anon";

grant delete on table "public"."platform_home_visit_settings" to "authenticated";

grant insert on table "public"."platform_home_visit_settings" to "authenticated";

grant references on table "public"."platform_home_visit_settings" to "authenticated";

grant select on table "public"."platform_home_visit_settings" to "authenticated";

grant trigger on table "public"."platform_home_visit_settings" to "authenticated";

grant truncate on table "public"."platform_home_visit_settings" to "authenticated";

grant update on table "public"."platform_home_visit_settings" to "authenticated";

grant delete on table "public"."platform_home_visit_settings" to "service_role";

grant insert on table "public"."platform_home_visit_settings" to "service_role";

grant references on table "public"."platform_home_visit_settings" to "service_role";

grant select on table "public"."platform_home_visit_settings" to "service_role";

grant trigger on table "public"."platform_home_visit_settings" to "service_role";

grant truncate on table "public"."platform_home_visit_settings" to "service_role";

grant update on table "public"."platform_home_visit_settings" to "service_role";

