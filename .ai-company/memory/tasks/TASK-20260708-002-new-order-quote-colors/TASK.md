---
schema_version: 1
task_id: "TASK-20260708-002-new-order-quote-colors"
title: "New order quotation money hierarchy colors"
status: "active"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["Frontend", "UIUX"]
created_at: "2026-07-07T22:20:46Z"
updated_at: "2026-07-07T22:20:55Z"
---
# Task — New order quotation money hierarchy colors

## Owner request

New order quotation money hierarchy colors

## Business value

让前台在新建维修订单时更清楚地区分总额、定金和尾款。

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

- [ ] 新建维修订单报价项目金额摘要有明确颜色层级
- [ ] 默认共享金额条行为不被无意改变
- [ ] 不改变报价计算、定金校验、订单创建 API 或数据结构
- [ ] targeted lint/typecheck、diff check 和本地浏览器截图验证通过

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
