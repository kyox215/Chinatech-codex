# TASK-20260707-002-order-detail-dialog-width

## Summary
- Date: 2026-07-07
- Owner request: desktop order detail dialog is too small; plan and execute a responsive widening pass.
- Scope: local UI/test changes for `/orders` order detail dialog and E2E/mock preview support.
- Risk: R1/L2, reversible UI and test-environment changes only.

## Decisions
- Use the existing `detailWorkspace` surface as the single width source instead of adding a one-off order detail style.
- Keep the mobile detail page unchanged.
- Keep dirty realtime/offline and governance worktree changes untouched.
- Do not push, stage, or commit during this turn.

## Files Changed
- `src/lib/ui-patterns.ts`
- `src/lib/component-patterns.ts`
- `src/features/orders/screens/order-list-screen.tsx`
- `src/server/api/repairdesk-router.ts`
- `tests/e2e/order-desktop-ui-audit.spec.ts`

## No-Spawn Reason
Single-agent implementation was used because the task was a narrow R1/L2 UI sizing change with a small file set. No sub-agent writes were needed; QA was run by the main thread.
