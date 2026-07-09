---
schema_version: 1
task_id: "TASK-20260709-001-settings-density-compression"
title: "Compress settings density layout"
status: "active"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["Frontend", "QA", "UIUX"]
created_at: "2026-07-09T00:16:30Z"
updated_at: "2026-07-09T00:23:16Z"
---
# Task — Compress settings density layout

## Owner request

Compress settings density layout

## Business value

设置页移动端和桌面端显示更紧凑，一屏展示更多员工管理信息，降低门店高频操作滚动成本。

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

- [ ] 设置分组导航高度降低，横向滚动时隐藏可见滚动条/状态条。
- [ ] 员工管理统计、筛选、邀请和邀请码区域高密度排列，低频表单默认折叠。
- [ ] 设置页 scoped typecheck/lint/tests/build 通过或记录既有非本任务门禁阻塞。
- [ ] 完成后 scoped commit 并推送到 origin/main。

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
