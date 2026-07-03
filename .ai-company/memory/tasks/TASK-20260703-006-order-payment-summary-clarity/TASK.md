---
updated_at: "2026-07-03T18:53:47Z"
---
# TASK-20260703-006-order-payment-summary-clarity

## Objective

Make the mobile order detail payment summary unambiguous by showing exactly three rows: total amount, paid deposit, and outstanding balance.

## Scope

- Change `src/features/orders/screens/order-detail-screen.tsx`.
- Remove the separate `已付金额` row from the mobile payment summary.
- Remove the `已付押金` status badge from beside the balance.
- Keep unrelated existing `order-detail-screen.tsx` WIP, including request signal and workflow-grid changes, unstaged and outside this task.

## Acceptance

- Payment information displays `总金额`, `已付押金`, and `待收尾款`.
- The outstanding balance is not visually paired with a paid-status label.
- TypeScript and focused ESLint pass.
