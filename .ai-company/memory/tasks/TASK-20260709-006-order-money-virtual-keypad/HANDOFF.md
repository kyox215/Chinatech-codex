# Handoff

## Current State

Implementation and validation are complete. The remaining work is scoped staging, commit, and push to `origin/main`.

## Files To Stage

- `.ai-company/memory/tasks/TASK-20260709-006-order-money-virtual-keypad/`
- `src/components/orders/money-keypad-input.tsx`
- `src/components/orders/money-keypad-input.test.tsx`
- `src/shared/lib/mobile-input.ts`
- `src/shared/lib/mobile-input.test.ts`
- `src/features/orders/forms/new-order-quotation-section.tsx`
- `src/features/orders/forms/edit-order-dialog.tsx`
- `src/features/orders/forms/payment-dialog.tsx`
- `src/features/orders/components/order-overview-tab.tsx`
- `src/features/orders/screens/order-detail-screen.tsx`
- `tests/e2e/mobile-input-keyboard.spec.ts`
- `screenshots/TASK-20260709-006-order-money-virtual-keypad/`

## Do Not Stage

- Unrelated worktree changes outside this task.
- Generated `.next/` content.

## Final Checks Before Push

- `git diff --check`
- `git status --short`
- Confirm `next-env.d.ts` is not staged from build/dev generation.
