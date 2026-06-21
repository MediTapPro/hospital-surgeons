# Cron Jobs

This project has 3 automated cron jobs. Unlike typical cron setups, these don't use Edge Functions or external schedulers. Instead, **pg_cron** (PostgreSQL's built-in scheduler) calls your existing Next.js API endpoints directly.

## Architecture

```
pg_cron (PostgreSQL — every 5 min / daily)
       ↓
invoke_app_cron() — reads latest app_url + cron_secret from cron_config table
       ↓
net.http_post → https://<your-app>/api/cron/<job-name>
       ↓  (x-cron-secret auth header)
Next.js API route (your existing code — Drizzle ORM)
       ↓
Supabase DB
```

No Edge Functions, no GitHub Actions cron, no Vercel Cron — everything lives inside the database.

## Jobs

| Job | Schedule | Endpoint | What it does |
|-----|----------|----------|-------------|
| **expire-assignments** | `*/5 * * * *` | `/api/cron/expire-assignments` | Cancels pending assignments where `expires_at < NOW()` |
| **process-expired-subscriptions** | `0 0 * * *` | `/api/cron/process-expired-subscriptions` | Activates scheduled plan changes after current plan expires |
| **generate-availability** | `0 2 * * *` | `/api/cron/generate-availability` | Creates availability slots from doctor templates for next 7 days |

## How it works

### 1. Migration (`20260621000009_cron_single.sql`)

The single migration creates:
- `cron_config` table — stores `app_url` and `cron_secret` (set per environment by workflow)
- `invoke_app_cron(endpoint_path)` function — reads config at **runtime** (not embedded in cron SQL)
- 3 `cron.schedule()` entries — each calls `invoke_app_cron('/api/cron/...')`

No secrets or URLs are embedded in the cron job SQL. The function reads fresh values from `cron_config` on every invocation.

### 2. Configuration via cron_config

Values are set by the GitHub Actions workflow after migration. The table has exactly 2 rows:

```
key           | value
--------------|-----------------------------------------------
app_url       | https://hospital-surgeons.vercel.app  (dev)
              | https://meditap.online                 (prod)
cron_secret   | <your-cron-secret>
```

If either value is missing, `invoke_app_cron()` logs a warning and skips (no crash).

## Setup per environment

### Prerequisites

- **Supabase Pro plan** or higher (pg_cron + pg_net extensions required)

### GitHub Secrets required

| Secret | Dev | Prod |
|--------|-----|------|
| `DEV_PROJECT_REF` | `bbohghnflhlascogqqdr` | — |
| `PROD_PROJECT_REF` | — | `<prod-ref>` |
| `DEV_APP_URL` | `https://hospital-surgeons.vercel.app` | — |
| `PROD_APP_URL` | — | `https://meditap.online` |
| `DEV_CRON_SECRET` | Your dev cron secret | — |
| `PROD_CRON_SECRET` | — | Your prod cron secret |
| `SUPABASE_ACCESS_TOKEN` | Your Supabase access token | Same |

### Manual dev setup (if not using workflow)

```sh
supabase db push
```

Then set the config:
```sql
INSERT INTO cron_config (key, value) VALUES ('app_url', 'https://hospital-surgeons.vercel.app') ON CONFLICT DO UPDATE;
INSERT INTO cron_config (key, value) VALUES ('cron_secret', '<your-cron-secret>') ON CONFLICT DO UPDATE;
```

### Prod setup

Push to `master` branch — GitHub Actions workflow handles everything:
1. Links to prod Supabase project
2. Pushes migrations
3. Sets `app_url` and `cron_secret` in `cron_config`

Or manually:
```sh
supabase link --project-ref <prod-ref>
supabase db push
```
Then set config with prod values.

## Verify cron jobs

```sql
-- List active jobs
SELECT jobid, jobname, schedule, active FROM cron.job;

-- View recent runs
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

## Manual trigger (for testing)

```bash
curl -X POST "https://meditap.online/api/cron/expire-assignments" \
  -H "x-cron-secret: <cron-secret>"
```

## Files

| File | Purpose |
|------|---------|
| `supabase/migrations/20260621000009_cron_single.sql` | Single migration — table + function + schedules |
| `.github/workflows/supabase-deploy.yml` | Workflow — pushes migrations + sets config per environment |
| `docs/cron-jobs.md` | This file |

## Deprecated

| Cron | Reason |
|------|--------|
| `reset-assignment-usage` | Old monthly reset — not needed (usage is subscription-cycle-aligned) |
| Supabase Edge Functions | Replaced by pg_cron calling Vercel endpoints directly |
| GitHub Actions cron workflows | Replaced by pg_cron (database-native scheduler) |
| Supabase Dashboard Scheduler | Replaced by pg_cron (version-controlled) |
