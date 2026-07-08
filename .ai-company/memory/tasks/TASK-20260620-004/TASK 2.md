---
schema_version: 1
task_id: "TASK-20260620-004"
title: "L2-024 permission and sensitive action matrix baseline"
status: "closed"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "Integration Lead / CEO Agent"
departments: ["API", "DATA", "DOC", "INT", "QA", "SECURITY"]
created_at: "2026-06-19T22:51:40Z"
updated_at: "2026-06-19T23:00:14Z"
closed_at: "2026-06-19T23:00:14Z"
---
# Task — L2-024 permission and sensitive action matrix baseline

## Owner request

L2-024 permission and sensitive action matrix baseline

## Business value

Create a verified baseline of RepairDesk roles, tenant boundaries, sensitive actions, approval points, and unknown production permission risks without changing authorization logic.

## Scope in

- Local repository evidence scan for authentication, authorization, tenant isolation, platform-admin, staff role, audit, attachment/storage, and sensitive business-action controls.
- Permission matrix report under this task directory.
- Department/project memory updates for verified permission facts, risks, and follow-up tasks.
- Non-destructive validation only.

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] Inventory authentication, role, tenant, staff, and platform-admin code paths from current repository evidence.
- [x] Map sensitive business actions to current verified controls, assumptions, unknowns, and required approval levels.
- [x] Identify P0/P1/P2 permission, tenant, secret, and production-readiness risks with evidence and owners.
- [x] Produce a permission matrix report under .ai-company/memory/tasks/TASK-20260620-004.
- [x] Do not modify business logic, auth logic, database migrations, secrets, or production data.
- [x] Run non-destructive validation: targeted source scans and npm run agents:check.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | task created |
| Role model | verified | `src/lib/repairdesk/types.ts`; `src/server/auth-context.ts` | owner/manager/technician/sales/viewer plus platform admin |
| Store tenant context | verified | `src/server/auth-context.ts`; `src/server/repairdesk-shared.ts`; `src/server/tenant-guard.test.ts` | strict store helper used by real repositories |
| Production permission state | unknown | local repo scan only | requires Owner-approved remote audit |
| Order/customer write role policy | conflict/unknown | router/repository scans | store context exists, but explicit role gates are not verified for many mutations |

## Decision and approval points

- D3 Owner decision required before changing order/customer/payment/message role gates.
- D3 Owner decision required before live Supabase read-only permission audit.
- D4 Owner approval required before production data, RLS/grant, platform-admin, deployment, or service-role changes.

## Work packages

- Evidence gathering and classification.
- Permission matrix report.
- Department/project memory sync.
- Non-destructive validation and closeout.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
