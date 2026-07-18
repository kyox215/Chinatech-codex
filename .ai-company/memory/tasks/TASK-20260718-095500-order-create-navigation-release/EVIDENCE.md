# Evidence Index — TASK-20260718-095500-order-create-navigation-release

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-18T08:05:56Z | IntegrationLead |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-18T08:07:07Z` `81604b9790` — .ai-company/memory/tasks/TASK-20260718-095500-order-create-navigation-release/TASK.md

## Implemented change

- `src/features/orders/screens/order-list-screen.tsx`：列表弹窗创建成功后关闭新建 Dialog、刷新 Orders 缓存，并通过 `router.push(`/orders/${id}`)` 进入 canonical 详情页；不再先设置 `detailOrderId` 打开第二个 Dialog。
- `tests/e2e/new-order-create-navigation.spec.ts`：覆盖 `/orders/new` 与 `/orders` 新建 Dialog 两条成功创建入口；成功响应使用稳定 route stub，详情读取继续使用现有 mock 数据。

## UI / UX review

- 成功：新建表单消失，URL 进入 `/orders/{id}`，详情以 page surface 显示，不保留详情 Dialog shell。
- 提交中、失败、超时恢复、离线逻辑：未修改，仍由 `NewOrderScreen` 管理。
- 响应式：成功回调由桌面/移动共用，未新增布局或 Token；本次截图验证桌面主路径。
- 可访问性：页面导航后模态锁随 Dialog 卸载；测试同时验证新建 root 与详情 Dialog shell 均不存在。

## Executed validation

| Gate | Command / environment | Result |
|---|---|---|
| Target E2E | Playwright Chromium, desktop mock, webpack dev server, 1 worker | PASS — 2/2 |
| Lint | `npm run lint` | PASS |
| TypeScript | `npm run typecheck` | PASS |
| Unit/integration | `npm run test` | PASS — 238 files, 1579 tests |
| Production build | `npx next build --webpack` | PASS — 24 static pages generated |
| Diff check | `git diff --check` | PASS |

## Environment-only failures

- 首次 E2E 启动在 sandbox 内因端口绑定 `EPERM` 失败；批准本地监听后继续。
- Turbopack dev/build 拒绝隔离 worktree 指向主仓库 `node_modules` 的符号链接，报 `Symlink [project]/node_modules is invalid`；改用 Next webpack 模式后 E2E 与生产构建通过。
- 首轮真实 mock create 返回 `400 缺少当前店铺`，原因是最新 mock order-cost wrapper 要求 `actor.storeId`，而 E2E system actor 没有 store。导航测试随后只 stub 创建成功响应，避免把无关测试基础设施问题混入本修复；生产创建完整性已由前置诊断验证。

## Visual evidence

- `screenshots/TASK-20260718-095500-order-create-navigation-release/order-create-navigation-detail-desktop.png`：从列表 Dialog 提交成功后，浏览器位于 `/orders/ord_1` 的独立详情页，右下角显示“工单已创建”。使用 mock 数据，无客户 PII。

## Quality conclusion before release

- PASS：验收范围内的前端行为、静态检查、完整测试和构建均通过。
- Release gate pending：尚未提交、推送或验证生产部署。
- `2026-07-18T08:15:23Z` `7d130c6518` — .ai-company/memory/tasks/TASK-20260718-095500-order-create-navigation-release/EVIDENCE.md
