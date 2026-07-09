---
schema_version: 1
task_id: "TASK-20260709-016-kiosk-pickup-signature"
title: "Kiosk pickup signature evidence"
status: "closed"
task_class: "T2"
risk_level: "R3"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["API", "DATA", "DOC", "FLOW", "QA", "SEC", "UX"]
created_at: "2026-07-09T13:15:32Z"
updated_at: "2026-07-09T13:38:13Z"
closed_at: "2026-07-09T13:38:13Z"
---
# Task — Kiosk pickup signature evidence

## Owner request

Kiosk pickup signature evidence

## Business value

Persist iPad pickup/customer signatures as order evidence and safely apply the minimum required database state.

## Scope in

- Server-side persistence for accepted kiosk signature submissions into private order attachments.
- Compatibility marker update on `repair_orders.customer_signature` without storing raw base64 there.
- Accepted kiosk session payload cleanup so raw `signature_data_url` is not retained after staff accept.
- Mock API parity and regression test coverage for accepted iPad signature evidence.
- Order detail signature evidence display and screenshot validation.
- Supabase linked migration/dry-run preflight and task-specific remote schema verification.

## Scope out

- Any work not required by the acceptance criteria.
- Broad `supabase db push --include-all` over historical migrations.
- New pickup-specific database columns, data backfill, or destructive schema changes.
- Production deployment or external customer communication.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] Accepted kiosk submissions with signatures persist signature evidence on the linked order without exposing raw signature data in audit events.
- [x] Order detail/staff review surfaces show actionable signature evidence status for pickup completion.
- [x] Database migration/application is dry-run checked and limited to task-specific safe changes or explicitly blocked with evidence.
- [x] Focused tests, lint/type/build gates, task memory, visual evidence, commit, and push to main are completed or blockers are recorded.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verified |
| Kiosk MVP migration is in remote history | observed | `supabase migration list --linked` shows `20260709233000` local and remote | no task-specific kiosk table migration needed |
| Normal `supabase db push --linked --dry-run` would require include-all for 25 historical migrations | observed | Supabase CLI dry-run output | broad DB push blocked for this task |
| Signature prerequisites already exist remotely | observed | read-only `supabase db query --linked` checks | `order_attachments`, bucket, RLS, and `customer_signature` exist |
| Screenshot evidence exists | observed | `/tmp/repairdesk-kiosk-signature-evidence.png` | desktop order detail shows signature evidence |

## Decision and approval points

- Owner explicitly requested execution, database application, commit, and push to main.
- Database decision: do not run `--include-all`; treat task-specific DB application as no-op because required remote objects already exist and are verified.
- Security decision: raw signature image is never written into order events; accepted kiosk session payload removes `signature_data_url` once attachment evidence is saved.

## Work packages

- Intake, evidence gathering, planning, implementation, independent review, memory closeout.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
