# Memory Delta — TASK-20260619-009

## Candidate project facts

- 2026-06-19 L2-005 removed the 12 Batch B order workflow/migration duplicate ` 2` files confirmed stale in `TASK-20260619-008`. Source: EVIDENCE E-006/E-007; status: active cleanup fact; owner: Integration Lead; review trigger: duplicate cleanup or order workflow/migration review.
- Batch C protected files `scripts/check-agent-rules 2.mjs` and `tests/e2e/visual-overflow.spec 2.ts` remain intentionally untouched. Source: EVIDENCE E-008; status: active boundary; owner: Operations + QA; review trigger: Batch C decision task.
- Targeted order workflow regression gate after Batch B cleanup passed with 5 test files and 40 tests. Source: EVIDENCE E-010; status: verification evidence; owner: QA; review trigger: order workflow cleanup or behavior change.

## Candidate department updates

- Product: stale Batch B order workflow semantics are no longer present as local duplicate files after approval and cleanup.
- Data: stale duplicate migration files from Batch B are deleted; canonical migration history remains unchanged; production Supabase parity remains unknown.
- QA: cleanup verification requires both path-level deletion checks and targeted order workflow tests; this gate passed in `TASK-20260619-009`.
- Operations: staged duplicate cleanup has completed Batch A and Batch B; remaining cleanup requires a new explicit list and approval.
- Memory: earlier active task record `TASK-20260619-200747-repairdesk-project-health-check-and-fix-ca` remains separate and should not be confused with this closed cleanup task.

## Candidate decisions / ADRs

- Decision: Batch B duplicates are delete-only stale evidence; no content was merged into canonical code or historical migrations. Source: `TASK-20260619-008` and EVIDENCE E-006; status: applied decision.

## Candidate lessons and capability evidence

- Lesson candidate: for semantic-conflict duplicates, require domain confirmation first, then delete only the explicit approved path list and re-run the relevant targeted tests.
- Capability evidence: Integration Lead performed L2 scoped cleanup with path-level guardrails, no staging/commit/push, and proportional validation.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
