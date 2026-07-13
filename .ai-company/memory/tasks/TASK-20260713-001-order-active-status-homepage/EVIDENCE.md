# Evidence Index - TASK-20260713-001-order-active-status-homepage

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | owner request | 计划、实施和最终推送 main 已批准 | 当前任务对话 | observed | 2026-07-13 | 鹤祥 |
| E-002 | workspace | 共享 main 脏且落后，任务使用隔离最新 main | `git status`; `git fetch`; `/private/tmp/repairdesk-order-active-status-20260713` | isolated at `origin/main@19e1c59d` | 2026-07-13 | INT |
| E-003 | plan delta | 本任务明确替代上一版默认首页归档准入规则，但不修改历史数据 | `TASK.md`; `TASK-20260712-005-order-custody-archive/TASK.md` | recorded | 2026-07-13 | INT |
| E-004 | implementation | 服务端在总数和分页前排除 `completed`/`cancelled`，并以同一六阶段分类返回队列计数 | `order-list-visibility.ts`; `order-queue-classification.ts`; `order.repository.ts`; `repairdesk-router.ts` | implemented | 2026-07-13 | INT |
| E-005 | automated tests | 终态排除、非终态保留、55 active + 70 terminal 分页、mock/API schema、阶段徽标与加载骨架偏移均有回归覆盖 | focused Vitest suite | 7 files / 124 tests passed | 2026-07-13 | QA |
| E-006 | full gates | 项目规则、静态分析、类型、完整测试与生产构建通过 | `agents:check`; lint; typecheck; test; build | 122 files / 839 tests; 22 pages built | 2026-07-13 | INT |
| E-007 | mobile visual | 320/390/430 宽度使用固定两列状态网格，页面无横向溢出，首张订单位于动态固定头部下方 | `screenshots/TASK-20260713-001-order-active-status-homepage/orders-mobile-*.png` | passed | 2026-07-13 | UX |
| E-008 | desktop visual | 1280 宽度七个入口独占整行，长标签不截断，默认结果无终态徽标 | `screenshots/TASK-20260713-001-order-active-status-homepage/orders-desktop-1280x800.png` | passed | 2026-07-13 | UX |
| E-009 | browser runtime | 下单、到货、修好已通知筛选分别返回对应阶段，蓝/黄/绿语义类生效；浏览器无 warn/error | in-app browser scripted checks | passed | 2026-07-13 | INT |
| E-010 | independent QA | 独立只读审查覆盖验收矩阵、权限、分页、文档和 diff | QA agent `019f5a6e-ce4c-7482-84e1-e8e134df8a2d` | PASS; no P0/P1 | 2026-07-13 | QA |
| E-011 | review follow-up | QA 指出的加载骨架默认偏移 P2 已设置为 `22rem` 并增加组件断言 | `order-list-skeleton.tsx`; `loading-skeletons.test.tsx` | fixed; focused tests passed | 2026-07-13 | INT |

## Agent execution

| Agent ID | Nickname | Role | Mode | Result |
|---|---|---|---|---|
| `019f5a48-f107-7332-be12-2d5e62d43883` | not retained after context compaction | project explorer | read-only | Mapped live list, repository, pagination and test paths; findings integrated. |
| `019f5a48-f191-7fd3-8c28-5b992dba219c` | not retained after context compaction | product analyst | read-only | Confirmed terminal-only homepage rule and six active stages; findings integrated. |
| `019f5a48-f226-70f1-b3ba-ffe7c8f135ff` | not retained after context compaction | UX reviewer | read-only | Defined fixed mobile grid, semantic color/text/icon hierarchy and responsive checks. |
| `019f5a6e-ce4c-7482-84e1-e8e134df8a2d` | Probe the 3rd | QA reviewer | read-only | PASS with no P0/P1; one loading-skeleton P2 fixed before release. |

## Residual risks

- 视觉验证使用本地 mock 数据；本任务未部署生产，也未读取或改写生产订单。
- 历史数据缺少配件/通知字段时会保守落入 `处理中`，不会因此从默认首页消失。
- 旧客户端若仍提交已废弃的 `handover`/`settlement`/`review` 分组会被新版 schema 拒绝；当前应用与 API 类型已同步更新。
- 生产数据库权限迁移与部署仍属于独立发布门禁，本任务没有扩大角色能力。
