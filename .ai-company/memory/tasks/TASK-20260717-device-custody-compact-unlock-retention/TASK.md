---
schema_version: 1
task_id: "TASK-20260717-device-custody-compact-unlock-retention"
title: "Device custody compact mobile UI and unlock retention"
status: "closed"
task_class: "T2"
risk_level: "R3"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["data", "product", "security"]
created_at: "2026-07-17T18:42:55Z"
updated_at: "2026-07-17T18:45:24Z"
closed_at: "2026-07-17T18:45:24Z"
---
# Task — Device custody compact mobile UI and unlock retention

## Owner request

Device custody compact mobile UI and unlock retention

## Business value

Reduce mobile order-detail space usage and align custody handover with owner-requested unlock retention rule.

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

- [ ] Mobile device custody card is compact and does not shrink the main scroll area unnecessarily.
- [ ] Mobile assignee and parts supplier management render in one compact row on normal phone width.
- [ ] Customer-held, returned, cancelled-return, terminal-correction and import custody flows retain unlock credentials unless manually cleared.
- [ ] Forward-only Supabase migration is applied to linked project and main is pushed.

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
