# Memory Delta — TASK-20260619-013

## Candidate project facts

- 2026-06-19 L2-009 reviewed the three remaining now-different duplicate files and classified all three as delete-only candidates for a later explicit cleanup task. Source: `REMAINING_DIFFERING_DUPLICATES_REVIEW.md`; status: active cleanup decision package; owner: Operations + QA + Documentation; review trigger: before deleting any of the three files.

## Candidate department updates

- Operations: remaining duplicate cleanup can proceed as a narrow L2-010 delete-only task for the three reviewed paths.
- QA: `warranty-picker 2.tsx` and `tenant-guard.test 2.ts` are older than canonical files and should not be merged; targeted tests are optional for the future deletion task.
- Documentation: `.ai-company/README 2.md` is a generic v2 package README shadow; canonical `.ai-company/README.md` remains the RepairDesk v3 authority.

## Candidate decisions / ADRs

- Decision: do not merge any of the three remaining now-different duplicate files into canonical files; preserve this review as evidence for a later path-scoped delete task.

## Candidate lessons and capability evidence

- Lesson candidate: now-different duplicates can still be delete-only if canonical files demonstrably contain newer project-specific behavior and the duplicate content is stale or separately preserved.
- Capability evidence: Integration Lead performed path-scoped diff review, usage/reference search, and cleanup classification without deleting files.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
