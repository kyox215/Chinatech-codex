---
schema_version: 1
department: data
status: active
owner: Data Department / Integration Lead
last_verified_at: 2026-07-17
review_trigger: relevant-task-or-quarterly-review
---

# Data Department Memory

## Mission and boundary

Schemas, invariants, migrations, indexing, backup/restore, retention, and data quality.

This department advises and maintains its own standards. It does not obtain
legal, financial, production, or organization authority merely by being named
as owner of this file.

## Current objectives and work in progress

- Maintain Supabase schema, migrations, RLS, storage buckets, functions, indexes, and data-quality invariants.
- First priority: verify remote Supabase migration/RLS parity before any production data or schema work.

## Verified rules and conventions

- Local migrations cover orders, customers/devices/CRM, inventory/buyback, store tenancy, settings/templates, workflow status, audit, platform onboarding, and private attachment storage.
- Production Supabase state is not verified by local repo inspection.
- Service-role operations and remote data changes require explicit owner approval.
- Duplicate migration files with ` 2.sql` must not be merged into canonical migration history. Confirm domain/data semantics first, then delete only with Owner approval.
- Current canonical order workflow intent keeps `mail_in_progress` and `repaired` in repair-stage semantics until notification/pickup handling; `TASK-20260619-008` confirmed the Batch B duplicate files are stale conflict evidence, not authority.
- `quoted -> parts_ordered` remains a valid order transition. Batch B duplicate migration content that omits or contradicts this should not be merged.
- `TASK-20260619-009` removed the three Batch B stale duplicate migration files only; canonical migration history and production data were not changed.
- `TASK-20260619-012` removed 15 current byte-identical duplicate migration files with ` 2.sql` names after SHA-256 verification; canonical migration files and production data were not changed.
- `TASK-20260620-004` verified local migrations for store tenancy, same-store foreign keys, member SELECT RLS policies, platform onboarding, audit logs, and private attachment storage. This remains local evidence only; remote Supabase parity is still unknown.
- `TASK-20260709-220940-task` scoped-verified linked Supabase migration history on 2026-07-10: local/remote migrations aligned through `20260709235000`, `supabase db push --linked --dry-run --include-all` reported up to date, and `store_member_permission_grants` existed with RLS enabled and table grants limited to `postgres`/`service_role`. This does not prove broad production schema/RLS parity beyond that history/table evidence.
- `TASK-20260710-009` scoped-verified the live payment ledger/RPC at migration `20260710145642`: immutable ledger, validated constraints, RLS, no browser-role table/function privileges, service-role-only command path, invoker/empty search path, advisory idempotency lock and order row lock. This is a migration-slice PASS, not an environment Gate PASS.
- `TASK-20260711-001` verified a bounded bulk-import pattern: target-bound deterministic IDs, private API-revoked staging, catalog/constraint fingerprints, set-based single-transaction inserts, in-transaction tenant/count/money assertions, and forced rollback rehearsal before commit.
- `TASK-20260712-001` verified an exact-manifest status reclassification pattern: source provenance plus expected old tuple/timestamp, short row locks, minimized before-image, forced rollback before commit, independent post-check, and selective recovery that stops after later business activity.
- SeaTable status is authoritative for status, notification and handover evidence. `到货已通知` and `修好已通知` set notification state but never delivery timestamps; problem/work text must not override these compound states.
- `TASK-20260712-005-order-custody-archive` validates the production repair SOP: exact store/source scope, minimal before-image, no-later-activity guard, forced patch rollback rehearsal, formal apply, selective restore rollback rehearsal, and independent post-check. Its 51-row batch changed only workflow/status evidence and audit events, with no customer, device, finance, attachment or cross-store mutation.
- Freeze and compare the exact current local and linked migration sets before every Settings database
  decision. Applied history is immutable; the sole current Settings candidate is Kiosk
  `20260714180000`. A linked dry-run must contain only the reviewed set; never use `--include-all` to bypass
  drift. Preview expiry is not PII deletion, and batch header plus rows require atomic staging.
- Because server repositories use the service-role/admin path, server-side authorization remains the decisive write-control boundary even when RLS exists as a database guardrail.
- `TASK-20260619-231154-l2-027-audit-log-redaction-and-minimizatio/AUDIT_LOG_REDACTION_POLICY.md` classifies audit-row retention risk and keeps live audit-row sampling, retention changes, purge, historical redaction/backfill, audit-reader grants, and schema/RLS changes approval-gated.
- `TASK-20260712-005-buyback-guided-evidence` adds a local migration contract for private restricted evidence, agreement/payment/evidence atomic finalize, idempotency and serial locking. It is not production evidence: linked dry-run, dual-schema fixtures, RPC grants/RLS, `storage.objects` policies, concurrent calls and cleanup/retention behavior must pass before apply.
- `TASK-20260714-001-buyback-sensitive-evidence-feature-off` read-only verified after release that migration `20260712150000` remains local-only, remote-only `20260714004500` is unrelated, and production has no `buyback_agreements`, finalize RPC, eight guided-evidence columns or dedicated evidence bucket. No migration, DDL, DML, Storage or customer-data write was executed; application containment is compatible with the old schema.
- `TASK-20260714-002-buyback-supabase-schema-staging` supersedes that schema-absence snapshot: production migration `20260712150000` is now applied as dormant staging after exact CLI dry-run, UUID/Text PG17 fixtures, fail-before-write and runner-atomicity proof. Agreement rows, evidence objects, payment anomalies and attachment relabels are zero; all runtime table DML/RPC EXECUTE remain false. This is a target-slice PASS, not full-history or restore certification.
- `TASK-20260716-002-orders-mobile-filter-loading-plan` verified a no-migration Orders performance release: production had 6,286 orders / 175 active / 2 stores, existing store/status and store/assignee indexes, and an acceptable scoped EXPLAIN. The application now uses a narrow index pass plus at most 50 detail rows; add a read model or index only after production p95/volume evidence.
- `TASK-20260716-003-customer-finance-order-correction-plan` applied production migrations `20260716221119`, `20260716221139`, `20260716221159` and `20260716221448`: additive customer v3 finance/history facts, lifecycle/terminal-operation audit state, service-role-only atomic terminal RPCs, validated same-store CRM references and covering indexes. Fresh current-schema PG17 replay and pgTAP 102/102 passed; final production anomalies were zero. This bounded slice does not close the older full-history reset/PITR risk.
- `TASK-20260716-004-device-left-status-plan` proposes an additive nullable custody column: add without a default so legacy rows stay NULL, then set a future `with_shop` default for omitted creates. No migration exists or has been applied; production parity must be checked again before any D3 operation.

## Interfaces and dependencies

| Provides / consumes | Counterparty | Contract | Failure handling | Evidence | Status |
|---|---|---|---|---|---|
| TBD | TBD | TBD | TBD | — | unknown |
| Customer/order lifecycle schema | Backend + Security + Operations | History retained; invalid lifecycle rows excluded from valid aggregates; terminal commands serialize and audit; CRM order links are same-store | Refuse invalid/stale/cross-store writes; forward-fix additive migrations and retain v2 compatibility | TASK-20260716-003-customer-finance-order-correction-plan E-014..E-025 | scoped_verified |

## SOPs and checklists

- Relevant Skills under `.agents/skills/` are candidate procedures.
- Project-specific commands and paths require verification before promotion.

## Risks, debt, and open questions

| ID | Risk/debt/question | Impact | Owner | Target/review | Status |
|---|---|---|---|---|---|
| DATA-20260619-001 | Local migration files may not match production Supabase state | Release or data-operation risk | Data + Security | before production DB work | open |
| DATA-20260619-002 | Duplicate ` 2.sql` migration files existed locally | Migration review/tooling confusion | Data + QA | byte-identical migration duplicates removed by TASK-20260619-012; reopen if new migration duplicates appear | closed |
| DATA-20260619-003 | Batch B duplicate migrations disagreed on `repaired` workflow mapping and `quoted -> parts_ordered` transition | Incorrect cleanup/merge could distort order workflow history | Data + Product | semantic decision confirmed by TASK-20260619-008; stale duplicate files deleted by TASK-20260619-009 | closed |
| DATA-20260620-001 | Live Supabase grants/RLS/storage/platform-admin parity is not verified by the local permission matrix | Production access-control drift | Data + Security + Owner | D3-approved read-only remote audit | open |
| DATA-20260620-002 | Existing live audit rows may already contain raw sensitive payloads | Privacy, retention, and cleanup risk | Data + Security + Owner | D4-approved historical exposure assessment before purge/backfill | unknown_live_state |
| DATA-20260710-001 | Reviewed legacy objects had direct browser-role privileges; the exact reversible revoke is contained, while RLS/default ACL/policy and consumer uncertainty remain | Residual unauthorized-access and compatibility risk | Data + Security + Owner | separate R4 hardening and current observation/release review | contained_residual_open |
| DATA-20260710-002 | Historical migration chain cannot reset from zero at `20260611102805`; backup/PITR restore proof is absent | Disaster recovery cannot be demonstrated | Data + Operations | P0 trusted baseline reconstruction and isolated restore drill | open |
| DATA-20260713-003 | Buyback restricted-evidence runtime grants, staged cleanup and retention/legal-hold behavior remain unverified for activation; dormant schema is present but empty and revoked | PII exposure, orphan files or noncompliant retention | Data + Security + Operations + Owner | separate approved production-readiness task before evidence activation | contained_by_feature_off_and_revoked_runtime_acl |
| DATA-20260716-004 | Order device-custody migration and legacy NULL preservation exist only as a proposal | False historical custody, rollout mismatch, or silent field loss | Data + API + Security + Owner | implementation WP-01 and D3 production gate | proposed |
| DATA-20260713-001 | Settings candidate migrations, scheduled cleanup, transaction sizing and restore evidence are not linked-environment proven | Data loss/privacy/release risk | Data + Security + Operations + Owner | exact preflight/dry-run/apply/post-check gates | open |

## Lessons and anti-patterns

- Do not infer project facts from the generic AI Company OS template.
- Promote repeated evidence, not stylistic preference, into durable standards.
- If linked Supabase catalog queries hit pooler auth or circuit-breaker errors after parallel calls, do not infer schema absence; wait briefly and rerun the necessary query serially.
- Never silently clamp `deposit > quotation`; require an Owner-approved policy, regenerate the manifest, and reach zero money-invariant violations before staging.
- A target-schema clone plus pgTAP validates a bounded migration but cannot replace a full recovery/restore drill.

## Capability and tool notes

| Agent/Skill | Current evidence | Capability | Permission | Limitation |
|---|---|---|---|---|
| TBD | none | C0/C1 | task-specific | not evaluated |

## Memory change log

| Date | Change | Source/task | Author/reviewer | Status |
|---|---|---|---|---|
| 2026-06-19 | Initial RepairDesk data baseline synchronized | TASK-20260619-003 | Integration Lead | active |
| 2026-06-19 | Added duplicate migration semantic-conflict guardrail | TASK-20260619-005 | Integration Lead | active |
| 2026-06-19 | Confirmed Batch B order workflow migration duplicates are stale | TASK-20260619-008 | Integration Lead | active |
| 2026-06-19 | Deleted Batch B stale duplicate migration files without changing canonical history | TASK-20260619-009 | Integration Lead | active |
| 2026-06-19 | Deleted 15 current byte-identical duplicate migration files without changing canonical history or production data | TASK-20260619-012 | Integration Lead | active |
| 2026-06-20 | Added local tenant/RLS permission baseline and remote parity risk | TASK-20260620-004 | Integration Lead | active |
| 2026-06-20 | Added audit retention/live-row approval boundary from L2-027 policy | TASK-20260619-231154-l2-027-audit-log-redaction-and-minimizatio | Integration Lead | policy_drafted |
| 2026-07-10 | Added scoped linked migration-history and supplier permission-grant table verification | TASK-20260709-220940-task | Integration Lead | scoped_verified |
| 2026-07-10 | Added payment transaction contract, legacy-table exposure and recovery-chain risks | TASK-20260710-009 | Integration Lead | scoped_verified |
| 2026-07-11 | Added verified private-staging, single-transaction and rollback-rehearsal import pattern | TASK-20260711-001-seatable-repairdesk-import | Integration Lead + DATA/SEC | verified |
| 2026-07-11 | Added exact-manifest production reclassification and selective recovery pattern | TASK-20260712-001-seatable-status-reclassification | Integration Lead + DATA/SEC | verified |
| 2026-07-13 | Added SeaTable authority rules and verified guarded production status-repair SOP | TASK-20260712-005-order-custody-archive | Integration Lead + data reviewer | scoped_verified |
| 2026-07-13 | Added local atomic buyback/evidence migration contract and explicit production NO-GO | TASK-20260712-005-buyback-guided-evidence | Integration Lead + security reviewer | verified_local |
| 2026-07-14 | Verified linked migration/catalog remained unchanged after the production feature-off release | TASK-20260714-001-buyback-sensitive-evidence-feature-off | Integration Lead | scoped_verified_no_write |
| 2026-07-14 | Applied and catalog/ACL/empty-state verified dormant buyback schema staging without runtime enable | TASK-20260714-002-buyback-supabase-schema-staging | Integration Lead + DATA/SEC/REL reviewers | scoped_verified |
| 2026-07-16 | Verified and postchecked a production Orders query optimization that required no migration, DDL, RPC or data write | TASK-20260716-002-orders-mobile-filter-loading-plan | Integration Lead + DATA/SEC reviewer | scoped_verified_no_write |
| 2026-07-16 | Applied and postchecked four customer finance/order lifecycle migrations after exact PG17 replay | TASK-20260716-003-customer-finance-order-correction-plan | Integration Lead + DATA/SEC/release reviewers | scoped_verified |
| 2026-07-13 | Recorded Settings migration order, exact-set dry-run, retention and atomic-staging boundaries | TASK-20260712-004-settings-center-master-plan | Integration Lead + WP08 release reviewer | local_contract |
