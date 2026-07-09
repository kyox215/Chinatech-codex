---
task_id: TASK-20260709-011-private-store-suppliers
updated_at: 2026-07-09T11:05:00Z
---

## Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run test -- src/server/permissions.test.ts src/server/api/repairdesk-schemas.test.ts src/features/suppliers/testing/mock-api.test.ts src/features/orders/testing/mock-api.test.ts` passed: 4 files, 72 tests.
- `npm run test` passed: 95 files, 630 tests.
- `npm run build` passed outside sandbox after sandbox build failed on Turbopack local port binding.
- `git diff --check` passed.

## Migration Preflight

- `supabase db push --linked --dry-run` could not run in this isolated worktree because Supabase CLI reported `Cannot find project ref. Have you run supabase link?`
- No production migration was applied.

## Visual Evidence

- `screenshots/private-suppliers-settings-with-supplier-desktop.png`: desktop Settings supplier card group and supplier card.
- `screenshots/private-suppliers-settings-mobile.png`: mobile Settings supplier card group and supplier card.
- Order list/detail screenshots were blocked by local request-origin protection returning `请求来源无效，请刷新页面后重试`; order supplier selection is covered by typecheck, full test suite, and source diff.
