---
schema_version: 1
task_id: "TASK-20260619-202308-repairdesk-order-detail-and-cross-page-ui"
title: "RepairDesk order detail and cross-page UI flow audit"
status: "on_hold"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "Integration Lead / CEO Agent"
departments: ["FE", "FLOW", "INT", "QA", "UX"]
created_at: "2026-06-19T20:23:08Z"
updated_at: "2026-06-19T20:58:17Z"
---
# Task — RepairDesk order detail and cross-page UI flow audit

## Owner request

RepairDesk order detail and cross-page UI flow audit

## Business value

Reduce confusion in desktop and mobile repair workflows by auditing UI consistency, edit affordances, and operation flows, then fixing the highest-impact order detail issues first.

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

- [ ] Sub-agents complete read-only audits for UI consistency, workflow logic, and desktop/mobile QA coverage.
- [ ] Known order-detail issues are fixed: main phone alignment, backup phone edit path, quote/deposit edit affordance, and visual clutter.
- [ ] Desktop and mobile verification evidence covers /orders and order detail edit flows.

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
