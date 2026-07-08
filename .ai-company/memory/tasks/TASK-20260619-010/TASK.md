---
schema_version: 1
task_id: "TASK-20260619-010"
title: "L2-006 review Batch C duplicate salvage candidates"
status: "closed"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "Integration Lead / CEO Agent"
departments: ["DOC", "INT", "OPS", "QA"]
created_at: "2026-06-19T20:18:15Z"
updated_at: "2026-06-19T20:21:28Z"
closed_at: "2026-06-19T20:21:28Z"
---
# Task — L2-006 review Batch C duplicate salvage candidates

## Owner request

L2-006 review Batch C duplicate salvage candidates

## Business value

Decide whether the remaining Batch C duplicate files contain useful checks worth salvaging before any deletion, so cleanup does not lose future QA/governance ideas.

## Scope in

- Compare `scripts/check-agent-rules 2.mjs` against `scripts/check-agent-rules.mjs` and current modular agent checks.
- Compare `tests/e2e/visual-overflow.spec 2.ts` against `tests/e2e/visual-overflow.spec.ts` and current UI text/selectors.
- Decide whether each Batch C file should be delete-only, salvage-first, or kept temporarily.
- Run proportional validation for this review-only task.
- Update task report, evidence, checkpoint, and affected memory.

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.
- Deleting, merging, staging, committing, or modifying the Batch C files.
- Editing canonical scripts, Playwright tests, business code, app UI, or test fixtures.
- Starting or relying on a browser/dev server for visual claims.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] Both Batch C files are compared against their canonical counterparts with evidence.
- [x] No Batch C file is deleted, merged, staged, committed, or modified in this review task.
- [x] A clear recommendation is recorded for each file: delete-only, salvage-first, or keep temporarily.
- [x] Post-review status confirms both Batch C files remain present and unrelated dirty worktree changes are untouched.
- [x] Task report, evidence, checkpoint, and affected memories are updated.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Owner said "继续下一步" after L2-005 | observed | chat instruction; `TASK-20260619-009/BATCH_B_CLEANUP_REPORT.md` | treated as next staged Batch C review |
| Batch C contains exactly two backlog/salvage candidates | verified fact | `TASK-20260619-005/DIFFERING_DUPLICATES_REVIEW.md`; `TASK-20260619-009/BATCH_B_CLEANUP_REPORT.md` | reviewed |
| `scripts/check-agent-rules 2.mjs` is a standalone older checker | verified fact | diff against canonical; current modular checker files | recommend delete-only in next cleanup |
| `tests/e2e/visual-overflow.spec 2.ts` swaps records workspace check for attachment inventory check | verified fact | diff against canonical; `rg` for UI text/selectors | recommend salvage-first backlog, not direct merge |
| Both Batch C files remain untracked after review | verified fact | `git status --short -- <Batch C paths>` | untouched |
| Active context pointed to a closed unrelated UX task during intake | observed conflict | `.ai-company/memory/ACTIVE_CONTEXT.md` | recorded as memory drift risk, not resolved here |

## Decision and approval points

- Risk/autonomy: R1/L2 review-only. No business code, tests, or duplicate files are modified.
- `scripts/check-agent-rules 2.mjs`: delete-only candidate; no unique current assertion needs to be salvaged because current modular checks cover the durable pieces and avoid the obsolete `AI智能部门管理/部门化管理设计 2.md` assertion.
- `tests/e2e/visual-overflow.spec 2.ts`: salvage-first backlog candidate; its attachment-inventory dialog idea should be converted into a future explicit E2E work item only if the current UI has or reintroduces that entry point. Direct merge would likely fail because current source search found no `附件库存` button text.
- Approval boundary: deletion or test modification requires a follow-up cleanup/implementation task with an explicit path list.

## Work packages

- WP-01: Restore governance and Batch C context.
- WP-02: Compare checker duplicate against canonical modular checkers.
- WP-03: Compare visual overflow duplicate against canonical E2E and current UI text/selectors.
- WP-04: Run proportional validation and confirm no files were changed.
- WP-05: Write decision report and memory closeout.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
