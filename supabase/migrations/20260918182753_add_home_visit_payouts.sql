alter table "public"."user_devices" drop constraint "user_devices_device_type_check";

alter table "public"."user_devices" add constraint "user_devices_device_type_check" CHECK (((device_type)::text = ANY ((ARRAY['ios'::character varying, 'android'::character varying, 'web'::character varying])::text[]))) not valid;

alter table "public"."user_devices" validate constraint "user_devices_device_type_check";


