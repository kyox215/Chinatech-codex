---
schema_version: 1
task_id: "TASK-20260619-231154-l2-027-audit-log-redaction-and-minimizatio"
title: "L2-027 audit log redaction and minimization policy"
status: "closed"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "Integration Lead / CEO Agent"
departments: ["API", "DATA", "DOC", "INT", "QA", "SECURITY"]
created_at: "2026-06-19T23:11:54Z"
updated_at: "2026-06-19T23:20:52Z"
closed_at: "2026-06-19T23:20:52Z"
---
# Task — L2-027 audit log redaction and minimization policy

## Owner request

L2-027 audit log redaction and minimization policy

## Business value

Create a safe audit-log redaction and minimization policy before production or customer-visible expansion, reducing PII/payment/message leakage risk while preserving accountability.

## Scope in

- Local repository inventory of audit-log writers, adjacent event/message/attachment logs, schema payload shapes, and sensitive-field sources.
- Policy definition for allowed, masked/tokenized, summarized, redacted, and forbidden audit payload fields.
- Event-specific audit envelope rules for orders, customers, inventory, messages, settings, members, platform onboarding, attachments, imports, and bootstrap/admin paths.
- Task memory, evidence index, checkpoint, department memory delta, and backlog updates.

## Scope out

- Business logic, audit code, router code, repository code, database migrations, tests, dependencies, generated output, or runtime behavior changes.
- Production Supabase access, live audit-row sampling, purge/backfill, RLS/grant changes, service-role script execution, deployment, staging, commit, push, or destructive actions.
- Legal/compliance advice beyond local technical minimization policy.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] Inventory current local audit-log writers, payload shapes, and sensitive input sources from repository evidence.
- [x] Classify audit fields into allowed, hashed/tokenized, summarized, redacted, and forbidden categories.
- [x] Define event-specific audit payload rules for orders, customers, inventory, messages, settings, members, platform onboarding, attachments, and bootstrap/admin paths.
- [x] Produce a policy report under the task directory with verified facts, assumptions, unknowns, approval points, and follow-up implementation tasks.
- [x] Do not modify business logic, audit code, database migrations, secrets, production data, or live Supabase state.
- [x] Run non-destructive validation: targeted source/policy scans and npm run agents:check.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Owner requested continued governance next step | verified fact | conversation + active L2 sequence | execute under L2 controlled autonomy |
| Task is documentation/security policy only | verified fact | acceptance criteria and scope | no business code changes |
| Generic writer stores raw caller-provided `before`, `after`, and `metadata` | verified fact | `src/server/audit.ts:31-42` | policy requires central sanitizer before code implementation |
| Generic router audit wrapper stores raw result and raw input | verified fact | `src/server/api/repairdesk-router.ts:637-654` | P1 privacy/retention risk |
| Some inventory paths already redact identifiers | verified fact | `src/features/inventory/server/inventory.repository.ts:1450-1472` | reuse as implementation precedent |
| Live Supabase audit row contents are unknown | unknown | no production access performed | requires D4 Owner approval before live audit |
| Actor email column exists in audit schemas | verified fact | audit migrations | policy target is masked/digest or explicit retention exception |
| Existing production/customer legal retention obligations are unknown | unknown | outside local repo evidence | keep as approval-gated follow-up |

## Decision and approval points

- Current task: D1/L2 docs and memory only; Integration Lead can execute without Owner approval.
- Future sanitizer implementation: D2/L2; recommended explicit Owner approval because audit payload behavior changes.
- Live audit-row sampling, purge/backfill, schema/RLS/grant/retention changes, or service-role scripts: D3/D4 and require explicit Owner approval.
- Risk classification: R2 for local docs/policy work; underlying implementation risk is P1 because raw PII/payment/message/attachment data may be retained in audit payloads.

## Work packages

- Intake and risk classification: completed.
- Source inventory and threat model: completed.
- Policy report: drafted in `AUDIT_LOG_REDACTION_POLICY.md`.
- Memory synchronization and validation: completed.
- Closeout: ready.

## Validation results

| Gate | Command / evidence | Result |
|---|---|---|
| Policy and memory scan | `rg -n "AUDIT_LOG_REDACTION_POLICY|policy_drafted|BE-BACKLOG-20260620-004|QA-BACKLOG-20260620-002|DATA-BACKLOG-20260620-002|SEC-20260620-002" .ai-company/memory` | passed; task artifact, backlog, and departments are indexed |
| Source evidence scan | `rg -n "writeAuditLog\\(|auditGeneric\\(|platform_audit_logs|before_data|after_data|metadata\\.input|data_base64|message_body|recipient_phone" src scripts supabase/migrations` | passed; known audit/sensitive-data sources remain findable for implementation follow-up |
| Governance gate | `npm run agents:check` | passed |
| Business code boundary | file edits performed by this task | only `.ai-company/memory/**` files were created/updated |

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
