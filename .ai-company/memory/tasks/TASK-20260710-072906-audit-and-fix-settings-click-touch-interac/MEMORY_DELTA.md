# Memory Delta — TASK-20260710-072906-audit-and-fix-settings-click-touch-interac

## Candidate project facts

- None yet.

## Candidate department updates

- None yet.

## Candidate decisions / ADRs

- None yet.

## Candidate lessons and capability evidence

- None yet.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
# Memory Delta — TASK-20260710-072906-audit-and-fix-settings-click-touch-interac

## Project memory candidates

- Settings workflow status rows should avoid one-line dense control layouts below `2xl`; at 1280px the previous grid caused checkbox/action hit targets to overlap the status code column.
- Add browser tests that check both semantic state changes and actual hit targets (`elementFromPoint`) when investigating "按不动" mobile/desktop UI reports.

## Not saved as long-term memory automatically

- Existing `business-desktop-overflow` currently fails on `/orders` with request-source invalid in this E2E run; treat this as a separate task unless it repeats in future RepairDesk order-flow work.
