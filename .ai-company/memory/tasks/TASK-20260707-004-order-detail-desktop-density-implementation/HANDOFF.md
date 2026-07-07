# Handoff

## Resume First Steps

1. Read `docs/ORDER_DETAIL_DESKTOP_DENSITY_UI_PLAN.md`.
2. Inspect current diffs for owned files before editing or staging.
3. Open `screenshots/TASK-20260707-004-order-detail-desktop-density-implementation/order-detail-dialog-1536.png` to confirm the final desktop visual state.
4. If rerunning browser checks, prefer `PLAYWRIGHT_BASE_URL=http://localhost:<port>` with `REPAIRDESK_E2E_BUSINESS_DESKTOP=1` and `next dev`; `next start` currently hits production-runtime Supabase browser auth/source-mode protection before layout assertions.
5. Do not stage unrelated dirty worktree files unless the Owner explicitly expands scope.
