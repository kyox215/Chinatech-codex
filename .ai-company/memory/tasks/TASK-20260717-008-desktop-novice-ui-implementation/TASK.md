---
schema_version: 1
task_id: "TASK-20260717-008-desktop-novice-ui-implementation"
title: "桌面端小白化工作台实施与发布"
status: "in_progress"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2_code_L1_production"
owner: "IntegrationLead"
departments: ["Product", "UX", "Frontend", "Data", "Security", "QA", "Release", "Documentation"]
created_at: "2026-07-17T22:20:00+02:00"
updated_at: "2026-07-17T21:18:00Z"
---
# Task

## Owner goal

按照已批准的桌面端小白化规划实施 RepairDesk，完成验证后推送到 `main`，并审查、dry-run、应用本任务真正需要的 Supabase migration。

## Business value

- 新员工无需理解底层状态机即可识别当前状态、下一步和缺失资料。
- 前台、技术员和店长保留完整纠错、审批、支付、保管和审计能力。
- 降低误操作、重复提交、错误空状态和金额口径回归风险。

## In scope

- 桌面导航与术语统一。
- 概览、工单列表、新建工单、工单详情、客户、回收、库存和设置的渐进式简化。
- 设备保管二次修改、解锁信息、取消工单金额、审批、支付、权限、并发与审计回归保护。
- 加载、空、错误、离线、无权限、冲突和重复提交状态。
- 桌面端测试、截图、文档、任务记忆、发布与观察。

## Out of scope

- 重写底层订单状态机或数据库状态值。
- 放宽权限、支付、审批、租户隔离或敏感字段规则。
- 应用店铺生命周期、Kiosk 或其他并行任务 migration。
- 生产数据修改、真实客户通知或破坏性数据库操作。

## Owner authorization

- 2026-07-17：Owner 明确要求按规划执行，完成后推送 `main` 并应用 Supabase/migration。
- 该授权解释为：允许本任务代码推送与本任务必要 migration 的生产 apply；不包含无关、未审查或破坏性 migration。

## Risk and autonomy

- UI 与可逆前端改动：R2 / L2。
- 跨模块发布、main 推送、Supabase linked 操作：R3 / L1，必须串行执行并保留前后状态证据。
- 若发现需要修改权限、支付、状态机或不可逆 schema，暂停并重新批准。

## Acceptance

- 用户术语统一；每个业务阶段最多一个主操作。
- 新建工单精确说明缺失字段并可定位。
- 工单列表和详情优先显示当前状态、下一步和阻塞原因。
- 设备保管、密码、取消金额、审批、支付和审计规则无回归。
- 回收查询错误不能显示为真实空数据。
- 1024、1280、1440、1600 桌面无页面级横向溢出。
- lint、typecheck、相关测试、全量测试、build、桌面 E2E 和截图通过。
- Supabase linked migration 状态经 dry-run 和元数据核验；只应用本任务必要 migration。
- 变更提交并推送到 `main`，完成发布后冒烟观察。

## Execution model

- Integration Lead：唯一业务代码写入者、Git/Supabase/发布执行者。
- UX/FE、FLOW/DATA/SEC、QA/Release 子代理：只读复核。
- 隔离 worktree：`/private/tmp/repairdesk-desktop-novice-ui-20260717`。
- 分支：`codex/desktop-novice-ui-20260717`，基线 `origin/main@91a5d077`。
