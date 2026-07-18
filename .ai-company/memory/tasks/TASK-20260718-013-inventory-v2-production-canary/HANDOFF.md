# Handoff / Resume — TASK-20260718-013-inventory-v2-production-canary

## Current handoff

- **Status:** complete; Chinatech Inventory V2 one-store production canary is active and V1 remains enabled.
- **Last verified:** 2026-07-18T21:48:47Z
- **Workspace/branch:** `/private/tmp/repairdesk-inventory-v2-production-canary-20260718`; `codex/inventory-v2-production-canary-20260718`; production code SHA `d6b9eaca` and deployment `dpl_3ktYrDKMYJ86G9rju3DjU4YTEKpW` are READY.
- **Latest gate:** linked history up to date; production reconcile healthy; rollback-only command canary zero residual; desktop/mobile screenshots captured; immediate runtime observation clean.
- **First action:** routine monitoring only. Do not expand beyond Chinatech without a new Owner decision.
- **Stop conditions:** if a V2 error appears, set `INVENTORY_V2_UI=0` and `INVENTORY_V2_COMMANDS=0` first, redeploy, keep V1 enabled and retain V2 evidence. Do not delete data or run a down migration.
