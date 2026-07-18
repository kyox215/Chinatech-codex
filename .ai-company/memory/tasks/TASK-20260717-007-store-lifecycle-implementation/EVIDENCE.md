# Evidence

## Implemented files

- `src/features/stores/server/store-lifecycle.repository.ts`
- `src/features/stores/server/store-lifecycle-access.ts`
- `src/features/stores/server/store-lifecycle-auth.ts`
- `src/features/stores/server/store-export-supabase-worker.ts`
- `src/features/stores/server/store-purge-worker.ts`
- `src/features/stores/server/store-purge-supabase-adapter.ts`
- `src/features/stores/model/store-lifecycle.ts`
- `src/features/settings/model/order-data-access-copy.ts`
- `src/features/settings/sections/store-settings-section.tsx`
- `src/features/settings/sections/store-lifecycle-actions.tsx`
- `supabase/migrations/20260717195346_store_lifecycle_control_plane.sql`
- `supabase/migrations/20260717195516_store_lifecycle_atomic_operations.sql`
- `supabase/migrations/20260717195519_store_lifecycle_export_purge_framework.sql`
- `supabase/migrations/20260717201728_store_lifecycle_transition_operations.sql`
- `supabase/migrations/20260717201729_store_export_restore_proof.sql`
- `supabase/migrations/20260717201730_store_purge_executor_control.sql`
- `docs/STORE_LIFECYCLE_IMPLEMENTATION_RUNBOOK.md`

## Verification to date

- TypeScript typecheck: PASS.
- Full ESLint: PASS.
- Full latest-main test run: 238 test files and 1578 tests passed.
- Production build: PASS; 24 static pages generated and `/settings` included.
- Production dependency audit: 0 vulnerabilities.
- `npm run agents:check`: PASS.
- `/opt/homebrew/bin/python3.12 tools/ai_company.py validate`: 11 checks, 0 warnings, 0 errors.
- Six migrations applied in order to an isolated PostgreSQL 17 database; lifecycle PL/pgSQL `plpgsql_check`: zero findings.
- Isolated rollback-only `service_role` transaction: rename -> closing -> restore, final revision 4, three challenges consumed, non-owner remains inactive after restore.
- Isolated baseline catalog: export 37 tables / purge 35 tables. Applied production schema dynamically expands to export 39 / purge 37; non-UUID `store_id` tables and unhandled public RESTRICT/NO ACTION child tables are zero.
- Browser verification at 390x844: lifecycle action card rendered, Chinese close reason selectable, exact name/UUID/TOTP confirmations visible, no horizontal overflow.
- Disposable database and test script removed after proof.

## Visual evidence

- `screenshots/store-lifecycle-preflight-mobile.png`
- `screenshots/order-data-access-reason-card-mobile.png`
- `screenshots/store-lifecycle-actions-mobile.png`

## Release gate evidence

- Release candidate is isolated from the dirty root checkout on latest `origin/main` and contains only the lifecycle implementation/task evidence.
- Mutation and lifecycle enforcement feature flags remain exact-string opt-in and are off by default.
- No browser purge route/button exists. Destructive RPCs require `service_role`, due approved job, lease, verified export/restore proof, released holds and separate exact flags.

## Production state before code push

- Linked project `xluzcoduqsdvjoouqhkc` applied exactly the six dry-run-reviewed lifecycle migrations on 2026-07-18.
- Post-apply: 7 stores / 7 active lifecycle rows / 0 missing; 0 lifecycle tables without RLS; 0 browser table or function grants; 26 lifecycle functions; 1 initialization trigger; 0 export/purge jobs; linked public-schema error lint PASS.
- No feature flag, rename, close, restore, export, purge or direct deploy action occurred. Code commit/push is the remaining release step.
