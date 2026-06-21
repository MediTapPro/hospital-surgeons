-- Single migration for pg_cron schedules (calls Vercel endpoints directly)
-- Values for app_url + cron_secret are set by GitHub Actions workflow (not hardcoded)

-- Clean up any stale schedules
SELECT cron.unschedule('expire-assignments');
SELECT cron.unschedule('process-expired-subscriptions');
SELECT cron.unschedule('generate-availability');

-- Config table (values injected by workflow)
CREATE TABLE IF NOT EXISTS cron_config (
  key text PRIMARY KEY,
  value text NOT NULL
);

-- Runtime wrapper: reads latest config every invocation (no secrets in cron SQL)
CREATE OR REPLACE FUNCTION invoke_app_cron(endpoint_path text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  app_url text;
  cron_secret text;
BEGIN
  SELECT value INTO app_url FROM cron_config WHERE key = 'app_url';
  SELECT value INTO cron_secret FROM cron_config WHERE key = 'cron_secret';

  IF app_url IS NULL OR cron_secret IS NULL THEN
    RAISE WARNING 'cron_config not fully set — run workflow to set app_url + cron_secret';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := app_url || endpoint_path,
    headers := jsonb_build_object(
      'x-cron-secret', cron_secret,
      'Content-Type', 'application/json'
    )
  );
END;
$$;

-- 3 schedules (no secrets/URLs embedded — just function calls)
SELECT cron.schedule('expire-assignments', '*/5 * * * *', $$SELECT invoke_app_cron('/api/cron/expire-assignments');$$);
SELECT cron.schedule('process-expired-subscriptions', '0 0 * * *', $$SELECT invoke_app_cron('/api/cron/process-expired-subscriptions');$$);
SELECT cron.schedule('generate-availability', '0 2 * * *', $$SELECT invoke_app_cron('/api/cron/generate-availability');$$);
