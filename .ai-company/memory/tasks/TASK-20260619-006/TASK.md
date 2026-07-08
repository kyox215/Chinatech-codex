---
schema_version: 1
task_id: "TASK-20260619-006"
title: "L2-003 cleanup approved Batch A duplicate files"
status: "closed"
task_class: "T1"
risk_level: "R2"
autonomy_level: "L2"
owner: "Integration Lead / CEO Agent"
departments: ["DATA", "DOC", "FE", "INT", "OPS", "QA"]
created_at: "2026-06-19T19:30:25Z"
updated_at: "2026-06-19T19:36:15Z"
closed_at: "2026-06-19T19:36:15Z"
---
# Task — L2-003 cleanup approved Batch A duplicate files

## Owner request

L2-003 cleanup approved Batch A duplicate files

## Business value

Remove owner-approved stale duplicate files so search, review, and future implementation are not confused by obsolete shadow files.

## Scope in

- Remove only the explicit Batch A duplicate files listed in `TASK-20260619-005/DIFFERING_DUPLICATES_REVIEW.md` rows #1-7, #9-16, and #26-28.
- Treat the explicit file list as authoritative. The previous summary count of "20" was an arithmetic error; the listed Batch A rows contain 18 files.
- Synchronize governance validation if it still requires a deleted deprecated duplicate file.
- Verify protected Batch B/C examples still exist after cleanup.
- Update task evidence, checkpoint, handoff, and project memory.

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.
- Batch B semantic-conflict duplicates, Batch C backlog/salvage candidates, canonical app/business files, tracked user edits outside this task, production data, dependencies, and business logic.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.
- Do not delete files to satisfy the mistaken "20" count; delete only the 18 explicitly listed Batch A duplicate paths.
- If a governance checker still requires a deleted duplicate, update only that checker assertion and document it.

## Acceptance criteria

- [x] Exactly the Batch A files from TASK-20260619-005 are removed: report rows #1-7, #9-16, and #26-28.
- [x] No Batch B semantic-conflict duplicates, Batch C backlog candidates, canonical app/business files, unrelated tracked user edits, production data, dependencies, or business logic are modified.
- [x] Governance checker no longer requires the deleted deprecated duplicate and `npm run agents:check` passes.
- [x] Post-cleanup status confirms the 18 explicitly approved files are gone and protected Batch B/C files still exist.
- [x] Task evidence, checkpoint, and project memory record the deletion scope and validation results.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Owner said "继续下一步" after L2-003 recommendation | observed | chat request | treated as approval for Batch A only |
| Batch A row list contains 18 files, not 20 | verified fact | `TASK-20260619-005/DIFFERING_DUPLICATES_REVIEW.md` rows #1-7, #9-16, #26-28 | corrected in this task |
| Approved Batch A files are untracked duplicates before deletion | verified fact | `git status --short -- <18 Batch A paths>` | all showed `??` |
| Batch B/C examples still exist before deletion | verified fact | `git status --short -- <protected examples>` | all showed `??`; do not touch |
| Governance checker required a deleted deprecated duplicate | verified fact | first `npm run agents:check` after deletion | failed on `AI智能部门管理/部门化管理设计 2.md`; checker assertion updated |
| Duplicate-like files remain after Batch A cleanup | verified fact | `git ls-files -o --exclude-standard` filtered by basename ending ` 2.*` | 87 remain for later approved batches/tasks |

## Decision and approval points

- Owner approval recorded by "继续下一步" applies only to Batch A from the prior decision package.
- Batch B and Batch C still require separate confirmation/tasks.

## Work packages

- WP-01: Verify Batch A file list and protected examples.
- WP-02: Remove only the 18 approved duplicate files.
- WP-03: Sync governance checker assertion exposed by cleanup.
- WP-04: Verify deletion scope and run `npm run agents:check`.
- WP-05: Update evidence/checkpoint/memory and close.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
