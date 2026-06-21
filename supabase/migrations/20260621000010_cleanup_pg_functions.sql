-- Clean up unused PG functions (replaced by direct Vercel endpoint calls via pg_cron)
-- These were from migration 20260621000003 — no callers remain
DROP FUNCTION IF EXISTS expire_pending_assignments;
DROP FUNCTION IF EXISTS process_expired_subscriptions;
