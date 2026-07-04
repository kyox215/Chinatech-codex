# Evidence Index — TASK-20260704-002-order-mobile-card-density

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-04T10:21:17Z | CEO-Orchestrator |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-04T10:21:26Z` `ba7bf8a24c` — eslint src/features/orders/components/order-list-items.tsx passed; git diff --check passed; npm run typecheck passed; vitest order-task-flow and canonical-order-status tests passed; Playwright mobile 393px screenshot saved at screenshots/TASK-20260704-002-order-mobile-card-density/orders-mobile-393-viewport.png; scrollWidth=393 innerWidth=393.
- `2026-07-04T10:35:23Z` `7e19c832b6` — eslint src/features/orders/components/order-list-items.tsx passed; git diff --check passed; npm run typecheck passed; vitest order-task-flow and canonical-order-status tests passed; Playwright 393px screenshot saved at screenshots/TASK-20260704-002-order-mobile-card-density/orders-mobile-393-device-left-amount-right.png; scrollWidth=393 innerWidth=393.
- `2026-07-04T10:40:19Z` `f5912d4b7b` — eslint src/features/orders/components/order-list-items.tsx passed; git diff --check passed; npm run typecheck passed; vitest order-task-flow and canonical-order-status tests passed; Playwright 393px screenshot saved at screenshots/TASK-20260704-002-order-mobile-card-density/orders-mobile-393-customer-top-device-second.png; scrollWidth=393 innerWidth=393.
- `2026-07-04T10:47:22Z` `28046e14d9` — eslint src/features/orders/components/order-list-items.tsx passed; git diff --check passed; npm run typecheck passed; vitest order-task-flow and canonical-order-status tests passed; Playwright 393px screenshot saved at screenshots/TASK-20260704-002-order-mobile-card-density/orders-mobile-393-payment-total-deposit-balance.png; scrollWidth=393 innerWidth=393.
- `2026-07-04T12:48:03Z` `5f952853f1` — Final checks already passed: eslint order-list-items.tsx, git diff --check, npm run typecheck, vitest order-task-flow and canonical-order-status tests, Playwright 393px screenshot with no horizontal overflow.
