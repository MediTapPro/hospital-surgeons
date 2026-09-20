alter table "public"."chat_conversations" drop constraint "chat_conversations_doctor_id_hospital_id_key";

alter table "public"."chat_message_attachments" drop constraint "chat_message_attachments_uploaded_by_check";

alter table "public"."chat_message_reactions" drop constraint "chat_message_reactions_reactor_type_check";

alter table "public"."chat_messages" drop constraint "chat_messages_sender_type_check";

alter table "public"."user_devices" drop constraint "user_devices_device_type_check";

drop index if exists "public"."chat_conversations_doctor_id_hospital_id_key";

alter table "public"."chat_conversations" add column "patient_profile_id" uuid;

alter table "public"."chat_conversations" add column "patient_unread_count" integer not null default 0;

alter table "public"."chat_conversations" alter column "hospital_id" drop not null;

CREATE UNIQUE INDEX chat_conversations_doctor_hospital_key ON public.chat_conversations USING btree (doctor_id, hospital_id) WHERE (hospital_id IS NOT NULL);

CREATE UNIQUE INDEX chat_conversations_doctor_patient_key ON public.chat_conversations USING btree (doctor_id, patient_profile_id) WHERE (patient_profile_id IS NOT NULL);

CREATE INDEX idx_chat_conversations_patient_profile_id ON public.chat_conversations USING btree (patient_profile_id);

alter table "public"."chat_conversations" add constraint "chat_conversations_patient_profile_id_fkey" FOREIGN KEY (patient_profile_id) REFERENCES public.patient_profiles(id) ON DELETE CASCADE not valid;

alter table "public"."chat_conversations" validate constraint "chat_conversations_patient_profile_id_fkey";

alter table "public"."chat_message_attachments" add constraint "chat_message_attachments_uploaded_by_check" CHECK ((uploaded_by = ANY (ARRAY['doctor'::text, 'hospital'::text, 'patient'::text]))) not valid;

alter table "public"."chat_message_attachments" validate constraint "chat_message_attachments_uploaded_by_check";

alter table "public"."chat_message_reactions" add constraint "chat_message_reactions_reactor_type_check" CHECK ((reactor_type = ANY (ARRAY['doctor'::text, 'hospital'::text, 'patient'::text]))) not valid;

alter table "public"."chat_message_reactions" validate constraint "chat_message_reactions_reactor_type_check";

alter table "public"."chat_messages" add constraint "chat_messages_sender_type_check" CHECK ((sender_type = ANY (ARRAY['doctor'::text, 'hospital'::text, 'patient'::text]))) not valid;

alter table "public"."chat_messages" validate constraint "chat_messages_sender_type_check";

alter table "public"."user_devices" add constraint "user_devices_device_type_check" CHECK (((device_type)::text = ANY ((ARRAY['ios'::character varying, 'android'::character varying, 'web'::character varying])::text[]))) not valid;

alter table "public"."user_devices" validate constraint "user_devices_device_type_check";


