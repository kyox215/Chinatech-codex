---
schema_version: 1
task_id: "TASK-20260708-003-new-order-dropdowns"
title: "Fix new order dropdown interactivity and sizing"
status: "closed"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["Frontend", "UIUX"]
created_at: "2026-07-07T22:31:36Z"
updated_at: "2026-07-09T00:06:03Z"
closed_at: "2026-07-09T00:06:03Z"
---
# Task — Fix new order dropdown interactivity and sizing

## Owner request

Fix new order dropdown interactivity and sizing

## Business value

让前台在新建维修订单时能稳定点击品牌、型号、故障细分、留存、质保、类型和状态下拉，并提升右侧服务区控件可点面积。

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

- [ ] 品牌和型号箭头打开可点击菜单且仍保留手动输入
- [ ] 故障细分、留存、保修、类型、状态下拉不被弹窗层级遮挡
- [ ] 右侧服务区下拉触发器尺寸统一且更易点击
- [ ] targeted lint/typecheck、diff check、本地浏览器交互验证和截图通过

## Facts, assumptions, and unknowns

| Item                            | Type     | Evidence                       | Status / next action |
| ------------------------------- | -------- | ------------------------------ | -------------------- |
| Task title and initial metadata | observed | owner request                  | verify scope         |
| Project implementation details  | unknown  | repository inspection required | investigate          |

## Decision and approval points

- None registered yet. Run `$risk-autonomy-classify`.

## Work packages

- Intake, evidence gathering, planning, implementation, independent review, memory closeout.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
