---
schema_version: 1
task_id: "TASK-20260709-022-permission-projection-phase-d1"
title: "Permission projection Phase D1"
status: "closed"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "Integration Lead"
departments: ["API", "DOC", "INT", "QA", "SEC"]
created_at: "2026-07-09T21:35:38Z"
updated_at: "2026-07-09T21:50:02Z"
closed_at: "2026-07-09T21:50:02Z"
---
# Task — Permission projection Phase D1

## Owner request

Owner asked to set a goal, implement the project stabilization plan, push `main`,
and apply database changes if required. Latest `origin/main` already contained
permission Phase B/C route gates and supplier permission migration, so this task
implemented the first Phase D field-projection slice instead of duplicating
completed work.

## Business value

Prevent restricted roles from receiving sensitive order fields over API, not just hiding buttons in UI.

## Scope in

- Add server-side role projection for first sensitive order list/detail fields.
- Add read permission gates for order list/stats/queue/dashboard/detail API paths.
- Add focused tests for restricted-role redaction and read permission denial.
- Verify whether this task introduced any Supabase migration.

## Scope out

- Object-level scoped order assignment logic for technician/viewer access.
- UI rendering changes for redacted finance labels.
- Supabase schema or data changes.
- Production/external/destructive actions beyond the requested `main` push.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] Order list and order detail responses are projected by store role for first sensitive fields.
- [x] Technician/viewer/frontdesk restrictions are covered by tests.
- [x] No Supabase migration is introduced unless implementation proves a schema need.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Latest `origin/main` already had Phase B/C route gates and supplier permission migration | observed | `docs/ROLE_PERMISSION_CONFIGURATION_PLAN.md`, `src/server/api/repairdesk-router.test.ts`, `src/server/permissions.ts` | task scope moved to Phase D1 |
| This task has no Supabase migration diff | observed | `git diff --name-only -- supabase` returned no files | database apply is no-op |
| Visual evidence | observed | backend/API security change only | no task page screenshot required |

## Decision and approval points

- Finance redaction currently zeroes required numeric API fields and sets
  `finance_redacted`; follow-up UI should render a permission-redacted label
  rather than treating zero as a business amount.
- Scoped technician/viewer order access still requires object-level assignment
  and audit checks before scoped unlock/attachment reads can be enabled.

## Work packages

- Intake, evidence gathering, planning, implementation, independent review, memory closeout.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
