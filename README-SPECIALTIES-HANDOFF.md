# Specialties Module Handoff

## Scope

Admin page: `/admin/specialties`

The module manages the medical specialty master data used by doctor specialties, hospital departments, procedures, procedure categories, assignments, doctor procedure fees, and home-visit fee configuration.

## Database

`specialties` currently has only:

```text
id
name (unique)
description (nullable)
```

There is no `status` or `is_active` column. Do not add or display an editable Active/Inactive state unless that feature is explicitly approved with a schema migration.

## APIs

| Endpoint | Purpose | Status |
| --- | --- | --- |
| `GET /api/admin/specialties` | Paginated/searchable specialty list and usage counts | Admin JWT guard added; legacy route query still needs repository/service refactor |
| `POST /api/admin/specialties` | Create a specialty | Admin JWT guard added; needs atomic insert + audit transaction |
| `GET /api/admin/specialties/{id}` | Specialty detail and usage counts | Admin JWT guard added; legacy route query still needs repository/service refactor |
| `PUT /api/admin/specialties/{id}` | Update name/description | Admin JWT guard added; needs atomic update + audit transaction |
| `DELETE /api/admin/specialties/{id}` | Delete unused specialty | Admin JWT guard added; needs full reference checks and atomic delete + audit transaction |

Swagger JSDoc exists in both route files. Regenerate with:

```bash
npm run swagger:generate
```

## Backend status

Completed:

- Added admin JWT guards to all Specialty API operations.
- Replaced `x-user-id` audit identity with `req.user.userId`.
- Made `SpecialtiesRepository` accept an injected database/transaction client.

Still required:

- Keep all Drizzle queries in `SpecialtiesRepository` only.
- Move validation/business rules/response mapping to `SpecialtiesService`.
- Use `await db.transaction(...)` for create/update/delete and create the audit record using the transaction client.
- Preserve current response shapes while refactoring.
- Validate pagination/sort query parameters.
- Use case-insensitive normalized duplicate-name handling.

## Deletion rule

Deletion must be rejected if the specialty is referenced by any dependent record. Check at least:

- `doctor_specialties`
- `hospital_departments`
- `procedure_categories`
- `procedures`
- `assignments`
- `doctor_procedure_fees`
- `platform_home_visit_fees`

The usage check and delete must run in the same transaction to prevent a reference appearing between validation and deletion.

## Frontend status

File: `app/admin/_components/pages/SpecialtiesManagement.tsx`

Current issues:

- Uses raw `fetch`; switch all API calls to `apiClient`.
- Uses a custom HTML table; migrate to shared `AdminDataTable`.
- API search is already available, but the page filters the same data again in the browser. Keep API search/pagination as the source of truth.
- Remove the hardcoded Status column/value because specialty status does not exist in the database.
- Replace browser `confirm()` deletion with the project confirmation dialog pattern.
- Keep Create, Edit, Delete, and procedure-management actions.

## Verification checklist

```bash
npx tsc --noEmit
npm run swagger:generate
git diff --check
```

Manual checks:

1. Non-admin request gets `401` or `403`.
2. Create a specialty and confirm one audit record is created.
3. Attempt duplicate name and receive `409`.
4. Update name/description and confirm the audit record is created atomically.
5. Delete unused specialty successfully.
6. Verify delete is blocked for every dependency type above.
7. Check table responsiveness and sticky Actions column.
