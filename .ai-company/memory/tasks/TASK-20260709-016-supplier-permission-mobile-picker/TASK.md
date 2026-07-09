---
schema_version: 1
task_id: "TASK-20260709-016-supplier-permission-mobile-picker"
title: "Supplier permission grants and compact mobile order picker"
status: "completed"
task_class: "T2"
risk_level: "R3"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["API", "DATA", "DOC", "FE", "FLOW", "INT", "QA", "SEC", "UX"]
created_at: "2026-07-09T13:24:47Z"
updated_at: "2026-07-09T14:08:58Z"
---
# Task — Supplier permission grants and compact mobile order picker

## Owner request

Supplier permission grants and compact mobile order picker

## Business value

Prevent supplier and purchase-source leakage across staff roles and stores while keeping mobile order cards compact.

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

- [x] Only owner or explicitly granted staff can read supplier lists or order supplier details.
- [x] Only staff with supplier assignment permission can change an order parts supplier.
- [x] Mobile order cards show a compact supplier control without adding a full extra row.
- [x] Schema migration is additive, dry-run verified, applied only after preflight, and recorded in migration history.
- [x] Code gates and relevant UI evidence are collected before push to main.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verify scope |
| Project implementation details | observed | implementation commit `809a8c41` and follow-up `2b655fcc` | completed |
| Migration history drift | observed | `supabase migration list --linked`; 25 old local versions missing on remote before repair | repaired as applied; no include-all |
| Final migration applied | observed | `supabase db push --linked`; `supabase migration list --linked` | `20260709235000` applied |

## Decision and approval points

- Owner requested automatic push and migration application in the same task.
- No real subagents were spawned: available multi-agent tooling requires explicit user request for spawning in this runtime; department review was handled by the main thread.

## Work packages

- Backend permission grants and API/data redaction.
- Settings UI permission assignment and supplier visibility.
- Compact mobile/desktop order supplier controls.
- Supabase migration dry-run, history repair, apply, and verification.
- Main push and closeout memory.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
