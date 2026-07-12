# Memory Delta — TASK-20260712-005-order-custody-archive

## Candidate project facts

- Archive eligibility is one global invariant: terminal status, closed workflow, verified `delivered_at`, and exact paid evidence (`balance_amount=0`, `is_paid=true`, `payment_status=paid`). Source: implementation and E-007/E-008; status: validated; owner: API/DATA; review trigger: archive or payment model change.
- Notification is not delivery evidence. `到货已通知` and `修好已通知` stay active with `notify_status=sent` and `delivered_at=null`. Source: importer tests and production batch; status: validated; owner: DATA; review trigger: SeaTable import change.
- Active work is grouped into processing, handover, settlement and review, with review sorted after ordinary operational work. Source: queue classifier and browser evidence; status: validated; owner: PRODUCT/FE; review trigger: queue UX change.

## Candidate department updates

- DATA: production status repairs require a minimal before-image, forced rollback rehearsal, no-later-activity guard, exact store scope and independent post-check.
- SEC: technicians may inspect a single order but must not browse archive totals or bulk-export aggregate finance; exact-search and assignment boundaries remain regression gates.

## Candidate decisions / ADRs

- Do not add a custody schema for this release. Existing `delivered_at` plus structured handover events represent the approved cases; reconsider only when split custody or partial returns are required.
- Cancellation does not imply customer handover. A cancelled order remains review-visible until explicit device return is confirmed.

## Candidate lessons and capability evidence

- The production correction completed a patch rollback rehearsal, formal apply, selective restore rollback rehearsal and independent verification without cross-store or finance changes.
- Full local verification passed 121 files / 818 tests, production build, desktop/mobile browser checks and zero console errors.

## Consolidation result

- Promoted the archive invariant to `PROJECT_MEMORY.md` and synchronized Backend, Data, Frontend and Security department memory.
- No conflict record was needed; this task explicitly supersedes only the older archive predicate from `TASK-20260712-002-global-staff-permissions`.
- Capability review result: no C-level, permission or autonomy change. One high-risk production repair is evidence for the existing controlled process, not grounds for broader autonomous production authority; the QA retry produced no result and is not counted as capability evidence.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
