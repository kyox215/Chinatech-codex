---
schema_version: 1
department: data
status: active
owner: Data Department / Integration Lead
last_verified_at: 2026-06-20
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
- Because server repositories use the service-role/admin path, server-side authorization remains the decisive write-control boundary even when RLS exists as a database guardrail.
- `TASK-20260619-231154-l2-027-audit-log-redaction-and-minimizatio/AUDIT_LOG_REDACTION_POLICY.md` classifies audit-row retention risk and keeps live audit-row sampling, retention changes, purge, historical redaction/backfill, audit-reader grants, and schema/RLS changes approval-gated.

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
| DATA-20260619-001 | Local migration files may not match production Supabase state | Release or data-operation risk | Data + Security | before production DB work | open |
| DATA-20260619-002 | Duplicate ` 2.sql` migration files existed locally | Migration review/tooling confusion | Data + QA | byte-identical migration duplicates removed by TASK-20260619-012; reopen if new migration duplicates appear | closed |
| DATA-20260619-003 | Batch B duplicate migrations disagreed on `repaired` workflow mapping and `quoted -> parts_ordered` transition | Incorrect cleanup/merge could distort order workflow history | Data + Product | semantic decision confirmed by TASK-20260619-008; stale duplicate files deleted by TASK-20260619-009 | closed |
| DATA-20260620-001 | Live Supabase grants/RLS/storage/platform-admin parity is not verified by the local permission matrix | Production access-control drift | Data + Security + Owner | D3-approved read-only remote audit | open |
| DATA-20260620-002 | Existing live audit rows may already contain raw sensitive payloads | Privacy, retention, and cleanup risk | Data + Security + Owner | D4-approved historical exposure assessment before purge/backfill | unknown_live_state |
| DATA-20260710-001 | 17 linked legacy public tables have RLS disabled and direct anon/authenticated privileges | Critical unauthorized-access surface; blind revoke may break an old consumer | Data + Security + Owner | P0 consumer discovery, then staged revoke/RLS with rollback | open |
| DATA-20260710-002 | Historical migration chain cannot reset from zero at `20260611102805`; backup/PITR restore proof is absent | Disaster recovery cannot be demonstrated | Data + Operations | P0 trusted baseline reconstruction and isolated restore drill | open |

## Lessons and anti-patterns

- Do not infer project facts from the generic AI Company OS template.
- Promote repeated evidence, not stylistic preference, into durable standards.
- If linked Supabase catalog queries hit pooler auth or circuit-breaker errors after parallel calls, do not infer schema absence; wait briefly and rerun the necessary query serially.
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
