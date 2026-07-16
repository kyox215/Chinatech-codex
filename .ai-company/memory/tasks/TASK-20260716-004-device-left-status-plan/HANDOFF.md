# Handoff

## Current State

Planning is complete and waiting for the Owner to authorize implementation. No business code or database state has changed.

## Read First

1. `PLAN.md`
2. `EVIDENCE.md`
3. `TASK.md`
4. `.ai-company/memory/ACTIVE_CONTEXT.md`
5. `src/features/orders/model/new-order-form.ts`
6. `src/features/orders/screens/new-order-screen.tsx`
7. `src/features/orders/screens/order-detail-screen.tsx`
8. `src/features/orders/server/order.repository.ts`
9. `src/server/repairdesk-shared.ts`
10. `src/lib/repairdesk/types.ts`

## First Executable Action

After the Owner says `开始`:

1. Fetch and inspect the latest `origin/main` without overwriting user work.
2. Recheck active task memory and file ownership, especially order-data import/export and settings work.
3. Create an isolated task worktree.
4. Confirm the state and migration contract in WP-00.
5. Implement server/data tests before exposing the UI control.

## Stop Conditions

Pause before:

- Applying any production migration.
- Deploying or pushing unless explicitly authorized in the execution request.
- Broad historical backfill or deletion.
- Expanding role permissions beyond the existing `order:update_intake` policy.
- Editing files owned by another active writer.
- Handling production credentials or raw unlock secrets.

## Verification Required Before Closeout

- Focused model, schema, router, repository, offline, import/export, queue, and permission tests.
- `npm run agents:check`, lint, typecheck, full test, and build.
- Responsive E2E and screenshots at the planned mobile/tablet/desktop viewports.
- Migration dry-run and post-apply schema/constraint/null-preservation checks after separate approval.
- DATA, SEC, QA, documentation, memory, and release closeout.
