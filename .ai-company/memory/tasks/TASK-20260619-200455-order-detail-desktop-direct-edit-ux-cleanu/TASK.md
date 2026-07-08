---
schema_version: 1
task_id: "TASK-20260619-200455-order-detail-desktop-direct-edit-ux-cleanu"
title: "Order detail desktop direct edit UX cleanup"
status: "closed"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "Integration Lead / CEO Agent"
departments: ["FE", "INT", "QA", "UX"]
created_at: "2026-06-19T20:04:55Z"
updated_at: "2026-06-19T20:16:41Z"
closed_at: "2026-06-19T20:05:20Z"
---
# Task — Order detail desktop direct edit UX cleanup

## Owner request

Order detail desktop direct edit UX cleanup

## Business value

Make desktop order-detail editing faster and less error-prone by removing secondary field activation and making finance edits inline.

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

- [ ] Desktop detail edit mode shows customer, device, issue, diagnosis, finance items, and deposit as direct inputs.
- [ ] Legacy secondary field edit buttons and the old choose-field hint are removed from the desktop edit flow.
- [ ] Lint, typecheck, unit tests, production build, and targeted browser verification pass.

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
