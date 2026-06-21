-- Migration: Set up pg_cron schedules for Edge Functions via helper function

-- Create config table for per-environment values
CREATE TABLE IF NOT EXISTS cron_config (
  key text PRIMARY KEY,
  value text NOT NULL
);

-- Helper function: schedules Edge Function calls via pg_cron
CREATE OR REPLACE FUNCTION schedule_edge_function(
  job_name text,
  schedule text,
  function_name text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  project_url text;
  full_url text;
BEGIN
  -- Read project URL from config (set per environment)
  SELECT value INTO project_url FROM cron_config WHERE key = 'project_url';

  IF project_url IS NULL THEN
    RAISE EXCEPTION 'cron_config.project_url not set. Run: INSERT INTO cron_config (key, value) VALUES (''project_url'', ''https://<ref>.supabase.co'');';
  END IF;

  full_url := project_url || '/functions/v1/' || function_name;

  PERFORM cron.schedule(job_name, schedule, format(
    'SELECT net.http_get(''%s'');', full_url
  ));
END;
$$;

-- Insert placeholder (update with actual URL per environment)
INSERT INTO cron_config (key, value)
VALUES ('project_url', 'https://bbohghnflhlascogqqdr.supabase.co')
ON CONFLICT (key) DO NOTHING;

-- Schedule the three cron jobs
SELECT schedule_edge_function('expire-assignments', '*/5 * * * *', 'expire-assignments');
SELECT schedule_edge_function('process-expired-subscriptions', '0 0 * * *', 'process-expired-subscriptions');
SELECT schedule_edge_function('generate-availability', '0 2 * * *', 'generate-availability');
