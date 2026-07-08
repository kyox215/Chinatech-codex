---
schema_version: 1
task_id: "TASK-20260707-007-customer-list-hierarchy"
title: "Improve customer list name and phone hierarchy"
status: "active"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["FE", "QA"]
created_at: "2026-07-07T18:45:16Z"
updated_at: "2026-07-07T18:45:27Z"
---
# Task — Improve customer list name and phone hierarchy

## Owner request

Improve customer list name and phone hierarchy

## Business value

Make the customer list easier to scan by strengthening the visual hierarchy of customer name and phone number.

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

- [ ] Desktop customer list shows customer name as the primary line and phone as a distinct contact chip.
- [ ] Email remains secondary and does not compete with the customer name or phone number.
- [ ] Mobile customer cards keep the same hierarchy.
- [ ] Targeted lint passes and local Chrome visual check confirms the updated hierarchy.

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
