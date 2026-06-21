# TASK-20260621-006-order-list-desktop-density

## Goal

Continue the order UI optimization after the first-round batch by improving desktop order queue information density without changing protected mobile order detail, mobile order information/list management, or mobile work-order/task pages.

## Scope

- Add a desktop-only queue health summary to `/orders`.
- Keep the existing desktop queue rows, filters, quick transitions, export, print, and detail dialog behavior.
- Do not edit protected mobile detail/task/header files in this batch.

## Changed Files

- `src/features/orders/screens/order-list-screen.tsx`
- `screenshots/figma-ui-system-20260620/orders-desktop-queue-health-strip.png`
- `screenshots/figma-ui-system-20260620/orders-mobile-list-safe-after-health-strip.png`

## Outcome

- Desktop `/orders` now shows a compact health strip between filters and the queue:
  - current queue and active filters
  - current-page quote total
  - unpaid and exception counts
  - directly advanceable order count
- The strip is hidden below the desktop breakpoint, so mobile order card rendering remains unchanged.

## Constraints

- `src/features/orders/screens/order-detail-screen.tsx` currently has pre-existing workspace modifications and was not edited for this task.
- `src/features/orders/components/order-list-mobile-header.tsx` currently exists as an untracked workspace file and was not edited for this task.
- No production data, API contracts, database schema, pricing rules, or workflow transition guards were changed.
