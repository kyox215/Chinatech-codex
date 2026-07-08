---
schema_version: 1
task_id: "TASK-20260708-001-new-order-device-layout"
title: "New order dialog device info and unlock layout"
status: "active"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["Frontend", "UIUX"]
created_at: "2026-07-07T22:12:33Z"
updated_at: "2026-07-07T22:12:43Z"
---
# Task — New order dialog device info and unlock layout

## Owner request

New order dialog device info and unlock layout

## Business value

提升前台新建维修订单录入效率：客户资料下方直接填设备，手机密码保持独立但仍在故障区附近。

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

- [ ] 客户信息下方显示设备品牌、型号、IMEI 与历史维修型号
- [ ] 手机密码作为独立区域保留在故障与诊断同列下方
- [ ] 不改变订单创建 API 与存储逻辑
- [ ] 本地 lint/typecheck 与浏览器预览验证通过

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
