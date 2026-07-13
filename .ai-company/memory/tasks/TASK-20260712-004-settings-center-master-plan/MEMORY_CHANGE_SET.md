# WP-08 Memory Change Set

Date: 2026-07-13 CEST
Source: `TASK-20260712-004-settings-center-master-plan`

## Promoted durable facts

- Settings Center has nine capability-projected sections with store-scoped query/draft/transient
  boundaries; local availability is not production approval.
- High-risk Kiosk and order-data paths use exact default-off flags; member and workflow writes still
  lack independent production kill switches.
- Settings-related migrations are ordered order-data → member grants → Kiosk expand. Generic linked
  migration apply can sweep unreviewed earlier files and must stop on a non-exact dry-run.
- A Settings release must be split into independent units and integrated from current `origin/main` in a
  clean worktree. After the WP08 package, the branch is 12 ahead / 8 behind with 24 overlaps.
- UI closeout requires synthetic, clean visual evidence and the exact interaction E2E command; rewritten
  historical screenshots are task-owned only when intentionally reviewed and committed.

## Not promoted as fact

- No production readiness, linked schema parity, live flag value, successful migration, deploy, runtime
  SLO, backup/restore proof, or Owner risk acceptance.
- No claim that Kiosk canvas evidence is an advanced/qualified electronic signature.
- No claim that order-data preview expiry equals PII deletion or that import rollback is automatic.

## Targets

- Project memory and index.
- Frontend, Backend, Data, Security, QA, Operations, and Documentation department memories.
- Capability registry as a C2 candidate only.
