# Handoff — TASK-20260710-011-account-password-reset-mobile-actions

## Current state

- Local package is complete on `codex/account-password-reset-closeout-20260716`, based on `origin/main@6717932e`.
- Code change is limited to `src/features/account/screens/account-center-screen.tsx` plus its direct component test.
- Task-local memory is under `.ai-company/memory/tasks/TASK-20260710-011-account-password-reset-mobile-actions/`.
- Final screenshots are the synthetic 390/430 JPEG files under the task screenshot directory; legacy screenshots are excluded.
- No push, deploy, database operation, or real reset email has occurred.

## First action on resume

1. Verify the local package commit and branch are unchanged.
2. Merge/cherry-pick it only through TASK-20260716-004's final integration branch.
3. Re-run the final integration gate before any owner-approved push.

## Stop conditions

- Do not push or deploy until the parent worktree-delivery release gate is approved.
- Do not apply linked database changes for this task; no DB migration belongs to this slice.
- Do not click the reset button in production merely to create evidence; actual email delivery needs separate owner intent.

## Validation already completed

- `npm run lint`
- `npm run typecheck`
- Targeted 3 files / 13 tests
- Full test suite: 139 files / 951 tests
- `npm run build -- --webpack`
- 390/430 synthetic screenshots using `qa@example.test`
