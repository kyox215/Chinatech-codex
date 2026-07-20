# Evidence Index — TASK-20260720-002-platform-owner-approval

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-20T21:31:13Z | Hexiang Huang |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-20T21:31:14Z` `2d25f9b051` — 55 focused tests and 2152 full-suite tests passed; lint, typecheck, Node 24 build, migration-history alignment, candidate-only dry-run, and aggregate preflight counts passed.

## Release candidate baseline

- Isolated worktree: `/private/tmp/repairdesk-platform-owner-release.K3HVGo`
- Base: `origin/main@7363746e11b6e8ca67d6183ab0201b313bfce8d7`
- Migration: `supabase/migrations/20260720231500_platform_owner_single_authority.sql`
- Migration SHA-256 before release: `f4ff7675381ba021576732d049a06ec004c1a0bd2fd803af35e652c90d362621`
- Root dirty worktree was excluded from staging and deployment.

## Application verification

- Focused authority/migration tests: 55 passed.
- Independent Security and QA rerun: 5 files, 42 tests passed.
- Full Vitest suite: 329 files, 2152 tests passed in a standalone non-parallel run.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- Node 24 `npm run build`: passed with 27 routes.
- An independent sandbox build could not fetch Google Fonts; this is an environment/network result, not a compile failure. A production Vercel build remains a release gate.

## Linked database read-only gates

- Project ref: `xluzcoduqsdvjoouqhkc`.
- Migration history aligned through `20260720190759`.
- `supabase db push --linked --dry-run` listed only `20260720231500_platform_owner_single_authority.sql`.
- Aggregate preflight: active owner `1`, valid verified canonical owner `1`, invalid active identity `0`, canonical staff profile `1`, invalid historical platform decisions `0`, pending legacy create-store requests `0`, object collisions `0`.

## PostgreSQL 17 schema-clone replay

- Production `public` schema was exported read-only and restored into an ephemeral `public.ecr.aws/supabase/postgres:17.6.1.063` container.
- The production Auth columns `confirmed_at` and `email_confirmed_at` were confirmed read-only; the local fixture schema was aligned before replay.
- The complete candidate migration executed successfully after the schema alignment.
- Postcheck: constraint validated; both triggers enabled; both functions are `SECURITY DEFINER` with fixed search path; `PUBLIC`, `anon`, and `authenticated` have no execute privilege.
- Negative fixture: a non-owner active platform-admin insert was rejected.
- Negative fixture: changing only `review_scope` on a non-owner decided row to `platform` was rejected.
- Positive fixture: the canonical owner successfully recorded a platform approval.
- Emergency removal order was executed inside a transaction and rolled back successfully; production rollback remains a separately approved timestamped forward-fix migration.

## Remaining release gates

- Commit the exact scoped candidate and record its SHA.
- Deploy the hardened application first and verify the exact production deployment.
- Observe application/Auth lookup health before database apply.
- Immediately before apply, rerun migration history, sole-pending dry-run, aggregate preflight, exact rows/bytes, active-lock query, backup/restore evidence, and release lease.
- Apply only `20260720231500`; then verify history, catalog objects, ACLs, aggregate invariants, app authorization behavior, advisors, and logs.

## Final pre-commit rerun — 2026-07-20

- Node 24 Vitest sequential run: 329 files passed, 2152 tests passed, duration 169.78 seconds.
- Node 24 ESLint: exit 0.
- Node 24 TypeScript `--noEmit`: exit 0.
- Node 24 Next.js production build: compiled successfully, TypeScript passed, 27 static pages generated.
- `2026-07-20T21:50:55Z` `001d9dbb6d` — PostgreSQL replay validated constraint, triggers, function ACLs, non-owner denial, review_scope bypass denial, owner approval, and transactional removal order. Final rerun: 329 files and 2152 tests passed; lint/typecheck exit 0; 27-page build passed.
