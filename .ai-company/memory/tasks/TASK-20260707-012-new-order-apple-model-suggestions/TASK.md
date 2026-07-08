---
schema_version: 1
task_id: "TASK-20260707-012-new-order-apple-model-suggestions"
title: "New order Apple model dropdown suggestions"
status: "active"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["Frontend", "QA"]
created_at: "2026-07-07T19:28:07Z"
updated_at: "2026-07-07T19:28:20Z"
---
# Task — New order Apple model dropdown suggestions

## Owner request

New order Apple model dropdown suggestions

## Business value

New repair order intake can select Apple/iPhone models directly without typing.

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

- [ ] New order device model field offers Apple/iPhone model suggestions including latest and legacy models.
- [ ] Selecting an Apple model can fill the model and normalize blank/Apple-like brand input to Apple.
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
