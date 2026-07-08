---
schema_version: 1
task_id: "TASK-20260708-004-workspace-dialog-sizing"
title: "Unify workspace dialog sizing with new order"
status: "active"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["Frontend", "QA", "UIUX"]
created_at: "2026-07-07T22:42:09Z"
updated_at: "2026-07-07T22:42:22Z"
---
# Task — Unify workspace dialog sizing with new order

## Owner request

Unify workspace dialog sizing with new order

## Business value

让工单详情和相关客户详情工作台弹窗与新建工单保持一致的近满屏尺寸，提升桌面查看和处理效率。

## Scope in

- To be refined by `$company-task-intake`.

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [ ] 订单详情弹窗使用与新建订单一致的响应式宽高逻辑
- [ ] 客户详情等共享 detail workspace 的弹窗同步采用同一工作台尺寸
- [ ] 小型确认、收款、通知表单不被误改为全屏工作台
- [ ] targeted lint、typecheck、diff check、本地浏览器截图验证通过

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verify scope |
| Project implementation details | unknown | repository inspection required | investigate |

## Decision and approval points

- None registered yet. Run `$risk-autonomy-classify`.

## Work packages

- Intake, evidence gathering, planning, implementation, independent review, memory closeout.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
