# Handoff / Resume — TASK-20260718-001-new-order-layout-stability

## Current handoff

- **Status:** implementation and local QA complete; production release waiting on a serialized concurrent migration owner.
- **Last verified:** 2026-07-17T22:53:31Z.
- **Workspace/branch:** `/private/tmp/repairdesk-new-order-layout-20260718`, `codex/new-order-layout-stability-20260718`, uncommitted task diff on `origin/main@1f643313`.
- **Completed:** compact report/overlay, stable quote workspace, safe active quote resolver, paused local draft/outbox boundary, unit/full tests, Webpack build, six-viewport E2E/screenshots, docs and independent reviews.
- **Hard blocker:** linked production has employee-invite migrations `20260717220219`, `20260717223030`, `20260717223222`, `20260717223354`, but GitHub `main` is still `1f643313` and does not contain them. Their active worktree is `/private/tmp/repairdesk-employee-invite-registration-20260717`; do not modify or copy its uncommitted files.
- **First action:** `git fetch --prune origin` and linked `migration list`. Continue only when latest `origin/main` contains all four versions; rebase this branch, resolve only in-scope conflicts, then rerun lint/typecheck/full test/Webpack build/E2E as affected.
- **Release sequence:** linked `db push --dry-run` must be up to date; explicit scoped stage; commit; fetch/assert; non-force `HEAD:main`; exact remote SHA and Vercel READY/smoke; post-push linked list/no-op; final `$memory-checkpoint` and task closeout.
