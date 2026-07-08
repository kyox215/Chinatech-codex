# Memory Delta — TASK-20260708-008-auth-login-investigation

## Candidate project facts

- None yet.

## Candidate department updates

- None yet.

## Candidate decisions / ADRs

- None yet.

## Candidate lessons and capability evidence

- `2026-07-08T16:15:42Z` — For Supabase Data API `Could not find the '<column>' column ... in the schema cache` errors on onboarding, first verify `information_schema.columns` on the linked project. If the column exists, send `pg_notify('pgrst', 'reload schema')` and then check deployed Vercel version/env before assuming another migration is needed. User-facing onboarding submit errors should not expose raw column names or schema-cache internals. Source: production schema query, cache reload result, and local platform repository tests in TASK-20260708-008.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
