# Architectural Rules — hospital-surgeons

This file defines the workspace rules and constraints for the **hospital-surgeons** project. Antigravity must always adhere to these guidelines.

**Activation**: Always On

## 1. Core Architectural Standards
- **Repository vs Service Separation**: Repositories in `/lib/repositories/` only contain SQL/Drizzle database queries. Services in `/lib/services/` contain business logic, validations, and rules. Services must never contain direct raw queries, and controllers/UI must never call repositories directly.
- **Transactions**: Wrap all multi-write operations in database transactions using `db.transaction(...)` to ensure atomicity.
- **SQL CTE Approach**: Favor SQL Common Table Expressions (CTEs) for complex operations. For writes, use them to chain multi-stage updates/inserts atomically. For reads, use them to structure complex aggregations, recursive hierarchy queries, or multi-step filtering.
- **Aesthetics & UI**: Use rich aesthetics, modern typography, glassmorphism, responsive Tailwind design, and micro-animations. No inline styles.

## 2. Load Local Skills First
Before performing any task, scan and read the corresponding skill files in `.agents/skills/`:
- `database` (Drizzle schema, transaction boundaries, CTE approach)
- `patient-registration` (Signup validation, password hashing, user-profile linking)
- `frontend-design` (Next.js 15, Tailwind, accessibility, component layout)
- `branches-and-commits` (Git conventions, branch naming, issue-linked commit messages)
