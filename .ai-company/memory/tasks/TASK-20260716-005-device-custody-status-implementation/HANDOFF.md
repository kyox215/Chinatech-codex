# Handoff / Resume — TASK-20260716-005-device-custody-status-implementation

## Current handoff

- **Status:** conditional release ready; waiting for Owner D3 production approval.
- **Last verified:** 2026-07-16T21:58:17Z.
- **Workspace/branch:** `codex/device-custody-status-20260716`, based on `origin/main@184672fe`; inspect current commit/status before resuming.
- **Completed:** implementation, rebase, independent review, full local gates, Chromium E2E and mock visual evidence.
- **Release blocker:** production Supabase lacks `device_custody_status`; pushing main auto-deploys Vercel. Do not push application first.
- **First action:** fetch latest origin; if unchanged and Owner explicitly approves, run linked migration dry-run, review exact plan, apply only `20260716183000_order_device_custody_status.sql`, verify column/default/constraint/RPC/grants and legacy NULL behavior, then fast-forward/push main and verify production.
- **Rollback:** revert application deployment first while retaining the nullable column; use forward-fix migration for DB issues; never drop/backfill automatically.
- **Residual:** WhatsApp message/order/event and kiosk cross-table acceptance are guarded but not single-transaction workflows; offline create remains disabled and fail closed pending a separate migration.
