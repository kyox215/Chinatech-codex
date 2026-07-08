---
schema_version: 1
task_id: "TASK-20260704-008-private-store-onboarding"
title: "Private store onboarding and store-side approval"
status: "active"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["Data", "Engineering", "Product", "QA", "Security"]
created_at: "2026-07-04T18:31:59Z"
updated_at: "2026-07-04T18:51:19Z"
---
# Task — Private store onboarding and store-side approval

## Owner request

Private store onboarding and store-side approval

## Business value

Hide existing stores from applicants and route join requests to store owners/managers while preserving tenant isolation.

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

- [ ] Join-store onboarding does not expose available store list and collects target owner email.
- [ ] Store owner/manager can approve or reject access requests for their stores; platform admin can fallback.
- [ ] On approval, requester receives active store membership and can enter the store; unauthorized users cannot read business data.
- [ ] Migration is additive/compatible and existing pending target_store_id requests remain processable.

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
