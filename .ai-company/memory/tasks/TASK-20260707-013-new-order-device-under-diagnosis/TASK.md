---
schema_version: 1
task_id: "TASK-20260707-013-new-order-device-under-diagnosis"
title: "Move new order device info under diagnosis"
status: "active"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["Frontend", "QA"]
created_at: "2026-07-07T19:35:10Z"
updated_at: "2026-07-07T19:35:23Z"
---
# Task — Move new order device info under diagnosis

## Owner request

Move new order device info under diagnosis

## Business value

New order intake follows the requested visual flow by placing device information beneath fault diagnosis.

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

- [ ] Device information section appears below Fault & Diagnosis in the new order dialog/workspace.
- [ ] Customer search remains in the left column and device fields keep existing behavior including history device selection and Apple model suggestions.
- [ ] Lint, typecheck, tests, build, browser verification, screenshot, and diff check pass.

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
