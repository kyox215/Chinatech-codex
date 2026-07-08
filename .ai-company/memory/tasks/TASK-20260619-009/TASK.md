---
schema_version: 1
task_id: "TASK-20260619-009"
title: "L2-005 cleanup confirmed Batch B duplicate files"
status: "closed"
task_class: "T1"
risk_level: "R2"
autonomy_level: "L2"
owner: "Integration Lead / CEO Agent"
departments: ["DATA", "DOC", "FLOW", "INT", "OPS", "QA"]
created_at: "2026-06-19T20:08:58Z"
updated_at: "2026-06-19T20:14:01Z"
closed_at: "2026-06-19T20:14:01Z"
---
# Task — L2-005 cleanup confirmed Batch B duplicate files

## Owner request

L2-005 cleanup confirmed Batch B duplicate files

## Business value

Remove confirmed stale order workflow duplicate files so future search, review, migration analysis, and cleanup are not confused by old order semantics.

## Scope in

- Delete exactly the 12 Batch B duplicate ` 2` files confirmed stale by `TASK-20260619-008`.
- Verify the deleted paths are gone from Git path status.
- Verify the two Batch C backlog/salvage files remain present and untracked.
- Run `npm run agents:check`.
- Run targeted order workflow tests from `TASK-20260619-008`.
- Update task evidence, cleanup report, checkpoints, project memory, conflict register, and affected department memories.

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.
- Editing canonical non-` 2` app/business files.
- Editing canonical migration history or adding new migrations.
- Cleaning Batch C files or any other remaining duplicate-like files.
- Staging, committing, pushing, deploying, or touching production data.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] Exactly the 12 Batch B duplicate files confirmed in TASK-20260619-008 are removed.
- [x] Batch C backlog files, canonical non-2 files, canonical migration history, production data, dependencies, and unrelated dirty worktree changes are untouched.
- [x] Post-cleanup status confirms the 12 paths are gone and Batch C protected files remain.
- [x] npm run agents:check and targeted order workflow tests pass after cleanup.
- [x] Cleanup report, evidence, checkpoint, and memory are updated.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Owner said "继续下一步" after Batch B semantic confirmation | observed | chat instruction; `TASK-20260619-008/BATCH_B_SEMANTIC_CONFIRMATION.md` cleanup package | treated as Owner approval for this narrow cleanup only |
| Batch B contains 12 stale duplicate files | verified fact | `TASK-20260619-008/BATCH_B_SEMANTIC_CONFIRMATION.md` file-level confirmation | removed in this task |
| Batch C contains two backlog/salvage candidates | verified fact | pre/post cleanup Git status and file presence checks | intentionally untouched |
| Target files were untracked duplicate files before deletion | verified fact | EVIDENCE E-004 | deleted with `apply_patch` only |
| Canonical order workflow semantics remain unchanged | verified fact | no canonical files edited; targeted tests passed | preserve |
| Earlier active task `TASK-20260619-200747-repairdesk-project-health-check-and-fix-ca` remains a separate memory record | observed conflict | task tool refused new task without `--allow-parallel`; task file remains active | not closed or modified in this cleanup |

## Decision and approval points

- Decision: delete Batch B duplicates only, based on Owner "continue next step" and the `TASK-20260619-008` approval package.
- Approval boundary: no production data, canonical migration rewrite, Batch C cleanup, commit, push, deploy, or destructive shell command.
- Risk/autonomy: R2/L2 because this removes local stale untracked duplicate files after domain confirmation; it remains bounded by exact path list and post-deletion tests.

## Work packages

- WP-01: Confirm Batch B approval package and active task boundary.
- WP-02: Capture pre-delete status for the 12 target files and two Batch C protected files.
- WP-03: Delete exactly the 12 target duplicate files using `apply_patch`.
- WP-04: Verify target paths are gone and Batch C remains.
- WP-05: Run `npm run agents:check` and targeted order workflow tests.
- WP-06: Synchronize task memory, project memory, conflict register, department memories, and close.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
