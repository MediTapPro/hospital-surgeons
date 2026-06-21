# Cron Jobs

This project has 3 automated cron jobs to handle background tasks.
All run as Supabase Edge Functions (Deno) with database-level PG functions for atomicity and locking.

## Architecture

```
pg_cron (PostgreSQL scheduler)
       ↓  every 5 min / daily
net.http_get('https://<project>.supabase.co/functions/v1/<name>')
       ↓
Edge Function (thin RPC wrapper — logging, response)
       ↓
supabase.rpc('pg_function_name')
       ↓
PG Function (transaction + FOR UPDATE SKIP LOCKED)
       ↓
Database
```

All schedules are defined in `supabase/migrations/20260621000004_cron_schedules.sql`
using `cron.schedule()` + a helper function that reads the project URL from `cron_config`.

---

## Setup per environment

### 1. Push migration (creates functions + schedules)

```sh
supabase db push
```

### 2. Set project URL (once per environment)

**Dev** (already has placeholder):
```sql
UPDATE cron_config SET value = 'https://<dev-ref>.supabase.co' WHERE key = 'project_url';
```

**Prod**:
```sql
UPDATE cron_config SET value = 'https://<prod-ref>.supabase.co' WHERE key = 'project_url';
```

---

## Jobs

| Job | Schedule | PG Function | Safety |
|-----|----------|-------------|--------|
| **expire-assignments** | `*/5 * * * *` | `expire_pending_assignments()` | `FOR UPDATE SKIP LOCKED` — prevents race with concurrent bookings |
| **process-expired-subscriptions** | `0 0 * * *` | `process_expired_subscriptions()` | Full `BEGIN/COMMIT/ROLLBACK` — no orphan subscriptions |
| **generate-availability** | `0 2 * * *` | None (pure Deno) | Idempotent — skips existing slots |

---

## Files

| File | Purpose |
|------|---------|
| `supabase/functions/expire-assignments/index.ts` | Edge Function (RPC → `expire_pending_assignments()`) |
| `supabase/functions/process-expired-subscriptions/index.ts` | Edge Function (RPC → `process_expired_subscriptions()`) |
| `supabase/functions/generate-availability/index.ts` | Edge Function (full logic in Deno) |
| `supabase/migrations/20260621000003_cron_pg_functions.sql` | Creates `expire_pending_assignments()` + `process_expired_subscriptions()` PG functions |
| `supabase/migrations/20260621000004_cron_schedules.sql` | Creates `cron_config` table + `schedule_edge_function()` helper + pg_cron schedules |
| `docs/cron-jobs.md` | This file |

---

## Deploy commands

```sh
# Deploy migrations + Edge Functions in one go (manual workflow)
# .github/workflows/supabase-deploy.yml handles this

# Or manually:
supabase db push
supabase functions deploy expire-assignments --no-verify-jwt
supabase functions deploy process-expired-subscriptions --no-verify-jwt
supabase functions deploy generate-availability --no-verify-jwt
```

---

## Manual trigger (for testing)

```bash
curl -X GET "https://<project-ref>.supabase.co/functions/v1/expire-assignments" \
  -H "Authorization: Bearer <supabase-anon-key>"
```

---

## Verify cron jobs

```sql
-- List scheduled jobs
SELECT jobid, jobname, schedule, active FROM cron.job;

-- View recent runs
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

---

## Requirements

- **Supabase Pro plan** or higher (pg_cron + pg_net extensions)
- GitHub secrets configured (for workflow):
  - `PROD_PROJECT_REF`
  - `SUPABASE_ACCESS_TOKEN`

---

## Deprecated

| Cron | Reason |
|------|--------|
| `reset-assignment-usage` | Old monthly reset — not needed (usage is subscription-cycle-aligned) |
| GitHub Actions cron workflows | Replaced by pg_cron + Edge Functions |
| Supabase Dashboard Scheduler | Replaced by pg_cron (version-controlled) |
