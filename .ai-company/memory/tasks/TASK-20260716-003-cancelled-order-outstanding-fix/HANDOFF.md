# Handoff

- Worktree: `/private/tmp/repairdesk-cancelled-outstanding-fix-20260716`
- Branch: `codex/cancelled-outstanding-fix-20260716`
- Baseline: `origin/main@6717932e316cbe5054709646ca7ea1087f517a49`
- Read first: `TASK.md`, `PLAN.md`, latest `CHECKPOINTS.md`, root `AGENTS.md`.
- Current state: implementation, visual acceptance, all gates, production migration and production post-check are complete.
- First action if interrupted before remote verification: inspect status/diff, confirm the release commit, fetch `origin/main`, rebase only if needed, push `HEAD:main`, and verify the remote SHA.
- Stop: any new upstream conflict, security, cross-tenant, test, migration-history or remote-SHA mismatch.
