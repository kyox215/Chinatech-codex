# Memory Delta — TASK-20260619-231154-l2-027-audit-log-redaction-and-minimizatio

## Candidate project facts

- `TASK-20260619-231154-l2-027-audit-log-redaction-and-minimizatio/AUDIT_LOG_REDACTION_POLICY.md` is the current local audit-log minimization policy draft. It is not implementation evidence.
- Current local audit risk: generic `writeAuditLog` and `auditGeneric` can retain raw before/after/input payloads. Treat audit minimization as P1 before production/customer-visible expansion.
- Inventory has a partial redaction precedent via `redactInventoryRowForAudit`, but other inventory, message, store, platform, and bootstrap paths still need policy-driven sanitization.

## Candidate department updates

- Security: promote audit minimization from proposed risk to policy drafted, implementation pending.
- Backend: future central audit sanitizer and route allowlists should be implemented only after Owner approval.
- Data: audit retention/backfill/live parity remain D3/D4 approval-gated; no live Supabase access occurred.
- QA: future tests must assert forbidden fields/values never serialize into audit payloads.
- Documentation: policy report is authoritative for future audit-log implementation planning, but not active runtime behavior.

## Candidate decisions / ADRs

- Decision candidate: audit payloads should be event-specific allowlists, not raw request/result/row snapshots.
- Decision candidate: raw message bodies, attachment data/base64/signed URLs, secrets, full request objects, and raw customer/contact identifiers are forbidden in audit logs.

## Candidate lessons and capability evidence

- Security review can map audit risk from source evidence without production access when the outcome is policy-only.
- Do not close this task as implementation; follow-up code and data tasks remain separate.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
