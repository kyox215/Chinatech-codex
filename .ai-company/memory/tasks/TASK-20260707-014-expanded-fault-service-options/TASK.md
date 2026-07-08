---
schema_version: 1
task_id: "TASK-20260707-014-expanded-fault-service-options"
title: "Expanded fault diagnosis service options"
status: "active"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "Integration Lead"
departments: ["FE", "INT", "QA"]
created_at: "2026-07-07T19:46:22Z"
updated_at: "2026-07-07T21:10:19Z"
---
# Task — Expanded fault diagnosis service options

## Owner request

Expanded fault diagnosis service options

## Business value

前台新建维修订单时可以直接选择更完整的维修/服务细分项，减少手工输入和报价命名不一致。

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

- [ ] 故障与诊断所有主要分类增加前台常用细分维修/服务选项。
- [ ] 新增系统类解锁、资料备份、激活锁核验咨询等服务项可选择。
- [ ] 不改变新建订单弹窗 UI 布局和 picker 交互逻辑。
- [ ] 意大利语消息/打印翻译不拆坏带 slash 或 hyphen 的服务名称。

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
