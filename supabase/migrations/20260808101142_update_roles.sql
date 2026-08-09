alter table "public"."user_devices" drop constraint "user_devices_device_type_check";

alter table "public"."users" drop constraint "users_role_check";

drop function if exists "public"."expire_pending_assignments"();

drop function if exists "public"."process_expired_subscriptions"();

alter table "public"."user_devices" add constraint "user_devices_device_type_check" CHECK (((device_type)::text = ANY ((ARRAY['ios'::character varying, 'android'::character varying, 'web'::character varying])::text[]))) not valid;

alter table "public"."user_devices" validate constraint "user_devices_device_type_check";

alter table "public"."users" add constraint "users_role_check" CHECK ((role = ANY (ARRAY['doctor'::text, 'hospital'::text, 'admin'::text, 'patient'::text]))) not valid;

alter table "public"."users" validate constraint "users_role_check";


