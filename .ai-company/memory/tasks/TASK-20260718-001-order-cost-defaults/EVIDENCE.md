# Evidence — TASK-20260718-001-order-cost-defaults

## Baseline

- Owner request authorizes scoped implementation, `main` push and application of this task's reviewed changes.
- Isolated worktree: `/private/tmp/repairdesk-order-cost-clean-20260718`.
- Branch/base: `codex/order-cost-defaults-clean-20260718` rebased on `origin/main@002852f3`.
- Original dirty checkout preserved unchanged.

## Pending evidence

- Implementation diff and automated gates.
- Permission/data/security independent reviews.
- Desktop/mobile and authorized/unauthorized screenshots.
- Linked Supabase dry-run/apply and post-apply metadata proof.
- Git remote main, deployment READY and production smoke proof.

- `2026-07-17T22:31:47Z` `a308c1331e` — src/server/permissions.ts; src/entities/staff/model/store-permission-policy.ts; src/features/settings/model/member-settings-editor.ts; src/features/stores/server/store.repository.ts; npx vitest run ... => 4 passed/84 passed
- `2026-07-17T22:32:53Z` `9acabb1afe` — npm run typecheck => passed; npx vitest run src/server/permissions.test.ts src/entities/staff/model/store-permission-policy.test.ts src/features/settings/model/member-settings-editor.test.ts src/features/stores/server/store.repository.test.ts => 4 passed/84 passed; git diff --check scoped files => passed
- `2026-07-18` local production-schema clone — migration SQL applied with `ON_ERROR_STOP`; transaction behavior suite passed permissions, snapshots, null/zero, CAS, forged/cross-order IDs, legacy middle insertion, cost binding and idempotent replay; transaction rolled back.
- `2026-07-18` local metadata — both cost tables have RLS; browser roles have no table grants; six cost/quote RPCs are security definer; normalization and cost-sync triggers are installed.
