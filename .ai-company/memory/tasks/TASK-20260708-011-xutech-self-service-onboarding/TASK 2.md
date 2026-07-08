---
schema_version: 1
task_id: "TASK-20260708-011-xutech-self-service-onboarding"
title: "Verify and harden self-service store onboarding for xutech"
status: "closed"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["API", "DATA", "FLOW", "QA", "SEC"]
created_at: "2026-07-08T17:45:33Z"
updated_at: "2026-07-08T18:05:24Z"
closed_at: "2026-07-08T18:05:24Z"
---
# Task — Verify and harden self-service store onboarding for xutech

## Owner request

Verify and harden self-service store onboarding for xutech

## Business value

让新用户可通过前端注册并创建独立店铺 xutech，验证多店铺开户注册不误绑 Chinatech。

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

- [ ] 测试账号从 ChinaTech 解绑或不再以 ChinaTech 作为 active store
- [ ] 通过浏览器模拟新用户注册并创建 xutech 店铺
- [ ] 若流程失败，修复开户注册相关代码或数据边界并验证
- [ ] 最终提供数据库验证和浏览器截图证据

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
