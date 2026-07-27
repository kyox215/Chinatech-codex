# Handoff / Resume — TASK-20260727-004-mobile-catalog-picker-release

## Current handoff

- **Status:** closed; no implementation handoff remains.
- **Last verified:** 2026-07-27.
- **Release:** production deployment for commit `888569d350ea47d66d596a45bf7bf8dd1630aced` is `READY`.
- **Production route:** `https://www.chinatech.in/inventory/new` (authentication required).
- **Residual verification:** if a real device still opens its keyboard automatically or cannot scroll the list, record device model, OS/browser version and a short screen recording; do not reopen implementation without that evidence.
- **Rollback:** revert `888569d3` and redeploy the previous `main`; no schema/data rollback.
