---
schema_version: 1
department: memory
status: active
owner: Memory Department / Integration Lead
last_verified_at: 2026-06-19
review_trigger: relevant-task-or-quarterly-review
---

# Knowledge & Memory Department Memory

## Mission and boundary

Context packets, checkpoints, consolidation, conflict handling, retention, and memory audits.

This department advises and maintains its own standards. It does not obtain
legal, financial, production, or organization authority merely by being named
as owner of this file.

## Current objectives and work in progress

- Maintain task directories, evidence index, checkpoints, project memory, conflict register, and capability evidence.
- First priority: keep facts, assumptions, conflicts, unknowns, and recommendations separated.

## Verified rules and conventions

- Do not store secrets, full customer PII, hidden reasoning, or production credentials in memory.
- Every non-micro task should maintain enough evidence for future recovery under `.ai-company/memory/tasks/`.
- External memory facts must be verified or labeled as memory-derived/stale when used.
- When a new scoped cleanup task uses `--allow-parallel` because an older active task record exists, record the older task as separate residual memory work rather than closing it implicitly.
- `.ai-company/memory/BACKLOG.md` stores proposed future work that is not yet implemented; do not treat backlog entries as shipped behavior.
- `TASK-20260619-012` is the authority for the current byte-identical duplicate cleanup: 70 files deleted, 0 byte-identical Git-visible duplicate files remain, and three now-different duplicates remain for separate review.
- `TASK-20260619-013` is the authority for classifying those three now-different duplicates; all three are delete-only candidates, not merge sources.
- `TASK-20260619-014` is the authority for deleting those three reviewed duplicates and closing the Git-visible untracked duplicate-file cleanup wave.
- `TASK-20260619-015` is the authority for closing empty duplicate directory cleanup and for classifying remaining duplicate-like paths as generated/ignored output.
- `TASK-20260619-016` is the authority for active-context drift hygiene: the old order-detail UI audit task is `on_hold` and should only be resumed deliberately.
- `TASK-20260619-017` is the authority for task-status registry hygiene: after normalization, no standard `TASK.md` frontmatter should use `status: "complete"`; use `closed`, `conditional`, or `on_hold` as current non-active status vocabulary.
- Conditional and on-hold task records are valid memory states, not dirt to auto-close. Each must carry a reason and a next action.

## Interfaces and dependencies

| Provides / consumes | Counterparty | Contract | Failure handling | Evidence | Status |
|---|---|---|---|---|---|
| TBD | TBD | TBD | TBD | — | unknown |

## SOPs and checklists

- Relevant Skills under `.agents/skills/` are candidate procedures.
- Project-specific commands and paths require verification before promotion.

## Risks, debt, and open questions

| ID | Risk/debt/question | Impact | Owner | Target/review | Status |
|---|---|---|---|---|---|
| MEM-20260619-001 | Stale active-task references can confuse future resumption | Wrong task continuation | Memory | checkpoint/update review | mitigated by TASK-20260619-016 and TASK-20260619-017; monitor |
| MEM-20260619-002 | `TASK-20260619-200747-repairdesk-project-health-check-and-fix-ca` used legacy `complete` metadata and could be mistaken for active work | Future resume could choose wrong task | Memory + Integration Lead | normalized by TASK-20260619-017; monitor |
| MEM-20260619-003 | `ACTIVE_CONTEXT.md` pointed to unrelated UX/UI task records during duplicate cleanup | Future "continue" requests can resume a wrong thread | Memory + Integration Lead | mitigated by TASK-20260619-016; monitor for recurrence | mitigated |
| MEM-20260619-004 | `ACTIVE_CONTEXT.md` pointed to a separate UI audit task while duplicate cleanup ran in parallel | Future cleanup and UI work can be conflated | Memory + Integration Lead | UI task marked `on_hold` by TASK-20260619-016; resume deliberately only | mitigated |
| MEM-20260619-005 | Duplicate-cleanup evidence spans several sequential tasks | Future agents may use stale counts if they read only L2-001 | Memory + QA | use TASK-20260619-014 for duplicate-file cleanup and TASK-20260619-015 for empty-dir/generated-output state | monitoring |

## Lessons and anti-patterns

- Do not infer project facts from the generic AI Company OS template.
- Promote repeated evidence, not stylistic preference, into durable standards.

## Capability and tool notes

| Agent/Skill | Current evidence | Capability | Permission | Limitation |
|---|---|---|---|---|
| TBD | none | C0/C1 | task-specific | not evaluated |

## Memory change log

| Date | Change | Source/task | Author/reviewer | Status |
|---|---|---|---|---|
| 2026-06-19 | Initial RepairDesk memory baseline synchronized | TASK-20260619-003 | Integration Lead | active |
| 2026-06-19 | Recorded L2-005 parallel-task boundary and cleanup evidence | TASK-20260619-009 | Integration Lead | active |
| 2026-06-19 | Recorded L2-006 active-context drift and Batch C review evidence | TASK-20260619-010 | Integration Lead | active |
| 2026-06-19 | Added formal backlog memory and recorded L2-007 parallel cleanup boundary | TASK-20260619-011 | Integration Lead | active |
| 2026-06-19 | Recorded L2-008 as latest authority for byte-identical duplicate cleanup | TASK-20260619-012 | Integration Lead | active |
| 2026-06-19 | Recorded L2-009 as classification authority for the three remaining now-different duplicates | TASK-20260619-013 | Integration Lead | active |
| 2026-06-19 | Recorded L2-010 as final authority for Git-visible duplicate-file cleanup | TASK-20260619-014 | Integration Lead | active |
| 2026-06-19 | Recorded L2-011 as final authority for empty duplicate directory cleanup and generated-output inventory | TASK-20260619-015 | Integration Lead | active |
| 2026-06-19 | Marked old UI audit task on_hold and isolated it from automatic active-context resume | TASK-20260619-016 | Integration Lead | active |
| 2026-06-19 | Normalized task-status registry and recorded current status vocabulary | TASK-20260619-017 | Integration Lead | active |
