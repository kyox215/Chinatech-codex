---
schema_version: 1
task_id: "TASK-20260701-007-performance-optimization-plan"
status: "implemented_verified"
phase: "batch_5_verified"
task_class: "performance_optimization_execution"
risk_level: "R2"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
created_at: "2026-07-01T23:20:00+02:00"
updated_at: "2026-07-02T00:46:00+02:00"
---

# Task Charter

## Owner Request

老板先要求规划项目加载/响应速度优化，随后说“开始执行”。本任务从计划阶段进入第一批低风险性能实施。

## Business Outcome

让 RepairDesk 的日常高频页面和动作更快：Dashboard、工单列表、新建工单、工单详情、客户、库存、回收、设置等页面应减少重复请求、减轻首屏包体、缩短常用动作响应时间，并保留现有业务流程和 RepairOS UI 规则。

## Scope In

- 性能基线与预算。
- React Query 缓存、staleTime、gcTime、focus refetch、失效范围治理。
- 首屏 bundle 与全局组件懒加载。
- 高频 API 响应体、分页、投影、请求超时/中断规划。
- 大型页面拆分路线图。
- 验证矩阵、回滚和审批点。

## Batch 1 Scope

Implemented:

- Centralized React Query cache defaults and cache time constants.
- Lazy-loaded the command palette body so the authenticated shell no longer imports the full command/search UI before opening.
- Replaced raw broad query invalidation strings with query key factories in hot order/customer/settings paths.
- Added stale times and placeholder data on common dashboard, orders, customers, inventory, buyback, settings, messages, onboarding, and shell-context queries.
- Deferred inventory and buyback search filter queries so typing stays responsive.
- Added a shared `/api/repairdesk/*` request timeout and cancellation policy in `src/lib/repairdesk/api.ts`.
- Wired React Query `signal` into common read-heavy hot paths so abandoned reads can be cancelled.
- Added a backward-compatible Dashboard aggregate API path, `dashboard/summary`, so the dashboard recent-orders and stats data load through one business query instead of two separate page queries.
- Added a backward-compatible Inventory aggregate API path, `inventory/summary`, so the inventory list and global stats load through one business query instead of duplicate broad reads.
- Added a backward-compatible Orders queue aggregate API path, `orders/queue-summary`, so the order queue list, workflow, and filter options load through one business query instead of three first-load reads.

## Scope Out

- 不执行生产发布。
- 不做数据库迁移或索引，除非老板单独批准。
- 不新增生产依赖，除非老板单独批准。
- 不删除疑似 legacy 文件，除非确认无引用并获得执行窗口。

## Acceptance Criteria

- 项目内性能优化计划已生成。
- 第一批低风险性能改动已实施。
- 第二批 API request timeout/cancel 改动已实施。
- 第三批 Dashboard API 聚合改动已实施。
- 第四批 Inventory API 聚合改动已实施。
- 第五批 Orders Queue API 聚合改动已实施。
- lint、typecheck、unit tests、production build、route timing、Playwright smoke/overflow checks 已记录。
- 可视证据截图已保存到 `screenshots/TASK-20260701-007-performance-optimization/login-production-1440.png`、`screenshots/TASK-20260701-007-performance-optimization/api-timeout-login-1440.png`、`screenshots/TASK-20260701-007-performance-optimization/dashboard-summary-1440.png`、`screenshots/TASK-20260701-007-performance-optimization/inventory-summary-1440.png` 和 `screenshots/TASK-20260701-007-performance-optimization/orders-queue-summary-1440.png`。

## Risk / Autonomy

- 计划阶段为 R1 / L2。
- 本批代码实施为 R2 / L2：可逆前端缓存/懒加载变更，无数据库、无依赖、无生产发布。
- 数据库索引、生产监控 SDK、新依赖、生产部署、权限/支付/客户通知相关变化升级到 R3 并需要老板批准。

## Sub-Agent Decision

No real sub-agents were spawned. Reason: the owner said "开始执行" but did not explicitly request sub-agents/multi-agent/departments. The first batch was a bounded, single-writer R2 implementation. QA/security/architecture review can be split into read-only sub-agent work packages before higher-risk API/database phases.

## Primary Plan Artifact

- `docs/PERFORMANCE_OPTIMIZATION_PLAN.md`

## Next Step

Next recommended batch: selected large-screen component splits, or customer/settings/message hot-path request review. Database indexes, new monitoring dependencies, and production deployment still require explicit owner approval.
