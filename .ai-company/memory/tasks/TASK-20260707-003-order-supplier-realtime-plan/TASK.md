---
schema_version: 1
task_id: "TASK-20260707-003-order-supplier-realtime-plan"
title: "订单配件供应商与订单相关实时更新计划"
status: "closed"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["API", "FE", "FLOW", "QA"]
created_at: "2026-07-07T13:22:43Z"
updated_at: "2026-07-07T18:24:21Z"
closed_at: "2026-07-07T13:54:35Z"
---
# Task — 订单配件供应商与订单相关实时更新计划

## Owner request

订单配件供应商与订单相关实时更新计划

## Business value

配件供应商选择后即时显示，统一订单相关 mutation 的缓存刷新、版本冲突和跨窗口实时一致性，减少前台重复刷新和误判。

## Scope in

- Add a shared order read-cache synchronization helper for list queue summaries, dashboard summaries, and order detail caches.
- Make the `/orders` parts-supplier selector update the current row immediately with optimistic cache updates.
- Roll back optimistic changes on save failure and refresh stale order data on version conflicts.
- Route order create/detail/task/list mutation cache refreshes through the shared helper so `queueSummary` is not missed.
- Add focused tests for cache patching, rollback, and clearing `parts_supplier_id`.

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [ ] 选择配件供应商后当前行立即显示新供应商或未选状态，无需手动刷新。
- [ ] 保存成功后订单列表聚合缓存、订单详情缓存、统计/筛选结果保持一致。
- [ ] 版本冲突时自动刷新受影响订单并给出可操作提示，不让用户停在旧数据上。
- [ ] 订单相关 mutation 使用统一缓存同步 helper，并覆盖 focused tests。
- [ ] 实施后提供 /orders 相关截图或说明环境阻塞。

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verify scope |
| Project implementation details | unknown | repository inspection required | investigate |

## Decision and approval points

- None registered yet. Run `$risk-autonomy-classify`.

## Work packages

- WP-01 cache helper and focused tests.
- WP-02 `/orders` parts-supplier optimistic update and conflict refresh.
- WP-03 order create/detail/task/list invalidation unification.
- WP-04 validation, browser evidence, and memory closeout.

## Agent Plan

- No real sub-agent spawned.
- Reason: current multi-agent tool policy only allows spawning when the user explicitly asks for sub-agents/delegation/parallel agent work. The owner approved starting the plan, but did not ask for sub-agents in this turn.
- Department checks were handled by the main thread: FLOW business boundary, FE cache behavior, API/client contract, QA evidence.

## Implemented Result

- Added `src/features/orders/api/cache-sync.ts`.
- Added `src/features/orders/api/cache-sync.test.ts`.
- Updated `/orders` supplier mutation to:
  - cancel current order reads before mutation,
  - snapshot relevant caches,
  - patch `parts_supplier_id` immediately in cached rows,
  - write returned `updated_at` after success,
  - restore old cache on failure,
  - refresh stale data and show a specific message on version conflict.
- Updated order list/detail/task/new-order screens to use `invalidateOrderReadCaches(...)`.
- Preserved the existing product boundary: `parts_supplier_id` marks the parts-purchase supplier only and does not change workflow state, parts status, price, SKU, or link data.

## Verification

- `npm run test -- src/features/orders/api/cache-sync.test.ts`: passed, 1 file / 3 tests.
- `npm run test -- src/features/orders`: passed, 23 files / 118 tests.
- `npm run typecheck`: passed.
- `npx eslint src/features/orders/api/cache-sync.ts src/features/orders/api/cache-sync.test.ts src/features/orders/screens/order-list-screen.tsx src/features/orders/screens/order-detail-screen.tsx src/features/orders/screens/order-task-screen.tsx src/features/orders/screens/new-order-screen.tsx`: passed.
- `npm run build`: passed after rerunning outside the sandbox; the first sandbox run failed because Turbopack could not bind/create its helper process.
- `npm run lint`: not fully green because existing `src/features/orders/components/order-overview-tab.tsx` has a Prettier issue outside this task scope.

## Visual Evidence

- Local dev server was opened at `http://localhost:3012/orders`.
- Computer Use verified the local `/orders` page rendered with queue controls and no crash.
- Local data showed `0` orders, so the supplier dropdown interaction could not be exercised visually in that session.
- Saving a screenshot with `screencapture` failed with `could not create image from display`; visual evidence remains the Computer Use app-state screenshot plus dev server request log.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
