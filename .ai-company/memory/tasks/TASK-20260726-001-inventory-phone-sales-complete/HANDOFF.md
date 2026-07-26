# Handoff / Resume — TASK-20260726-001-inventory-phone-sales-complete

## Current handoff

- **Status:** active; complete local implementation and gates verified, production migration/push blocked by Owner approval.
- **Last verified:** 2026-07-26T00:36:08Z
- **Workspace/branch:** `/private/tmp/repairdesk-inventory-phone-sales-20260726` / `codex/inventory-phone-sales-complete`.
- **First action:** obtain explicit Owner approval to apply the two 2026072600133x workflow migrations to production; after approval apply expand then enable, run advisors/SQL verification and responsive smoke, acquire integration lease, commit and push `main`.
- **Do not:** apply either production migration without approval; bypass the enable preflight; re-enable direct V2 listing through non-atomic V1 transitions; claim `main` was pushed before the migration/runtime smoke succeeds.
