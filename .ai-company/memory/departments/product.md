---
schema_version: 1
department: product
status: active
owner: Product Department / Integration Lead
last_verified_at: 2026-07-17
review_trigger: relevant-task-or-quarterly-review
---

# Product Department Memory

## Mission and boundary

User value, product scope, business rules, roles, state machines, prioritization, and acceptance criteria.

This department advises and maintains its own standards. It does not obtain
legal, financial, production, or organization authority merely by being named
as owner of this file.

## Current objectives and work in progress

- Maintain Chinatech RepairDesk shop workflow scope and acceptance criteria using `TASK-20260619-003/PROJECT_TAKEOVER_REPORT.md` as the initial baseline.
- First priority: clarify owner-approved L2 tasks and keep business outcomes separate from technical cleanup.

## Verified rules and conventions

- Owner / 老板 is Hexiang Huang / 鹤祥; AI employees execute under the Integration Lead.
- Core product areas are orders, customers/devices/CRM, buyback/resale, inventory, messages, store settings, onboarding/platform approvals, and mobile repair workflows.
- Product policy, roles, payments, customer communication, and external messaging changes require owner confirmation when business intent is not already explicit in code/docs.
- Current order workflow semantics confirmed by `TASK-20260619-008`: `mail_in_progress` is external repair work in the repair stage; `repaired` remains repair until notification/pickup; `quoted -> parts_ordered` is valid.
- `TASK-20260619-009` deleted the Batch B stale duplicate files that encoded old intake/pickup assumptions; canonical product semantics were not changed.
- `TASK-20260620-001` established manual order-detail status transition as a correction/override path: users may choose any enabled concrete order status except the current status, while approval decision, required reason, disabled/current target, canonical-group target, and unpaid-completion protections remain enforced.
- `TASK-20260619-230350-l2-025-role-policy-decision-package/ROLE_POLICY_DECISION_PACKAGE.md` is the current Owner-approval package for role policy. It recommends Option A, a conservative shop-operations policy, but it is not approved or implemented yet.
- `TASK-20260716-001-dashboard-handoff-priority` makes Dashboard an operational handoff workbench: keep quick repair intake and buyback quote, then show the actor-authorized order to handle first with an explainable reason, current step, next step, assignee and update time. Finance does not influence V1 priority and Dashboard performs no direct workflow mutation.
- `TASK-20260716-003-customer-finance-order-correction-plan` separates customer history from valid repair/finance facts: cancelled/custom-cancelled/voided/deleted orders remain discoverable history but contribute zero to valid count, active work, lifetime quote and receivables. Customer UI shows repair and payment states independently. Terminal corrections/reopen require Manager or Owner; safe void is Owner-only, preserves evidence and is never a normal hard delete.
- `TASK-20260716-005-device-custody-status-implementation` makes device custody an independent live order dimension. Repair type and accessory notes are not reused; legacy unknown remains visible; completed-to-shop requires reopen; cancelled shop-held devices require audited return; customer-held rows do not create false pickup or unlock expectations.

## Interfaces and dependencies

| Provides / consumes | Counterparty | Contract | Failure handling | Evidence | Status |
|---|---|---|---|---|---|
| TBD | TBD | TBD | TBD | — | unknown |
| Product customer/order lifecycle | Frontend + Backend + Data | History is retained; only valid lifecycle rows contribute operational/finance facts; terminal changes use named audited actions | Fail closed and preserve evidence when role, version, reason or accounting preconditions fail | TASK-20260716-003-customer-finance-order-correction-plan E-013..E-025 | verified |

## SOPs and checklists

- Relevant Skills under `.agents/skills/` are candidate procedures.
- Project-specific commands and paths require verification before promotion.

## Risks, debt, and open questions

| ID | Risk/debt/question | Impact | Owner | Target/review | Status |
|---|---|---|---|---|---|
| PROD-20260619-001 | Production business policy for roles, retention, and external messaging is not fully verified | Misaligned automation or customer communication | Product + Owner | before production/external messaging work | open |
| PROD-20260619-002 | Batch B duplicate files encoded stale order workflow semantics | Future agents may follow old intake/pickup assumptions | Product + Data + QA | deleted by TASK-20260619-009; monitor for re-created workflow duplicates | closed |
| PROD-20260620-001 | Manual transition can bypass configured next-step edges by design | Accidental misuse could skip process stages if UI copy or audit trail becomes unclear | Product + QA | monitor order workflow changes | mitigated by enabled-status filtering, reason rules, approval protection, finance completion guard, and timeline events |
| PROD-20260620-002 | Recommended role policy awaits Owner decision | Permission implementation could block real shop work if guessed | Product + Owner + Security | before role-gate implementation | approval_pending |

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
| 2026-06-19 | Initial RepairDesk product baseline synchronized | TASK-20260619-003 | Integration Lead | active |
| 2026-06-19 | Confirmed Batch B order workflow product semantics | TASK-20260619-008 | Integration Lead | active |
| 2026-06-19 | Removed stale Batch B duplicate workflow files after semantic confirmation | TASK-20260619-009 | Integration Lead | active |
| 2026-06-20 | Recorded manual order-detail status transition correction path and preserved safeguards | TASK-20260620-001 | Integration Lead | active |
| 2026-06-20 | Added Owner-ready role-policy decision package as proposed product policy | TASK-20260619-230350-l2-025-role-policy-decision-package | Integration Lead | proposed |
| 2026-07-16 | Recorded beginner-friendly Dashboard priority and store-handoff product contract | TASK-20260716-001-dashboard-handoff-priority | Integration Lead + department reviewers | active |
| 2026-07-16 | Recorded customer finance/history split and audited terminal correction/reopen/void product contract | TASK-20260716-003-customer-finance-order-correction-plan | Integration Lead + DATA/SEC/UX/QA reviewers | active |
| 2026-07-17 | Promoted the order device-custody product contract to production-verified behavior | TASK-20260716-005-device-custody-status-implementation | Integration Lead + FLOW/UX/QA reviewers | active |
