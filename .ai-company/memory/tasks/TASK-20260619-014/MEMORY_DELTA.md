# Memory Delta — TASK-20260619-014

## Candidate project facts

- 2026-06-19 L2-010 deleted exactly the three remaining now-different duplicate files reviewed in L2-009: `.ai-company/README 2.md`, `src/features/orders/components/warranty-picker 2.tsx`, and `src/server/tenant-guard.test 2.ts`. Source: `REVIEWED_DUPLICATES_CLEANUP_REPORT.md`; status: active cleanup fact; owner: Operations + QA; review trigger: duplicate cleanup or broad search.
- Final Git-visible untracked ` 2` duplicate scan with canonical counterparts reports `same=0 diff=0 missing=0 nonfiles=0`. Source: EVIDENCE E-005; status: active cleanup fact; owner: QA + Operations.

## Candidate department updates

- Operations: the Git-visible untracked duplicate-file cleanup wave is complete; next hygiene targets are empty duplicate directories or ignored/generated duplicate-like output.
- QA: L2-010 cleanup used the L2-009 review package and final scan evidence; canonical file statuses remain pre-existing and should not be attributed to L2-010.
- Documentation: `.ai-company/README 2.md` was removed; canonical `.ai-company/README.md` remains the RepairDesk Codex Native v3 README.

## Candidate decisions / ADRs

- Decision: close the remaining reviewed duplicate-file cleanup as complete; do not reopen unless new Git-visible ` 2` duplicate files appear.

## Candidate lessons and capability evidence

- Lesson candidate: complete cleanup waves should distinguish files, empty directories, and ignored/generated output because each has different verification and risk.
- Capability evidence: Integration Lead converted review evidence into a path-scoped cleanup, used `apply_patch` deletion, reran scan evidence, and avoided canonical file changes.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
