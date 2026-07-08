# Handoff / Resume — TASK-20260620-002

## Current handoff

- **Status:** closed.
- **Last verified:** 2026-06-19T22:42:42Z
- **Workspace/branch:** dirty worktree; do not revert unrelated changes and do not stage.
- **Key findings:** six legacy `src/routes/*` files remain; active source outside `src/routes` has no `@/routes` or direct `src/routes` imports; current App Router pages under `src/app/*` import feature screens directly.
- **Decision boundary:** do not delete files under this task. Deletion needs Owner approval and a separate cleanup task.
- **Validation:** active source legacy route scan returned no matches; `npm run agents:check` passed.
- **First action after resume:** ask Owner for explicit approval before deleting any `src/routes/*` file. If approved, create a separate cleanup task and run post-deletion gates. Do not reopen this classification task for deletion.
