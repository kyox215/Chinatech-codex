---
schema_version: 1
task_id: "TASK-20260704-002-order-mobile-card-density"
title: "Improve order mobile card density"
status: "closed"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["FE", "QA", "UX"]
created_at: "2026-07-04T10:21:17Z"
updated_at: "2026-07-04T12:48:03Z"
closed_at: "2026-07-04T10:47:22Z"
---
# Task — Improve order mobile card density

## Owner request

Improve order mobile card density

## Business value

Mobile order list shows clearer hierarchy with less wasted card whitespace for faster repair queue scanning.

## Scope in

- Mobile order list card layout in `src/features/orders/components/order-list-items.tsx`.
- Mobile visual evidence for 393px viewport.

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] Mobile order cards group customer/payment, device/repair, and workflow summary into compact layers.
- [x] 393px mobile viewport has no horizontal overflow.
- [x] Targeted lint, typecheck, and workflow tests pass.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verify scope |
| Project implementation details | observed | `src/features/orders/components/order-list-items.tsx` | verified |
| 393px viewport overflow | observed | Playwright screenshot and `scrollWidth=393 innerWidth=393` | verified |

## Decision and approval points

- None registered yet. Run `$risk-autonomy-classify`.

## Work packages

- Intake, evidence gathering, planning, implementation, independent review, memory closeout.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
