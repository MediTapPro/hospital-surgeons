ALTER TABLE public.platform_home_visit_settings
  ADD COLUMN IF NOT EXISTS allow_early_assignment_completion boolean NOT NULL DEFAULT false;
