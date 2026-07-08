---
schema_version: 1
task_id: "TASK-20260707-008-order-health-overview-move"
title: "Move order queue health cards to dashboard overview"
status: "active"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["FE", "QA"]
created_at: "2026-07-07T18:53:54Z"
updated_at: "2026-07-07T18:54:10Z"
---
# Task — Move order queue health cards to dashboard overview

## Owner request

Move order queue health cards to dashboard overview

## Business value

Remove queue-health summary cards from the order work queue page and show the same operational summary in the overview page.

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

- [ ] Orders page no longer renders the selected current queue, risk, and quick-action summary strip.
- [ ] Overview page shows an order queue overview section with current queue, risk, and direct-action metrics.
- [ ] Targeted lint, typecheck, and local browser visual checks pass.

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
