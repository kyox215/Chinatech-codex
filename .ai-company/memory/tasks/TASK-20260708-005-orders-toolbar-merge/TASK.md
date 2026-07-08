---
schema_version: 1
task_id: "TASK-20260708-005-orders-toolbar-merge"
title: "Merge orders stage queue and toolbar"
status: "active"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["Frontend", "QA", "UIUX"]
created_at: "2026-07-07T22:50:01Z"
updated_at: "2026-07-07T22:50:12Z"
---
# Task — Merge orders stage queue and toolbar

## Owner request

Merge orders stage queue and toolbar

## Business value

把订单页阶段队列和搜索操作栏合并为一个紧凑桌面工作条，减少首屏高度并提高扫单效率。

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

- [ ] 订单页桌面端阶段队列和搜索/筛选/导出/新建合并到同一容器
- [ ] 阶段队列在合并条内保持可点击、数量正常、无横向溢出
- [ ] 移动端浮动筛选头不受影响
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
