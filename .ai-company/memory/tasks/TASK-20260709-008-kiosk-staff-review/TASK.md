---
schema_version: 1
task_id: "TASK-20260709-008-kiosk-staff-review"
title: "Kiosk staff review for customer submissions"
status: "closed"
task_class: "T2"
risk_level: "R3"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["API", "DATA", "DOC", "FLOW", "QA", "SEC", "UX"]
created_at: "2026-07-09T00:44:37Z"
updated_at: "2026-07-09T01:16:42Z"
closed_at: "2026-07-09T01:16:42Z"
---

# Task — Kiosk staff review for customer submissions

## Owner request

Kiosk staff review for customer submissions

## Business value

Allow staff to safely review iPad customer submissions before writing customer/order data, preventing customer-entered PII from overwriting records without staff approval.

## Scope in

- Staff review surface under Settings / 客户 iPad for submitted kiosk sessions.
- Staff accept and return actions for submitted kiosk sessions.
- Server-side store/order/customer validation and customer/order contact updates after accept.
- Audit-safe order events for submitted/accepted/returned transitions.
- Mock API, public kiosk source selection, client API, schemas, and focused tests.
- Visual evidence for staff review and iPad returned state.

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.
- New database migration, because existing kiosk schema already supports the needed status and timestamp columns.
- Signature attachment persistence and printed receipt QR pickup-completion flow.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] Submitted kiosk sessions are visible in a staff review surface with customer fields, order/device context, and device/session metadata.
- [x] Staff can accept a submitted session; service layer validates store/order/customer ownership and updates canonical customer/order fields only after approval.
- [x] Staff can return a submitted session for correction with a reason; iPad can show returned state without exposing staff-only data.
- [x] Submitted, accepted, and returned transitions are recorded with order events/audit-safe payloads that do not include full PII or signature data.
- [x] Mock API, client API, schemas, and tests cover accept/return behavior and validation failures.
- [x] Implementation avoids unrelated WIP files, validates with focused tests plus type/lint/build where feasible, updates docs/memory, captures visual evidence, commits, and pushes main.

## Facts, assumptions, and unknowns

| Item                                                            | Type     | Evidence                                                         | Status / next action                                                                                     |
| --------------------------------------------------------------- | -------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Task title and initial metadata                                 | observed | owner request                                                    | verify scope                                                                                             |
| Existing kiosk migration has review-ready states and timestamps | observed | `supabase/migrations/20260709233000_customer_kiosk_ipad_mvp.sql` | no migration added                                                                                       |
| Unrelated inventory task is staged in current checkout          | observed | `git status --short --branch`                                    | isolate final kiosk commit outside current staged index                                                  |
| Documentation sync impact                                       | observed | code/API/UI changed                                              | no standalone user docs updated; task memory and evidence updated as authoritative implementation record |
| Real sub-agent spawning                                         | observed | owner request did not explicitly ask for departments/sub-agents  | no sub-agents spawned; main thread used skill reviews and single-writer implementation                   |

## Decision and approval points

- R3/L2 local implementation approved by Owner request to continue and push main.
- No production data or migration action performed in this task.
- Final push must not include unrelated staged inventory files.

## Work packages

- Intake, evidence gathering, planning, implementation, independent review, memory closeout.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
