---
schema_version: 1
task_id: "TASK-20260718-095500-order-create-navigation-release"
title: "创建工单成功后统一跳转详情并发布"
status: "closed"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["Frontend", "Operations", "QA"]
created_at: "2026-07-18T08:05:56Z"
updated_at: "2026-07-18T08:22:33Z"
closed_at: "2026-07-18T08:22:33Z"
---
# Task — 创建工单成功后统一跳转详情并发布

## Owner request

“开始下一步，并在完成后推送以及部署。”承接上一任务已确认的根因：修复列表弹窗创建成功后不进入 canonical 工单详情页的问题，完成推送和生产部署。

## Business value

消除列表弹窗创建成功后无页面跳转的体验断点

## Scope in

- 将 `/orders` 列表弹窗的创建成功行为改为导航到 `/orders/{id}`。
- 保持 `/orders/new` 直接创建页的成功导航行为不回退。
- 增加成功创建导航 E2E，覆盖直接页面与列表弹窗两条入口。
- 运行项目要求的 lint、typecheck、test、build，以及目标 E2E。
- 提交本任务最小变更，推送到 `main`，完成 Vercel 生产部署和真实路径验证。

## Scope out

- 不修改创建 API、数据库 schema、RLS、权限、支付、离线 operation id 协议。
- 不重构 Orders 列表或详情 Dialog；不带入主工作区其他未提交改动。
- 不执行数据库迁移或生产数据写入。
- 不发送客户通知。

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.
- 单一业务代码写入者；隔离 worktree 基于最新 `origin/main`。
- 发布提交只能包含本任务代码、测试和任务证据。
- 若 `origin/main` 在推送前移动，先重新同步并重跑受影响门禁。

## Acceptance criteria

- [x] 列表弹窗创建成功后导航到 /orders/{id}
- [x] 直接创建页成功导航保持正常
- [x] 关键 E2E、lint、typecheck、test、build 通过
- [x] 提交推送到 main 并完成生产部署验证

## Facts, assumptions, and unknowns

| Item                                            | Type     | Evidence                                                    | Status / next action |
| ----------------------------------------------- | -------- | ----------------------------------------------------------- | -------------------- |
| 列表弹窗传入 `onCreated` 后会跳过 `router.push` | observed | `new-order-screen.tsx` success callback                     | verified             |
| 列表回调仅关闭新建 Dialog、设置 `detailOrderId` | observed | `order-list-screen.tsx` handler                             | verified             |
| 直接 `/orders/new` 会进入 canonical 详情页      | observed | 代码与上一任务本地浏览器证据                                | verified             |
| 生产创建 API 与数据库写入正常                   | observed | 上一诊断任务 Vercel/Supabase 只读证据                       | verified             |
| 发布提交                                        | observed | `3022ba83291d04adcb55506b2b54de64d56ef0af` on `origin/main` | verified             |
| Vercel 生产部署                                 | observed | `dpl_FRW6tZNUggwmtdo7vGPLHhVD7QcT` READY                    | verified             |

## Decision and approval points

- 风险等级：R2。客户可见导航行为和生产发布有影响，但变更前端可逆、无数据迁移。
- 自治等级：L2。允许在最小范围内实施和验证；生产发布的 D3 决策已由老板在本消息中明确批准。
- D1：具体 handler、测试选择、提交信息由 Integration Lead 决定。
- D3：推送 `main` 与生产部署已批准；若出现数据/权限/迁移变化必须停止并重新请求批准。
- 强制门禁：Frontend/UI、QA、Release；Data/Security 不触发，因为无数据、权限、秘密或依赖变化。
- 回滚：Vercel 回滚到前一 READY 部署，或 revert 本次单一提交后重新部署。

## Work packages

1. **WP1 基线与隔离（Integration Lead）**：确认远端、创建独立 worktree、锁定文件预算；退出条件为 clean baseline。
2. **WP2 最小实现（单一写入者）**：`order-list-screen.tsx` 改为成功后 `router.push`，移除瞬时详情 Dialog 打开；退出条件为窄测试可运行。
3. **WP3 回归证据（QA gate）**：新增 E2E 覆盖两入口；运行目标 E2E、lint、typecheck、test、build；结论只能 PASS/CONDITIONAL/FAIL。
4. **WP4 发布（Release gate）**：检查 scoped diff、提交、同步远端、推送 main、确认生产 READY、执行真实路径 smoke 与观察日志。
5. **WP5 关闭（Integration Lead）**：保存截图、证据、检查点和发布/回滚记录，正式关闭任务。

### Agent 选择

- no-spawn reason：变更仅一个前端成功回调和一份 E2E，所有步骤强顺序依赖且需要单一写入者；启动多个只读 Agent 不产生独立交付物，成本高于收益。Frontend、QA、Operations 为 considered / not spawned，由主线程按门禁顺序执行。

### 文件影响预算

- 允许：`src/features/orders/screens/order-list-screen.tsx`。
- 允许：一份 Orders 创建导航 E2E 文件。
- 允许：本任务 `.ai-company/memory/tasks/TASK-20260718-095500-order-create-navigation-release/*`、必要的 `ACTIVE_CONTEXT.md`。
- 禁止：Supabase migrations、API contract、权限、依赖、设计 Token、无关格式化。

### 测试与证据矩阵

| 验收项                   | 验证                                                                                        | 证据             |
| ------------------------ | ------------------------------------------------------------------------------------------- | ---------------- |
| 列表弹窗创建后进入详情页 | Playwright mock E2E + 最终浏览器截图                                                        | E2E 输出、截图   |
| 直接创建页不回退         | Playwright mock E2E                                                                         | E2E 输出         |
| 静态与回归安全           | lint、typecheck、vitest、build                                                              | 命令退出码       |
| 生产已发布               | Vercel READY + production URL/commit                                                        | deployment 记录  |
| 真实用户路径正常         | production smoke，不创建真实工单时验证部署/页面；创建行为由 mock E2E 与线上请求日志共同证明 | smoke 截图、日志 |

### 暂停条件

- 目标文件出现新上游冲突或需要带入当前脏工作区改动。
- 修复要求修改 API、数据库、权限或生产数据。
- 关键 E2E、typecheck、build 失败且不能在本任务范围内解释或修复。
- 生产部署不是本次提交、部署非 READY，或健康日志出现新增错误。

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
