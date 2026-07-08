# Audit Log Redaction and Minimization Policy

- Task: `TASK-20260619-231154-l2-027-audit-log-redaction-and-minimizatio`
- Status: policy drafted, implementation pending
- Scope: local repository evidence only
- Code changes: none
- Production/live Supabase access: not performed
- Generated at: 2026-06-19T23:16:32Z

## Executive conclusion

RepairDesk has a useful audit spine, but current local code can over-collect sensitive data.
The central `writeAuditLog` service stores caller-provided `before`, `after`, and `metadata`
without redaction. The central `auditGeneric` wrapper writes the full operation result into
`after_data` and the full request input into `metadata.input`. Several direct audit writers
also store raw rows or raw inputs.

This policy sets the required target state: audit logs must preserve accountability
(`actor`, `action`, `entity`, `result`, `time`, `store`, and safe context) while never
retaining raw customer PII, message bodies, attachment contents, secrets, full request
objects, or full database rows.

## Threat model

| Area | Policy view |
|---|---|
| Assets | Customer identity and contact data, device identifiers, repair history, payment and buyback amounts, message contents, attachments/photos, staff identity, store membership, platform onboarding records, service-role/bootstrap context. |
| Adversaries / misuse cases | Over-broad staff audit access, leaked database backup, copied debug rows, support exports, compromised admin session, or accidental log sharing. |
| Entry points | `audit_logs`, `platform_audit_logs`, business timeline events, message logs, attachment metadata, bootstrap scripts, service-role server actions. |
| Trust boundaries | Browser to server API, server API to Supabase service-role writes, store tenant boundary, platform-admin boundary, local code evidence vs unverified live Supabase state. |
| Worst credible local risk | Audit tables or adjacent logs retain raw PII/message/attachment/payment inputs beyond operational need, increasing breach and retention impact. |

## Verified current facts

| Fact | Evidence | Status |
|---|---|---|
| `writeAuditLog` inserts `actor_email`, `actor_name`, `before_data`, `after_data`, and `metadata` directly into `audit_logs`. | `src/server/audit.ts:31-42` | verified local source |
| `auditGeneric` writes full `result` to `after` and full `input` to `metadata.input`. | `src/server/api/repairdesk-router.ts:637-654` | verified local source |
| `auditGeneric` covers order create/update/finance/payment/attachment/transition, customer create/update, order workflow, and approval decision routes. | `src/server/api/repairdesk-router.ts:344-533` | verified local source |
| Message settings/template updates write `before`, `after`, and `metadata.input`. | `src/features/messages/server/message-settings.service.ts:33-68` | verified local source |
| Store member invite audit writes raw invitation data and raw invite email in metadata. | `src/features/stores/server/store.repository.ts:208-214` | verified local source |
| Some inventory audit paths already use redaction for create/transition rows. | `src/features/inventory/server/inventory.repository.ts:267-273`, `src/features/inventory/server/inventory.repository.ts:363-370`, `src/features/inventory/server/inventory.repository.ts:1450-1472` | verified local source |
| Other inventory audit paths write full rows or raw input into audit/event payloads. | `src/features/inventory/server/inventory.repository.ts:307-314`, `src/features/inventory/server/inventory.repository.ts:584-591`, `src/features/inventory/server/inventory.repository.ts:702-708` | verified local source |
| `platform_audit_logs` has the same raw JSON shape as `audit_logs`. | `supabase/migrations/20260611080254_platform_onboarding_approvals.sql:67-84` | verified local source |
| Platform onboarding audit writes raw onboarding request before/after rows. | `src/features/platform/server/platform.repository.ts:93-99`, `src/features/platform/server/platform.repository.ts:146-153`, `src/features/platform/server/platform.repository.ts:180-187` | verified local source |
| Bootstrap admin script writes owner email and display name into `after_data`; dry-run/complete console output also prints email/display/store, but not password. | `scripts/ensure-owner-admin.ts:299-309`, `scripts/ensure-owner-admin.ts:341-350`, `scripts/ensure-owner-admin.ts:360-368` | verified local source |
| Order attachment upload accepts `data_base64`; event payload stores attachment metadata including file name, mime, and size. | `src/server/api/repairdesk-schemas.ts:171-184`, `src/features/orders/server/order.repository.ts:1088-1143` | verified local source |
| WhatsApp/SMS message bodies are stored in `message_logs`; order event payload stores message ids and may store recipient phone in WhatsApp payload. | `src/features/orders/server/order.repository.ts:2339-2388`, `src/features/orders/server/order.repository.ts:2418-2448` | verified local source |
| Audit schema only validates JSON object shape, not sensitivity or field-level allowlists. | `supabase/migrations/20260611074644_repairdesk_auth_multistore_bootstrap_safe.sql:114-135` | verified local source |

## Assumptions, conflicts, and unknowns

| Item | Type | Handling |
|---|---|---|
| Live Supabase may already contain audit rows with raw sensitive data. | unknown | Requires Owner-approved read-only production audit before any claim or purge. |
| Store staff may need some audit search by email or phone. | assumption | Use actor/customer ids plus masked value or keyed digest, not raw values, unless Owner approves a stricter retention exception. |
| Payment amounts are business-sensitive but needed for financial accountability. | assumption | Allow exact amount only for payment/finance events; forbid card/bank details and raw payment free text. |
| Message body may be needed for customer history but not audit accountability. | verified adjacent data, policy conflict | Keep message body in business message history according to retention policy; audit/timeline should only reference message id, template, channel, length, and status. |
| Attachment file names can contain PII. | assumption backed by free-form file names | Audit should store attachment id, kind, mime, size, and sanitized extension only; omit or summarize original file name. |
| Existing audit table has `actor_email`. | schema fact | Treat raw actor email as legacy-compatible but policy target is masked or digest form. |

## Field classification

| Category | Examples | Audit treatment |
|---|---|---|
| Allowed | `id`, `store_id`, `actor_id`, `action`, `entity_type`, `entity_id`, `created_at`, safe enum statuses, boolean flags, counts, route/event key, result state. | Store directly. |
| Conditionally allowed | Exact payment amount, currency, payment method enum, quote/list/sale/buyback amount, workflow from/to, approved/rejected status, attachment mime/size. | Store only in event-specific allowlist. Do not include full request/result objects. |
| Mask or keyed digest | Customer phone, staff/customer email, IMEI/serial, external message recipient, invite email, storage path, device identifiers. | Store last-2/last-4 plus deterministic keyed digest when lookup is required. Otherwise store `has_*` boolean. |
| Summarize | Free-form notes, reason text, fault descriptions, template body, message body, attachment file name, legacy payload, import report, CSV content. | Store length, presence, count, template id/kind, changed field names, or validation outcome only. |
| Redact | Customer name, address, raw phone/email, raw IMEI/serial, raw invite email, store member display details beyond role/status, free-form sensitive notes. | Do not store raw value in audit. Replace with `redacted`, `has_value`, masked value, or digest. |
| Forbidden | Passwords, Supabase service-role key, tokens, session/cookie values, full base64/data URLs, signed URLs, full attachment contents, raw request body, full response rows, raw message body, raw onboarding request row, raw customer/order/inventory rows, card/bank details. | Never store in `audit_logs`, `platform_audit_logs`, or generic event payloads. Add tests for this list. |

## Event-specific audit rules

| Domain/event | Required audit envelope | Forbidden in audit |
|---|---|---|
| Orders create/update/patch | order id/public no, store id, actor id, action, changed field names, from/to status, safe status/payment/parts enums, safe amount fields only when event is finance/payment. | raw customer name/phone/email, raw device IMEI, raw full order row, raw input/result object, fault notes/free text. |
| Order payment/finance | amount, currency, payment method enum, balance/payment status transition, transaction id if present. | card/bank data, raw note, customer contact, full order row. |
| Order transition/batch transition | from, to, count/id list when needed, reason presence and reason length/category. | raw free-form reason unless Owner approves audit retention; raw order rows. |
| Order/customer notifications | message id, channel, template kind/id, status, length, recipient digest/masked value if needed. | raw message body, raw recipient phone, customer phone/email, rendered template body. |
| Order/inventory attachments | attachment id, kind, mime type, file size, extension, storage bucket enum. | `data_base64`, signed/public URL, raw storage path, original file name when it may contain PII, note text, binary content. |
| Customers create/update | customer id, changed field names, tag ids/counts, follow-up ids/status, phone/email digest if lookup is required. | raw name, phone, email, address, contact phone list, interaction body, raw device serial/IMEI. |
| Inventory/buyback create/update/check/transition/sale | item id/public no, status from/to, category/brand/model, masked serial/IMEI, amount fields when buyback/sale/transaction event requires them, check id, attachment id. | raw customer name/phone, raw serial/IMEI, notes, raw legacy payload, raw full row, raw input. |
| Inventory transactions | transaction id, transaction type, amount, currency, method enum. | raw note, customer contact, full item row. |
| Message settings/templates | template id, domain/kind/channel/language, enabled flag, changed field names, body length/hash only if needed. | raw template body, raw preview context, rendered body, store contact phone/email. |
| Store settings | setting id, changed field names, store id, store name only if public/internal business name is already visible. | raw phone/email/address/free text settings until field-specific allowlist exists. |
| Store members/invitations | invitation/member id, role, status, accepted_immediately, invite email digest/masked value. | raw invite email in metadata/after, token hash, full invitation row. |
| Platform onboarding | request id, request type, status, target/result store id, desired store name presence, requested role, reviewer id, decision outcome. | raw requester email, display name, decision note, full onboarding request before/after row. |
| Bootstrap/admin | source script, target staff id, store id, role/status, auth_user_created boolean, email digest/masked value. | password, service-role key, raw owner email in audit after_data, raw env/config dumps. |
| Imports | source name, import id if available, rows accepted/rejected counts, warning counts by type, report summary. | raw CSV content, row-level customer phone/email/name, raw IMEI/serial, full parsed row arrays. |

## Implementation requirements for a future code task

1. Add a central audit sanitizer that accepts an event-specific allowlist and rejects unknown fields by default.
2. Replace `auditGeneric` raw `after` and `metadata.input` with a safe envelope generated by per-route policy rules.
3. Route all direct `writeAuditLog` and `writePlatformAuditLog` callers through domain-specific sanitizers.
4. Keep inventory's existing `redactInventoryRowForAudit` pattern, but extend it to all inventory audit/event paths that currently write full rows or raw input.
5. Add tests that assert forbidden keys and representative values never appear in serialized audit payloads.
6. Add a production-readiness checklist for retention, audit-reader permissions, and live Supabase parity before customer-visible expansion.
7. Do not purge or rewrite existing production audit rows without a separate Owner-approved data-retention/backfill plan.

## Approval boundaries

| Decision | Level | Owner approval required? |
|---|---:|---|
| This policy report and local memory updates | D1/L2 | No, reversible docs/memory only. |
| Implementing local sanitizer and tests without production data access | D2/L2 | Recommended explicit Owner approval because audit payload behavior changes. |
| Changing audit schema, retention, RLS, grants, or audit-reader permissions | D3 | Yes. |
| Reading live audit rows, sampling production data, purging, redacting historical rows, or running service-role scripts | D4 | Yes, with a written plan and rollback/backup evidence. |

## Follow-up task proposals

| Proposed ID | Title | Type | Approval |
|---|---|---|---|
| L2-035 | Implement central audit sanitizer and route allowlists | backend/security | Owner approval recommended before code changes |
| L2-036 | Replace generic router audit payloads with safe audit envelopes | backend/security/qa | after L2-035 design accepted |
| L2-037 | Sanitize direct message/store/platform/bootstrap audit writers | backend/security | after L2-035 design accepted |
| L2-038 | Audit log retention and reader-access policy | security/data/product | Owner approval required |
| L2-039 | Add forbidden-field audit serialization tests | qa/security/backend | after sanitizer implementation begins |
| D3-001 | Live Supabase audit-log parity and historical exposure assessment | data/security/owner | explicit Owner approval required |

## Security gate conclusion

Conditional pass for policy drafting only.

The local risk is P1: no live exploit or production leak was verified in this task, but current repository evidence shows raw request/result and row snapshots can be stored in audit tables. Before production or broader customer-visible operation, audit minimization should move from policy to implementation and tests.
