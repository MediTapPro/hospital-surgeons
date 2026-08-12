# Supabase Remote Database Diff

## 1. Authenticate Supabase CLI

First, log in to Supabase CLI:

```bash
npx supabase login
```

This will open a browser where you authenticate with your Supabase account.

After successful login, the CLI will be authenticated.

---

## 2. Link the Supabase Project

From the project root, run:

```bash
npx supabase link --project-ref bbohghnflhlascogqqdr
```

You can find the project reference from your Supabase project URL:

```text
https://bbohghnflhlascogqqdr.supabase.co
              ↑
         project-ref
```

The CLI may ask for your database password.

---

## 3. Set Database Password

If the CLI asks for `SUPABASE_DB_PASSWORD`, set it manually:

```bash
export SUPABASE_DB_PASSWORD='YOUR_DATABASE_PASSWORD'
```

For example:

```bash
export SUPABASE_DB_PASSWORD='medi-link'
```

Verify that it is set without displaying the password:

```bash
if [ -n "$SUPABASE_DB_PASSWORD" ]; then
  echo "SUPABASE_DB_PASSWORD is set"
else
  echo "SUPABASE_DB_PASSWORD is NOT set"
fi
```

---

## 4. Generate Diff Against Remote Database

Run:

```bash
npx supabase db diff --db-url "postgresql://postgres.bbohghnflhlascogqqdr:medi-link@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true" -f add_home_visit_booking
```

This compares the migration state with the **remote Supabase database** and generates a migration file.

---

## 5. Important

Do **not** run:

```bash
npx supabase start
```

for this workflow.

`supabase start` starts a local Supabase database.

For the remote database, use:

```bash
npx supabase db diff --db-url "postgresql://postgres.bbohghnflhlascogqqdr:medi-link@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true" -f add_home_visit_booking
```

---

## Complete Workflow

Run these commands in order:

```bash
npx supabase login
```

```bash
npx supabase link --project-ref bbohghnflhlascogqqdr
```

```bash
npx supabase db diff --db-url "postgresql://postgres.bbohghnflhlascogqqdr:medi-link@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true" -f add_home_visit_booking
```

The generated migration will be placed under:

```text
supabase/migrations/
```

Review the generated SQL before applying it.
