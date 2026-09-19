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
- Consumer doctor/hospital subscription APIs were not changed.

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
