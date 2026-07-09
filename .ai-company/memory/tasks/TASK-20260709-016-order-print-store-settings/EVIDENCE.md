# Evidence — TASK-20260709-016

| ID | Type | Evidence | Result | Timestamp |
|---|---|---|---|---|
| E-001 | baseline | `git worktree add -B codex/order-print-store-settings /private/tmp/repairdesk-order-print-settings origin/main` | Clean worktree created from latest `origin/main` | 2026-07-09T13:10:11Z |
| E-002 | database | `git diff --name-only -- supabase/migrations` in original checkout | No task-specific migration file created | 2026-07-09T13:10:11Z |
| E-003 | test | `npm run test -- --run src/features/print/model/store-print-profile.test.ts` | Passed: 1 file, 3 tests | 2026-07-09T13:23:07Z |
| E-004 | typecheck | `npm run typecheck` | Passed after installing dependencies in clean worktree | 2026-07-09T13:24:14Z |
| E-005 | test | `npm run test` | Passed: 98 files, 640 tests | 2026-07-09T13:24:14Z |
| E-006 | lint | `npm run lint` | Passed | 2026-07-09T13:24:14Z |
| E-007 | build | `npm run build` | Passed after sandbox-escalated rerun; first attempt failed on Turbopack port binding sandbox restriction | 2026-07-09T13:25:00Z |
| E-008 | database | `supabase db push --linked --dry-run` in original checkout | Failed safely before applying: remote migration versions `20260709125247` and `20260709234000` not found locally in that checkout; no migration was pushed | 2026-07-09T13:17:00Z |
| E-009 | database | `supabase migration list --linked` | Migration history remains divergent with many local-only entries and remote-only `20260709125247`, `20260709234000` | 2026-07-09T13:27:00Z |
| E-010 | database | `supabase db query --linked ... information_schema.columns ... store_settings ...` | Production has `store_name`, `store_address`, `store_phone`, `store_whatsapp`, `store_email`, `print_footer` as text columns | 2026-07-09T13:28:00Z |
| E-011 | visual | Playwright screenshot against `/orders` on local dev server | Browser reached `/login?next=%2Forders`; task page screenshot blocked by authentication. Screenshot saved in original checkout task folder as `orders-page.png` | 2026-07-09T13:17:00Z |
- `2026-07-09T13:28:17Z` `315be1d84f` — E-003..E-010
