---
schema_version: 1
task_id: "TASK-20260707-006-remove-global-new-order-button"
title: "Remove global new order app bar button"
status: "active"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["FE", "QA"]
created_at: "2026-07-07T18:40:16Z"
updated_at: "2026-07-07T18:40:26Z"
---
# Task — Remove global new order app bar button

## Owner request

Remove global new order app bar button

## Business value

Remove the global app bar quick-create button selected by the owner from all pages while keeping page-level create actions.

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

- [ ] Global AppBar no longer renders the contextual primary action button on any module page.
- [ ] Order page content toolbar still keeps its page-level New Order action.
- [ ] Targeted lint passes and local browser verification confirms the top bar button is absent.

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
