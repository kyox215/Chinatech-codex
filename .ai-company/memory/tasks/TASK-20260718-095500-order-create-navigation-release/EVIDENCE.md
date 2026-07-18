# Evidence Index — TASK-20260718-095500-order-create-navigation-release

| Evidence ID | Type    | Claim supported                   | Source/path/command | Result   | Collected at         | Collector       |
| ----------- | ------- | --------------------------------- | ------------------- | -------- | -------------------- | --------------- |
| E-001       | request | task exists and title is recorded | `TASK.md`           | observed | 2026-07-18T08:05:56Z | IntegrationLead |

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

| Gate             | Command / environment                                           | Result                           |
| ---------------- | --------------------------------------------------------------- | -------------------------------- |
| Target E2E       | Playwright Chromium, desktop mock, webpack dev server, 1 worker | PASS — 2/2                       |
| Lint             | `npm run lint`                                                  | PASS                             |
| TypeScript       | `npm run typecheck`                                             | PASS                             |
| Unit/integration | `npm run test`                                                  | PASS — 238 files, 1579 tests     |
| Production build | `npx next build --webpack`                                      | PASS — 24 static pages generated |
| Diff check       | `git diff --check`                                              | PASS                             |

## Environment-only failures

- 首次 E2E 启动在 sandbox 内因端口绑定 `EPERM` 失败；批准本地监听后继续。
- Turbopack dev/build 拒绝隔离 worktree 指向主仓库 `node_modules` 的符号链接，报 `Symlink [project]/node_modules is invalid`；改用 Next webpack 模式后 E2E 与生产构建通过。
- 首轮真实 mock create 返回 `400 缺少当前店铺`，原因是最新 mock order-cost wrapper 要求 `actor.storeId`，而 E2E system actor 没有 store。导航测试随后只 stub 创建成功响应，避免把无关测试基础设施问题混入本修复；生产创建完整性已由前置诊断验证。

## Visual evidence

- `screenshots/TASK-20260718-095500-order-create-navigation-release/order-create-navigation-detail-desktop.png`：从列表 Dialog 提交成功后，浏览器位于 `/orders/ord_1` 的独立详情页，右下角显示“工单已创建”。使用 mock 数据，无客户 PII。

## Quality conclusion before release

- PASS：验收范围内的前端行为、静态检查、完整测试和构建均通过。
- Release gate：PASS，详细记录见下节。
- `2026-07-18T08:15:23Z` `7d130c6518` — .ai-company/memory/tasks/TASK-20260718-095500-order-create-navigation-release/EVIDENCE.md

## Documentation impact matrix

| Reader            | Authority                                | Result                                             |
| ----------------- | ---------------------------------------- | -------------------------------------------------- |
| Frontend/QA       | `docs/UI_PAGE_GENERATION_DECLARATION.md` | Updated canonical creation-success navigation rule |
| API/Data/Security | API/schema/permission docs               | No update; contracts unchanged                     |
| Operations        | release evidence in this task            | Deployment and rollback IDs recorded at closeout   |

## Production release record

- Git：`3022ba83291d04adcb55506b2b54de64d56ef0af`（`Fix order creation detail navigation`）已推送至 `origin/main`。
- Vercel：`dpl_FRW6tZNUggwmtdo7vGPLHhVD7QcT`，target `production`，状态 `READY`，部署提交与 Git SHA 完全一致。
- Production aliases：`www.chinatech.in`、`chinatech.in` 已指向该部署，alias error 为 null。
- 远端标准 Turbopack build：23.8 秒编译通过，TypeScript 30.4 秒通过，24/24 静态页面生成，部署完成。
- 无登录 smoke：`https://www.chinatech.in/orders` 返回 200 并匹配 `/login`，说明生产域名、路由和认证保护正常。
- 运行时观察：部署后 15 分钟窗口无 runtime error；已观察状态码为 200（4 次）和 307（1 次），无 5xx。
- 未在生产创建测试工单：避免写入业务数据。成功导航由 2/2 mock E2E 证明；生产创建 API/数据库完整性由前置诊断任务的只读证据证明。

## Rollback

- 首选回滚点：`dpl_5cXmYBqeJdrnJLuLmGhkaedMEYTh`（上一 READY production，commit `1fadd288`）。
- 代码前滚/回滚：revert `3022ba83` 后重新部署；本变更无数据库迁移和数据回滚步骤。

## Final quality / release conclusion

- PASS：代码、QA、文档、生产部署、无写入 smoke 与运行时错误扫描均通过。
- 残余风险：未在生产写入真实测试工单；由已有生产创建完整性证据和同提交前端 E2E 覆盖，Owner 为 Integration Lead，若用户仍复现则立即按 incident flow 收集浏览器/订单时间窗。
- `2026-07-18T08:21:21Z` `7d130c6518` — .ai-company/memory/tasks/TASK-20260718-095500-order-create-navigation-release/EVIDENCE.md
- `2026-07-18T08:22:26Z` `7a1cef7855` — .ai-company/memory/tasks/TASK-20260718-095500-order-create-navigation-release/CLOSEOUT.md
