# Handoff / Resume — TASK-20260719-004-store-lifecycle-uuid-flow-plan

## Current handoff

- **Status:** implementation complete; release validation and application in progress.
- **Canonical plan:** `docs/STORE_LIFECYCLE_SETTINGS_FLOW_PLAN.md`.
- **Current worktree:** `/private/tmp/repairdesk-store-lifecycle-20260720`, branch `codex/store-lifecycle-beginner-flow-20260720`.
- **Next action:** commit scoped changes, rebase current `origin/main`, rerun full gates, push, apply the sole linked migration with flags off, deploy, then run post-apply read-only verification.
- **Do not:** run a real store close/restore, enable mutation/export/purge flags, or execute purge. Those remain outside this task's release boundary.
- **Workspace caution:** current checkout contains unrelated dirty work and diverges from origin; preserve it.
