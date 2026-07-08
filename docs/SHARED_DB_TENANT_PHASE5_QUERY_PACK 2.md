# Shared DB Tenant Isolation Phase 5 Query Pack

Last updated: 2026-07-07
Owner: Hexiang Huang / 鹤祥
Status: prepared; full live SQL query pack not executed; CLI preflight is blocked on migration-history mismatch
Source runbook: `docs/SHARED_DB_TENANT_PHASE5_VERIFICATION_RUNBOOK.md`
Approval packet: `docs/SHARED_DB_TENANT_PHASE5_APPROVAL_PACKET.md`

## Purpose

This file is the execution index for Phase 5 read-only verification. The SQL source of truth remains the runbook; this pack defines execution order, expected evidence, and stop conditions so the verification can be repeated without relying on chat history.

No live or linked Supabase command may run until the Owner approves the approval packet. The previously approved CLI preflight stopped at Step 1 because remote migration history does not match local files; do not continue to Step 2 or later until that mismatch is reconciled or explicitly remediated.

## Pack Metadata

```text
query_pack_id: shared-db-tenant-phase5
query_pack_version: 2026-07-07.1
source_runbook: docs/SHARED_DB_TENANT_PHASE5_VERIFICATION_RUNBOOK.md
approval_packet: docs/SHARED_DB_TENANT_PHASE5_APPROVAL_PACKET.md
execution_mode: read-only
redaction: counts/booleans/names/error-codes only
runbook_hash: capture immediately before approved execution
query_pack_hash: capture immediately before approved execution
approval_packet_hash: capture immediately before approved execution
```

This pack is an execution index, not a duplicate SQL file. The SQL source remains the runbook to avoid drift.

## Hash Capture

Capture hashes immediately before any approved execution window:

```bash
shasum -a 256 docs/SHARED_DB_TENANT_PHASE5_VERIFICATION_RUNBOOK.md
shasum -a 256 docs/SHARED_DB_TENANT_PHASE5_QUERY_PACK.md
shasum -a 256 docs/SHARED_DB_TENANT_PHASE5_APPROVAL_PACKET.md
```

Record only hashes and file names. Do not paste secrets, environment variables, connection strings, or token-bearing URLs.

## Universal Execution Guard

Use a read-only transaction whenever the SQL client supports it:

```sql
begin transaction read only;
set local statement_timeout = '15s';
-- run one query block
rollback;
```

Stop immediately if the client cannot enforce read-only mode and the operator is not certain the query is metadata/count-only.

## Execution Order

| Step | Runbook section | Evidence to record | Pass threshold | Stop condition |
|---|---|---|---|---|
| 0 | Required Inputs | Completed approval packet fields | All required fields present | Missing target, operator, backup proof, or redaction owner |
| 1 | Supabase CLI Preflight | CLI version, linked project ref, dry-run summaries | Expected target; dry-runs only; no migration-history mismatch; no unexpected pending migrations | Wrong target, migration-history mismatch, `db dump --dry-run` failure, destructive pending migration, offline draft pending unexpectedly |
| 2 | Migration Inventory Template | Required migration applied booleans; excluded draft list | Required tenant/privacy migrations present; offline drafts absent unless approved | Missing required migration or unapproved draft found live |
| 3 | Store ID Column Presence | table_exists, has_store_id, nullable/default summary | All store-scoped tables exist and have `store_id` | Missing table/column, unsafe default, unexpected nullable |
| 4 | Null Store ID Counts | table_name and null count | Zero nulls for store-scoped live tables | Any non-zero count without approved remediation |
| 5 | Default Store Residue | table_name and default-store count | Counts explained as ChinaTech seed/legacy data | Default-store rows include partner-store live business data or cannot be explained |
| 6 | Constraint And FK Validity | constraint names, validation booleans | Required same-store constraints exist and validate | Missing or unvalidated critical tenant constraint |
| 7 | Same-Store Unique Indexes | index names and existence | Required composite indexes present | Missing index needed by same-store FK |
| 8 | RLS And Policies | relrowsecurity, policies, roles | RLS enabled where exposed; policies are membership-scoped | Public/anon/auth grants without approved rationale |
| 9 | Security Definer Functions And Public Views | function/view names and grants | No exposed unsafe definer function or bypass view | Callable unsafe definer function or public bypass view |
| 10 | Storage Buckets And Attachment Metadata | bucket public flag, metadata anomaly counts | Private buckets; zero public URL/wrong bucket/path anomalies | Public bucket, public URLs, wrong bucket, invalid prefix |
| 11 | Grants And Exposed Schema Access | grants for tables/sequences/routines | No unexpected public/anon/auth grants | Direct grant exposes tenant data or unsafe routine |
| 12 | Control-Plane RLS And Grants | control-plane policies/grants | Control-plane tables do not leak store discovery data | Store list, owner email, request, or invite leak path |
| 13 | Realtime Private Broadcast Boundary | publication/policy summary | No broad cross-store broadcast path | Tenant data broadcast without membership boundary |
| 14 | Cross-Table Tenant Mismatch Counts | mismatch counts | Zero mismatches | Any non-zero mismatch without remediation package |
| 15 | Default Master-Data Completeness | per-store default counts | Active stores have required settings/workflow/templates | Active store missing required defaults |
| 16 | Control-Plane Invariants | owner/request/invite invariant counts | Zero active-store-without-owner and unsafe owner-grant paths | Any active store lacks owner, or join path can grant owner |
| 17 | PostgREST Schema Cache Visibility | route/API/schema-cache result summary | App sees required store-scoped columns | Missing-column/schema-cache error |
| 18 | Non-Service RLS And Storage Behavior Smoke | pass/fail per approved test identity | Cross-store/non-member access denied | Valid cross-store read/write/signing path found |
| 19 | Service-Role Repository Matrix | domain-by-domain bypass review | Every service-role path has server-side store/role checks | Any repository relies on service role without app authorization |
| 20 | Invite Attempt And Audit Retention | counts only | Retention decision recorded; no unnecessary PII output | Raw sensitive fields retained without decision or exported into evidence |
| 21 | Observation Metrics | API/schema/storage error baseline | No new unexpected errors during window | Error spike or tenant-isolation anomaly |

## Executable Block Manifest

Use the runbook section titles as the stable source pointer. If line numbers drift, re-open the section title rather than relying on stale chat references.

| Query ID | Runbook section | Kind | Evidence field | Stop on |
|---|---|---|---|---|
| Q00 | Required Inputs | approval | approval_packet_complete | Missing approval field |
| Q01 | Supabase CLI Preflight | CLI dry-run | cli_preflight_result | Wrong target or unsafe pending migration |
| Q02 | Migration Inventory Template | SQL metadata | migration_inventory_result | Missing required migration or unapproved draft |
| Q03 | Store ID Column Presence | SQL metadata | schema_result | Missing table/column, unsafe nullable/default |
| Q04 | Null Store ID Counts | SQL count | null_store_id_result | Non-zero null count |
| Q05 | Default Store Residue | SQL count | default_store_result | Unexplained default-store partner data |
| Q06 | Constraint And FK Validity | SQL metadata | constraint_result | Missing/unvalidated required constraint |
| Q07 | Same-Store Unique Indexes | SQL metadata | index_result | Missing required composite index |
| Q08 | RLS And Policies | SQL metadata | rls_policy_result | Missing RLS or unsafe broad policy |
| Q09 | Security Definer Functions And Public Views | SQL metadata | routine_view_result | Unsafe callable definer function or bypass view |
| Q10 | Storage Buckets And Attachment Metadata | SQL count/metadata | storage_result | Public bucket/url or invalid attachment metadata |
| Q11 | Storage Object Prefix Counts | SQL count | storage_object_result | Object prefix outside store/object pattern |
| Q12 | Grants And Exposed Schema Access | SQL metadata | grants_result | Unsafe public/anon/auth grant |
| Q13 | Control-Plane RLS And Grants | SQL metadata | control_plane_result | Store discovery or invite/request leak path |
| Q14 | Realtime Private Broadcast Boundary | SQL metadata | realtime_result | Cross-store broadcast or direct client mutation path |
| Q15 | Cross-Table Tenant Mismatch Counts | SQL count | mismatch_result | Non-zero mismatch count |
| Q16 | Store Default Master-Data Completeness | SQL count | defaults_result | Active store missing required defaults |
| Q17 | Control-Plane Invariants | SQL count | invariant_result | Active store without owner or owner-grant join path |
| Q18 | PostgREST Schema Cache Visibility | REST/API check | schema_cache_result | Missing tenant-critical column in API view |
| Q19 | RLS And Storage Behavior Smoke | behavior smoke | behavior_smoke_result | Cross-store/non-member read/write/signing succeeds |
| Q20 | Service-Role Repository Matrix | source review | service_role_matrix_result | Service-role path lacks app-side tenant/role check |
| Q21 | Invite Attempt And Audit Retention | SQL count/policy | retention_result | Retention/anonymization undecided or PII exported |
| Q22 | Observation Metrics | operational review | observation_result | Error spike or tenant anomaly |

## Evidence Record

Use one record per execution window:

```text
query_pack_id:
query_pack_version:
source_runbook_revision:
target_project_ref:
target_environment:
executor:
approver:
observer:
started_at:
finished_at:
read_only_guard_used:
statement_timeout:
cli_preflight_result:
migration_inventory_result:
schema_result:
rls_storage_result:
control_plane_result:
behavior_smoke_result:
service_role_matrix_result:
no_go_result:
redacted_output_path:
notes_without_pii:
```

## Redacted Result Table

| Step | Result | Evidence path | No-go? | Notes without PII |
|---|---|---|---|---|
| 0 | not_run |  |  |  |
| 1 | not_run |  |  |  |
| 2 | not_run |  |  |  |
| 3 | not_run |  |  |  |
| 4 | not_run |  |  |  |
| 5 | not_run |  |  |  |
| 6 | not_run |  |  |  |
| 7 | not_run |  |  |  |
| 8 | not_run |  |  |  |
| 9 | not_run |  |  |  |
| 10 | not_run |  |  |  |
| 11 | not_run |  |  |  |
| 12 | not_run |  |  |  |
| 13 | not_run |  |  |  |
| 14 | not_run |  |  |  |
| 15 | not_run |  |  |  |
| 16 | not_run |  |  |  |
| 17 | not_run |  |  |  |
| 18 | not_run |  |  |  |
| 19 | not_run |  |  |  |
| 20 | not_run |  |  |  |
| 21 | not_run |  |  |  |

## Result Classification

- `pass`: all no-go thresholds passed and evidence is redacted.
- `conditional`: one or more checks are inconclusive, but no direct tenant leak or unsafe migration path was found.
- `block`: any no-go threshold failed, target is wrong, read-only guard is unavailable for unsafe query execution, or evidence would require exposing raw PII/secrets.

## Operator Notes

- Run one query block at a time.
- Do not paste raw result tables into chat when they contain row-level identifiers.
- Prefer counts and booleans over samples.
- If a query fails because a table is missing, record the table name and error code only.
- If the result is unexpected, stop and create a remediation package before running follow-up row sampling.
- Do not continue into Phase 6 from this file; Phase 6 needs a separate approval and release plan.
