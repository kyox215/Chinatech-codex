# Handoff / Resume — TASK-20260716-005-device-custody-status-implementation

## Current handoff

- **Status:** closed; production release verified.
- **Last verified:** 2026-07-17T00:14:00Z.
- **Release:** GitHub `main@452f89855e83aa4104bc2945e0ca087bbffca77c`; Supabase migration `20260716235650_order_device_custody_finance_reconcile`; Vercel `dpl_9ovqtzqJ9ZuAnNd852skDYFtC7Gv` READY on `www.chinatech.in`.
- **Completed:** implementation, latest-main rebase, three independent read-only reviews, full local/app/SQL gates, responsive E2E/screenshots, DB-first production migration, main push, exact-SHA deployment and anonymous/runtime smoke.
- **Recovery entry point:** read `CEO_REPORT.md`, `EVIDENCE.md` and the latest `CHECKPOINTS.md`; do not replay the superseded `20260716183000` or planned `20260717001000` versions.
- **Rollback:** revert application deployment first while retaining the nullable column; use forward-fix migration for DB issues; never drop/backfill automatically.
- **Residual:** WhatsApp message/order/event and kiosk cross-table acceptance are guarded but not single-transaction workflows; offline create remains disabled through a service-role-only `blocked_operation` stub pending a separate reviewed migration. The unrelated full-history reset/PITR risk remains open.
