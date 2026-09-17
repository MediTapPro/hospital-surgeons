alter table "public"."user_devices" drop constraint "user_devices_device_type_check";


  create table "public"."platform_home_visit_fees" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "specialty_id" uuid,
    "fee" numeric(10,2) not null,
    "platform_commission_percentage" numeric(5,2) not null default 10.00,
    "created_at" timestamp without time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone not null default CURRENT_TIMESTAMP
      );


alter table "public"."orders" add column "assignment_id" uuid;

CREATE UNIQUE INDEX platform_home_visit_fees_pkey ON public.platform_home_visit_fees USING btree (id);

CREATE UNIQUE INDEX platform_home_visit_fees_specialty_id_key ON public.platform_home_visit_fees USING btree (specialty_id);

alter table "public"."platform_home_visit_fees" add constraint "platform_home_visit_fees_pkey" PRIMARY KEY using index "platform_home_visit_fees_pkey";

alter table "public"."orders" add constraint "orders_assignment_id_fkey" FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE SET NULL not valid;

alter table "public"."orders" validate constraint "orders_assignment_id_fkey";

alter table "public"."platform_home_visit_fees" add constraint "platform_home_visit_fees_specialty_id_fkey" FOREIGN KEY (specialty_id) REFERENCES public.specialties(id) ON DELETE CASCADE not valid;

alter table "public"."platform_home_visit_fees" validate constraint "platform_home_visit_fees_specialty_id_fkey";

alter table "public"."platform_home_visit_fees" add constraint "platform_home_visit_fees_specialty_id_key" UNIQUE using index "platform_home_visit_fees_specialty_id_key";

alter table "public"."user_devices" add constraint "user_devices_device_type_check" CHECK (((device_type)::text = ANY ((ARRAY['ios'::character varying, 'android'::character varying, 'web'::character varying])::text[]))) not valid;

alter table "public"."user_devices" validate constraint "user_devices_device_type_check";

grant delete on table "public"."platform_home_visit_fees" to "anon";

grant insert on table "public"."platform_home_visit_fees" to "anon";

grant references on table "public"."platform_home_visit_fees" to "anon";

grant select on table "public"."platform_home_visit_fees" to "anon";

grant trigger on table "public"."platform_home_visit_fees" to "anon";

grant truncate on table "public"."platform_home_visit_fees" to "anon";

grant update on table "public"."platform_home_visit_fees" to "anon";

grant delete on table "public"."platform_home_visit_fees" to "authenticated";

grant insert on table "public"."platform_home_visit_fees" to "authenticated";

grant references on table "public"."platform_home_visit_fees" to "authenticated";

grant select on table "public"."platform_home_visit_fees" to "authenticated";

grant trigger on table "public"."platform_home_visit_fees" to "authenticated";

grant truncate on table "public"."platform_home_visit_fees" to "authenticated";

grant update on table "public"."platform_home_visit_fees" to "authenticated";

grant delete on table "public"."platform_home_visit_fees" to "service_role";

grant insert on table "public"."platform_home_visit_fees" to "service_role";

grant references on table "public"."platform_home_visit_fees" to "service_role";

grant select on table "public"."platform_home_visit_fees" to "service_role";

grant trigger on table "public"."platform_home_visit_fees" to "service_role";

grant truncate on table "public"."platform_home_visit_fees" to "service_role";

grant update on table "public"."platform_home_visit_fees" to "service_role";


