---
schema_version: 1
task_id: "TASK-20260723-005-dashboard-quick-order-dialog"
title: "概览快速接单弹窗一致性修复与逻辑审计"
status: "closed"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["Frontend", "QA", "UX"]
created_at: "2026-07-23T20:20:59Z"
updated_at: "2026-07-23T20:44:56Z"
---
# Task — 概览快速接单弹窗一致性修复与逻辑审计

## Owner request

将概览“快速接单”改为与维修工单列表“新建工单”相同的弹窗流程，并检查客户入口、尾款、备注和 Safari 打印等相关逻辑，把未实施的问题写入报告。

## Business value

减少同一业务入口的交互分叉，避免用户从概览跳到独立页面；同时形成后续修复可直接采用的缺陷清单。

## Scope in

- 复用同一个新建工单弹窗组件。
- 概览桌面端和移动端快速接单使用弹窗，成功后进入新工单详情。
- 保留链接的打开新标签页/无 JavaScript 降级能力。
- 检查用户已报告的客户入口、尾款、备注和 Safari 打印逻辑并形成报告。

## Scope out

- Any work not required by the acceptance criteria.
- 本任务不修复客户尾款、返回上下文、新工单通用备注或 Safari 打印问题。
- 不改生产数据、不部署、不提交或推送代码。
- Production/external/destructive actions unless explicitly approved.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] 概览快速接单普通点击在当前页面打开与工单列表相同的新建工单弹窗。
- [x] 桌面与移动布局均可用且无横向溢出。
- [x] 关闭弹窗仍停留概览，重新打开获得干净表单会话。
- [x] 创建成功后进入 `/orders/{id}`。
- [x] 修饰键点击保留 `/orders/new` 链接语义。
- [x] 其余发现写入审计报告且未越权实施。

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| 概览和工单列表原先采用两个不同入口 | observed | `dashboard-quick-start.tsx`, `order-list-screen.tsx` | 已统一 |
| 客户页尾款状态与工单付款状态机不一致 | observed | 客户与工单 payment state 模型 | 报告，待独立任务修复 |
| 新工单缺少可编辑通用备注 | observed | `new-order-screen.tsx` | 报告，待产品确定可见性 |
| Safari 系统打印预览右侧裁切 | owner evidence + code inspection | 用户截图、打印 CSS/E2E | 报告，待独立任务修复 |

## Decision and approval points

- R1/L2：局部、可回滚 UI 入口一致性修改；财务、打印和数据语义问题只读审计，不在本任务实施。

## Work packages

- 共享弹窗抽取与工单列表复用。
- 概览桌面/移动入口接线与会话生命周期。
- 单元测试、浏览器双视口验证、构建验证。
- 逻辑审计报告与任务证据同步。

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
