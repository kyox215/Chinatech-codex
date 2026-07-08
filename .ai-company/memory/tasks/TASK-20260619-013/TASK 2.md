---
schema_version: 1
task_id: "TASK-20260619-013"
title: "L2-009 review remaining now-different duplicate files"
status: "closed"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "Integration Lead / CEO Agent"
departments: ["DOC", "OPS", "QA"]
created_at: "2026-06-19T20:42:05Z"
updated_at: "2026-06-19T20:45:43Z"
closed_at: "2026-06-19T20:45:43Z"
---
# Task — L2-009 review remaining now-different duplicate files

## Owner request

L2-009 review remaining now-different duplicate files

## Business value

Classify remaining now-different duplicate files before any deletion or merge so cleanup is evidence-based and reversible.

## Scope in

- Compare `.ai-company/README 2.md` against `.ai-company/README.md`.
- Compare `src/features/orders/components/warranty-picker 2.tsx` against `src/features/orders/components/warranty-picker.tsx`.
- Compare `src/server/tenant-guard.test 2.ts` against `src/server/tenant-guard.test.ts`.
- Classify each remaining now-different duplicate as delete-only, merge-needed, preserve/backlog, or blocked.
- Write a review report, evidence, checkpoint, memory delta, and handoff.

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.
- Deleting, merging, renaming, staging, committing, pushing, or deploying any file.
- Editing canonical counterpart files or business logic.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] All three remaining now-different duplicate files are compared against canonical counterparts and classified with evidence.
- [x] No duplicate file, canonical file, business logic, production data, dependency, staging, commit, push, or deploy is changed.
- [x] A review report, evidence index, checkpoint, memory delta, and handoff are updated.
- [x] npm run agents:check passes after memory/report updates.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verify scope |
| L2-008 final scan found 3 now-different duplicates | verified fact | `TASK-20260619-012/EVIDENCE.md` E-009 | review in this task |
| `.ai-company/README 2.md` is generic v2 README content | verified fact | EVIDENCE E-002/E-003 | delete-only candidate |
| `warranty-picker 2.tsx` lacks canonical quiet appearance support | verified fact | EVIDENCE E-004/E-005 | delete-only candidate |
| `tenant-guard.test 2.ts` lacks canonical attachment storage tests | verified fact | EVIDENCE E-006/E-007 | delete-only candidate |

## Decision and approval points

- Risk/autonomy: R1/L2 because this is review/report-only and changes no business code or duplicate files.
- Decision: classify all three remaining now-different duplicates as delete-only candidates for a later explicit cleanup task.
- Approval boundary: do not delete these files inside L2-009.

## Work packages

- WP-01: Create task and define review-only scope.
- WP-02: Compare the three duplicate/canonical file pairs.
- WP-03: Search for usage/reference evidence to decide merge vs delete-only.
- WP-04: Write review report and memory updates.
- WP-05: Run `npm run agents:check` and close.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
