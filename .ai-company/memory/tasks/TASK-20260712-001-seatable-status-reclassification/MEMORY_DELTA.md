# Memory Delta — TASK-20260712-001-seatable-status-reclassification

## Candidate project facts

- SeaTable `STATO` strong values must be evaluated before free-text problem markers: FATTO -> completed; IN CORSO/INCORSO -> diagnosing; arrival states -> parts_arrived; repaired states -> repaired/notified; cancelled states -> cancelled. Source: mapper tests and production batch verification. Status: verified. Owner: Data/Integration. Review trigger: mapper or source vocabulary changes.
- The in-progress business group includes `parts_arrived`, `repaired`, and `notified`, but detailed workflow states remain visible. Source: owner decision and `src/lib/mock/enums.ts`. Status: verified. Owner: Product/Integration. Review trigger: business tab semantics change.

## Candidate department updates

- Data: production correction SOP requires deterministic IDs, source-row/file-hash binding, expected old tuple and timestamp, short locks, fresh minimized before-image, forced rollback before commit, independent post-check, and selective recovery rehearsal.

## Candidate decisions / ADRs

- Do not use the normal paid-completion transition for historical FATTO corrections; completion classification and payment status remain independent.

## Candidate lessons and capability evidence

- Exact 24-row production reclassification and both rollback paths passed without money, tenant, or related-activity drift. Aggregated receipt contains no customer PII.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
