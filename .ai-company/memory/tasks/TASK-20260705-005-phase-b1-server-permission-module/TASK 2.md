---
schema_version: 1
task_id: "TASK-20260705-005-phase-b1-server-permission-module"
title: "Phase B1 server permission module and matrix tests"
status: "closed"
task_class: "T2"
risk_level: "R3"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["API", "Data", "QA", "Security"]
created_at: "2026-07-05T10:41:10Z"
updated_at: "2026-07-05T10:49:28Z"
closed_at: "2026-07-05T10:49:28Z"
---
# Task — Phase B1 server permission module and matrix tests

## Owner request

Phase B1 server permission module and matrix tests

## Business value

Create a server-only role permission contract for independent partner stores so later route/object gates can be implemented safely without changing runtime behavior in this slice.

## Scope in

- Add a server-only permission module for the approved all-A independent partner store role defaults.
- Add matrix tests for role/action coverage and high-risk defaults.
- Keep the implementation isolated to `src/server/permissions.ts` and `src/server/permissions.test.ts`.
- Verify no runtime route/API/UI/database behavior changes are introduced in this slice.

## Scope out

- Wiring route gates into `src/server/api/repairdesk-router.ts`.
- Object-level authorization for orders, customers, inventory, attachments, unlock credentials, or exports.
- UI permission cues or visible product changes.
- Database migrations, RLS/storage policy changes, production preflight, deploy, or release.
- Secret handling, destructive SQL, external communication, or support-access activation.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] Add server-only permission module with explicit role/action matrix, default-deny behavior, and approved all-A defaults.
- [x] Add unit tests covering owner, manager, technician, sales/frontdesk, viewer, unknown/null/system/platform cases, payment/export/support/unlock/member defaults.
- [x] Do not wire route gates, object-level checks, UI cues, database migrations, production preflight, deploy, or runtime behavior changes.
- [x] Run targeted tests plus lint/typecheck or document any skipped broader validation with reason.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verify scope |
| Owner approved all A defaults | observed | `TASK-20260705-004.../EVIDENCE.md` E-008 | implemented as Phase B1 matrix |
| Permission module is server-only | observed | `src/server/permissions.ts` | no client import |
| Runtime code does not import permission module | observed | `rg` over `src/server src/features src/app src/components` | only test imports module |

## Decision and approval points

- Owner approved all A defaults before implementation.
- Runtime route gates, object-level checks, database/RLS/storage changes, production preflight, deploy, and release remain gated follow-up phases.
- R3/L2 boundary respected: code-only contract added, no production or runtime enforcement behavior changed.

## Work packages

1. WP-01 Evidence: inspect current actor/error/test conventions.
2. WP-02 Implement: add `src/server/permissions.ts` and `src/server/permissions.test.ts`.
3. WP-03 Verify: targeted permission tests, lint, typecheck, full test suite, build, import search, diff check.
4. WP-04 Memory/closeout: update evidence, checkpoint, close task.

## Implementation summary

- Added `PermissionAction`, `PermissionEffect`, action metadata, explicit `rolePermissions`, `getPermissionDecision`, `can`, `assertPermission`, role/action guards, and `sales` frontdesk helper.
- Default-deny behavior covers missing actor, missing store context, unknown/stale role, and `systemActor` unless explicit internal context is supplied.
- Approved all-A defaults are represented:
  - Internal `sales` remains the v1 frontdesk role.
  - Frontdesk can collect normal payments but cannot adjust/refund/override.
  - Technician unlock reads are scoped and audit-required.
  - Viewer exports are denied.
  - Support grants and manager-role grants are owner-only.
  - Owner removal/transfer remains elevated rather than automatically allowed.
- Module is currently not wired into routes or UI; this task adds a permission contract and tests only.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
