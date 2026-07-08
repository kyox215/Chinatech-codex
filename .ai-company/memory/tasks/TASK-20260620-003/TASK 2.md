---
schema_version: 1
task_id: "TASK-20260620-003"
title: "L2-023 legacy src/routes deletion preflight contract"
status: "closed"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "Integration Lead / CEO Agent"
departments: ["ARCH", "DOC", "FE", "INT", "QA"]
created_at: "2026-06-19T22:45:00Z"
updated_at: "2026-06-19T22:49:53Z"
closed_at: "2026-06-19T22:49:53Z"
---
# Task — L2-023 legacy src/routes deletion preflight contract

## Owner request

L2-023 legacy src/routes deletion preflight contract

## Business value

Prepare an executable, approval-gated cleanup contract for removing classified legacy src/routes files without performing deletion before Owner approval.

## Scope in

- To be refined by `$company-task-intake`.

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] Confirm TASK-20260620-002 classification is still current against the worktree.
- [x] Produce a deletion preflight contract with exact file scope, approval boundary, work packages, rollback, and stop conditions.
- [x] Map every post-approval deletion step to validation evidence, including knip.json cleanup if src/routes is removed.
- [x] Run non-destructive baseline validation: legacy route reference scan, src/routes existence/hash capture, agents:check, and at least lint/typecheck unless blocked by unrelated workspace failure.
- [x] Do not delete or edit src/routes files in this task.
- [x] Update task memory, backlog, and relevant department memory with the preflight result.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| `TASK-20260620-002` classification remains current | verified fact | `EVIDENCE.md` E-003 through E-007 | preserved |
| Six legacy `src/routes/*` files still exist and were not edited/deleted | verified fact | `EVIDENCE.md` E-004, E-006, E-016 | await approval |
| Active source outside `src/routes` has no legacy route references | verified fact | `EVIDENCE.md` E-007, E-015 | preserve invariant |
| `knip.json` still contains a stale future-cleanup ignore entry | verified fact | `EVIDENCE.md` E-008, E-014 | remove only after deletion approval and directory removal |
| Pre-deletion baseline gates are green | verified fact | `EVIDENCE.md` E-011 through E-014 | use as baseline for future deletion |
| Memory and architecture docs are synchronized to the preflight state | verified fact | `EVIDENCE.md` E-017, E-018 | close task |

## Decision and approval points

- Owner approval is required before deleting `src/routes/*`, editing `knip.json` for cleanup, staging, committing, pushing, or deploying.

## Work packages

- Context and classification recovery.
- Fresh source/tooling baseline scan.
- Approval-gated deletion preflight contract.
- Non-destructive baseline validation.
- Memory synchronization and closeout.

## Definition of done

- Acceptance criteria have evidence in `EVIDENCE.md`.
- `LEGACY_ROUTES_DELETION_PREFLIGHT_CONTRACT.md` defines exact deletion scope, rollback, stop conditions, and validation matrix.
- `src/routes/*` files remain untouched.
- Baseline validation is recorded.
- Formal memory is synchronized and the deletion approval point remains explicit.
