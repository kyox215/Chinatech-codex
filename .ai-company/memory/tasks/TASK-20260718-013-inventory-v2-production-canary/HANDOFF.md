# Handoff / Resume — TASK-20260718-013-inventory-v2-production-canary

## Current handoff

- **Status:** recovery and pre-production migration gates passed; production migration/flags unchanged because an earlier unapproved AI cost migration blocks exact V2-only apply.
- **Last verified:** 2026-07-18T21:11:23Z
- **Workspace/branch:** `/private/tmp/repairdesk-inventory-v2-production-canary-20260718`; `codex/inventory-v2-production-canary-20260718`; default-off hardening is on `origin/main@92d7cdad` and the Vercel production deployment is READY at the same SHA.
- **Latest gate:** full-data restore and exact four-migration chain pass; atomic sale now updates V2 unit/movement; store-scoped shadow reconciliation returns healthy and browser ACLs remain closed.
- **First action:** wait for Owner's independent D4 decision on whether `20260718174042_ai_assistant_cost_governance_v1.sql` may be applied first. If approved, refetch/requery and repeat all DB preflight before any apply; otherwise keep V2 dormant.
- **Stop conditions:** do not apply production migration if rebase, dry-run, recovery, RLS/grant or build evidence changes; do not open flags before exact migration history and post-apply checks pass.
