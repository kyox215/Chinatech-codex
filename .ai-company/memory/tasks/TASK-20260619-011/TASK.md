---
schema_version: 1
task_id: "TASK-20260619-011"
title: "L2-007 preserve Batch C backlog idea and remove duplicate files"
status: "closed"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "Integration Lead / CEO Agent"
departments: ["DOC", "INT", "OPS", "QA"]
created_at: "2026-06-19T20:23:42Z"
updated_at: "2026-06-19T20:27:32Z"
closed_at: "2026-06-19T20:27:32Z"
---
# Task — L2-007 preserve Batch C backlog idea and remove duplicate files

## Owner request

L2-007 preserve Batch C backlog idea and remove duplicate files

## Business value

Preserve the useful attachment-inventory overflow E2E idea from Batch C while removing the last reviewed Batch C duplicate files from the working tree.

## Scope in

- Create or update formal project backlog memory for the attachment-inventory overflow E2E idea.
- Delete exactly the two reviewed Batch C duplicate files:
  - `scripts/check-agent-rules 2.mjs`
  - `tests/e2e/visual-overflow.spec 2.ts`
- Verify the two deleted paths are gone.
- Run `npm run agents:check`.
- Update task report, evidence, checkpoint, project memory, conflict register, and affected department memories.

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.
- Editing canonical `scripts/check-agent-rules.mjs`.
- Editing canonical `scripts/agents/*` files.
- Editing canonical `tests/e2e/visual-overflow.spec.ts`.
- Implementing the future attachment-inventory E2E scenario now.
- Staging, committing, pushing, deploying, or changing production data.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] A formal backlog entry records the attachment-inventory overflow E2E idea with evidence, owner, trigger, and status.
- [x] Exactly the two Batch C duplicate files are removed: scripts/check-agent-rules 2.mjs and tests/e2e/visual-overflow.spec 2.ts.
- [x] Canonical scripts/check-agent-rules.mjs, scripts/agents/*, tests/e2e/visual-overflow.spec.ts, and business code remain unchanged by this task.
- [x] Post-cleanup path status confirms the two Batch C duplicate paths are gone.
- [x] npm run agents:check passes after memory and cleanup changes.
- [x] Task report, evidence, checkpoint, project memory, conflict register, and affected department memories are updated.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Owner requested continuing the next improvement | observed | chat objective | treated as L2-007 follow-up from `TASK-20260619-010` |
| Batch C review recommends preserving attachment-inventory E2E idea before deletion | verified fact | `TASK-20260619-010/BATCH_C_REVIEW_REPORT.md` | converted to backlog entry |
| `scripts/check-agent-rules 2.mjs` is delete-only | verified fact | `TASK-20260619-010/BATCH_C_REVIEW_REPORT.md` | deleted in this task |
| `tests/e2e/visual-overflow.spec 2.ts` should not be copied directly | verified fact | `TASK-20260619-010/BATCH_C_REVIEW_REPORT.md`; source search evidence | backlog entry created instead |
| Canonical `scripts/agents/check-agent-config.mjs` has pre-existing local modification | observed | preflight and post-cleanup `git status --short -- <canonical paths>` | not touched by this task |
| Active context points to a separate UI audit task | observed | `.ai-company/memory/ACTIVE_CONTEXT.md` and new-task refusal | not closed or modified by this task |

## Decision and approval points

- Risk/autonomy: R1/L2 because this removes only two already-reviewed untracked duplicate files and writes memory/backlog records.
- Decision: create `QA-BACKLOG-20260619-001` before deleting the E2E duplicate, preserving the useful future-test idea.
- Approval boundary: no canonical code/test edits, no production operations, no commit/push/deploy.

## Work packages

- WP-01: Verify Batch C review evidence and current file status.
- WP-02: Create formal backlog entry for the attachment-inventory overflow E2E idea.
- WP-03: Delete exactly the two Batch C duplicate files.
- WP-04: Verify paths are gone and governance checks pass.
- WP-05: Synchronize memory and close.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
