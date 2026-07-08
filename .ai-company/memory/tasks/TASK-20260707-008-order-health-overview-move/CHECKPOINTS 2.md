# Checkpoints — TASK-20260707-008-order-health-overview-move

## 2026-07-07T18:53:54Z — Task created

- **Phase:** intake
- **Completed:** task directory and initial metadata created.
- **Evidence:** owner request; generated task files.
- **Decisions:** none.
- **Risks/blockers:** scope and project facts not yet verified.
- **Next:** run `$company-task-intake`, `$context-rehydrate`, and `$risk-autonomy-classify`.
## 2026-07-07T18:54:10Z — Moved the order queue health cards out of the Orders page and into the dashboard Overview page.

- **Phase:** verified-local
- **Completed/current state:** Moved the order queue health cards out of the Orders page and into the dashboard Overview page.
- **Next:** Optional: commit/push/deploy this scoped UI change together with other approved local UI tweaks.
- **Decision:** Move the operational summary to Overview as a store-level queue snapshot and remove it from the Orders work queue so the order list starts immediately after search/filter controls.
- **Evidence:**
  - Changed src/features/orders/screens/order-list-screen.tsx to remove DesktopQueueHealthStrip, its metrics, and related imports. Changed src/features/dashboard/screens/dashboard-screen.tsx to query queue summary and render a new 工单队列概览 section with 当前队列、待处理风险、可直接处理. npx eslint src/features/orders/screens/order-list-screen.tsx src/features/dashboard/screens/dashboard-screen.tsx passed. npm run typecheck passed. git diff --check on the two files passed. Local dev server returned /orders and / plus relevant queue/dashboard API calls; Computer Use visual check confirmed the cards are absent on /orders and present on / overview. screencapture was attempted but macOS returned could not create image from display.
- **Recorded by:** codex-main
