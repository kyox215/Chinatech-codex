# Handoff / Resume — TASK-20260718-013-inventory-v2-production-canary

## Current handoff

- **Status:** recovery and pre-production migration gates passed; production migration/flags unchanged because an earlier unapproved AI cost migration blocks exact V2-only apply.
- **Last verified:** 2026-07-18T20:12:08Z
- **Workspace/branch:** `/private/tmp/repairdesk-inventory-v2-production-canary-20260718`; `codex/inventory-v2-production-canary-20260718`; rebased migration commit `a20366d0` on `origin/main@ca271119`.
- **First action:** fast-forward push the default-off migration fixes/evidence to `main` and verify the exact deployment SHA. Do not apply production DB until Owner separately decides whether `20260718174042_ai_assistant_cost_governance_v1.sql` may be applied first.
- **Stop conditions:** do not apply production migration if rebase, dry-run, recovery, RLS/grant or build evidence changes; do not open flags before exact migration history and post-apply checks pass.
