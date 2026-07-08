# Memory Delta — TASK-20260619-010

## Candidate project facts

- 2026-06-19 L2-006 reviewed both Batch C duplicate salvage candidates without deleting or modifying them. Source: EVIDENCE E-004/E-009; status: review fact; owner: Integration Lead; review trigger: Batch C cleanup task.
- `scripts/check-agent-rules 2.mjs` is a delete-only candidate after review: current canonical agent checks already use modular config/template checkers and the duplicate includes an obsolete deprecated-file assertion. Source: EVIDENCE E-005; status: recommendation; owner: DOC + QA; review trigger: next duplicate cleanup.
- `tests/e2e/visual-overflow.spec 2.ts` is a salvage-first backlog candidate: it suggests an attachment-inventory dialog stability check, but current source search did not find the `附件库存` UI entry point, so direct merge is not appropriate. Source: EVIDENCE E-006/E-007; status: recommendation; owner: QA + UX; review trigger: E2E expansion or attachment-inventory UI work.

## Candidate department updates

- Operations: Batch C is now classified as one delete-only file and one salvage-first backlog/test idea; do not bulk delete without preserving the decision record.
- QA: attachment-inventory overflow scenario should only become canonical if the UI route/entry point exists and the test is intentionally implemented.
- Documentation: old standalone checker duplicate should not override modular agent check architecture.
- Memory: active context drift was observed; closed/unrelated active context records should be reviewed separately before resuming work.

## Candidate decisions / ADRs

- Decision: no Batch C file was deleted or merged in L2-006. Follow-up cleanup must use a new explicit approval/path list.

## Candidate lessons and capability evidence

- Lesson candidate: backlog/salvage duplicates should produce a decision report first, then either a real task or a delete-only cleanup; do not paste duplicate content into canonical files.
- Capability evidence: Integration Lead performed a bounded review, separated useful future test ideas from stale duplicate files, and preserved evidence before cleanup.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
