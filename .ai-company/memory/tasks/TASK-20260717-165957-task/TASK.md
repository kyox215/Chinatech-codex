---
schema_version: 1
task_id: "TASK-20260717-165957-task"
title: "创建工单幂等与卡顿恢复修复"
status: "conditional"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["Product", "Architecture", "Data", "Security", "Frontend", "API", "QA", "Release"]
created_at: "2026-07-17T16:59:57Z"
updated_at: "2026-07-17T17:31:48Z"
closed_at: "2026-07-17T17:20:51Z"
---
# Task — 创建工单幂等与卡顿恢复修复

## Owner request

开始执行创建工单卡住问题的修复计划。

## Business value

降低前台创建工单时“页面一直卡住、刷新后才看到结果”的接待中断风险，并降低用户超时后重复提交造成重复工单的概率。

## Scope in

- 给在线创建工单请求增加客户端生成的 `operation_id`。
- 服务端在创建事件 payload 写入 `operation_id`，并提供 `orders/create/status` 查询同一操作是否已经生成工单。
- 同一 `operation_id` 重放时返回已创建工单，不重复写 audit/realtime。
- 前端区分请求超时和真实失败；超时后自动确认结果，确认中/无法确认时阻止重复提交。
- Mock 数据层、API client、router、repository 和相关测试同步。
- 桌面/移动创建页截图与 overflow 验证。

## Scope out

- 不执行生产数据库迁移。
- 不实现完整数据库原子创建 RPC。
- 不改订单业务字段、权限模型、付款、库存或客户资料规则。
- 不发送客户消息、不操作真实客户数据。

## Hard constraints

- 保留已有用户/任务改动，不回滚无关工作。
- 不记录 secrets、生产凭据、完整客户 PII 或解锁值。
- 生产迁移、生产部署和外部发布需要 Owner 明确批准。
- 本次第一阶段修复不能被描述为完整原子事务方案。

## Acceptance criteria

- [x] 在线创建请求携带稳定 `operation_id`。
- [x] 服务端可通过 `operation_id` 找回已创建工单。
- [x] 重放已创建请求不重复写 audit 或 realtime created 事件。
- [x] 前端超时后进入确认中/无法确认状态，阻止重复提交。
- [x] 桌面和移动 `/orders/new` 可视结果已截图。
- [x] lint、typecheck、unit tests、build、移动 E2E 和 overflow E2E 通过。

## Decisions

- Adopted first-phase no-DDL recovery: store `operation_id` in `order_events.payload` and query by store-scoped operation id.
- Deferred full atomic create RPC to a future Owner-approved database migration task.
- Replay response intentionally skips duplicate audit/realtime because original successful create already wrote the create event and router audit.

## Residual risks

| Risk | Impact | Owner / next action |
|---|---|---|
| This is not a single database transaction | Rare partial-write classes are reduced but not fully eliminated | Future R3 DB task: service-role-only atomic RPC |
| If the first request is still before `order_events` insert, status returns pending | UI prevents duplicate submit during confirmation, but manual multi-tab duplicate remains possible | Future operation ledger or RPC |
| Production deploy/migration not executed in this local task | Users do not benefit until code is released | Release requires explicit push/deploy decision |

## Definition of done

- Code and tests reflect the first-phase recovery behavior.
- Evidence is recorded in `EVIDENCE.md`.
- Remaining database atomicity risk is explicit and not hidden.
- Task memory can support safe continuation, release, or rollback.
