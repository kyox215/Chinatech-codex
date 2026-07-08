# Memory Delta — TASK-20260620-002

## Candidate project facts

- `TASK-20260620-002` classified all six remaining `src/routes/*` files as delete-ready after Owner approval. Active source outside `src/routes` has no `@/routes` or direct `src/routes` imports in the current scan.
- No legacy route files were deleted in this task. Deletion remains a separate L2 cleanup task with explicit approval and post-deletion code gates.
- `knip.json` still ignores `src/routes/**`; a deletion task should remove that ignore entry after the directory is gone.

## Candidate department updates

- Architecture: `CONFLICT-20260619-004` can move from "classification pending" to "deletion approval pending"; keep zero `@/routes` import rule.
- Frontend: do not reuse `src/routes/*`; live page bodies are feature screens under `src/features/*/screens`.
- QA: post-deletion task should run route scans, `agents:check`, lint, typecheck, tests, and build; rerun build outside sandbox if Turbopack port binding fails.
- Documentation: historical docs may mention old `src/routes` as snapshots; active docs should point to this classification before deletion.

## Candidate decisions / ADRs

- Decision proposed, not approved: delete all six legacy `src/routes/*` files in a separate cleanup task.

## Candidate lessons and capability evidence

- Classification-only cleanup prep is safe under L2 when it avoids destructive edits, records hashes, distinguishes docs/config references from runtime imports, and produces an explicit approval package.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
