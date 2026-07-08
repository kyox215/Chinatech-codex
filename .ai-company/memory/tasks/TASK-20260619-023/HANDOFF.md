# Handoff / Resume — TASK-20260619-023

## Current handoff

- **Status:** closed; implementation contract complete.
- **Last verified:** 2026-06-19T21:50:48Z
- **Workspace/branch:** inspect before resuming; existing dirty worktree includes unrelated changes.
- **First action:** read `TASK.md`, `ORDER_LIST_MIGRATION_IMPLEMENTATION_CONTRACT.md`, `EVIDENCE.md`, and latest checkpoint.

## Resume notes

- Do not edit business code in this task.
- The next code task should remove the wrapper import in `src/features/orders/screens/order-list-screen.tsx` by extracting the legacy route into feature-owned files.
- Keep `CONFLICT-20260619-004` open until implementation removes all active-source `@/routes` imports.
- Do not delete `src/routes/*` until a separate cleanup task verifies zero live imports and full code gates.
