---
schema_version: 1
task_id: "TASK-20260708-008-auth-login-investigation"
title: "Investigate Supabase Auth login failure for staff account"
status: "conditional"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["Engineering", "Security", "Support"]
created_at: "2026-07-08T11:53:57Z"
updated_at: "2026-07-08T17:45:22Z"
closed_at: "2026-07-08T17:45:22Z"
---
# Task — Investigate Supabase Auth login failure for staff account

## Owner request

Investigate Supabase Auth login failure for staff account

## Business value

Identify why a staff account on chinatech.in cannot log in without exposing credentials or mutating production auth.

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

- [ ] Confirm whether the email exists in Supabase Auth and whether the failure is auth credentials or business authorization.
- [ ] Check related staff, membership, invitation, and onboarding records using read-only queries.

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
