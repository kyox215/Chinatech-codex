# Memory Delta — TASK-20260619-011

## Candidate project facts

- 2026-06-19 L2-007 created formal backlog entry `QA-BACKLOG-20260619-001` for attachment-inventory dialog overflow E2E coverage. Source: EVIDENCE E-006; status: active backlog fact; owner: QA + UX; review trigger: attachment-inventory UI work or E2E expansion.
- 2026-06-19 L2-007 deleted the two reviewed Batch C duplicate files: `scripts/check-agent-rules 2.mjs` and `tests/e2e/visual-overflow.spec 2.ts`. Source: EVIDENCE E-007/E-008; status: active cleanup fact; owner: Operations + QA; review trigger: duplicate cleanup or broad code search.
- Canonical files were not changed by L2-007; `scripts/agents/check-agent-config.mjs` had a pre-existing modification. Source: EVIDENCE E-005/E-009; status: boundary fact.

## Candidate department updates

- QA: attachment-inventory overflow E2E is now backlog `QA-BACKLOG-20260619-001`, not a duplicate-file dependency.
- Operations: Batch C duplicate cleanup completed; continue staged cleanup with explicit path lists for remaining duplicate-like files.
- Documentation: `BACKLOG.md` is the formal project backlog memory entry point.
- Memory: active context remains assigned to a separate UI audit task because this cleanup ran with `--allow-parallel`.

## Candidate decisions / ADRs

- Decision: delete Batch C duplicate files after preserving their only useful future-test idea in formal backlog.

## Candidate lessons and capability evidence

- Lesson candidate: before deleting salvage duplicates, extract the useful idea into `BACKLOG.md` with owner, trigger, and evidence.
- Capability evidence: Integration Lead performed a scoped cleanup with path-level verification, no canonical code edits, and governance validation.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
