---
schema_version: 1
task_id: "TASK-20260619-015"
title: "L2-011 duplicate directory and generated-output hygiene"
status: "closed"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "Integration Lead / CEO Agent"
departments: ["DOC", "OPS", "QA"]
created_at: "2026-06-19T20:51:15Z"
updated_at: "2026-06-19T20:55:37Z"
closed_at: "2026-06-19T20:55:37Z"
---
# Task — L2-011 duplicate directory and generated-output hygiene

## Owner request

L2-011 duplicate directory and generated-output hygiene

## Business value

Finish the remaining duplicate hygiene after duplicate files were cleared by inventorying and cleaning empty duplicate directories where safe, while separating generated/ignored output from source-tree facts.

## Scope in

- Inventory current empty duplicate directories outside generated output folders.
- Remove only confirmed empty duplicate directories matching `* 2*`.
- Inventory duplicate-like ignored/generated output under `.next/`, `storybook-static/`, `playwright-report/`, and `test-results/`.
- Do not delete generated/ignored output in this task; classify it separately.
- Run duplicate-file and empty-directory post-cleanup scans.
- Run `npm run agents:check`.
- Update cleanup report, evidence, checkpoint, memory delta, handoff, project memory, conflict register, and affected department memories.

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.
- Deleting source files, canonical directories, generated files, `.next/`, `storybook-static/`, `playwright-report/`, `test-results/`, node_modules, production data, dependencies, staging, commits, pushes, or deploys.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] Current empty duplicate directory inventory is generated with exact paths and evidence.
- [x] Current ignored/generated duplicate-like output inventory is generated with exact paths and classification.
- [x] Only confirmed empty duplicate directories are removed; source files, canonical directories, generated files, business code, production data, dependencies, staging, commits, pushes, and deploys are untouched.
- [x] Post-cleanup scan confirms no empty duplicate directories matching the cleanup rule remain.
- [x] Report, evidence, checkpoint, memory delta, handoff, project memory, conflict register, and affected department memories are updated.
- [x] npm run agents:check passes after cleanup and memory updates.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verify scope |
| L2-010 cleared Git-visible duplicate files | verified fact | `TASK-20260619-014/REVIEWED_DUPLICATES_CLEANUP_REPORT.md` | this task targets remaining directory/generated hygiene only |
| Pre-cleanup empty duplicate directory scan found 14 paths | verified fact | EVIDENCE E-002 | removed |
| Post-cleanup empty duplicate directory scan found 0 paths | verified fact | EVIDENCE E-005 | complete |
| Generated/ignored duplicate-like output count is 56 | verified fact | EVIDENCE E-006 | recorded only; not deleted |

## Decision and approval points

- Risk/autonomy: R1/L2 because cleanup is limited to empty directories after an exact inventory; generated files are inventory-only.
- Decision: remove exactly 14 empty duplicate directories, do not delete generated/ignored duplicate-like output in this task.
- Approval boundary: no source file deletion, no generated output deletion, no production action, no staging/commit/push/deploy.

## Work packages

- WP-01: Create task and define empty-directory/generated-output boundary.
- WP-02: Inventory current empty duplicate directories and generated duplicate-like output.
- WP-03: Remove exactly confirmed empty duplicate directories.
- WP-04: Verify empty-directory and duplicate-file scans.
- WP-05: Synchronize report/memory and close.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
