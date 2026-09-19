# Home Visit MVP — Current Handoff

Updated: 19 September 2026

## Agreed MVP rules

- Admin can enable or disable new patient-initiated home-visit bookings.
- Existing bookings are unchanged when home visits are disabled.
- Free trials are configurable by completed-visit and active-booking limits.
- Paid visits use `pay_after_completion` only. Do not expose pre-payment until refunds are designed.
- A complimentary visit has no patient payment and no doctor settlement record.
- A paid home visit creates a settlement only when the doctor completes it.

## Current payment lifecycle

```text
Patient books home visit
  → booking snapshots fee, platform commission, doctor payout, and payment mode
  → doctor accepts and completes visit
  → assignment_payments record: patient payment pending, doctor settlement processing
  → patient pays through Razorpay
  → patient payment paid, doctor settlement pending
  → admin confirms payout after transferring doctor share
  → doctor settlement completed
```

Hospital assignments continue using the same `assignment_payments` table:

```text
payment_source = hospital_assignment
patient_payment_status = not_applicable
payment_status = hospital-to-doctor settlement status
```

Home visits use:

```text
payment_source = home_visit
patient_payment_status = Razorpay patient payment state
payment_status = doctor settlement state
```

## Database state

`assignment_payments` has been extended for both flows:

- `payment_source`
- `patient_payment_status`
- `patient_paid_at`
- `payment_transaction_id`
- `payment_order_id`
- nullable `hospital_id` for home visits

`home_visit_details` now snapshots:

- `payment_mode`
- `is_free_trial`
- `platform_commission`
- `doctor_payout`

`patient_profiles` now stores `profile_photo_id`, which references `files.id`. Patient profile reads join `users` for the read-only account email and phone, and join `files` for `profile_photo_url`.

`platform_home_visit_settings` also stores `allow_early_assignment_completion`. Although it is configured from the existing Admin Home Visit Settings page, this global rule applies to both hospital assignments and patient home visits.

The active migration file is:

- `supabase/migrations/20260917175652_extend_assignment_payments_for_home_visits.sql`

The patient-profile photo migration is:

- `supabase/migrations/20260919120000_add_patient_profile_photo.sql`
- `supabase/migrations/20260919130000_add_early_assignment_completion_setting.sql`

It includes a backfill for existing non-trial home visits, so they do not receive a zero doctor payout.

The live database was checked on 19 September 2026 and contains both snapshot columns. Do not use `20260918182753_add_home_visit_payouts.sql`; it contains only unrelated `user_devices` constraint churn.

## APIs changed or added

| API | Current responsibility |
| --- | --- |
| `PATCH /api/assignments/{id}/status` | Atomically updates assignment status, creates the appropriate payment/settlement record on completion, and releases a cancelled/declined slot. |
| `POST /api/payments/verify` | Atomically records a successful paid home-visit Razorpay payment and makes doctor settlement `pending`. |
| `GET /api/doctors/{id}/payments` | Unified hospital and home-visit payment history, with `source` and settlement `status` filters. |
| `GET /api/admin/payments` | Admin unified payment ledger with the same filters. |
| `PATCH /api/admin/payments/{id}/settle` | Admin-only home-visit payout confirmation. It requires patient payment `paid` and settlement `pending`; hospital settlements retain their existing workflow. |
| `GET /api/patients/payments` | Patient transaction history from actual payment transactions. |
| `POST /api/patients/profile-photo/upload` | Patient-only multipart image upload. It stores the file and updates `patient_profiles.profile_photo_id` atomically. |
| `PATCH /api/assignments/{id}/status` | Uses the admin-controlled `allow_early_assignment_completion` rule for both hospital and home-visit assignments; the former environment-based bypass was removed. |

New or materially changed APIs have Swagger documentation.

## UI completed

- Admin home-visit settings page.
- Patient booking/payment flow and transaction history.
- Patient Profile & Settings now shows the account email and phone, plus an avatar with JPG/PNG/WebP upload (5 MB maximum).
- Admin Home Visit Settings includes Allow early assignment completion. It defaults to off and applies immediately to hospital assignments and home visits.
- Doctor Earnings/Payments page:
  - Settlement status filter.
  - Payment source filter: All payment sources / Hospital assignments / Home visits.
- Admin Payments page and sidebar navigation.
  - Home visits show a `Pay ₹...` action only after patient payment is received.
  - Hospital-assignment rows deliberately show no new payout action.
- Razorpay checkout closes its active modal after verified success and cancels stale initialization, preventing a second popup over the bookings page.
- Shared HTTP client refreshes an expired access token with the stored refresh token and retries the failed request. Login occurs only when refresh token is missing, expired, or invalid.

## Coding rules added

- Multi-write business flows must use `await db.transaction(...)` and the transaction client for every query inside it.
- New/materially changed APIs require Swagger JSDoc.
- Reusable business status/source/mode values belong in `lib/enums`, not duplicated as string literals.
- Current shared payment enum: `lib/enums/assignment-payments.enums.ts`.

## Verification completed

```text
npx tsc --noEmit --pretty false  ✅
git diff --check                 ✅
```

Existing callers were checked for the changed APIs:

- Doctor earnings keeps the expected `assignment`, `hospital`, and `patient` response objects.
- Assignment screens use unchanged `success` and `message` response fields.
- Razorpay checkout keeps its existing verification success response and redirect.
- The database has a paid historical home visit (`c342cc64-a212-4749-ae79-e6577736b055`) with a successful Razorpay transaction but no `assignment_payments` row. It needs a one-time backfill: source `home_visit`, patient payment `paid`, settlement `pending`, fee ₹1000, platform commission ₹100, doctor payout ₹900, linked order/transaction.

## Before deploying / continuing tomorrow

1. Backfill the one known paid home-visit settlement record listed above, then verify it appears in Admin and Doctor → Home visits filters.
2. Test on staging:
   - free trial → completed → no `assignment_payments` row
   - paid home visit → completed → patient payment pending / doctor settlement processing
   - Razorpay success → patient paid / doctor settlement pending
   - hospital assignment → completed → existing hospital settlement flow
3. Later: add a Razorpay webhook for durable server-side confirmation. Browser verification is working but should not be the only source of truth.
4. Later: add refunds before enabling `pay_before_booking`.
5. Keep current normal chat for MVP. Do not add assignment-based chat until per-visit conversation/privacy/closure rules are agreed.
6. Run `npm run db:push` before using patient profile reads or photo upload; the new `patient_profiles.profile_photo_id` column must exist in the database.
