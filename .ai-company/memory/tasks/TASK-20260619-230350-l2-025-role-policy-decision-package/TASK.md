---
schema_version: 1
task_id: "TASK-20260619-230350-l2-025-role-policy-decision-package"
title: "L2-025 role policy decision package"
status: "closed"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "Integration Lead / CEO Agent"
departments: ["API", "DATA", "DOC", "FLOW", "INT", "QA", "SECURITY"]
created_at: "2026-06-19T23:03:50Z"
updated_at: "2026-06-19T23:09:27Z"
closed_at: "2026-06-19T23:09:27Z"
---
# Task — L2-025 role policy decision package

## Owner request

L2-025 role policy decision package

## Business value

Create an Owner-ready role/action policy proposal for RepairDesk sensitive store actions before any authorization behavior changes.

## Scope in

- Current-source role/action scan for RepairDesk store roles and platform-admin boundaries.
- Owner-ready role policy decision package for sensitive store actions.
- Conservative recommended policy plus alternatives.
- Follow-up implementation and test task breakdown.
- Governance/memory updates only.

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.
- Business logic, auth logic, database migrations, Supabase remote access, secret handling, production data, deploys, staging, commits, or pushes.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] Produce an Owner decision package mapping viewer, sales, technician, manager, owner, and platform admin to sensitive actions.
- [x] Use TASK-20260620-004 as evidence and separate verified facts, assumptions, conflicts, unknowns, recommendations, and approval points.
- [x] Recommend a conservative default policy and alternatives without modifying business logic, auth logic, database migrations, secrets, or production data.
- [x] Identify follow-up implementation/test tasks that are safe for L2 only after Owner approval.
- [x] Run non-destructive validation: targeted source/policy scans and npm run agents:check.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | task created |
| Previous permission baseline | verified | `TASK-20260620-004/PERMISSION_MATRIX_BASELINE.md` | use as source baseline |
| Current role set | verified | `src/lib/repairdesk/types.ts`; `src/server/api/repairdesk-schemas.ts`; role-label screens | owner/manager/technician/sales/viewer plus platform admin |
| Current write gates | verified | router/repository scans | inventory, settings/templates, workflow, member invite, platform onboarding have explicit gates |
| Order/customer mutation role policy | unresolved | current source scan and TASK-20260620-004 | requires Owner decision before implementation |

## Decision and approval points

- Owner approval required before implementing any permission behavior change.
- D3 approval required before live Supabase permission audit or service-role/script use.
- D4 approval required before production data, RLS/grant, platform-admin, deployment, or destructive actions.

## Work packages

- Intake and risk classification.
- Source/policy evidence scan.
- Role policy decision package.
- Department/project memory sync.
- Non-destructive validation and closeout.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
