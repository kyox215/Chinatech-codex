---
schema_version: 1
department: backend
status: active
owner: Backend Department / Integration Lead
last_verified_at: 2026-07-17
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
- Dashboard priority uses `dashboard/priority-summary`: apply the existing actor-aware active-order repository scope first, rank the complete visible set, then slice and return the compact allowlist. Keep the previous `dashboard/summary` response during the rolling-client compatibility window. Dashboard mutations remain out of scope; order task/detail routes own all permission-checked writes.
- Orders list reads must first select store/view/technician-scoped narrow index rows, then issue one store-scoped detail query for at most 50 IDs. Keep legacy `pageSize <= 100` input compatibility but clamp the effective detail page size to 50, preserve actor response projections, and fail closed when technician assignment schema is unavailable.
- Order update authority is field/capability scoped and clients send changed fields only. Terminal correction/reopen/void and cancelled-custody confirmation are dedicated atomic repository/RPC commands with store/member role validation, row/version locks, idempotency, reason and immutable before/after evidence; generic update and batch paths must not bypass them.
- Settings APIs must treat server capability projection and `expectedStoreId`/version checks as authority;
  typed 403/409/422 errors preserve recoverable drafts. High-risk member, workflow, Kiosk, or order-data
  Apply work may not sequence legacy endpoints and claim atomicity.

## Interfaces and dependencies

Verified cross-department contract from `TASK-20260716-005-device-custody-status-implementation`: API/Backend exposes store-scoped, version-locked active custody mutation plus dedicated terminal correction/return commands. Required custody fields are never silently stripped; missing migration fails closed. Browser roles have no RPC execution, and customer handover clears unlock secrets atomically.

| Provides / consumes | Counterparty | Contract | Failure handling | Evidence | Status |
|---|---|---|---|---|---|
| TBD | TBD | TBD | TBD | — | unknown |
| Terminal order command API | Frontend + Data + Security | Project capabilities server-side; Manager/Owner correct/reopen, Owner void; service role calls named RPCs | Reject forged fields, cross-store IDs, stale versions, duplicates and unsupported finance changes before partial writes | TASK-20260716-003-customer-finance-order-correction-plan E-015..E-025 | verified |

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
| BE-20260716-001 | Dashboard priority currently reads and ranks the complete visible active set in memory | Correct but may become expensive at materially larger store volume | Backend + Data | measure volume/latency before moving ranking into a database read model | monitoring |
| BE-20260716-002 | Legacy `dashboard/summary` remains for rolling-client compatibility and generic priority read failures map to HTTP 400 | Contract debt and weaker unavailable-service observability | Backend + QA | deprecate old endpoint and introduce a 503-class error in a separate compatibility task | monitoring |
| BE-20260716-003 | Orders archive/all still scans narrow index batches up to 1,000 and the two-phase read is not a transactional snapshot | Higher-volume latency or a transient missed row during concurrent change | Backend + Data | observe production p95/volume; introduce a database read model only with measured evidence | monitoring |
| BE-20260713-003 | Member and workflow writes lack independent production kill switches and proven atomic RPCs | Partial writes or weak containment | Backend + Security + Data | before either production release unit | open |
| BE-20260717-001 | Online `orders/create` remains multi-write, but first-phase code now accepts `operation_id`, replays by created event lookup and skips duplicate audit/realtime on replay | Client timeout duplicate-submit risk is reduced; partial-write risk remains without an atomic RPC | Backend + Data + QA | future Owner-approved atomic-create/observability task | mitigated_first_phase; atomic_rpc_pending |

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
| 2026-07-16 | Added complete actor-scoped Dashboard priority endpoint, allowlisted DTO and legacy rolling compatibility boundary | TASK-20260716-001-dashboard-handoff-priority | Integration Lead + ARCH/SEC reviewers | active |
| 2026-07-16 | Added bounded two-phase Orders list repository contract with tenant/assignment and projection preservation | TASK-20260716-002-orders-mobile-filter-loading-plan | Integration Lead + DATA/SEC/performance reviewers | active |
| 2026-07-16 | Added changed-fields-only order updates and audited atomic terminal command boundary | TASK-20260716-003-customer-finance-order-correction-plan | Integration Lead + DATA/SEC/QA reviewers | active |
| 2026-07-13 | Recorded Settings expected-store/typed-conflict authority and atomic-Apply boundary | TASK-20260712-004-settings-center-master-plan | Integration Lead + WP08 release reviewer | local_verified |
| 2026-07-17 | Recorded online create ambiguous-success, idempotency and post-create audit reliability debt | TASK-20260717-163954-task | Integration Lead + API/Data reviewer | verified_debt |
| 2026-07-17 | Added first-phase order-create operation id replay through `order_events` and duplicate audit/realtime suppression | TASK-20260717-165957-task | Integration Lead | mitigated_first_phase |
