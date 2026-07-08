---
schema_version: 1
task_id: "TASK-20260619-016"
title: "L2-012 active context drift hygiene"
status: "closed"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "Integration Lead / CEO Agent"
departments: ["INT", "MEM", "QA"]
created_at: "2026-06-19T20:58:09Z"
updated_at: "2026-06-19T21:00:54Z"
closed_at: "2026-06-19T21:00:54Z"
---
# Task — L2-012 active context drift hygiene

## Owner request

L2-012 active context drift hygiene

## Business value

Prevent future continue/resume commands from being routed to an unrelated UI task after the duplicate-cleanup wave, while preserving that UI task as separately resumable.

## Scope in

- Document the observed `ACTIVE_CONTEXT.md` drift to `TASK-20260619-202308-repairdesk-order-detail-and-cross-page-ui`.
- Preserve the old UI audit task and mark it `on_hold`, not `closed`.
- Update the old UI task handoff so it can be deliberately resumed later.
- Update project/memory department/conflict records so future agents treat the old UI task as a separate paused workstream.
- Close this hygiene task so `ACTIVE_CONTEXT.md` returns to idle.

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.
- Closing the old UI task as completed.
- Changing business code, UI code, tests, generated output, production data, dependencies, staging, commits, pushes, or deploys.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] Current ACTIVE_CONTEXT drift is documented with evidence.
- [x] The unrelated UI audit task is preserved but marked as on_hold with a clear resume handoff, not closed as completed.
- [ ] ACTIVE_CONTEXT is cleared to idle after the memory hygiene task closes.
- [x] Project memory, memory department, conflict/risk records, evidence, checkpoints, and handoff are updated.
- [x] npm run agents:check passes after memory updates.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verify scope |
| `ACTIVE_CONTEXT.md` pointed to the old UI audit task before this task was created | observed conflict | EVIDENCE E-002 | resolved by isolating the old task |
| Old UI task has checkpoint/test claims but acceptance criteria were not fully checked in `TASK.md` | verified fact | EVIDENCE E-003/E-004 | do not close as complete in this task |
| `tools/ai_company.py close-task` only idles active context when closing the current active task | verified fact | EVIDENCE E-005 | use this task as current active task, then close it |

## Decision and approval points

- Risk/autonomy: R1/L2 because this changes only task memory and active-context routing.
- Decision: mark the old UI audit task `on_hold` and preserve it for explicit future resume instead of closing or continuing it implicitly.
- Approval boundary: no business code, no generated output, no production action, no staging/commit/push/deploy.

## Work packages

- WP-01: Verify current active-context drift and old UI task state.
- WP-02: Mark old UI task `on_hold` and write a resume handoff.
- WP-03: Update project/memory/conflict records.
- WP-04: Run `npm run agents:check`.
- WP-05: Close this task and verify `ACTIVE_CONTEXT.md` is idle.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
