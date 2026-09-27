# Admin Portal Handoff

Updated: 19 September 2026

## Current focus

The admin portal is being stabilized page by page. The current refactor keeps existing response shapes and business behavior while enforcing the project rules:

- Admin routes use JWT/RBAC middleware (`withAuth` or `withAuthAndContext`).
- Routes call services; services contain validation/business rules; repositories contain Drizzle/SQL.
- Multi-write operations use one database transaction, including their audit record.
- Changed endpoints include Swagger JSDoc.
- Admin UI uses the authenticated `apiClient`, shared tables/dialogs, and feature constants/enums.

## Completed or refactored

### Dashboard and verification

- Dashboard statistics, trends, alerts, and recent activity are behind admin guards and repository/service layers.
- Doctor and hospital verification APIs use admin guards and audit the authenticated admin actor.
- Verification UI uses shared table patterns and review dialogs.

### Users

- User list, detail, role, and status APIs use repository/service layers and admin RBAC.
- User status and verification are displayed separately: patients do not require provider verification.
- New patient registration creates an active user.
- Last-login display reads the persisted login timestamp; `Never` is shown only when no timestamp exists.

### Specialties, categories, and procedures

- Admin specialty/procedure endpoints are admin-only and documented in Swagger.
- Specialty, category, and procedure operations preserve the existing hierarchy and portal consumers.
- Doctor, hospital, and patient catalog consumers continue using their existing active-specialty endpoints.
- Deletion checks dependent records and returns a conflict when a record is referenced.

### Assignment settings

- `/admin/settings` now manages assignment expiry windows for routine, urgent, and emergency assignments.
- Expiry values are persisted through `/api/admin/assignment-expiry`.
- The same settings apply to hospital and home-visit assignments.
- Home-visit settings remain on the dedicated Home Visit Settings page.

### Subscriptions

Admin subscription APIs are now layered and protected:

| Endpoint | Responsibility |
| --- | --- |
| `GET /api/admin/subscriptions` | Paginated/filterable subscription list |
| `GET /api/admin/subscriptions/expiring` | Active subscriptions nearing expiry |
| `GET /api/admin/subscriptions/{id}` | Subscription detail |
| `PUT /api/admin/subscriptions/{id}` | Admin status, renewal, or end-date update |

- Admin subscription queries live in `lib/repositories/admin-subscriptions.repository.ts`.
- Response mapping and update rules live in `lib/services/admin-subscriptions.service.ts`.
- Subscription update plus audit logging is atomic; an audit-write failure rolls back the update.
- `SubscriptionsOverview` uses `apiClient` so access-token refresh behavior is preserved.
- The subscriptions page filters by Doctor or Hospital through the API, including Expiring Soon.
- Subscription amounts are displayed in the platform currency (INR); legacy currency labels are not shown in the admin price column.
- Consumer doctor/hospital subscription APIs were not changed.

### Assignments monitor

The Admin Assignments page now uses the shared `AdminDataTable` with a sticky Actions column and distinguishes:

- `hospital_assignment` records, which use hospital patients;
- `home_visit` records, which use `patient_profile_id` and `home_visit_details`.

Home visits display the patient/profile or recipient name and visit address instead of showing `Unknown` for hospital data. Assignment list, detail, statistics, and update APIs are admin-only and use the assignment repository/service. Updates and audit records are transactional.

## Runtime verification still required

Static checks currently pass:

```text
npx tsc --noEmit  ✅
git diff --check  ✅
```

Before merging, run the app against the configured database and verify:

1. Admin subscription list loads with active-token authentication.
2. Expiring tab loads with `days=30`.
3. Subscription detail loads.
4. Updating status/renewal/end date changes the row and creates one audit row.
5. Force an audit insert failure and confirm the subscription update is rolled back.
6. Non-admin requests receive `401`/`403`.
7. Doctor and hospital subscription pages still load their existing consumer APIs.

No schema migration is required for the subscription refactor.

## Known scope boundaries

- Support is currently hidden from the admin navigation because no supported backend workflow is assigned to that page.
- Refunds, automated doctor payouts, and subscription payment reconciliation remain outside this MVP refactor.
- Runtime database verification has not been performed by the static checks above.

### Shared admin tables

`AdminDataTable` now supports a shared pagination footer. Users, doctor/hospital verifications, specialties, subscriptions, and assignments use server pagination with a page-size selector (10, 20, 25, 50, or 100), total-count display, and previous/next controls. Procedures, categories, and specialty hierarchy tables use the same control in client-pagination mode. Changing the page size resets the current page to 1.

### Analytics (temporarily hidden)

Analytics endpoints are admin-guarded and use the `AdminAnalyticsService`/`AdminAnalyticsRepository` layers. The dashboard uses the authenticated API client, validates the 1–24 month range, displays INR revenue, and supports refresh and range selection. The sidebar entry is currently hidden and direct `/admin/analytics` visits redirect to the admin dashboard until the metrics are finalized.

### Web portal mode

The web UI supports two deployment modes through `NEXT_PUBLIC_PORTAL_MODE`:

- `all` (default, dev server): doctor, hospital, patient, and admin login/registration UI is available.
- `admin` (production admin web server): the common login renders only the admin form, registration routes redirect to `/admin/login`, and doctor/hospital/patient web layouts redirect to the admin login.

This is a UI deployment setting only. Mobile-facing APIs remain available and continue enforcing their own role guards.

Local verification commands:

```text
npm run dev                 # uses .env; all portals
npm run prod -- -p 3001    # builds with .env.production; admin-only portal
```
