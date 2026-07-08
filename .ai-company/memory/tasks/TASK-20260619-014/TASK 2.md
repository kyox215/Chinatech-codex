---
schema_version: 1
task_id: "TASK-20260619-014"
title: "L2-010 delete reviewed remaining duplicate files"
status: "closed"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "Integration Lead / CEO Agent"
departments: ["DOC", "OPS", "QA"]
created_at: "2026-06-19T20:46:20Z"
updated_at: "2026-06-19T20:49:39Z"
closed_at: "2026-06-19T20:49:39Z"
---
# Task — L2-010 delete reviewed remaining duplicate files

## Owner request

L2-010 delete reviewed remaining duplicate files

## Business value

Finish the reviewed duplicate cleanup by deleting only the three now-different duplicate files that L2-009 classified as delete-only candidates.

## Scope in

- Fresh path check for the three reviewed duplicate files from `TASK-20260619-013`.
- Delete exactly:
  - `.ai-company/README 2.md`
  - `src/features/orders/components/warranty-picker 2.tsx`
  - `src/server/tenant-guard.test 2.ts`
- Verify Git-visible untracked duplicate scan after deletion.
- Run `npm run agents:check`.
- Update cleanup report, task evidence, checkpoint, memory delta, handoff, project memory, conflict register, and affected department memories.

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.
- Editing canonical counterparts, business code, production data, dependencies, staging, commits, pushes, or deploys.
- Cleaning empty duplicate directories or ignored/generated duplicate-like output.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] A fresh path check confirms the three reviewed duplicate files exist and canonical counterparts exist before deletion.
- [x] Exactly the three reviewed duplicate files are deleted; canonical files, business code, production data, dependencies, staging, commits, pushes, and deploys are untouched.
- [x] Post-cleanup Git-visible duplicate scan reports same=0 and diff=0 for untracked files with canonical counterparts.
- [x] Cleanup report, evidence, checkpoint, memory delta, handoff, project memory, conflict register, and affected department memories are updated.
- [x] npm run agents:check passes after cleanup and memory updates.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verify scope |
| L2-009 classified all three remaining now-different duplicates as delete-only candidates | verified fact | `TASK-20260619-013/REMAINING_DIFFERING_DUPLICATES_REVIEW.md` | used as cleanup approval package |
| Fresh pre-delete path check confirmed all three duplicate/canonical pairs exist | verified fact | EVIDENCE E-003 | safe to delete exact duplicate paths |
| Final duplicate scan reports no Git-visible untracked ` 2` files with canonical counterparts | verified fact | EVIDENCE E-005 | cleanup complete for this class |

## Decision and approval points

- Risk/autonomy: R1/L2 because deletion is limited to three untracked duplicate files that L2-009 classified as delete-only candidates.
- Decision: delete exactly the three reviewed duplicate paths and do not edit canonical files.
- Approval boundary: no production action, no staging/commit/push/deploy, no dependency change.

## Work packages

- WP-01: Create task and confirm review package.
- WP-02: Fresh path check for all three duplicate/canonical pairs.
- WP-03: Delete exactly the three reviewed duplicate files.
- WP-04: Verify duplicate scan and run `npm run agents:check`.
- WP-05: Synchronize report/memory and close.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
