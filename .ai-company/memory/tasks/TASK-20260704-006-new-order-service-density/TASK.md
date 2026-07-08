---
schema_version: 1
task_id: "TASK-20260704-006-new-order-service-density"
title: "Compact mobile new-order service settings"
status: "closed"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: []
created_at: "2026-07-04T16:57:25Z"
updated_at: "2026-07-04T17:00:49Z"
closed_at: "2026-07-04T17:00:49Z"
---
# Task — Compact mobile new-order service settings

## Owner request

Compact mobile new-order service settings

## Business value

Make the new-order mobile deposit/service block denser and easier to scan for shop intake.

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

- [ ] Mobile service settings block uses compact high-density layout with clear deposit label and no excessive vertical space.
- [ ] The block remains usable on 393px mobile viewport without horizontal overflow or hidden controls.

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
