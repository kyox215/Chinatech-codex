---
schema_version: 1
task_id: "TASK-20260620-002"
title: "L2-022 classify remaining legacy src/routes cleanup"
status: "closed"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "Integration Lead / CEO Agent"
departments: ["ARCH", "DOC", "FE", "INT", "QA"]
created_at: "2026-06-19T22:36:28Z"
updated_at: "2026-06-19T22:42:42Z"
closed_at: "2026-06-19T22:42:42Z"
---
# Task — L2-022 classify remaining legacy src/routes cleanup

## Owner request

L2-022 classify remaining legacy src/routes cleanup

## Business value

Prepare safe removal of remaining legacy src/routes files after active @/routes dependencies were eliminated, without deleting files before evidence and owner approval.

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

- [x] Inventory every current file under src/routes with size, exports, imports, and likely replacement owner.
- [x] Verify active source has no @/routes imports and no direct imports of src/routes files.
- [x] Classify each src/routes file as delete-ready, keep-for-now, or needs-owner-decision with evidence.
- [x] Do not delete src/routes files in this classification task.
- [x] Create a cleanup approval package and task evidence under .ai-company/memory/tasks/TASK-20260620-002.
- [x] Run non-destructive validation appropriate to classification: route import scans and agents:check.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Six legacy route files remain under `src/routes/` | verified fact | `EVIDENCE.md` E-003, E-004 | classified |
| Active source outside `src/routes` has no `@/routes` or direct `src/routes` imports | verified fact | `EVIDENCE.md` E-006, E-015 | preserve this invariant |
| All six current `src/routes/*` files are delete-ready after Owner approval and post-deletion validation | proposed decision | `LEGACY_ROUTES_CLASSIFICATION_REPORT.md` | await Owner approval before deletion |
| Deletion was not performed in this task | verified fact | git/source state and task constraint | create separate cleanup task if approved |

## Decision and approval points

- Owner approval is required before deleting `src/routes/*` or changing cleanup from classification to implementation.

## Work packages

- Context recovery and task intake.
- Read-only source and reference scan.
- Classification report and approval package.
- Non-destructive validation and memory sync.

## Definition of done

- Acceptance criteria have evidence in `EVIDENCE.md`.
- `LEGACY_ROUTES_CLASSIFICATION_REPORT.md` lists per-file classification and approval request.
- Route reference scan and `npm run agents:check` are recorded.
- Documentation and formal memory are synchronized.
- Residual deletion risk is tracked in `BACKLOG.md` and `OPEN_CONFLICTS.md`.
