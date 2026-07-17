# Handoff

## Current state

Implementation and all local release gates are complete in the isolated worktree. Independent read-only re-audit returned GO. Linked Supabase is current and this task has no pending migration.

## First resume action

1. Re-fetch `origin/main` and stop if it differs from the recorded pre-release head without clean integration.
2. Verify `git diff --check`, no `next-env.d.ts` generation diff, and an empty migration diff.
3. Commit the scoped implementation/evidence, integrate current `origin/main`, push `HEAD:main`, then verify the remote SHA and production-visible routes.

## Stop conditions

- Any new remote Git commit that conflicts with the order, navigation, customer, dashboard or buyback files in this task.
- Any linked Supabase pending migration or migration-history mismatch.
- Any failed build, full test, desktop E2E, permission/custody regression, or independent review blocker.
