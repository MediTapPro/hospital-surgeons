---
name: patient-registration
description: Guidelines for the Patient Registration and Onboarding module in hospital-surgeons — users table updates, patient profiles, schema validation, and RBAC guards. Use this skill whenever implementing registration forms, authentication APIs, password hashing, and user profile management.
---

# Patient Registration & Authentication Module

## 1. Schema Design Standards

- **Role Guard**: Ensure the user role is `'patient'` for all patient accounts.
- **Lightweight Profile Pattern**:
  - The `users` table holds authentication details (email, phone, password_hash, role).
  - The `patient_profiles` table holds patient-specific metadata (`fullName`, etc.) linked to `users.id` with a foreign key constraint.
  - Do not bloat the authentication user table with domain-specific metadata.

## 2. API Implementation Standards

- **Endpoint**: All registration requests must route to `POST /api/users/signup` or a dedicated endpoint.
- **DTO Validation**:
  - Use Zod schemas in `lib/validations/` to strictly validate request payloads.
  - Enforce constraints like `email()`, minimum password length (8 characters), and valid phone numbers.
- **Password Safety**:
  - Never store plain text passwords. Always hash passwords using `bcrypt` (with a salt factor of 10) in the service layer before saving them to the database.
- **Error Codes**:
  - `400 Bad Request` for validation failures or existing email/phone conflicts.
  - `201 Created` for successful signup with access and refresh JWT tokens returned.

## 3. Swagger Documentation Standards

All endpoints under the patient registration and profile module must be fully documented using JSDoc `@swagger` comment tags, specifying:
- **Paths & HTTP Methods**: Correct mapping (e.g. `/api/patients/signup`).
- **Tags**: Group under `[Patients]`.
- **Security**: Include `bearerAuth` security definitions for all authorized endpoints.
- **Request Body & Parameters**: Document schemas, required fields, and examples.
- **Responses**: Document `200`, `201`, `400`, `401`, `403`, and `500` outputs.

## 4. DTO Validation Patterns

- Use Zod schemas stored in `lib/validations/` prefixing them with context (e.g. `PatientSignupDtoSchema`).
- Map Zod validation errors to standardized JSON responses:
  ```typescript
  return NextResponse.json({
    success: false,
    message: validation.error.issues[0].message,
  }, { status: 400 });
  ```
- Use `partial()` or explicit Zod schemas for updates where only a subset of fields is allowed to change.

