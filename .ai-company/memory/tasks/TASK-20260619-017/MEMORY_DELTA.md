# Memory Delta — TASK-20260619-017

## Candidate project facts

- `TASK-20260619-017` is the authority for task-status registry hygiene after L2-012.
- L2-013 inventoried 19 pre-existing standard `TASK.md` records and 20 current standard records including itself.
- Five historical records were normalized from legacy `complete` to `closed` with `closed_at`.
- After normalization, no standard task frontmatter should use `status: "complete"`.
- One `conditional` task (`TASK-20260619-005`) and one `on_hold` task (`TASK-20260619-202308-repairdesk-order-detail-and-cross-page-ui`) remain intentionally.
- Legacy `TASK_MEMORY.md` records are outside this standard status normalization and should be migrated only under a separate task if needed.

## Candidate department updates

- Memory department should treat `closed`, `conditional`, and `on_hold` as current task-status vocabulary.
- Avoid reintroducing `complete` as a closeout frontmatter status in new task records.
- Future "continue" requests should start from `ACTIVE_CONTEXT.md`; if idle, use latest closed task and owner instruction, not stale summaries.

## Candidate decisions / ADRs

- Decision: historical `complete` task records can be metadata-normalized to `closed` only when their own acceptance/checkpoint evidence supports completion.
- Decision: conditional/on-hold records are not registry dirt; they are preserved exceptions with explicit next actions.

## Candidate lessons and capability evidence

- Governance memory hygiene can be handled at R1/L2 when scoped to `.ai-company/memory/*`, no business code, no deletion, and no production operations.
- Older task directories may lack structured `EVIDENCE.md` entries; do not backfill unsupported evidence, instead cite existing checkpoints and reports.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
