---
schema_version: 1
task_id: "TASK-20260707-009-desktop-sidebar-collapse"
title: "Desktop sidebar collapse control"
status: "active"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["Frontend", "QA", "UX"]
created_at: "2026-07-07T19:02:13Z"
updated_at: "2026-07-07T19:02:25Z"
---
# Task — Desktop sidebar collapse control

## Owner request

Desktop sidebar collapse control

## Business value

Desktop users can collapse the global workspace sidebar to free horizontal order-list space.

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

- [ ] Desktop sidebar can collapse from full navigation to icon rail.
- [ ] Collapsed state hides navigation text and keeps mobile drawer behavior unchanged.
- [ ] Lint, typecheck, tests, build, and local browser verification pass.

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
