# Patient-Initiated Home Visit Payments & Payouts System

This module implements the B2C payment collection and doctor payout ledger for patient-initiated home visits. It uses a hybrid design combining **automated online patient payments** and **manual administrator doctor settlements**, future-proofed for automated payout gateways.

---

## 1. System Architecture & Workflow

The payment flow leverages existing B2B tables (`orders`, `payment_transactions`, `assignments`, and `assignment_payments`) to coordinate transactions without database schema changes.

```
                  [ Patient Booking Wizard ]
                              │
                              ▼ (Create Assignment & Order)
                    [ B2C Consultation Order ]
                              │
                              ▼ (Pay Online via Gateway)
                    [ /api/payments/verify ]
                              │
            ┌─────────────────┴─────────────────┐
            ▼                                   ▼
 [ payment_transactions ] (Incoming)   [ assignment_payments ] (Ledger)
   - amount: ₹1000                       - consultationFee: ₹1000
   - status: 'completed'                 - platformCommission: ₹100 (10%)
                                         - doctorPayout: ₹900 (90%)
                                         - paidToDoctorAt: NULL (Pending)
                                                │
                                                ▼ (Admin Settles Manually)
                                       [ Update: paidToDoctorAt = NOW() ]
```

---

## 2. Pricing & Splits Calculation

The pricing rules are configured at the platform level in the `platform_home_visit_fees` table:
* **Main Consultation Fee**: A standard all-inclusive flat fee set by the platform per specialty or default (e.g., **₹1000.00**).
* **Platform Commission Percentage**: A configurable commission rate (e.g., **10.00%**).
* **Doctor Payout**: The remaining balance (e.g., **90%** of the Main Fee) credited to the doctor.

### Split Example (at 10% commission):
* **Patient Pays**: ₹1000.00
* **Platform Revenue**: ₹100.00 (10% of ₹1000)
* **Owed to Doctor**: ₹900.00 (90% of ₹1000)

---

## 3. Database Schema Reuse & State Mapping

We map our B2C entities to the existing database schema as follows:

### A. Booking & Order Mapping
1. **`assignments`**: The booking itself is saved with the resolved `hospitalId` (fetched from the doctor's active hospital affiliation) and `consultationFee` (the main fee).
2. **`orders`**: Created with `orderType = 'consultation'` and `status = 'pending'`.
3. **`orders.assignmentId`**: Direct foreign key relation referencing `assignments.id` to connect the order to the home visit booking.

### B. Transaction & Payout Mapping
1. **`payment_transactions`**: Stores the raw gateway details for the patient's payment (Stripe/Razorpay transaction ID, currency, amount).
2. **`assignment_payments`**: Represents the split ledger:
   * `consultationFee`: ₹1000.00
   * `platformCommission`: ₹100.00
   * `doctorPayout`: ₹900.00
   * `paymentStatus`: `'completed'` (once verified)
   * `paidToDoctorAt`: `NULL` represents a **Pending Payout**. When marked as paid, the timestamp is set, representing a **Settled Payout**.

---

## 4. Key Code Interactions

### A. Booking Flow (`lib/services/home-visits.service.ts`)
When the booking is initiated:
1. Resolve the doctor's active hospital affiliation.
2. Insert the assignment record.
3. Generate a pending gateway checkout order in the `orders` table, setting `assignmentId` to the newly created assignment's ID.

### B. Payment Verification (`app/api/payments/verify/route.ts`)
On successful payment:
1. Retrieve `assignmentId` directly from the `orders` record.
2. Calculate the platform commission split based on the configured commission percentage.
3. Insert the ledger record into `assignment_payments` (with `paidToDoctorAt` as `NULL`).
4. Update the assignment status to `'accepted'` (confirmed booking slot).
5. Insert the gateway transaction log into `payment_transactions`.

### C. Doctor Payout Ledger (`lib/services/home-visit-payments.service.ts`)
* **List Payouts**: Query `assignment_payments` where `paidToDoctorAt` is null (Pending) or not null (Paid).
* **Settle Payout**: Provide an admin/system update setting `paidToDoctorAt = NOW()`. This action is future-proofed to accept Stripe/Razorpay payout transaction references in `payment_transactions` later.
