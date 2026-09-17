# Home Visit MVP — Handoff

This document describes the current patient-initiated home-visit MVP. It is separate from the existing hospital-to-doctor assignment and manual payment workflow.

## Agreed MVP policy

- Admin can enable or disable new patient home-visit bookings platform-wide.
- Existing bookings are unaffected when home visits are disabled.
- Free trials are optional and configurable.
- A patient can receive a configured number of completed free visits.
- A patient can have only the configured number of pending or accepted free-trial bookings at one time.
- Paid visits use **pay after completion** only.
- The patient pays only after the doctor marks the home visit as `completed`.
- Pre-payment is intentionally not enabled. This avoids the doctor-rejects-after-payment refund case for the MVP.
- Refunds and doctor payouts are not part of this MVP.

## Settings

The singleton `platform_home_visit_settings` row uses `scope = 'global'`.

| Setting | Meaning |
| --- | --- |
| `home_visit_enabled` | When false, patients cannot create new home-visit bookings. |
| `free_trial_enabled` | Turns free-trial eligibility on or off. |
| `free_trial_visit_limit` | Number of completed free visits a patient may receive. `0` means none. |
| `free_trial_active_booking_limit` | Maximum pending or accepted free-trial bookings for one patient. |
| `paid_payment_timing` | Currently only `pay_after_completion` is available. |

The admin UI is at `/admin/home-visit-settings` and the API is `/api/admin/home-visit-settings`.

## Booking decision

At booking time, the server creates a snapshot in `home_visit_details`:

| Situation | `is_free_trial` | `payment_mode` | `consultation_fee` |
| --- | ---: | --- | ---: |
| Eligible free trial | true | `free_trial` | `0.00` |
| Trial unavailable or exhausted | false | `pay_after_completion` | Configured home-visit fee |

The snapshot means later setting changes do not change an existing booking's payment rule.

Free-trial eligibility is calculated as:

```text
free_trial_enabled
AND completed free visits < free_trial_visit_limit
AND pending/accepted free visits < free_trial_active_booking_limit
```

The patient profile row is locked during booking, so simultaneous booking requests cannot incorrectly grant more free trials than allowed.

## Patient payment flow

```text
Patient books visit
        ↓
Doctor completes visit
        ↓
Patient sees “Pay now” in My Bookings
        ↓
POST /api/bookings/home-visit/:id/payment-order
        ↓
Create Razorpay order and open checkout
        ↓
Razorpay verification
        ↓
Order, transaction, and assignment paid state are committed together
```

The payment-order API only permits a patient to pay their own booking when all conditions are true:

- assignment source is `patient`
- visit status is `completed`
- `payment_mode` is `pay_after_completion`
- it is not a free trial
- the assignment is not already paid

## Atomic payment recording

After Razorpay confirms a payment, `/api/payments/verify`:

1. Verifies the Razorpay signature and payment/order match.
2. Locks the internal order row.
3. Validates the order amount, currency, and home-visit payment eligibility.
4. In one database transaction, marks the order paid, creates or reuses the payment transaction, and sets `assignments.paid_at`.

If one database operation fails, the transaction rolls back. A repeated verification is safe because `gateway_payment_id` is unique.

## Main files

- `lib/services/home-visits.service.ts` — booking and free-trial rules
- `lib/repositories/home-visits.repository.ts` — home-visit database queries and locks
- `lib/services/home-visit-settings.service.ts` — settings validation and policy retrieval
- `lib/repositories/home-visit-settings.repository.ts` — settings queries
- `lib/services/home-visit-payments.service.ts` — creates a post-completion Razorpay order
- `lib/repositories/home-visit-payments.repository.ts` — payment-order database queries
- `app/api/bookings/home-visit/[id]/payment-order/route.ts` — protected patient payment-order endpoint
- `app/api/payments/verify/route.ts` — Razorpay verification and atomic payment recording
- `app/admin/home-visit-settings/page.tsx` — admin settings page
- `app/patient/bookings/page.tsx` — patient pay action after completion

## Database changes

- `home_visit_details.payment_mode`
- `home_visit_details.is_free_trial`
- `platform_home_visit_settings`

The schema was pushed directly to the database during development. The generated migration is `supabase/migrations/20260917042505_add_home_visit_settings.sql` and must be cleaned before it is committed or used in another environment: it currently includes unrelated `user_devices` constraint changes and broad table grants.

## Verification completed

```text
npx tsc --noEmit --pretty false  ✅
git diff --check                 ✅ for the changed payment verification file
```

## Remaining work for tomorrow

1. Clean and validate the generated Supabase migration before sharing it with another environment.
2. Move Razorpay order creation out of the long database transaction in `HomeVisitPaymentsService`; retain idempotency and safe retry handling.
3. Add integration tests for:
   - disabled home visits
   - free-trial limit `0`
   - completed and active trial limits
   - concurrent free-trial booking attempts
   - completed paid visit payment
   - duplicate Razorpay verify callback
   - amount/order/currency mismatch
4. Add Razorpay webhook handling as the durable server-to-server fallback; the browser success callback should not be the only confirmation path.
5. Later, when pre-payment is introduced, add cancellation/rejection refund rules before exposing `pay_before_booking`.
6. Later, add doctor payout and refund ledgers only when the business workflow is agreed.
