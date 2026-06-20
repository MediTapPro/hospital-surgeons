# Subscription System

## Data Model

### subscription_plans
Plan definitions — Free, Basic, Premium, Enterprise (separate for doctor and hospital roles).

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| name | TEXT | e.g. "Free", "Basic" |
| tier | TEXT | free / basic / premium / enterprise |
| user_role | TEXT | doctor / hospital |
| is_active | BOOLEAN | soft-delete flag |
| default_billing_cycle | TEXT | monthly / quarterly / yearly / custom |

### plan_pricing
Pricing options per plan. One plan can have multiple (monthly, yearly).

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| plan_id | UUID FK -> subscription_plans | |
| billing_cycle | TEXT | monthly / quarterly / yearly / custom |
| billing_period_months | INTEGER | 1 / 3 / 12 |
| price | BIGINT | minor units |
| currency | TEXT | default USD |
| is_active | BOOLEAN | soft-delete |

### subscriptions
User subscriptions — each user has one active at a time, history preserved.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK -> users | |
| plan_id | UUID FK -> subscription_plans | |
| pricing_id | UUID FK -> plan_pricing | null for free plans |
| status | TEXT | active / expired / cancelled / suspended |
| start_date | TIMESTAMP | |
| end_date | TIMESTAMP | |
| auto_renew | BOOLEAN | default true |
| billing_cycle | TEXT | |
| billing_period_months | INTEGER | |
| next_plan_id | UUID FK -> subscription_plans | for scheduled changes |
| plan_change_status | TEXT | pending / cancelled / failed |
| replaced_by_subscription_id | UUID self-FK | links upgrades |
| created_at / updated_at | TIMESTAMP | |

### doctor_plan_features
Per-plan feature limits for doctors.

| Column | Type | Notes |
|--------|------|-------|
| max_assignments_per_month | INTEGER | -1 = unlimited, null = default (5) |
| max_affiliations | INTEGER | |
| visibility_weight | INTEGER | |

### hospital_plan_features
Per-plan feature limits for hospitals.

| Column | Type | Notes |
|--------|------|-------|
| max_patients_per_month | INTEGER | -1 = unlimited, null = default (10) |
| max_assignments_per_month | INTEGER | -1 = unlimited, null = default (20) |
| includes_premium_doctors | BOOLEAN | |

### doctor_assignment_usage
Usage tracking — aligned to subscription billing periods.

| Column | Type | Notes |
|--------|------|-------|
| doctor_id | UUID FK -> doctors | |
| subscription_id | UUID FK -> subscriptions | |
| month | VARCHAR(7) | e.g. "2026-06" (backward compat) |
| count | INTEGER | current usage |
| limit_count | INTEGER | limit at period start |
| period_start | TIMESTAMPTZ | billing period start |
| period_end | TIMESTAMPTZ | billing period end |
| reset_date | TIMESTAMP | same as period_end |

### hospital_usage_tracking
Usage tracking for hospitals — aligned to subscription billing periods.

| Column | Type | Notes |
|--------|------|-------|
| hospital_id | UUID FK -> hospitals | |
| subscription_id | UUID FK -> subscriptions | |
| patients_count | INTEGER | |
| assignments_count | INTEGER | |
| patients_limit | INTEGER | |
| assignments_limit | INTEGER | |

---

## Flows

### Registration (Free Plan Auto-Creation)
File: `app/api/doctors/register/route.ts`, `app/api/hospitals/register/route.ts`

1. User signs up in a DB transaction (user + doctor/hospital profile)
2. After transaction, queries `subscription_plans` for `tier='free'` + matching `userRole`
3. Calls `subscriptionsService.create()` — creates subscription + usage records atomically in a single `db.transaction()`
4. Free plan: 10-year end date, `autoRenew: false`, no pricing

### Paid Subscription (via Payment)
File: `app/api/payments/verify/route.ts`

1. Payment verified with Razorpay
2. Calls `subscriptionsService.create()` with `planId`, `pricingId`, `startDate: now`, `endDate: now + billingPeriodMonths`
3. If user has an existing active subscription → cancels it (set `status='cancelled'`, `replacedBySubscriptionId` = new sub ID, `cancellationReason='upgraded'`)

### Upgrade (Immediate)
File: `lib/services/subscriptions.service.ts` → `upgradeSubscription()`

1. Validates current sub is active, new tier is higher
2. In a transaction: creates new sub + cancels old sub
3. Calls `generateUsageRecords()` for new sub

### Plan Change (Scheduled — Downgrade / Same-Tier)
File: `lib/services/subscriptions.service.ts` → `changePlan()`

1. Sets `nextPlanId`, `nextPricingId`, `planChangeStatus='pending'` on existing sub
2. When current sub expires, cron (`processExpiredSubscriptions`) picks it up and creates the new sub

---

## Usage Tracking

### Generation
File: `lib/services/subscriptions.service.ts` → `generateUsageRecords()`

Called on: subscription create, upgrade, expired-plan-change processing.
- Splits subscription duration into billing periods (`billingPeriodMonths`)
- Inserts one usage record per period with `count=0`, `limitCount` from plan features
- Creates records for both doctor and hospital usage depending on `userRole`

### Period Lookup
Current period found by:
```sql
WHERE subscription_id = <sub.id>
  AND period_start <= NOW()
  AND period_end > NOW()
```

No lazy fallback — period records are guaranteed to exist because `create()` is atomic (transaction wraps both subscription insert + `generateUsageRecords()`).

### Enforcement
Both hospital and doctor limits checked before assignment creation (`app/api/hospitals/[id]/assignments/create/route.ts`):
- Hospital: `HospitalUsageService.checkAssignmentLimit()` → throws `HOSPITAL_ASSIGNMENT_LIMIT_REACHED`
- Doctor: inline `checkAssignmentLimit()` → throws `ASSIGNMENT_LIMIT_REACHED`
- If `maxAssignments === -1` (unlimited), check is skipped

Usage is incremented atomically:
```sql
UPDATE ... SET count = count + 1 WHERE id = <usage_record_id>
```

---

## API Endpoints

### Subscriptions
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/subscriptions` | List (filtered) |
| POST | `/api/subscriptions` | Create |
| GET | `/api/subscriptions/current` | Active sub for current user |
| GET | `/api/subscriptions/history` | Full history with plans, payments, orders |
| GET/PATCH/DELETE | `/api/subscriptions/[id]` | CRUD single sub |
| GET | `/api/subscriptions/plans` | List active plans |
| POST | `/api/subscriptions/plans` | Create plan (admin) |
| GET/PATCH/DELETE | `/api/subscriptions/plans/[id]` | CRUD plan (admin) |

### Admin
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/subscriptions` | List all with filters |
| GET/PUT | `/api/admin/subscriptions/[id]` | Get/update sub |
| GET | `/api/admin/subscriptions/expiring` | Expiring within N days |
| GET/POST | `/api/admin/plans` | List/create plans |
| GET/PUT/DELETE | `/api/admin/plans/[id]` | Plan CRUD (soft-delete) |
| GET/POST | `/api/admin/plans/[id]/pricing` | Pricing CRUD |
| PUT/DELETE | `/api/admin/plans/[id]/pricing/[pricingId]` | Single pricing CRUD |
| GET/PUT | `/api/admin/plans/[id]/features` | Plan features CRUD |

### Usage
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/doctors/[id]/assignment-usage` | Doctor current usage |
| GET | `/api/hospitals/[id]/assignment-usage` | Hospital current usage |
| GET | `/api/doctors/dashboard` | Dashboard (includes usage) |
| POST | `/api/hospitals/[id]/assignments/create` | Creates + enforces limits |

### Cron
| Endpoint | Status | Purpose |
|----------|--------|---------|
| `reset-assignment-usage` | DEPRECATED | Old monthly reset |
| `process-expired-subscriptions` | Active | Process pending plan changes on expiry |
| `expire-assignments` | Active | Auto-cancel expired pending assignments |
| `generate-availability` | Active | Generate doctor availability slots |

---

## Limits (Defaults)
When plan features are null/missing:

| Role | Limit | Default |
|------|-------|---------|
| Doctor | Assignments/month | 5 |
| Hospital | Patients/month | 10 |
| Hospital | Assignments/month | 20 |

`-1` means unlimited. Values are stored in `doctorPlanFeatures` / `hospitalPlanFeatures`, configurable via admin panel.

---

## Key Files

| File | Purpose |
|------|---------|
| `lib/repositories/subscriptions.repository.ts` | DB access layer for plans, pricing, subscriptions |
| `lib/services/subscriptions.service.ts` | Business logic — create, upgrade, change, cancel, generate usage records |
| `lib/services/hospital-usage.service.ts` | Hospital usage check + increment |
| `lib/config/subscription-limits.ts` | Doctor limit retrieval from DB |
| `lib/config/hospital-subscription-limits.ts` | Hospital limit retrieval from DB |
| `app/api/payments/verify/route.ts` | Payment verification + subscription creation |
| `app/api/doctors/register/route.ts` | Doctor registration + free plan |
| `app/api/hospitals/register/route.ts` | Hospital registration + free plan |
| `app/api/hospitals/[id]/assignments/create/route.ts` | Assignment creation + limit enforcement |
| `src/db/drizzle/migrations/schema.ts` | Drizzle schema definitions |
| `supabase/migrations/20260620090000_subscription_cycle_usage.sql` | Migration for period-aligned columns |
| `lib/validations/plan.dto.ts` | Zod schemas for plans/pricing |
