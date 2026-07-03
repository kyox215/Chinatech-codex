# Checkpoints

## 2026-07-03T01:48:32+02:00

- Goal was created for mobile order card density execution.
- Implemented the compact mobile card layout in `OrderMobileCard`.
- Removed card-body display of order number, normal workflow short badge, and order type badge.
- Moved technician into the middle device/fault card.
- Moved payment status, balance, and total into the right-side money column.
- First version compressed the bottom progress rail too much; owner feedback said it looked like a short uneven bar.
- Refined the bottom workflow into five compact stage cells plus a next-action chip.
- Adjusted the header so customer/phone stay on the independent left side and payment information sits in a right-side finance block.
- Validation passed: scoped eslint, typecheck, focused order task-flow test, full lint, order slice tests, production build with approved local permissions, browser mobile verification, and `git diff --check`.
- Screenshot evidence saved under `screenshots/TASK-20260703-001-order-mobile-card-density/`.

## Decisions

- Keep click behavior as the whole card link to order detail.
- Hide low-value scan metadata on the mobile card while preserving it in data and detail pages.
- Keep exception and overdue indicators visible because they affect work priority.
- Avoid backend/API changes; this is a presentation-only density pass.

## Risks

- Very long customer names, device names, technician names, accessory notes, and repair labels are intentionally truncated in list view. Detail page remains the place for full text.
- Worktree is still dirty with unrelated existing packages; future commit/push must stage only this task's scoped files.

## Next Step

If owner asks to ship, stage only the scoped files listed in `HANDOFF.md`, rerun `npm run lint`, `npm run typecheck`, `npm run test -- src/features/orders`, `npm run build`, then commit and push only this package.
