# Evidence Index — TASK-20260707-003-order-supplier-realtime-plan

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-07T13:22:43Z | CEO-Orchestrator |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-07T13:22:54Z` `eff55581de` — src/features/orders/screens/order-list-screen.tsx: partsSupplierMutation 使用 expected_updated_at 并成功后调用 invalidate(vars.order.id)
- `2026-07-07T13:22:54Z` `6e5a88840d` — src/features/orders/api/query-keys.ts: ordersKeys.queueSummary 使用 ['orders','queue-summary',store,input]，不被 ordersKeys.lists() 覆盖
- `2026-07-07T13:22:54Z` `46c64ab761` — src/features/realtime/model/query-invalidation-map.ts: realtime 订单事件会 broad invalidate ordersKeys.all，但本机 mutation 成功路径未统一采用
- `2026-07-07T13:22:54Z` `9b1b32528e` — .ai-company/memory/tasks/TASK-20260703-007-order-queue-progress-parts-supplier/TASK.md: 供应商业务边界为 parts_supplier_id，不自动改变订单状态
- `2026-07-07T13:53:59Z` `262ac87748` — src/features/orders/api/cache-sync.ts 新增 queueSummary/dashboard/detail 缓存 patch、restore、invalidate helper
- `2026-07-07T13:53:59Z` `9ccd393f58` — src/features/orders/screens/order-list-screen.tsx partsSupplierMutation 使用 onMutate/onSuccess/onError 乐观更新与版本冲突刷新
- `2026-07-07T13:53:59Z` `0e30252d06` — npm run test -- src/features/orders/api/cache-sync.test.ts passed: 1 file / 3 tests
- `2026-07-07T13:53:59Z` `0297f38f89` — npm run test -- src/features/orders passed: 23 files / 118 tests
- `2026-07-07T13:53:59Z` `aa8d4ec54e` — npm run typecheck passed
- `2026-07-07T13:53:59Z` `5a58d7fc0e` — npx eslint focused changed files passed
- `2026-07-07T13:53:59Z` `5a3aa72804` — npm run build passed after sandbox-related first failure was rerun with approval
- `2026-07-07T18:18:36Z` `76ae7f4966` — npm run lint passed
- `2026-07-07T18:18:36Z` `aa8d4ec54e` — npm run typecheck passed
- `2026-07-07T18:18:36Z` `25a8613212` — npm run test passed: 82 files / 531 tests
- `2026-07-07T18:18:36Z` `bc27dcb957` — npm run build passed
- `2026-07-07T18:18:36Z` `18977d2b2d` — git diff --cached --name-only contains only task memory and order cache sync files
- `2026-07-07T18:24:21Z` `f7754d9584` — Tests passed before commit: lint, typecheck, npm run test, build. Vercel deployment chinatech-codex-4kt0s0ztp is READY for commit b93a1fb; chinatech.in/orders redirects to login and returns 200; screenshot saved at screenshots/TASK-20260707-003-order-supplier-realtime-plan/prod-orders-login-20260707.png.
