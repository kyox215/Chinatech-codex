---
schema_version: 1
task_id: "TASK-20260721-002-order-deposit-correction-release"
title: "Deploy bounded initial deposit correction"
status: "active"
task_class: "T2"
risk_level: "R3"
autonomy_level: "L2"
owner: "Hexiang Huang"
departments: ["Engineering", "Product", "QA", "Release", "Security"]
created_at: "2026-07-21T12:17:46Z"
updated_at: "2026-07-21T12:17:56Z"
---
# Task — Deploy bounded initial deposit correction

## Owner request

Deploy bounded initial deposit correction

## Business value

Allow sales staff and assigned technicians to correct incorrectly entered initial deposits without granting refund or payment-adjustment powers.

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

- [ ] Sales and assigned technicians can correct eligible initial deposits.
- [ ] Correction is atomic, audited, idempotent, store-scoped, and blocked after approval or payment history.
- [ ] Database migration and application release are verified with rollback guidance.

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
