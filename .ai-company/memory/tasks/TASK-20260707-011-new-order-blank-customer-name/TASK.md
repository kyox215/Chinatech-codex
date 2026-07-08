---
schema_version: 1
task_id: "TASK-20260707-011-new-order-blank-customer-name"
title: "New order blank phone-only customer name"
status: "active"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["Backend", "Frontend", "QA"]
created_at: "2026-07-07T19:19:54Z"
updated_at: "2026-07-07T19:20:21Z"
---
# Task — New order blank phone-only customer name

## Owner request

New order blank phone-only customer name

## Business value

New order intake no longer displays or creates synthetic customer names when only a phone number is known.

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

- [ ] Selecting a customer named 客户 + phone leaves the new order name field blank.
- [ ] Create order payload no longer generates 客户 + phone and backend/mock allow blank customer name with a phone.
- [ ] Lint, targeted tests, typecheck, full tests, build, browser verification pass.

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
