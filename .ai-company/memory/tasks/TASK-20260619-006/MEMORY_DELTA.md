# Memory Delta — TASK-20260619-006

## Candidate project facts

- `TASK-20260619-006` removed the 18 explicit Batch A duplicate files from `TASK-20260619-005` rows #1-7, #9-16, and #26-28. The earlier "20" count was an arithmetic error. Source: `CLEANUP_REPORT.md`; status: verified by `git status --short -- <18 paths>` returning no rows after deletion.
- `scripts/agents/check-agent-config.mjs` no longer requires deleted `AI智能部门管理/部门化管理设计 2.md`; the old assertion blocked `npm run agents:check` after cleanup. Source: EVIDENCE E-007/E-008; status: active governance checker sync.

## Candidate department updates

- OPS/QA/DOC: Batch A cleanup completed; Batch B/C remain protected. Future duplicate cleanup must reference explicit row/file lists instead of summary counts.

## Candidate decisions / ADRs

- Decision: explicit reviewed paths are authoritative when a summary count conflicts with the file-level table.

## Candidate lessons and capability evidence

- Lesson candidate: cleanup tasks should verify arithmetic totals against explicit file lists before deletion.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
