---
schema_version: 1
task_id: "TASK-20260709-203146-task"
title: "角色权限配置执行与数据库应用"
status: "closed"
task_class: "T2"
risk_level: "R3"
autonomy_level: "L2"
owner: "鹤祥"
departments: ["API", "DATA", "DOC", "QA", "SEC"]
created_at: "2026-07-09T20:31:46Z"
updated_at: "2026-07-09T20:42:18Z"
closed_at: "2026-07-09T20:39:40Z"
---
# Task — 角色权限配置执行与数据库应用

## Owner request

角色权限配置执行与数据库应用

## Business value

把设置页的角色选择从“显示用标签”推进为服务端可执行的权限模型：技师、前台、店长、店主、只读成员在订单、客户、金额、供应商、设置、成员管理等敏感动作上有明确边界，降低误操作和隐私泄露风险。

## Scope in

- 固化角色权限矩阵，补齐批量流转等缺失动作。
- 在 RepairDesk API 路由入口补齐关键写入/敏感动作权限检查。
- 覆盖订单附件上传、客户通知/审批请求、批量流转、成员供应商权限授予的单元测试。
- 补充角色权限配置计划文档和本次执行记录。
- 预检并在确认只包含目标迁移时应用 Supabase 数据库迁移。
- 完成 lint/typecheck/test/build，提交并推送 main。

## Scope out

- 大范围 UI 重做或新增复杂可视权限配置器。
- 一次性重构所有订单/客户读取响应的字段级投影；本次只记录为后续阶段，避免在同一发布中扩大回归面。
- 生产数据删除、历史数据重写、凭据处理。

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] 权限矩阵包含批量工单流转并明确店主/店长可用，技师/前台/只读禁用。
- [x] 订单附件上传、订单客户通知/WhatsApp/审批请求、批量流转、成员权限授予均有服务端入口权限检查。
- [x] 权限相关单元测试覆盖新增规则。
- [x] Supabase migration 经 dry-run 确认范围后应用到 linked 数据库。
- [x] lint/typecheck/test/build 通过，提交并推送 main。

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verify scope |
| 用户已授权推送 main 和应用数据库 | observed | owner request: "完成后推送main以及应用数据库" | 可执行，但仍需 dry-run 防止非目标迁移 |
| 主线已有 server permission module 和供应商授权 migration | observed | `src/server/permissions.ts`, `supabase/migrations/20260709235000_supplier_permission_grants.sql` | 在其基础上补缺口 |
| 字段级金额/历史脱敏仍是后续更大阶段 | inferred | 当前订单/客户读取接口返回结构广，变更面跨 UI/API | 本次记录后续阶段，不混入当前发布 |

## Decision and approval points

- User explicitly approved pushing main and applying database changes.
- No sub-agents spawned: available multi-agent tool requires explicit user request for sub-agents/delegation/parallel agent work; this execution turn asked to set a goal and execute, not to dispatch departments. Department work is handled by the main thread using the relevant skills and task record.
- Database application rule: proceed only if `supabase db push --linked --dry-run` shows the intended pending migration set; stop if unrelated/past migrations appear.

## Work packages

- API/security: close server-side permission gaps.
- Data: inspect/dry-run/apply existing Supabase permission-grant migration.
- QA: run targeted and full validation.
- Docs/memory: write role permission plan, checkpoints, evidence, and closeout.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
