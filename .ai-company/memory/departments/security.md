---
schema_version: 1
department: security
status: active
owner: Security Department / Integration Lead
last_verified_at: 2026-07-13
review_trigger: relevant-task-or-quarterly-review
---

# Security & Privacy Department Memory

## Mission and boundary

Threat models, identity, authorization, secrets, sensitive data, dependency and audit controls.

This department advises and maintains its own standards. It does not obtain
legal, financial, production, or organization authority merely by being named
as owner of this file.

## Current objectives and work in progress

- Maintain authentication, authorization, tenant isolation, secrets, PII, and storage/attachment posture.
- First priority: require explicit approval for live role, secret, production data, or Supabase policy changes.

## Verified rules and conventions

- Browser auth config plus Supabase claims resolve staff profile and active store membership.
- Platform approval requires active platform admin.
- Real Supabase repositories have tests preventing legacy default-store fallback in production repositories.
- `.gitignore` excludes `.env*` and `supabase/.temp`; do not quote secret-bearing local configs.
- `TASK-20260620-004` is the current local permission matrix baseline. It found no verified P0 from local inspection, but it did identify P1 risks around order/customer mutation role policy, production Supabase permission parity, audit-log minimization, and self-service store creation.
- UI-hidden actions are not sufficient permission enforcement; server-side router/repository gates are the authority for sensitive actions.
- Live Supabase permission audits, role changes, RLS/grant changes, platform-admin changes, and service-role scripts require explicit Owner approval.
- `TASK-20260619-230350-l2-025-role-policy-decision-package` recommends Option A: `viewer` read-only, platform/store authority separation, tighter staff roster/store creation policy, and staged server-side gates. This is a proposal pending Owner approval, not active behavior.
- `TASK-20260619-231154-l2-027-audit-log-redaction-and-minimizatio/AUDIT_LOG_REDACTION_POLICY.md` is the current audit-log minimization policy draft. It requires audit payload allowlists and forbids raw request/result rows, secrets, base64/data URLs, signed URLs, raw message bodies, raw contact identifiers, and raw IMEI/serials in audit logs. This is policy only; no sanitizer code is implemented yet.
- `TASK-20260710-009` enforces customer read authorization before repository calls and no longer trusts user-editable metadata or a generic confirmation timestamp as verified-email authority. Technician/viewer customer reads remain fail closed without an approved object-level scope model.
- `TASK-20260712-002-global-staff-permissions` closes the approved global staff-policy gap: mutable technician names are never authorization keys, kiosk session review is owner/manager-only, and browser 401/403 authority loss clears tenant-sensitive caches before paint. Production assignment/grant migrations remain unapplied until the separate database gate.
- `TASK-20260712-005-order-custody-archive` keeps cancelled devices visible until an authorized, same-store, version-locked return confirmation. That action preserves finance fields and writes a structured event; SeaTable import events no longer retain raw source rows. Exact archived-order lookup remains a single-order capability, while archive browsing, aggregate totals and bulk output stay separately gated.

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
| SEC-20260619-001 | Production role/platform admin membership is unknown | Over-permission or lockout risk | Security + Owner | before production operations | open |
| SEC-20260619-002 | Attachment/customer data retention and backup policy not verified | Privacy/operations risk | Security + Operations | before external release | open |
| SEC-20260620-001 | Store `viewer` may be able to mutate order/customer/payment/message/attachment/approval APIs if it has active store membership | Over-permission and accountability risk | Security + Backend + Owner | resolved in central server policy by TASK-20260712-002; legacy direct-table risk remains SEC-20260710-001 | closed |
| SEC-20260620-002 | Audit metadata/before/after can retain raw PII, payment, message, or attachment inputs | Privacy and retention risk | Security + Backend | policy drafted in L2-027; implementation pending before production/customer-visible expansion | policy_drafted |
| SEC-20260620-003 | `stores/create` allows any logged-in actor to create a store outside platform approval | Tenant lifecycle/governance risk | Security + Product + Owner | decide self-service vs platform-admin-only | open |
| SEC-20260710-001 | 17 legacy public tables permit direct browser-role access with RLS disabled | Critical customer/business data exposure | Security + Data + Owner | P0 consumer discovery and staged containment | open |
| SEC-20260710-002 | One plaintext unlock pattern remains and no approved retention/key-management policy exists | Sensitive device-access secret risk | Security + Data + Owner | policy decision before encryption migration, purge or export | blocked_by_policy |

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
| 2026-06-19 | Initial RepairDesk security baseline synchronized | TASK-20260619-003 | Integration Lead | active |
| 2026-06-20 | Added permission matrix baseline, role-policy risks, audit minimization risk, and production approval boundaries | TASK-20260620-004 | Integration Lead | active |
| 2026-06-20 | Added Option A role-policy decision package and approval boundary | TASK-20260619-230350-l2-025-role-policy-decision-package | Integration Lead | proposed |
| 2026-06-20 | Drafted audit-log redaction/minimization policy and kept implementation/live data actions approval-gated | TASK-20260619-231154-l2-027-audit-log-redaction-and-minimizatio | Integration Lead | policy_drafted |
| 2026-07-10 | Added customer-read/verified-email controls and legacy/unlock residual risks | TASK-20260710-009 | Integration Lead | active |
| 2026-07-12 | Verified global staff permissions, membership-ID order scope, kiosk PII gate and authority-loss cache purge | TASK-20260712-002-global-staff-permissions | Security reviewer + Integration Lead | active |
| 2026-07-13 | Added custody-return authorization, import minimization and archive-search boundary | TASK-20260712-005-order-custody-archive | Security reviewer + Integration Lead | active |
