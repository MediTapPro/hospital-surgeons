---
name: database
description: Database layer guide for hospital-surgeons — Drizzle ORM, PostgreSQL, repository pattern, transaction boundaries, schema migrations, and role constraints. Use this skill whenever writing queries, modifying tables, creating models, writing Drizzle schemas, or defining transaction boundaries.
---

# Database Layer & Layered Architecture — hospital-surgeons

## Technical Stack & ORM
- **Database**: PostgreSQL (Supabase/Postgres)
- **ORM**: Drizzle ORM
- **Target Schema**: `src/db/drizzle/migrations/schema.ts`

## 1. Repository vs. Service Constraint (Layered Architecture)

- **Repository Layer (`/lib/repositories/`)**:
  - Must strictly contain *only* low-level database operations, queries (Drizzle select, insert, update, delete), and raw SQL if necessary.
  - Must **never** contain business logic, permission checks, or HTTP validation.
- **Service Layer (`/lib/services/`)**:
  - Must contain all business logic, data orchestrations, validations, and rules.
  - Must coordinate repository calls and external integrations.

## 2. Transaction Boundaries & Connection Leak Prevention
- Any business flow or service method that performs **more than one database write or update operation** must be wrapped in a database transaction boundary (`db.transaction(...)`).
- **Always Await the Transaction**: You must prefix `db.transaction` with `await`. Leaving a transaction un-awaited causes execution to return early, leaving active connection handles open and leaking database connections.
- **Use the Transaction Client Context (`tx`)**: Inside `db.transaction(async (tx) => { ... })`, all repository instantiations or database queries must strictly use the transaction client parameter (`tx`). Construct repositories as `new Repository(tx)` or pass `tx` directly to repository methods. Never run queries on the global `db` client inside the transaction callback.
- **Ensure Proper Exception Propagation**: Let errors bubble up or re-throw them within the transaction block. Swallowing exceptions inside a transaction without throwing them prevents Drizzle from executing a rollback, resulting in partial commits or hung/leaked connection pools.

## 3. Role Constraints
- Ensure user role checks align with database check constraints, specifically the role check in the `users` table:
  ```typescript
  check("users_role_check", sql`role = ANY (ARRAY['doctor'::text, 'hospital'::text, 'admin'::text, 'patient'::text])`)
  ```
- Any new role introduced must be registered in the schema's check constraints.

## 4. SQL CTE (Common Table Expression) Approach
- **Complex Writes & Updates**: For complex, multi-stage database updates, cascading state changes, or bulk operations, prefer using SQL Common Table Expressions (CTEs) within a single execution block to keep logic atomic and reduce network round-trips.
- **Complex Reads**: Leverage CTEs for advanced read operations (e.g. hierarchical queries, recursive traversals, multi-stage aggregations, or pre-filtering large datasets) to break down complex queries into logical, readable steps instead of deep nested subqueries or sub-optimal joins.
