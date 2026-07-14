---
schema_version: 1
department: backend
status: active
owner: Backend Department / Integration Lead
last_verified_at: 2026-07-14
review_trigger: relevant-task-or-quarterly-review
---

# Backend Department Memory

## Mission and boundary

Services, domain logic, API contracts, authorization, error handling, jobs, and observability.

This department advises and maintains its own standards. It does not obtain
legal, financial, production, or organization authority merely by being named
as owner of this file.

## Current objectives and work in progress

- Maintain server API contracts, validation, audit logging, and permission enforcement through the central RepairDesk API router.
- First priority: preserve strict store context and mutation auditing while documenting permission matrix.

## Verified rules and conventions

- Client data calls go through `@/lib/repairdesk/api` and `/api/repairdesk/[...path]`.
- Server dispatch lives in `src/server/api/repairdesk-router.ts`; schemas live in `src/server/api/repairdesk-schemas.ts`.
- Inventory writes require owner/manager/technician/sales; message template writes require owner/manager; platform onboarding approval requires platform admin.
- `TASK-20260620-004` verified that order workflow configuration is owner/manager gated, and `setOrderWorkflowStatusEnabled` delegates to the gated workflow update path.
- `TASK-20260620-004` found store context on order/customer mutation repositories, but did not find explicit role gates for many order/customer/payment/message/attachment/approval write paths. Treat this as a policy gap until Owner confirms the intended role matrix.
- `TASK-20260619-230350-l2-025-role-policy-decision-package` proposes staged server-side implementation after Owner approval: tests first, viewer read-only hardening, order/customer gates, inventory/buyback fine-grain gates, member/store creation hardening, then field-level technician/sales splits.
- `TASK-20260619-231154-l2-027-audit-log-redaction-and-minimizatio/AUDIT_LOG_REDACTION_POLICY.md` establishes the target audit payload contract: deny-by-default sanitizer, event allowlists, safe envelopes instead of raw `metadata.input` or raw `after`, and domain-specific direct-writer sanitization. This is not implemented yet.
- `TASK-20260712-002-global-staff-permissions` implements the global Owner-approved role contract. Individual-order finance is separate from aggregate/profit/export authority, archived queue access is explicit, and technician object checks use stable same-store membership IDs before every child read or write. Legacy name-based technician authorization is forbidden and fails closed until migration.
- `TASK-20260713-001-order-active-status-homepage` supersedes the default-home predicate from the custody task: the server filters `completed` and `cancelled` before counts and pagination, independent of payment, delivery or custody evidence. Every nonterminal order remains operationally visible. Completion and cancelled-device actions still preserve finance fields and remain available through authorized history/detail paths.
- `TASK-20260713-002-order-search-grouped-results` defines the shared repository/mock list contract: sort by the six active queue groups, then `completed`, then `cancelled`; within each group use `created_at ASC`, followed by `public_no` and `id`. `OrderListResult.resultGroupCounts` reports the exact filtered result set without weakening archive, assignment or finance projection permissions.
- `TASK-20260712-005-buyback-guided-evidence` establishes a dedicated sensitive buyback boundary: Sales handoff is separate from Owner/Manager restricted-evidence capture/finalize; generic inventory updates cannot write signed acquisition fields, direct buyback payment or `purchased`; finalize uses expected version, idempotency and one RPC; quality-check updates use status/version CAS and patch only submitted fields.
- While `BUYBACK_SENSITIVE_WORKFLOW_ENABLED` is false, `TASK-20260714-001-buyback-sensitive-evidence-feature-off` makes the router and repository reject every buyback attachment, restricted kind, finalize and legacy evidence apply regardless of client or role. Ordinary inventory attachments use the legacy production row shape. Quote updates merge stored allowlisted markers with sanitized inbound metadata, and partial-save retries load and refresh the remembered record before any transition.

## Interfaces and dependencies

| Provides / consumes | Counterparty | Contract | Failure handling | Evidence | Status |
|---|---|---|---|---|---|
| TBD | TBD | TBD | TBD | — | unknown |

## SOPs and checklists

- Relevant Skills under `.agents/skills/` are candidate procedures.
- Project-specific commands and paths require verification before promotion.

## Risks, debt, and open questions

| ID | Risk/debt/question | Impact | Owner | Target/review | Status |
|---|---|---|---|---|---|
| BE-20260619-001 | Permission matrix is code-derived but not yet owner-confirmed as business policy | Potential over/under-permission | Backend + Security + Product | before permission changes | open |
| BE-20260620-001 | Order/customer write paths need an explicit Owner-approved role policy and server-side tests before behavior changes | Staff workflow regression or over-permission | Backend + Security + QA | resolved by TASK-20260712-002 global policy and negative tests | closed |
| BE-20260620-002 | Audit writer and generic router currently permit raw before/after/input payloads | Sensitive data over-retention | Backend + Security + QA | implement central sanitizer after Owner confirms behavior change | policy_drafted |
| BE-20260713-001 | General status update and timeline insertion remain separate database writes | A status may commit without its event if event insertion fails | Backend + Data | make both writes atomic in the next workflow RPC migration | open |
| BE-20260713-002 | Generic inventory sale/payment remains outside the buyback-finalize transaction boundary | A later resale workflow can still partially write outside this acquisition scope | Backend + Data + Product | dedicated atomic sale-command task before expanding resale automation | open |

## Lessons and anti-patterns

- Do not infer project facts from the generic AI Company OS template.
- Promote repeated evidence, not stylistic preference, into durable standards.

## Capability and tool notes

| Agent/Skill | Current evidence | Capability | Permission | Limitation |
|---|---|---|---|---|
| TBD | none | C0/C1 | task-specific | not evaluated |

## Memory change log

| Date | Change | Source/task | Author/reviewer | Status |
|---|---|---|---|---|
| 2026-06-19 | Initial RepairDesk backend baseline synchronized | TASK-20260619-003 | Integration Lead | active |
| 2026-06-20 | Added server-side permission matrix baseline and order/customer role-policy gap | TASK-20260620-004 | Integration Lead | active |
| 2026-06-20 | Added staged implementation boundary for proposed role policy | TASK-20260619-230350-l2-025-role-policy-decision-package | Integration Lead | proposed |
| 2026-06-20 | Added audit sanitizer/allowlist implementation boundary from L2-027 policy | TASK-20260619-231154-l2-027-audit-log-redaction-and-minimizatio | Integration Lead | policy_drafted |
| 2026-07-12 | Recorded global role, archive, finance projection and stable order-assignment contract | TASK-20260712-002-global-staff-permissions | Integration Lead + security reviewer | active |
| 2026-07-13 | Superseded archive eligibility, separated handover from payment, and added explicit cancelled-device return | TASK-20260712-005-order-custody-archive | Integration Lead + Data/Security reviewers | active |
| 2026-07-13 | Simplified default-home visibility to terminal status and moved filtering before counts/pagination | TASK-20260713-001-order-active-status-homepage | Integration Lead + QA reviewer | active |
| 2026-07-13 | Added result-group counts and stable status-first, oldest-intake-first order sorting | TASK-20260713-002-order-search-grouped-results | Integration Lead | active |
| 2026-07-13 | Added restricted buyback command boundary, quality CAS and generic-write bypass guards | TASK-20260712-005-buyback-guided-evidence | Integration Lead + security reviewer | verified_local |
| 2026-07-14 | Added production feature-off deny coverage, legacy attachment-schema compatibility and same-record retry refresh | TASK-20260714-001-buyback-sensitive-evidence-feature-off | Integration Lead + security reviewer | active |
