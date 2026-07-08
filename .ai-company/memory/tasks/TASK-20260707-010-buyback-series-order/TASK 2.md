---
schema_version: 1
task_id: "TASK-20260707-010-buyback-series-order"
title: "Buyback iPhone series row order"
status: "active"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["Frontend", "QA", "UX"]
created_at: "2026-07-07T19:08:43Z"
updated_at: "2026-07-07T19:08:56Z"
---
# Task — Buyback iPhone series row order

## Owner request

Buyback iPhone series row order

## Business value

Buyback quote operators can scan iPhone generations from newest to oldest left-to-right.

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

- [ ] iPhone series cards render row-major from 17/Air to X/8.
- [ ] Series ordering is covered by a unit test.
- [ ] Lint, typecheck, full tests, build, and local browser verification pass.

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
