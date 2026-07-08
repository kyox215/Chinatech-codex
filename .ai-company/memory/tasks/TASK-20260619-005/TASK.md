---
schema_version: 1
task_id: "TASK-20260619-005"
title: "Review differing duplicate files before cleanup decision"
status: "conditional"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "Integration Lead / CEO Agent"
departments: ["API", "DATA", "DOC", "FE", "INT", "OPS", "QA"]
created_at: "2026-06-19T19:01:54Z"
updated_at: "2026-06-19T19:15:30Z"
closed_at: "2026-06-19T19:15:30Z"
---
# Task — Review differing duplicate files before cleanup decision

## Owner request

Review differing duplicate files before cleanup decision.

## Business value

Review the 32 duplicate files that differ from canonical counterparts so the owner can decide whether each file can be removed, requires salvage, or needs deeper human review before cleanup.

## Scope in

- Compare the 32 Git-visible duplicate files from `TASK-20260619-004` whose contents differ from canonical counterparts.
- Classify each duplicate by domain, diff size, and cleanup recommendation.
- Record semantic conflicts and backlog/salvage candidates before any cleanup decision.
- Update task memory, evidence, and checkpoint artifacts only.

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.
- Deleting, merging, staging, reverting, or editing duplicate/business-code files.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] All 32 differing duplicate files are compared against canonical counterparts with diff size and domain classification.
- [x] Each differing duplicate receives a recommendation: remove after confirmation, salvage candidate, or defer to owner/domain review.
- [x] No files are deleted, staged, reverted, merged, or business-code edited.
- [x] Evidence index and checkpoint are updated for this review task.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Owner requested next step after L2-001 inventory | observed | chat request and `TASK-20260619-004/DUPLICATE_WORKTREE_INVENTORY.md` | done |
| 32 duplicate files differ from canonical counterparts | verified fact | `TASK-20260619-004/DUPLICATE_WORKTREE_INVENTORY.md` and `git diff --no-index` review | done |
| Canonical non-` 2` files remain authoritative until Owner cleanup approval | verified project rule | `OPEN_CONFLICTS.md` CONFLICT-20260619-005 | active rule |
| Order workflow duplicates contain semantic conflicts | verified fact | `DIFFERING_DUPLICATES_REVIEW.md` | needs Owner/domain confirmation before deletion |
| No duplicate/business-code files were modified during this task | verified fact | edit boundary and `git status --short` before memory update | re-check at closeout |
| `npm run agents:check` passed | verified fact | command output | done |
| Full `tools/ai_company.py validate` did not complete | verified fact | interrupted stack trace showed `root.rglob("*.md")` traversal before skip filtering | record as validation/tooling limitation |

## Decision and approval points

- Owner approval is required before deleting duplicate files.
- Domain/Data confirmation is required before deleting order workflow/status migration duplicates with semantic conflicts.

## Work packages

- Compare all 32 differing duplicate files.
- Produce decision package with remove/domain-confirm/backlog recommendations.
- Update task memory, evidence, checkpoint, and project conflict memory.
- Run AI Company OS validation after memory edits.
- Close conditionally if full validation remains blocked by validator traversal performance.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
