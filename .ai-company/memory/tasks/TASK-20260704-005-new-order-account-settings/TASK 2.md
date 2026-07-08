---
schema_version: 1
task_id: "TASK-20260704-005-new-order-account-settings"
title: "New order service settings and account display name"
status: "closed"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: []
created_at: "2026-07-04T16:50:57Z"
updated_at: "2026-07-04T16:51:13Z"
closed_at: "2026-07-04T16:51:13Z"
---
# Task — New order service settings and account display name

## Owner request

New order service settings and account display name

## Business value

Clarify mobile new-order deposit/service settings, prevent submit bar overlap, and allow staff to edit their own display name from Settings.

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

- [ ] Mobile new order deposit field is explicitly labeled and bottom fields are scrollable above the fixed submit bar.
- [ ] Settings exposes editable account display name while account role remains read-only and compact.
- [ ] Account display name update persists through staff profile API and refreshes relevant UI caches.

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
