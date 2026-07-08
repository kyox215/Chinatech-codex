# Memory Delta — TASK-20260619-016

## Candidate project facts

- 2026-06-19 L2-012 resolved the active-context drift by marking `TASK-20260619-202308-repairdesk-order-detail-and-cross-page-ui` as `on_hold` instead of letting it remain the automatic resume target. Source: `ACTIVE_CONTEXT_DRIFT_HYGIENE_REPORT.md`; status: active memory hygiene fact; owner: Memory + Integration Lead.

## Candidate department updates

- Memory: old UI audit task is preserved for explicit resume, but should not be auto-resumed by generic "continue" commands.
- QA: old UI task is not closed; it needs separate acceptance verification before completion.
- Integration: after `TASK-20260619-016` closes, `ACTIVE_CONTEXT.md` should be idle.

## Candidate decisions / ADRs

- Decision: use `on_hold` for unrelated active task records that have useful checkpoints but should not own the current automatic resume path.

## Candidate lessons and capability evidence

- Lesson candidate: parallel cleanup tasks should explicitly manage `ACTIVE_CONTEXT.md`; closing a non-active task does not clear unrelated active context.
- Capability evidence: Integration Lead inspected tool behavior, preserved a resumable handoff, and avoided overclaiming old UI task completion.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
