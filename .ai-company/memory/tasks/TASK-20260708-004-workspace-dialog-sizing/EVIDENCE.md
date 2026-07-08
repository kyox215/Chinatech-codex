# Evidence Index — TASK-20260708-004-workspace-dialog-sizing

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-07T22:42:09Z | CEO-Orchestrator |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-07T22:42:22Z` `8f23d0426c` — npx eslint src/lib/component-patterns.ts src/lib/ui-patterns.ts src/features/orders/screens/order-list-screen.tsx src/routes/orders.index.tsx exit 0; npm run typecheck exit 0; git diff --check targeted files exit 0; browser order detail 1440x900 dialog 1400x868 overflowX false; browser customer detail 1440x900 dialog 1400x868 overflowX false; screenshots/TASK-20260708-004-workspace-dialog-sizing/order-detail-workspace-1440.png; screenshots/TASK-20260708-004-workspace-dialog-sizing/customer-detail-workspace-1440.png
