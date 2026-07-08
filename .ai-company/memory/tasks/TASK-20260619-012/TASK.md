---
schema_version: 1
task_id: "TASK-20260619-012"
title: "L2-008 cleanup current byte-identical duplicate files"
status: "closed"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "Integration Lead / CEO Agent"
departments: ["DATA", "DOC", "INT", "OPS", "QA"]
created_at: "2026-06-19T20:29:42Z"
updated_at: "2026-06-19T20:41:07Z"
closed_at: "2026-06-19T20:41:07Z"
---
# Task — L2-008 cleanup current byte-identical duplicate files

## Owner request

L2-008 cleanup current byte-identical duplicate files

## Business value

Remove currently verified byte-identical duplicate files so search, review, migration analysis, and future cleanup are not polluted by redundant shadow copies.

## Scope in

- Recompute current Git-visible untracked ` 2` duplicate files against canonical counterparts using SHA-256.
- Delete only the currently verified byte-identical duplicate files.
- Exclude now-different duplicates from deletion and record them as residual review items.
- Run `npm run agents:check`.
- Update task report, evidence, checkpoint, project memory, conflict register, and affected department memories.

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.
- Deleting or merging any now-different duplicate file.
- Editing canonical counterpart files.
- Editing business logic, tests, migrations, dependencies, production data, deployment config, staging, commits, or pushes.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] Current scan identifies the exact byte-identical duplicate file list and excludes any now-different duplicates.
- [x] Exactly the verified byte-identical duplicate files are removed; differing duplicates are untouched.
- [x] Canonical counterpart files, business code, production data, dependencies, staging, commits, pushes, and deploys are untouched.
- [x] Post-cleanup path status confirms removed duplicate paths are gone and excluded differing paths remain.
- [x] npm run agents:check passes after cleanup and memory updates.
- [x] Cleanup report, evidence, checkpoint, project memory, conflict register, and affected department memories are updated.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Owner requested continuing next improvement | observed | chat objective | treated as L2-008 byte-identical duplicate cleanup |
| Initial L2-001 found 72 byte-identical duplicate files | historical fact | `TASK-20260619-004/DUPLICATE_WORKTREE_INVENTORY.md` | reverified current state before deletion |
| Current scan found 70 byte-identical duplicate files | verified fact | EVIDENCE E-003; `BYTE_IDENTICAL_CLEANUP_REPORT.md` | deleted |
| Final closeout scan found 3 now-different duplicate files | verified fact | EVIDENCE E-007/E-009 | preserved for separate review |
| Canonical counterpart files remain authoritative | verified project rule | `PROJECT_MEMORY.md`; no canonical edit hunks in this task | unchanged by this task |

## Decision and approval points

- Risk/autonomy: R1/L2 because this removes only untracked duplicate files verified byte-identical to existing canonical files.
- Decision: delete the 70 current byte-identical duplicates in one batch.
- Exclusions: preserve `.ai-company/README 2.md`, `src/features/orders/components/warranty-picker 2.tsx`, and `src/server/tenant-guard.test 2.ts` because current SHA-256 comparison shows they differ from canonical files.
- Approval boundary: no canonical file edits, no production action, no commit/push/deploy.

## Work packages

- WP-01: Restore context and recompute current duplicate equality.
- WP-02: Delete only verified byte-identical duplicate files.
- WP-03: Verify byte-identical duplicate count is zero and excluded differing duplicates remain.
- WP-04: Run `npm run agents:check`.
- WP-05: Synchronize reports/memory and close.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
