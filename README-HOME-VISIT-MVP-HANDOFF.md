# Home Visit MVP — Current Handoff

Updated: 18 September 2026

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
  → future admin payout action marks doctor settlement completed
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

The active migration file is:

- `supabase/migrations/20260917175652_extend_assignment_payments_for_home_visits.sql`

It includes a backfill for existing non-trial home visits, so they do not receive a zero doctor payout.

## APIs changed or added

| API | Current responsibility |
| --- | --- |
| `PATCH /api/assignments/{id}/status` | Atomically updates assignment status, creates the appropriate payment/settlement record on completion, and releases a cancelled/declined slot. |
| `POST /api/payments/verify` | Atomically records a successful paid home-visit Razorpay payment and makes doctor settlement `pending`. |
| `GET /api/doctors/{id}/payments` | Unified hospital and home-visit payment history, with `source` and settlement `status` filters. |
| `GET /api/admin/payments` | Admin unified payment ledger with the same filters. |
| `GET /api/patients/payments` | Patient transaction history from actual payment transactions. |

New or materially changed APIs have Swagger documentation.

## UI completed

- Admin home-visit settings page.
- Patient booking/payment flow and transaction history.
- Doctor Earnings/Payments page:
  - Settlement status filter.
  - Payment source filter: All payment sources / Hospital assignments / Home visits.
- Admin Payments page and sidebar navigation.

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

## Before deploying / continuing tomorrow

1. Apply the database migration before deploying the code. The new snapshot columns must exist first.
2. If this exact database already received the earlier `assignment_payments` fields through `db:push`, do not replay duplicate `ALTER TABLE ADD COLUMN` statements. Create/apply only the missing snapshot migration or reconcile migration history first.
3. Test on staging:
   - free trial → completed → no `assignment_payments` row
   - paid home visit → completed → patient payment pending / doctor settlement processing
   - Razorpay success → patient paid / doctor settlement pending
   - hospital assignment → completed → existing hospital settlement flow
4. Build the future admin action to mark a doctor settlement as paid (`payment_status = completed`, `paid_to_doctor_at`).
5. Later: add refunds before enabling `pay_before_booking`; add a Razorpay webhook for durable server-side confirmation.
