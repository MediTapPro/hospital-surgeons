alter table "public"."user_devices" drop constraint "user_devices_device_type_check";

alter table "public"."home_visit_details" add column "address_label" text;

alter table "public"."home_visit_details" add column "address_latitude" numeric(10,8);

alter table "public"."home_visit_details" add column "address_longitude" numeric(11,8);

alter table "public"."home_visit_details" add column "address_text" text;

alter table "public"."home_visit_details" add column "recipient_name" text;

alter table "public"."home_visit_details" add column "recipient_phone" text;

alter table "public"."home_visit_details" add column "recipient_relationship" text;

alter table "public"."user_devices" add constraint "user_devices_device_type_check" CHECK (((device_type)::text = ANY ((ARRAY['ios'::character varying, 'android'::character varying, 'web'::character varying])::text[]))) not valid;

alter table "public"."user_devices" validate constraint "user_devices_device_type_check";


