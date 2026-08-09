# Hospital Surgeons — Home Visit Platform

A platform that lets patients find doctors, book home visits, receive digital prescriptions and visit notes, with free follow-up options — fully independent of hospital workflows.

---

## Overview

Built on top of an existing doctor-hospital assignment platform, this module extends the doctor portal to support home visits and introduces a new patient-facing portal. Payments are handled by a unified cross-platform module serving all money flows (subscriptions, hospital assignments, and home visits).

---

## Key Features

### For Patients (MVP — Release 1)
- Register via email, phone OTP, or social login
- Manage addresses
- Search doctors by specialty, location, symptoms, or name
- Book home visits with structured symptom questionnaires
- Upload medical reports before the visit
- Pay upfront via Razorpay (cards, UPI, netbanking)
- View visit notes and digital prescriptions
- Download/share prescriptions as PDF

### For Patients (Release 2+)
- Family members module (R4)
- Advanced filters: gender, language, availability badges (R2)
- Free follow-up visits, chat with doctor, ratings & reviews (R2)
- Deposit + balance, post-visit payment models (R3)
- Cash payments (R3)
- Favorites + saved payment methods (R4)

### For Doctors (MVP — Release 1)
- Toggle home visits ON/OFF
- Set availability (selected model)
- Configure flat consultation fee
- Set travel radius / working areas
- Accept/decline bookings, update status through lifecycle
- Write digital prescriptions
- Issue sick leave certificates
- Upload images and record diagnosis notes
- View Google Maps directions to patient

### For Doctors (Release 2+)
- Advanced fee models: tiered, time-based, distance-based (R3)
- Surcharges: night, emergency, medicine, nursing (R3)
- Route optimization for multiple visits (R3)
- Chat with patients (R2)
- Mark follow-up eligible visits (R2)
- Earnings dashboard for home visits (R3)
- Payout account setup + automated settlements (R3)

### For Administrators (Release 3+)
- Doctor verification (license, identity, address, bank) (R3)
- Approve home visit eligibility (R3)
- View all bookings with filters (R3)
- Manual booking creation (call center support) (R3)
- Fraud detection (frequent cancellations, no-show patterns) (R3)
- Payment monitoring across all money flows (R3)
- Dispute resolution and refund processing (R3)
- Platform-wide settings (commission, deposit %, cancellation window) (R4)
- KPIs and analytics dashboard with CSV/PDF export (R4)
- Complete audit trail (MVP baseline, R4 hardening)

---

## Money Flows

| Flow | From → To | Status |
|------|-----------|--------|
| Doctor Subscription | Doctor → Platform | ✅ Live |
| Hospital Subscription | Hospital → Platform | ✅ Live |
| Hospital Assignment Payment | Hospital → Doctor | To be built |
| Home Visit Payment | Patient → Doctor | To be built |

All payment flows are handled by a single cross-platform Payments Module.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS, shadcn/ui (Radix UI primitives) |
| Database | PostgreSQL via Drizzle ORM, Supabase |
| Payments | Razorpay |
| Maps | Google Maps Platform |
| Notifications | Push (in-app), SMS, Email |
| Chat | In-app real-time messaging |
| Auth | JWT, OTP, social login |

---

## Current Platform (Already Built)

The following modules exist today and will be extended for home visits:

- Doctor dashboard, schedule, leave management
- Doctor profile, credentials, specialties, photos
- Doctor-hospital affiliations
- Fee management (hospital-facing)
- Earnings & transactions
- Ratings & reviews
- Subscriptions
- Chat (doctor ↔ hospital)
- Notifications & alerts
- Support tickets
- Hospital portal (patient management, assignments)
- Admin panel (users, verifications, analytics, audit logs)

---

## Project Structure

```
hospital-surgeons/
├── app/
│   ├── admin/          # Admin portal
│   ├── doctor/         # Doctor portal (extended for home visits)
│   ├── hospital/       # Hospital portal
│   ├── patient/        # New patient portal
│   ├── api/            # API routes
│   └── components/     # Shared UI components
├── lib/
│   ├── services/       # Business logic
│   ├── repositories/   # Data access
│   ├── validations/    # DTOs and validation
│   ├── auth/           # JWT and middleware
│   └── utils/          # Scoring, geocoding, audit
├── src/
│   └── db/             # Database schema and migrations
├── docs/               # Documentation
├── scripts/            # Admin CLI tools
└── supabase/           # Database migrations
```

---

## Phased Release Plan

Each release is independently demoable. Slices within a release are milestones — see the PRD for the full 26-milestone breakdown.

### Release 1 (MVP) — "Get patients in and playing"
| Milestones | What ships |
|-----------|------------|
| 1–10 | Patient auth + profile, doctor home visit toggle, Maps geocode/distance, patient addresses, doctor search + profile view, booking flow (no payment), payment integration (full upfront online), status lifecycle, visit notes + prescriptions, push+email notifications |

**After Release 1:** Patient can sign up, find a doctor, book, pay, get a visit, receive a prescription. Minimum playable product.

### Release 2 — Retention
| Milestones | What ships |
|-----------|------------|
| 11–16 | Doctor↔Patient chat, reschedule flow, free follow-up, ratings & reviews, SMS notifications, advanced search filters (gender, language, availability badges) |

### Release 3 — Monetization depth & ops tooling
| Milestones | What ships |
|-----------|------------|
| 17–22 | Advanced fee models + surcharges, deposit payment models, payout automation + invoicing + disputes, offline payments (cash), admin panel core (verification, oversight, fraud), route optimization + live location sharing |

### Release 4 — Governance & polish
| Milestones | What ships |
|-----------|------------|
| 23–26 | Admin settings & reports (KPIs, exports), compliance hardening, family members module, favorites + saved payment methods |

---

## Future Scope (Unsequenced — Phase G)

- AI-assisted symptom triage
- Wearable device integration
- Home nursing, vaccination, ambulance services
- Multi-language UI
- WhatsApp notifications
- Voice-note dictation for visit notes
- Subscription plans for frequent home visits

---

## Contact

For questions, feature requests, or client inquiries, refer to the detailed PRD at `docs/home-visit-prd.md`.
