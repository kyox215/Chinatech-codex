---
schema_version: 1
task_id: "TASK-20260707-015-staff-display-name"
title: "Resolve customer-facing staff display names"
status: "active"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "Integration Lead"
departments: ["API", "FE", "INT", "QA"]
created_at: "2026-07-07T19:54:57Z"
updated_at: "2026-07-07T21:10:32Z"
---
# Task — Resolve customer-facing staff display names

## Owner request

Resolve customer-facing staff display names

## Business value

对客打印、录入人员和订单负责人显示真实意大利语员工名，不把最高管理员等权限角色当作人名展示。

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

- [ ] kyox120@gmail.com 在前台录单和打印相关人员名中显示为 Alessio，同时保留 owner/最高管理员权限。
- [ ] 其它账号如果档案名是角色词，则从邮箱推导可读人员名。
- [ ] 订单创建、时间线和打印用同一套人员显示名逻辑。
- [ ] 不改变角色权限模型，不修改生产数据。

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
