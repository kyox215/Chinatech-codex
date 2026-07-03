# Checkpoints

## 2026-07-03T02:00:00+02:00

- Replaced the mobile detail payment tile strip with a receipt-style summary.
- Made `尾款` the prominent amount and rendered total, deposit, and paid amount as full-width rows.
- Preserved existing `paidAmount`, `quotation_amount`, `deposit_amount`, `balance_amount`, and payment status calculations.
- Validation passed: scoped eslint, typecheck, full lint, order slice tests, production build with approved local permissions, browser screenshot verification, and `git diff --check`.

## Decisions

- Do not modify shared `OrderWorkspaceMoneyStrip`; it may still be useful on desktop or wider surfaces.
- Keep the mobile detail fix local to `order-detail-screen.tsx` to avoid widening the change.

## Risks

- Broader worktree remains dirty with unrelated packages. Future staging must be scoped.

## Next Step

If owner asks to ship, stage only the scoped files listed in `HANDOFF.md`, rerun validation, then commit/push the scoped package.
