# Evidence Index — TASK-20260619-231154-l2-027-audit-log-redaction-and-minimizatio

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-06-19T23:11:54Z | Integration Lead / CEO Agent |
| E-002 | source | generic audit writer persists caller-provided actor/email/before/after/metadata | `awk 'NR>=1 && NR<=90 ...' src/server/audit.ts` | `writeAuditLog` inserts `actor_email`, `before_data`, `after_data`, and `metadata` without field redaction | 2026-06-19T23:16:32Z | Integration Lead / CEO Agent |
| E-003 | source | generic router audit wrapper over-collects input/result | `awk 'NR>=330 && NR<=660 ...' src/server/api/repairdesk-router.ts` | `auditGeneric` covers multiple order/customer/workflow/payment/attachment paths and writes raw `after` plus `metadata.input` | 2026-06-19T23:16:32Z | Integration Lead / CEO Agent |
| E-004 | source | direct audit writers include raw before/after/input or sensitive metadata | targeted `awk`/`rg` on messages, stores, inventory, platform, bootstrap files | message settings and store invite write raw input/rows; platform and bootstrap write raw before/after rows; inventory is mixed | 2026-06-19T23:16:32Z | Integration Lead / CEO Agent |
| E-005 | schema | audit tables accept JSON objects but no field sensitivity constraints | targeted `awk` on audit migrations | `audit_logs` and `platform_audit_logs` define `before_data`, `after_data`, and `metadata` as JSON object fields | 2026-06-19T23:16:32Z | Integration Lead / CEO Agent |
| E-006 | source | adjacent logs also contain sensitive fields that audit policy must consider | targeted `awk`/`rg` on attachment/message schemas and repositories | attachments accept `data_base64`; message logs store `message_body`; WhatsApp event payload can include `recipient_phone` | 2026-06-19T23:16:32Z | Integration Lead / CEO Agent |
| E-007 | artifact | policy report defines classification, event-specific rules, approvals, and follow-ups | `AUDIT_LOG_REDACTION_POLICY.md` | policy drafted; implementation not performed | 2026-06-19T23:16:32Z | Integration Lead / CEO Agent |
| E-008 | validation | policy and memory updates are discoverable | `rg -n "AUDIT_LOG_REDACTION_POLICY|policy_drafted|BE-BACKLOG-20260620-004|QA-BACKLOG-20260620-002|DATA-BACKLOG-20260620-002|SEC-20260620-002" .ai-company/memory` | passed | 2026-06-19T23:16:32Z | Integration Lead / CEO Agent |
| E-009 | validation | source evidence remains findable for future sanitizer task | `rg -n "writeAuditLog\\(|auditGeneric\\(|platform_audit_logs|before_data|after_data|metadata\\.input|data_base64|message_body|recipient_phone" src scripts supabase/migrations` | passed | 2026-06-19T23:16:32Z | Integration Lead / CEO Agent |
| E-010 | validation | governance rules accept updated task/memory state | `npm run agents:check` | passed: config, template, and rule checks passed | 2026-06-19T23:16:32Z | Integration Lead / CEO Agent |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
