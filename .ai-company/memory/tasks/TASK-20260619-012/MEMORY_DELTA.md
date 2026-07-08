# Memory Delta — TASK-20260619-012

## Candidate project facts

- 2026-06-19 L2-008 removed 70 current byte-identical ` 2` duplicate files after fresh SHA-256 verification. Source: EVIDENCE E-003/E-005/E-006; status: active cleanup fact; owner: Operations + QA; review trigger: duplicate cleanup or broad code search.
- Current Git-visible untracked ` 2` file scan now has zero byte-identical duplicates and three now-different duplicates: `.ai-company/README 2.md`, `src/features/orders/components/warranty-picker 2.tsx`, and `src/server/tenant-guard.test 2.ts`. Source: EVIDENCE E-009; status: active residual risk; owner: QA + relevant domain reviewers.

## Candidate department updates

- Operations: byte-identical file cleanup completed; remaining duplicate cleanup should target either the three now-different files or empty duplicate directories.
- QA: `npm run agents:check` passed after cleanup; no full app tests were required because only untracked duplicate files were deleted.
- Data: byte-identical duplicate migration files were removed as shadow copies only; canonical migration files and production state were untouched.
- Documentation: duplicate docs shadow copies removed; canonical docs remain.

## Candidate decisions / ADRs

- Decision: do not delete now-different duplicates without a review package, even if they were historically byte-identical.

## Candidate lessons and capability evidence

- Lesson candidate: re-run equality checks immediately before cleanup; stale inventories can overstate safe deletion counts.
- Capability evidence: Integration Lead performed fresh hash verification, path-scoped deletion, and post-cleanup verification under L2.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
