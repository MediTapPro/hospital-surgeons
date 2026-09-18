ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS profile_photo_id uuid;

ALTER TABLE public.patient_profiles
  DROP CONSTRAINT IF EXISTS patient_profiles_profile_photo_id_fkey;

ALTER TABLE public.patient_profiles
  ADD CONSTRAINT patient_profiles_profile_photo_id_fkey
  FOREIGN KEY (profile_photo_id)
  REFERENCES public.files(id)
  ON DELETE SET NULL;
