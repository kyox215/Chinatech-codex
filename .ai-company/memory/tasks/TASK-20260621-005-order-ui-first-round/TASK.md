# TASK-20260621-005 - Order UI First-Round Optimization

## Goal

Implement the approved first-round order UI plan while preserving protected mobile order surfaces.

## Scope

- Improve new-order intake density on `/orders/new`.
- Improve desktop order queue scanning and quick action access on `/orders`.
- Compact order payment, WhatsApp notification, approval request, and cancellation dialogs.
- Preserve mobile order detail, mobile order information, mobile order task/work-order flow, and mobile order management list behavior.

## Files Touched

- `src/features/orders/forms/new-order-quotation-section.tsx`
- `src/features/orders/components/order-list-desktop-row.tsx`
- `src/features/orders/components/order-list-filters.tsx`
- `src/features/orders/forms/payment-dialog.tsx`
- `src/features/orders/forms/notify-dialog.tsx`
- `src/features/orders/forms/approval-request-dialog.tsx`
- `src/features/orders/forms/cancel-dialog.tsx`

## Outcome

- New-order quote section now shows a compact `总额 / 定金 / 尾款` summary.
- Desktop order queue rows expose a direct `推进` button for safe no-reason next actions.
- Desktop flow filters use a shorter header, smaller stage cards, and tighter sub-tabs.
- Payment, notification, approval, and cancel dialogs use fixed header/footer shells with compact scrollable bodies.
- Existing notification behavior remains `wa.me` open-and-record; no auto-send integration was added.
