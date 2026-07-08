---
schema_version: 1
task_id: "TASK-20260619-008"
title: "L2-004 confirm Batch B order workflow duplicate semantics"
status: "closed"
task_class: "T1"
risk_level: "R2"
autonomy_level: "L2"
owner: "Integration Lead / CEO Agent"
departments: ["API", "DATA", "DOC", "FLOW", "INT", "QA"]
created_at: "2026-06-19T19:50:07Z"
updated_at: "2026-06-19T19:56:21Z"
closed_at: "2026-06-19T19:56:21Z"
---
# Task — L2-004 confirm Batch B order workflow duplicate semantics

## Owner request

L2-004 confirm Batch B order workflow duplicate semantics

## Business value

Confirm whether Batch B order workflow and migration duplicate files are stale so the Owner can safely approve or reject their cleanup without losing valid workflow semantics.

## Scope in

- Review the 12 Batch B duplicate files listed in `TASK-20260619-005/DIFFERING_DUPLICATES_REVIEW.md` rows #17-25 and #29-31.
- Confirm current Product/Data semantics for `mail_in_progress`, `repaired`, and `quoted -> parts_ordered`.
- Compare duplicate files against canonical code, tests, mock workflow, server approval targets, and Supabase migration history.
- Produce a deletion approval package for a later cleanup task.

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.
- Deleting, merging, staging, reverting, or editing Batch B/C duplicate files.
- Editing canonical app/business files or canonical migration history.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.
- Treat this as a confirmation/review task only. Cleanup requires a follow-up owner-approved task.

## Acceptance criteria

- [x] All 12 Batch B duplicate files from TASK-20260619-005 rows #17-25 and #29-31 are reviewed against canonical code, tests, and migration history.
- [x] The three conflict decisions are explicitly answered: mail_in_progress stage, repaired stage, and quoted to parts_ordered transition.
- [x] No Batch B/C files are deleted, merged, staged, reverted, or business-code edited in this confirmation task.
- [x] A Product/Data decision report, evidence index, checkpoint, and follow-up cleanup recommendation are recorded.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Owner requested next step after L2-003 cleanup | observed | chat request | treated as L2-004 confirmation task |
| Batch B has 12 files | verified fact | `TASK-20260619-005/DIFFERING_DUPLICATES_REVIEW.md` rows #17-25 and #29-31 | reviewed |
| `mail_in_progress` belongs to repair/external repair in current canonical direction | verified fact | `canonical-order-status.ts`, `order-workflow.ts`, `20260619103000_order_external_repair_workflow.sql`, targeted tests | confirmed |
| `repaired` remains repair until notification/pickup | verified fact | `canonical-order-status.ts`, `order-task-flow.ts`, `20260618172000_repaired_workflow_status_repair.sql`, targeted tests | confirmed |
| `quoted -> parts_ordered` remains valid | verified fact | `20260611164138_order_workflow_statuses.sql`, `src/lib/mock/workflow.ts`, `order.repository.ts`, mock API test | confirmed |
| Older canonical migrations contain superseded intermediate semantics | verified fact | `20260611202504...`, `20260613113000...`, later forward migrations | do not rewrite history in this task |

## Decision and approval points

- Deleting Batch B requires a follow-up Owner-approved cleanup task.
- Production/remote Supabase claims remain out of scope until a remote parity audit is approved.

## Work packages

- WP-01: Verify current Batch B file presence and dirty worktree boundary.
- WP-02: Compare product semantics across canonical code/tests/mock/server.
- WP-03: Compare data semantics across migration history and superseding migrations.
- WP-04: Run targeted order workflow tests and `npm run agents:check`.
- WP-05: Write Product/Data confirmation report and close.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
