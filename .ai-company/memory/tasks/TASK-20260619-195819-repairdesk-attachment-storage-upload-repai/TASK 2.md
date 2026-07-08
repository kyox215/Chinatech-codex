---
schema_version: 1
task_id: "TASK-20260619-195819-repairdesk-attachment-storage-upload-repai"
title: "repairdesk attachment storage upload repair"
status: "closed"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["Backend", "Data", "QA"]
created_at: "2026-06-19T19:58:19Z"
updated_at: "2026-06-19T20:00:00Z"
closed_at: "2026-06-19T20:00:00Z"
---
# Task — repairdesk attachment storage upload repair

## Owner request

repairdesk attachment storage upload repair

## Business value

Restore order device-photo and buyback/inventory proof-photo upload reliability on production, and make future Storage/schema drift diagnosable from server errors.

## Scope in

- Production Supabase attachment bucket/table parity check and forward repair migration.
- Server upload failure classification for missing bucket, service-role key, and Storage permission failures.
- Order attachment payload integrity checks before Storage write.
- Inventory/buyback attachment upload failure classification.
- Targeted and full local verification gates.

## Scope out

- UI redesign of the photo panel.
- Customer-facing notification changes.
- Public Storage URLs or direct browser upload policies.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] order and inventory attachment uploads have buckets, metadata tables, actionable errors, and passing gates

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Production upload error was caused by missing Supabase Storage bucket and attachment table drift. | observed | production schema/storage inspection | fixed by migration |
| `repairdesk-order-attachments` and `repairdesk-inventory-attachments` are private buckets. | observed | production SQL verification | present |
| `order_attachments` and `inventory_attachments` exist on production. | observed | production SQL verification | present |
| Upload code is server-routed with service-role metadata insert and cleanup on metadata failure. | observed | repository inspection | preserved |

## Decision and approval points

- Production DDL repair was necessary because the live app was already failing uploads with `Bucket not found`.
- Buckets remain private; direct anon/auth table access remains revoked.

## Work packages

- Data: apply idempotent attachment Storage/table repair migration.
- Backend: classify Storage failures and harden order attachment payload validation.
- QA: verify Supabase parity, lint, typecheck, unit tests, full tests, build.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
