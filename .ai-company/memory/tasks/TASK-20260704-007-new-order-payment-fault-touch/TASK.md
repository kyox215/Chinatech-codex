---
schema_version: 1
task_id: "TASK-20260704-007-new-order-payment-fault-touch"
title: "Mobile new order service payment fault touch layout"
status: "active"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["Design", "Engineering", "Product", "QA"]
created_at: "2026-07-04T18:00:34Z"
updated_at: "2026-07-04T18:11:42Z"
---
# Task — Mobile new order service payment fault touch layout

## Owner request

Mobile new order service payment fault touch layout

## Business value

Mobile new-order and order-detail screens are clearer and easier to tap.

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

- [ ] New-order service settings show deposit, warranty, operator, retain/type/status in compact touch-friendly cards.
- [ ] Compact fault picker stays at three columns on mobile and has larger split tap targets for main category vs detail dropdown.
- [ ] Mobile order detail payment summary emphasizes total amount, then collected deposit and pending balance without ambiguity.

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
