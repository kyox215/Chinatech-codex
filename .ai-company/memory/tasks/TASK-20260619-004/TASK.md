---
schema_version: 1
task_id: "TASK-20260619-004"
title: "L2-001 duplicate files and dirty worktree inventory"
status: "closed"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "Integration Lead / CEO Agent"
departments: ["DOC", "INT", "OPS", "QA"]
created_at: "2026-06-19T13:22:40Z"
updated_at: "2026-06-19T13:28:29Z"
closed_at: "2026-06-19T13:28:29Z"
---
# Task — L2-001 duplicate files and dirty worktree inventory

## Owner request

L2-001 duplicate files and dirty worktree inventory

## Business value

Create a non-destructive inventory of duplicate files and dirty worktree state so the owner can decide what to keep, remove, or review before further business-code work.

## Scope in

- Non-destructive inventory of duplicate-like ` 2` files/directories.
- Dirty worktree summary from Git status, diff names, and diff stat.
- Classification into safe-after-owner-confirmation, review-before-decision, ignored/generated, and do-not-touch-this-task.
- Task memory, evidence, checkpoint, and handoff updates.

## Scope out

- Deleting files or directories.
- Staging, committing, reverting, or formatting files.
- Editing business code.
- Deciding whether different duplicate files should be merged.
- Production/external/destructive actions unless explicitly approved.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] All current * 2.* duplicate files are listed with likely canonical counterpart and recommendation category.
- [x] Current git dirty worktree is summarized without staging, reverting, deleting, or editing business code.
- [x] The report separates safe cleanup candidates, requires-owner-confirmation candidates, unrelated tracked modifications, assumptions, and unknowns.
- [x] Evidence index and checkpoint are updated for the inventory task.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request; `TASK.md` | complete |
| Duplicate-like paths found | observed | `DUPLICATE_WORKTREE_INVENTORY.md` | complete |
| Git-visible duplicate files | observed | read-only duplicate classifier | 104 files |
| Git-visible identical duplicate files | observed | SHA-256 comparison | 72 files; cleanup candidate after owner confirmation |
| Git-visible different duplicate files | observed | SHA-256 comparison | 32 files; review before decision |
| Git-visible empty duplicate dirs | observed | directory scan | 14 dirs; cleanup candidate after owner confirmation |
| Ignored generated duplicate-like paths | observed | `git check-ignore` | 11 Storybook paths |
| Tracked modified files | observed | `git diff --name-status`; `git diff --stat` | 12 files; do not touch in this task |

## Decision and approval points

- Risk: R1 inventory-only task.
- Autonomy: L2 controlled execution.
- Owner approval required before any deletion, staging, revert, or merge of differing duplicate files.

## Work packages

- Intake, risk classification, read-only duplicate scan, dirty-worktree scan, report writing, memory closeout.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
