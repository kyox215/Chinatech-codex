---
schema_version: 1
department: security
status: active
owner: Security Department / Integration Lead
last_verified_at: 2026-07-18
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
- Production PII staging must remain outside exposed Data API schemas with explicit API/runtime-role revokes, a bounded rollback window, and only hashes/counts in durable audit evidence. Historical imports default required-notification, marketing and SMS consent to false unless the source proves consent.
- Import previews with row-level linkage fields are restricted pseudonymized data, not anonymous data. Repository tools must write them outside the repo through real owner-only directories, reject symbolic-link targets, and enforce `0600` after writes.
- Dashboard priority authorization is inherited from the actor-aware order-list boundary before ranking. Technicians remain scoped by stable membership assignment; caller-controlled store/role fields are rejected. The response excludes phone, IMEI, unlock, supplier, signature, finance amount, unpaid aggregate and membership UUID. Any 401/403 must hide previously cached priority rows immediately, not downgrade them to a stale-data warning.
- `TASK-20260710-009` enforces customer read authorization before repository calls and no longer trusts user-editable metadata or a generic confirmation timestamp as verified-email authority. Technician/viewer customer reads remain fail closed without an approved object-level scope model.
- `TASK-20260712-002-global-staff-permissions` closes the approved global staff-policy gap: mutable technician names are never authorization keys, kiosk session review is owner/manager-only, and browser 401/403 authority loss clears tenant-sensitive caches before paint. Production assignment/grant migrations remain unapplied until the separate database gate.
- `TASK-20260713-001-order-active-status-homepage` hides all `completed` and `cancelled` rows from the default homepage without deleting or rewriting them. Cancelled-device return, settlement contradictions and other custody reminders remain on the authorized order detail/history paths. Exact archived-order lookup remains a single-order capability, while archive browsing, aggregate totals and bulk output stay separately gated.
- `TASK-20260712-005-buyback-guided-evidence` verifies local fail-closed controls for sensitive buyback evidence: Sales cannot capture/read/finalize; Owner/Manager can; full document numbers are never persisted; private evidence is tenant/item scoped with short-lived audited access; signature hashes bind legal/device/seller/amount/payment/declarations; generic write/payment/status bypasses are denied; hosted JSON is capped at 4.4MB after 2.4MB client compression.
- `TASK-20260714-001-buyback-sensitive-evidence-feature-off` supersedes the active production boundary while migration/privacy gates are open: all roles are denied buyback attachments, restricted kinds, finalize and legacy evidence apply at router and repository layers. Existing allowlisted historical markers are retained read-only, while new client-supplied evidence markers are stripped. UI removal is only a projection of the authoritative server deny.
- `TASK-20260714-002-buyback-supabase-schema-staging` adds only dormant production objects: agreement RLS is enabled with no access policy, the private bucket has no upload/read policy, and `public`/`anon`/`authenticated`/`service_role` retain no agreement-table or finalize-RPC runtime access. This fail-closed schema state does not authorize identity/signature collection.
- `TASK-20260716-003-customer-finance-order-correction-plan` enforces terminal-order authority in router/repository/database layers: Manager/Owner may correct or reopen, Owner alone may void, and browser roles cannot execute terminal RPCs. `order_terminal_operations` intentionally uses RLS with no policy while only `service_role` has RPC EXECUTE; the UI is only a projection. Finance-restricted customer reads omit amounts rather than returning misleading zeros.
- Settings Kiosk and order-data routes use exact default-off dual flags. Any confirmed cross-store data,
  transient secret, output identity, unauthorized write, missing high-risk audit, or post-failure partial
  write is a zero-tolerance release stop; local flags and mocks are not production proof.
- Custody changes require server-side store/actor/role checks, version locking and redacted audit events; anon/authenticated cannot execute custody RPCs and NULL actors/targets fail closed. Migration `20260717182220` intentionally allows customer-held devices to retain credentials. Raw secrets remain separately permissioned and are excluded from ordinary offline drafts and event/audit payloads; a boolean re-entry marker is safe to persist.
- `TASK-20260717-004-order-diagnosis-quote-implementation` enforces same-store active actor checks, narrow non-grantable quote authority, CAS and idempotency in both quote RPCs. Both functions are security invoker with an empty search path; only service role has EXECUTE, while PUBLIC/anon/authenticated are denied. Message and audit payloads retain only bounded quote/send evidence.
- Store lifecycle mutations use recent TOTP/AAL2 and one-use challenges, immutable store UUID binding, service-role-only destructive RPCs and a second approval for purge. The 2026-07-18 production slice has zero browser table/function grants and remains dormant behind five off-by-default flags; schema presence is not activation authority.

## Interfaces and dependencies

`TASK-20260718-008-order-cost-phase2` production-verifies the cost-data boundary: browser roles
have zero direct privileges on all 11 Phase 2 tables and 21 RPC overloads; server permissions,
store scope and feature flags fail closed; unauthorized UI does not mount profit, export,
procurement, backfill or currency controls. No cost is added to customer DTOs, print, messaging,
Realtime or offline storage.

| Provides / consumes | Counterparty | Contract | Failure handling | Evidence | Status |
|---|---|---|---|---|---|
| TBD | TBD | TBD | TBD | — | unknown |
| Terminal mutation authorization | Backend + Data + Frontend | Store membership/role, allowed fields, expected version, reason and idempotency are server/DB enforced; immutable evidence is retained | Deny browser RPC execution and generic-update/batch bypasses; zero write on failure | TASK-20260716-003-customer-finance-order-correction-plan E-015, E-024, E-025 | verified |

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
| SEC-20260710-001 | Reviewed legacy browser-role grants were revoked under exact Owner-approved containment; RLS/default ACL/policy/function residuals and observation gaps remain | Residual customer/business data and governance exposure | Security + Data + Owner | separate R4 hardening and fresh release review | contained_residual_open |
| SEC-20260710-002 | One plaintext unlock pattern remains and no approved retention/key-management policy exists | Sensitive device-access secret risk | Security + Data + Owner | policy decision before encryption migration, purge or export | blocked_by_policy |
| SEC-20260713-003 | Buyback evidence retention, staged-file deletion, runtime bucket/RLS grants, legal wording and advanced file sanitization are not production-verified | Identity-document/privacy exposure | Security + Data + Operations + Owner | approved production-readiness/legal task before evidence activation | contained_by_feature_off_and_revoked_runtime_acl |
| SEC-20260716-004 | Custody and credential retention previously conflicted across code/memory | False custody evidence or unintended secret clearing | Security + Backend + Product + Owner | `20260717182220` superseding `20260716235650`, UI/E2E and linked dry-run evidence | mitigated_scoped_verified |
| SEC-20260713-001 | Kiosk limiting/token/retention/signature policy and order-data ingress/retention/limiting remain unapproved | PII abuse, leakage or over-retention | Security + Data + Operations + Owner | before Kiosk or order-data production unit | open |
| SEC-20260718-001 | Real AI requests would expose device images/identifiers without approved budget, DPA/ZDR/region/retention/deletion, durable limiting or server image sanitation | Privacy, cross-border, secret, cost and abuse risk | Security + Privacy + Architecture + Owner | independent R4/D4 approval before any provider activation | contained_by_fail_closed_flags |
| SEC-20260718-002 | Lifecycle purge retry-baseline proof does not independently bind a retry to the original approved baseline | Permanent tenant deletion could be authorized from incomplete retry evidence | Security + Data + Operations + Owner | keep worker/scheduler/flags off until a reviewed forward fix and adversarial retry tests pass | blocked_activation |

## Lessons and anti-patterns

- Do not infer project facts from the generic AI Company OS template.
- Promote repeated evidence, not stylistic preference, into durable standards.
- Auth email links are bearer credentials and prove only control of the current Auth email. Never persist them in business invitations, consume them on GET, or grant store access outside the atomic matching-invitation RPC.
- Hosted Auth template updates must preserve live MFA, OTP frequency/length and existing redirect callbacks; review the remote/local diff before confirmation instead of pushing local defaults wholesale.

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
| 2026-07-11 | Added verified private PII staging, explicit historical-consent false and fail-closed rollback controls | TASK-20260711-001-seatable-repairdesk-import | Integration Lead + Security Reviewer | verified |
| 2026-07-12 | Verified global staff permissions, membership-ID order scope, kiosk PII gate and authority-loss cache purge | TASK-20260712-002-global-staff-permissions | Security reviewer + Integration Lead | active |
| 2026-07-13 | Added custody-return authorization, import minimization and archive-search boundary | TASK-20260712-005-order-custody-archive | Security reviewer + Integration Lead | active |
| 2026-07-13 | Preserved history/detail authority while removing terminal orders from the default homepage | TASK-20260713-001-order-active-status-homepage | Integration Lead + QA reviewer | active |
| 2026-07-13 | Added verified buyback role/PII/evidence/signature/idempotency/upload-envelope controls and production NO-GO | TASK-20260712-005-buyback-guided-evidence | Security reviewer + Integration Lead | verified_local |
| 2026-07-14 | Activated production default-deny containment for all sensitive buyback paths and preserved the separate migration/legal approval gate | TASK-20260714-001-buyback-sensitive-evidence-feature-off | Security reviewer + Integration Lead | active |
| 2026-07-14 | Verified dormant production schema remains empty and inaccessible to every runtime role after migration apply | TASK-20260714-002-buyback-supabase-schema-staging | Security reviewer + Integration Lead | scoped_verified |
| 2026-07-16 | Verified actor-scoped Dashboard priority, compact DTO denylist and cached-data permission-revocation hiding | TASK-20260716-001-dashboard-handoff-priority | Security reviewer + Integration Lead | active |
| 2026-07-16 | Verified service-role-only terminal RPCs, layered bypass denial and finance-redacted customer projection | TASK-20260716-003-customer-finance-order-correction-plan | Security reviewer + Integration Lead | scoped_verified |
| 2026-07-13 | Recorded Settings dual-flag containment and zero-tolerance tenant/PII/partial-write stops | TASK-20260712-004-settings-center-master-plan | Integration Lead + WP08 release reviewer | local_contract |
| 2026-07-17 | Verified custody permission, tenant, NULL-input and unlock-secret controls in app, pgTAP and production ACL/constraint postchecks | TASK-20260716-005-device-custody-status-implementation | Security reviewers + Integration Lead | scoped_verified |
| 2026-07-17 | Verified quote role/tenant/CAS/idempotency controls and service-role-only production RPC ACLs | TASK-20260717-004-order-diagnosis-quote-implementation | Security/Data reviewers + Integration Lead | scoped_verified |
| 2026-07-17 | Superseded automatic custody secret clearing while preserving permission, offline and audit minimization boundaries | TASK-20260717-008-desktop-novice-ui-implementation | Security/QA reviewers + Integration Lead | scoped_verified |
| 2026-07-17 | Verified current-Auth-email binding, prefetch-safe token POST, service-role-only atomic acceptance and redacted delivery failures | TASK-20260717-employee-invite-registration | Security/QA reviewers + Integration Lead | scoped_verified |
| 2026-07-18 | Verified production cost-data ACL/permission/tenant containment and dormant child-feature behavior | TASK-20260718-008-order-cost-phase2 | Security/Data reviewers + Integration Lead | scoped_verified_option_b |
| 2026-07-18 | Verified AI server-derived authority, audit minimization, CDN-free local recognition, pre-decode image limits and production no-key/no-call dormant state | TASK-20260718-009-ai-assistant-implementation | Security/Architecture reviewer + Integration Lead | scoped_verified_dormant |
| 2026-07-18 | Verified all-request abuse control, HMAC safety identifiers, aggregate-only cost audit, zero enabled policy and no key/call/apply Phase 3A boundary | TASK-20260718-011-ai-assistant-cost-governance | Security/Data reviewer + Integration Lead | verified_dormant_candidate |
| 2026-07-18 | Verified store-default migration changed no RLS/policy/ACL, Inventory V2 remained ungranted/off and lifecycle purge activation stayed blocked | TASK-20260718-012-workspace-integration-release | Security/Data reviewers + Integration Lead | scoped_verified |
