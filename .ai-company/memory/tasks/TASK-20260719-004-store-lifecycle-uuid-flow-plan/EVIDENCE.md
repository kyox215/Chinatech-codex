# Evidence — TASK-20260719-004-store-lifecycle-uuid-flow-plan

## Production UI read-only evidence

- URL: `https://www.chinatech.in/settings?section=store`
- Selected store: `ChinaTech`
- Full UUID from selected option value: `5248dda1-2b32-46cd-8ed0-d15386a9e8ed`
- Confirmation suffix: `86a9e8ed`
- Screenshot: `screenshots/TASK-20260719-004-store-lifecycle-uuid-flow-plan/current-store-lifecycle-before.png`
- No preflight, TOTP, rename, close or production mutation was performed.

## Code evidence map

- UUID membership/cookie/context: `src/server/auth-context.ts`, `src/features/stores/server/store.repository.ts`.
- Client context/API/types: `src/lib/repairdesk/api.ts`, `src/lib/repairdesk/types.ts`.
- Settings UI: `src/features/settings/screens/settings-screen.tsx`, `src/features/settings/sections/store-settings-section.tsx`, `src/features/settings/sections/store-lifecycle-actions.tsx`.
- Lifecycle repository/flags/errors: `src/features/stores/server/store-lifecycle.repository.ts`, `store-lifecycle-feature-flags.ts`, `store-lifecycle-errors.ts`.
- Router gates: `src/server/api/repairdesk-router.ts`.
- SQL authority: `supabase/migrations/20260717195346*` through `20260717201730*` lifecycle migrations.
- Runbooks: `docs/STORE_LIFECYCLE_DELETE_RENAME_PLAN.md`, `docs/STORE_LIFECYCLE_IMPLEMENTATION_RUNBOOK.md`.

## Independent reviews

- ARCH/DATA read-only review: 7 focused test files / 60 tests reported passed.
- FLOW/UX read-only review: full component hierarchy, state table, role matrix and Given/When/Then criteria.
- SECURITY/QA read-only review: 10 focused test files / 67 tests reported passed; current implementation/production lifecycle release FAIL/NO-GO.
- FLOW/UX second review: recommended one visible task/action at a time, a three-step close flow, separate rename entry, plain-language copy and progressive disclosure.
- SECURITY/QA second review: approved removing redundant manual store-name typing while retaining suffix confirmation, consequence acknowledgment, authenticator code and full server-side controls.
- Implementation validation on the isolated branch:
  - lifecycle/router targeted suite: 37/37 after operation-reconciliation hardening.
  - production-schema clone pgTAP: 26/26.
  - Playwright store lifecycle E2E: 1/1.
  - ESLint: pass.
  - TypeScript: pass.
  - Next.js production build: pass; `/settings/closed-stores` generated.
  - Final full Vitest on latest `origin/main`: 2095/2095 with a 10-second per-test ceiling.
  - Default 5-second suite ceiling exposes one pre-existing resource-sensitive order-option-picker timeout; its exact file passes 5/5 under the default ceiling. No unrelated test code was changed.

## Implementation visual evidence

- Desktop blocked state: `screenshots/TASK-20260719-004-store-lifecycle-uuid-flow-plan/store-lifecycle-beginner-desktop-blocked.png`.
- Desktop final confirmation: `screenshots/TASK-20260719-004-store-lifecycle-uuid-flow-plan/store-lifecycle-desktop-final-confirmation.png`.
- Mobile blocked viewport: `screenshots/TASK-20260719-004-store-lifecycle-uuid-flow-plan/store-lifecycle-beginner-mobile-blocked-viewport.png`.
- Mobile final confirmation: `screenshots/TASK-20260719-004-store-lifecycle-uuid-flow-plan/store-lifecycle-mobile-final-confirmation.png`.
- Verified viewport widths 390, 768 and 1280 without horizontal overflow.

## Production release baseline

- Supabase project ref: `xluzcoduqsdvjoouqhkc`; status `ACTIVE_HEALTHY`; organization plan `pro`.
- Linked migrations match through `20260718223739`; only `20260720013000_store_lifecycle_business_fence_and_close_recheck.sql` is pending.
- Production lifecycle aggregate: seven active stores; no real close/restore action was performed.
- Vercel target: `kyox120-9295s-projects/chinatech-codex` / `https://www.chinatech.in`.
- `STORE_LIFECYCLE_ENFORCEMENT_ENABLED`, `STORE_LIFECYCLE_MUTATIONS_ENABLED`, export worker, purge worker and purge scheduling variables are absent in Production, therefore off.
- Final latest-main gates: lint pass, typecheck pass, production build pass, Playwright 1/1 pass, clean worktree/diff check pending immediately before push.

## Production release result

- GitHub PR: `https://github.com/kyox215/Chinatech-codex/pull/1`; merged commit `471a2b45df6c0664b29ceea786cedb659ffcd624`.
- Supabase migration `20260720013000` is recorded remotely; contract version 2.
- Writer fence coverage: 57 expected / 57 installed / 0 missing.
- Close RPC privileges: anon false, authenticated false, service_role true.
- Production state after migration: 0 non-active stores.
- Current Vercel production deployment: `dpl_9HagYhzCkwCeGE4rf1UEjHypTjm5`, Ready, custom aliases `https://www.chinatech.in` and `https://chinatech.in`.
- Final staged flag state: enforcement on; mutation/export/purge flags off.
- Production HTTP smoke: Store settings and closed-store routes both return expected unauthenticated 307 redirects, with no 5xx.
- No production lifecycle mutation was used as a smoke test.

## Git/workspace

- `git fetch --prune` succeeded before planning.
- Local checkout is dirty and diverged; implementation must use isolated latest `origin/main` and scoped integration.
