---
schema_version: 1
task_id: "TASK-20260708-006-ui-business-batch-push"
title: "RepairDesk UI and order business batch push"
status: "active"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "Hexiang Huang"
departments: ["Engineering", "QA"]
created_at: "2026-07-07T23:17:20Z"
updated_at: "2026-07-07T23:20:12Z"
---
# Task — RepairDesk UI and order business batch push

## Owner request

RepairDesk UI and order business batch push

## Business value

Ship the locally validated order/customer/buyback UI and order business improvements to main without unrelated dirty-worktree changes.

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

- [ ] Scoped UI/business changes are committed and pushed to origin/main.
- [ ] lint, typecheck, targeted tests, and build evidence are recorded.

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
