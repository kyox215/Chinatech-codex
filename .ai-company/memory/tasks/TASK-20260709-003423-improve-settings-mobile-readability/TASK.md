---
schema_version: 1
task_id: "TASK-20260709-003423-improve-settings-mobile-readability"
title: "Improve settings mobile readability"
status: "active"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["Frontend", "QA", "UIUX"]
created_at: "2026-07-09T00:34:23Z"
updated_at: "2026-07-09T00:47:03Z"
---
# Task — Improve settings mobile readability

## Owner request

Improve settings mobile readability

## Business value

设置页移动端功能入口和员工操作按钮更清晰，保持高密度同时避免单字按钮造成误解。

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

- [ ] 移动端设置分组不再依赖横向滑动，改为清晰两列或等效可见布局。
- [ ] 员工管理卡片操作按钮不再显示单字，保存/停用/恢复等动作可读且不截断。
- [ ] 桌面端布局保持高密度，不引入页面级横向滚动。
- [ ] 完成 scoped 验证并推送 main。

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
