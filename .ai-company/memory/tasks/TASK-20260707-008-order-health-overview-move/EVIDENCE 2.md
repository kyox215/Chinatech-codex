# Evidence Index — TASK-20260707-008-order-health-overview-move

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-07T18:53:54Z | CEO-Orchestrator |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-07T18:54:10Z` `77e9f358ce` — Changed src/features/orders/screens/order-list-screen.tsx to remove DesktopQueueHealthStrip, its metrics, and related imports. Changed src/features/dashboard/screens/dashboard-screen.tsx to query queue summary and render a new 工单队列概览 section with 当前队列、待处理风险、可直接处理. npx eslint src/features/orders/screens/order-list-screen.tsx src/features/dashboard/screens/dashboard-screen.tsx passed. npm run typecheck passed. git diff --check on the two files passed. Local dev server returned /orders and / plus relevant queue/dashboard API calls; Computer Use visual check confirmed the cards are absent on /orders and present on / overview. screencapture was attempted but macOS returned could not create image from display.
