# Shared DB Tenant Isolation Phase 5 Verification Runbook

Last updated: 2026-07-07
Owner: Hexiang Huang / 鹤祥
Status: owner-approved linked CLI preflight ran and blocked on migration-history mismatch; full live SQL query pack has not run

Companion files:

- Approval packet: `docs/SHARED_DB_TENANT_PHASE5_APPROVAL_PACKET.md`
- Query pack index: `docs/SHARED_DB_TENANT_PHASE5_QUERY_PACK.md`

## Purpose

Phase 5 proves whether the live Supabase database, RLS policies, storage buckets, and schema cache match the shared-database tenant-isolation model.

This phase is verification-first. It does not apply migrations, backfill production rows, change RLS/storage policies, deploy, or delete data unless the Owner gives explicit approval for that exact action.

## Current Decision

- One shared Supabase/Postgres database for all stores.
- One codebase and one global schema path.
- Store privacy is enforced with `store_id` isolation in application code, database constraints, RLS defense in depth, and private server-routed storage.

## Official Supabase Basis

This runbook follows current Supabase guidance checked on 2026-07-07:

- Data API exposure is controlled by grants, and row visibility is controlled by RLS: https://supabase.com/docs/guides/api/securing-your-api
- RLS must be enabled for tables in exposed schemas such as `public`: https://supabase.com/docs/guides/database/postgres/row-level-security
- Storage access is controlled through RLS policies on `storage.objects`: https://supabase.com/docs/guides/storage/security/access-control
- `supabase db push --dry-run` shows pending remote changes before applying: https://supabase.com/docs/reference/cli/supabase-db-push
- `supabase migration list` compares local migration files with remote migration history: https://supabase.com/docs/reference/cli/supabase-migration-list
- `supabase db dump` is the supported CLI backup path before restore/migration work: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore

## Stop Conditions

Stop and ask the Owner before:

- Running any live or linked Supabase query, even read-only, unless the Owner has confirmed the target project for this verification window.
- Running any linked Supabase migration apply.
- Running SQL that writes data, changes schema, reloads PostgREST schema, changes policies, or changes storage bucket settings.
- Backfilling, deleting, anonymizing, or moving production rows.
- Deploying, promoting, aliasing, or pushing a production release.
- Sharing live customer PII or production data in screenshots, logs, docs, or agent prompts.

Current blocker:

- Linked CLI preflight reported remote migration versions that are not present locally: `20260611103402`, `20260611103627`, `20260611171345`, `20260613101014`, `20260619194103`, `20260621074627`, and `20260701214123`.
- Do not run the full live SQL query pack until migration history is reconciled or every mismatch has an Owner-approved remediation plan.
- Do not run `supabase migration repair`, `supabase db pull`, linked migration apply, schema-cache reload, deployment, push, production mutation, backfill, anonymization, or Phase 6 without separate explicit Owner approval.

## Required Inputs

Use `docs/SHARED_DB_TENANT_PHASE5_APPROVAL_PACKET.md` as the Owner-facing approval record before running any live or linked Supabase command.

- Explicit Owner approval to run read-only verification against the named live/linked Supabase target.
- Confirm target Supabase project ref.
- Confirm current production deployment target.
- Confirm backup/restore method and whether restore has been tested.
- Confirm backup artifact identifier, backup timestamp, restore-drill target, restore result, RPO/RTO estimate, restore owner, and sign-off owner.
- Confirm acceptable maintenance window if a later migration is approved.
- Confirm whether old default-store rows are expected for ChinaTech seed data.
- Confirm whether `supabase/migrations/20260707090000_repairdesk_offline_operations.sql` and `supabase/migrations/20260707110000_repairdesk_offline_order_sync_rpc_draft.sql` are only local approval drafts and must not be applied in Phase 5.

## Read-Only Execution Envelope

All live SQL in this runbook must be executed inside a read-only transaction when the SQL client supports it:

```sql
begin transaction read only;
set local statement_timeout = '15s';
-- paste one verification block here
rollback;
```

Rules:

- Record counts, booleans, table names, policy names, constraint names, and error codes only.
- Do not export raw row contents, customer names, phone numbers, emails, notes, device identifiers, attachment paths containing customer data, or production secrets into chat, screenshots, task memory, or agent prompts.
- If a query returns non-zero exception counts, stop after recording the count and create a remediation package. Only run row-sampling queries after a separate Owner approval that defines redaction rules.
- Do not run `notify pgrst`, `alter`, `update`, `insert`, `delete`, `truncate`, `create`, `drop`, `grant`, `revoke`, `vacuum`, `reindex`, or migration commands during Phase 5 read-only verification.

Evidence record template:

```text
phase5_query_pack_version:
query_pack_hash:
target_project_ref:
target_environment:
executor:
approver:
started_at:
finished_at:
read_only_guard_used: yes/no
statement_timeout:
redacted_output_path:
no_go_result: pass/fail
notes_without_pii:
```

## Tenant Tables To Verify

Business/store-scoped tables:

- `customers`
- `devices`
- `suppliers`
- `repair_orders`
- `order_events`
- `message_logs`
- `customer_interactions`
- `customer_followups`
- `customer_tags`
- `customer_tag_assignments`
- `inventory_items`
- `inventory_quality_checks`
- `inventory_transactions`
- `inventory_events`
- `inventory_attachments`
- `order_attachments`
- `store_settings`
- `message_templates`
- `order_workflow_statuses`
- `order_workflow_transitions`
- `audit_logs`

Control-plane tables to verify separately:

- `stores`
- `store_memberships`
- `store_invitations`
- `store_invite_links`
- `store_invite_link_attempts`
- `onboarding_requests`
- `platform_admins`
- `platform_audit_logs`

Local approval-only drafts to exclude from any production apply unless separately approved:

- `repairdesk_offline_operations`
- `repairdesk_offline_sync_order_create_rpc`
- `repairdesk_offline_sync_order_update_rpc`

These offline-sync objects include `security definer` RPCs and require a separate owner-approved design, HMAC secret source, backup, dry-run, and rollback package.

## Supabase CLI Preflight

Run these only after the Owner approves read-only/dry-run live checks and confirms the target project ref. Record summaries only; do not paste secrets or full connection strings into chat, task memory, screenshots, or docs.

```bash
supabase --version
supabase migration list --linked
supabase db push --linked --dry-run
supabase db dump --linked --dry-run
```

No-go if:

- The linked project ref is not the expected production/staging target.
- Remote migration history diverges from local files in a way that would require `migration repair`.
- `db push --dry-run` includes unexpected migrations, offline-sync draft migrations, destructive changes, or RLS/storage changes not explicitly approved.
- `db dump --dry-run` fails, because backup confidence is not established.

## Migration Inventory Template

Before any dry-run is treated as meaningful, create a short inventory with these fields:

| Migration | Status | Phase 5 handling | Notes |
|---|---|---|---|
| `20260611005916_harden_store_tenant_constraints.sql` | tenant hardening | verify/applies only after zero null and zero mismatch proof | contains `set not null`, same-store FKs, RLS policies |
| `20260619193655_repairdesk_attachment_storage_repair.sql` | attachment storage repair | verify constraints/storage; mutation only after approval | includes `not valid` constraints in local text |
| `20260704203000_onboarding_owner_email_routing_hardening.sql` | onboarding privacy | verify live constraint | direct `target_store_id` join protection |
| `20260704221944_store_invite_links.sql` | invite links | verify PII/retention | existing `actor_email` column needs decision |
| `20260706133632_repairdesk_realtime_private_broadcast_authorization.sql` | realtime private broadcast | verify realtime RLS/grants | required before realtime tenant broadcast claims |
| `20260707090000_repairdesk_offline_operations.sql` | offline sync draft | exclude unless separately approved | local approval draft only |
| `20260707110000_repairdesk_offline_order_sync_rpc_draft.sql` | offline sync RPC draft | exclude unless separately approved | contains `security definer` RPCs |

The final approval package must include the full local-vs-remote migration list, the pending migration list from `supabase migration list --linked`, and the exact list excluded from Phase 5.

SQL proof for required migration history:

```sql
with required(version, label) as (
  values
    ('20260611002831', 'multi_store_foundation'),
    ('20260611005916', 'tenant_constraints'),
    ('20260619193655', 'attachment_storage_repair'),
    ('20260620120000', 'customer_interactions_store_id_repair'),
    ('20260704190000', 'private_onboarding_requests'),
    ('20260704203000', 'owner_email_routing'),
    ('20260704212000', 'approved_role'),
    ('20260704220843', 'invitation_non_owner'),
    ('20260704221944', 'invite_links'),
    ('20260706133632', 'realtime_private_broadcast_authorization')
)
select
  required.version,
  required.label,
  migrations.version is not null as applied
from required
left join supabase_migrations.schema_migrations migrations
  on migrations.version = required.version
order by required.version;
```

SQL proof that local approval-only drafts are not live unless separately approved:

```sql
select
  migrations.version,
  migrations.version in ('20260707090000', '20260707110000') as approval_only_draft
from supabase_migrations.schema_migrations migrations
where migrations.version in ('20260707090000', '20260707110000')
order by migrations.version;
```

No-go if a required tenant/privacy migration is missing, migration history has drift, or approval-only draft migrations appear without a separate Owner approval package.

SQL proof that local approval-only draft objects are not present through manual DDL unless separately approved:

```sql
with draft_objects(object_type, object_name, exists_in_database) as (
  values
    (
      'table',
      'public.repairdesk_offline_operations',
      to_regclass('public.repairdesk_offline_operations') is not null
    ),
    (
      'function',
      'public.repairdesk_offline_sync_order_create_rpc',
      exists (
        select 1
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = 'repairdesk_offline_sync_order_create_rpc'
      )
    ),
    (
      'function',
      'public.repairdesk_offline_sync_order_update_rpc',
      exists (
        select 1
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = 'repairdesk_offline_sync_order_update_rpc'
      )
    )
)
select *
from draft_objects
order by object_type, object_name;
```

No-go if any approval-only draft object exists without a separate Owner-approved offline-sync release package.

## Read-Only Verification SQL

### 1. Store ID Column Presence

```sql
with required_tables(table_name) as (
  values
    ('customers'), ('devices'), ('suppliers'), ('repair_orders'), ('order_events'),
    ('message_logs'), ('customer_interactions'), ('customer_followups'),
    ('customer_tags'), ('customer_tag_assignments'), ('inventory_items'),
    ('inventory_quality_checks'), ('inventory_transactions'), ('inventory_events'),
    ('inventory_attachments'), ('order_attachments'), ('store_settings'),
    ('message_templates'), ('order_workflow_statuses'),
    ('order_workflow_transitions'), ('audit_logs')
)
select
  required_tables.table_name,
  tables.table_name is not null as table_exists,
  columns.column_name is not null as has_store_id,
  columns.is_nullable,
  columns.column_default
from required_tables
left join information_schema.tables tables
  on tables.table_schema = 'public'
 and tables.table_name = required_tables.table_name
left join information_schema.columns columns
  on columns.table_schema = 'public'
 and columns.table_name = required_tables.table_name
 and columns.column_name = 'store_id'
order by required_tables.table_name;
```

No-go if any listed table returns `table_exists = false` or `has_store_id = false`, unless it is formally reclassified as platform-global. No-go if any store-scoped table still reports `is_nullable = YES` after the approved tenant constraint migration is expected to be live. No-go if `column_default` auto-fills the historical default store except for a separately approved transitional migration plan.

### 2. Null Store ID Counts

```sql
select 'customers' as table_name, count(*) as null_store_id from public.customers where store_id is null
union all select 'devices', count(*) from public.devices where store_id is null
union all select 'suppliers', count(*) from public.suppliers where store_id is null
union all select 'repair_orders', count(*) from public.repair_orders where store_id is null
union all select 'order_events', count(*) from public.order_events where store_id is null
union all select 'message_logs', count(*) from public.message_logs where store_id is null
union all select 'customer_interactions', count(*) from public.customer_interactions where store_id is null
union all select 'customer_followups', count(*) from public.customer_followups where store_id is null
union all select 'customer_tags', count(*) from public.customer_tags where store_id is null
union all select 'customer_tag_assignments', count(*) from public.customer_tag_assignments where store_id is null
union all select 'inventory_items', count(*) from public.inventory_items where store_id is null
union all select 'inventory_quality_checks', count(*) from public.inventory_quality_checks where store_id is null
union all select 'inventory_transactions', count(*) from public.inventory_transactions where store_id is null
union all select 'inventory_events', count(*) from public.inventory_events where store_id is null
union all select 'inventory_attachments', count(*) from public.inventory_attachments where store_id is null
union all select 'order_attachments', count(*) from public.order_attachments where store_id is null
union all select 'store_settings', count(*) from public.store_settings where store_id is null
union all select 'message_templates', count(*) from public.message_templates where store_id is null
union all select 'order_workflow_statuses', count(*) from public.order_workflow_statuses where store_id is null
union all select 'order_workflow_transitions', count(*) from public.order_workflow_transitions where store_id is null
union all select 'audit_logs', count(*) from public.audit_logs where store_id is null;
```

No-go if any store-scoped business table has null `store_id`.

### 3. Default Store Residue

```sql
select 'customers' as table_name, count(*) as default_store_rows from public.customers where store_id = '00000000-0000-0000-0000-000000000001'
union all select 'devices', count(*) from public.devices where store_id = '00000000-0000-0000-0000-000000000001'
union all select 'suppliers', count(*) from public.suppliers where store_id = '00000000-0000-0000-0000-000000000001'
union all select 'repair_orders', count(*) from public.repair_orders where store_id = '00000000-0000-0000-0000-000000000001'
union all select 'order_events', count(*) from public.order_events where store_id = '00000000-0000-0000-0000-000000000001'
union all select 'message_logs', count(*) from public.message_logs where store_id = '00000000-0000-0000-0000-000000000001'
union all select 'customer_interactions', count(*) from public.customer_interactions where store_id = '00000000-0000-0000-0000-000000000001'
union all select 'customer_followups', count(*) from public.customer_followups where store_id = '00000000-0000-0000-0000-000000000001'
union all select 'customer_tags', count(*) from public.customer_tags where store_id = '00000000-0000-0000-0000-000000000001'
union all select 'customer_tag_assignments', count(*) from public.customer_tag_assignments where store_id = '00000000-0000-0000-0000-000000000001'
union all select 'inventory_items', count(*) from public.inventory_items where store_id = '00000000-0000-0000-0000-000000000001'
union all select 'inventory_quality_checks', count(*) from public.inventory_quality_checks where store_id = '00000000-0000-0000-0000-000000000001'
union all select 'inventory_transactions', count(*) from public.inventory_transactions where store_id = '00000000-0000-0000-0000-000000000001'
union all select 'inventory_events', count(*) from public.inventory_events where store_id = '00000000-0000-0000-0000-000000000001'
union all select 'inventory_attachments', count(*) from public.inventory_attachments where store_id = '00000000-0000-0000-0000-000000000001'
union all select 'order_attachments', count(*) from public.order_attachments where store_id = '00000000-0000-0000-0000-000000000001'
union all select 'store_settings', count(*) from public.store_settings where store_id = '00000000-0000-0000-0000-000000000001'
union all select 'message_templates', count(*) from public.message_templates where store_id = '00000000-0000-0000-0000-000000000001'
union all select 'order_workflow_statuses', count(*) from public.order_workflow_statuses where store_id = '00000000-0000-0000-0000-000000000001'
union all select 'order_workflow_transitions', count(*) from public.order_workflow_transitions where store_id = '00000000-0000-0000-0000-000000000001'
union all select 'audit_logs', count(*) from public.audit_logs where store_id = '00000000-0000-0000-0000-000000000001';
```

Default-store rows are not automatically wrong, but they must be explained. No-go if default-store rows include another partner store's live business data.

### 4. Constraint And FK Validity

```sql
select
  conrelid::regclass::text as table_name,
  conname,
  contype,
  convalidated,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where connamespace = 'public'::regnamespace
  and conrelid::regclass::text in (
    'customers', 'devices', 'suppliers', 'repair_orders', 'order_events',
    'message_logs', 'customer_interactions', 'customer_followups',
    'customer_tags', 'customer_tag_assignments', 'inventory_items',
    'inventory_quality_checks', 'inventory_transactions', 'inventory_events',
    'inventory_attachments', 'order_attachments', 'store_settings',
    'message_templates', 'order_workflow_statuses',
    'order_workflow_transitions', 'audit_logs'
  )
order by table_name, conname;
```

No-go if required same-store foreign keys exist but are not validated, or if critical tenant constraints are missing.

Expected same-store constraint matrix:

```sql
with expected_constraints(table_name, constraint_name) as (
  values
    ('customers', 'customers_store_id_fkey'),
    ('devices', 'devices_store_id_fkey'),
    ('suppliers', 'suppliers_store_id_fkey'),
    ('repair_orders', 'repair_orders_store_id_fkey'),
    ('order_events', 'order_events_store_id_fkey'),
    ('message_logs', 'message_logs_store_id_fkey'),
    ('customer_tags', 'customer_tags_store_id_fkey'),
    ('customer_tag_assignments', 'customer_tag_assignments_store_id_fkey'),
    ('customer_interactions', 'customer_interactions_store_id_fkey'),
    ('customer_followups', 'customer_followups_store_id_fkey'),
    ('inventory_items', 'inventory_items_store_id_fkey'),
    ('inventory_quality_checks', 'inventory_quality_checks_store_id_fkey'),
    ('inventory_transactions', 'inventory_transactions_store_id_fkey'),
    ('inventory_events', 'inventory_events_store_id_fkey'),
    ('audit_logs', 'audit_logs_store_id_fkey'),
    ('store_settings', 'store_settings_store_id_fkey'),
    ('message_templates', 'message_templates_store_id_fkey'),
    ('order_workflow_statuses', 'order_workflow_statuses_store_id_fkey'),
    ('order_workflow_transitions', 'order_workflow_transitions_store_id_fkey'),
    ('devices', 'devices_customer_same_store_fkey'),
    ('repair_orders', 'repair_orders_customer_same_store_fkey'),
    ('repair_orders', 'repair_orders_device_same_store_fkey'),
    ('repair_orders', 'repair_orders_supplier_same_store_fkey'),
    ('repair_orders', 'repair_orders_original_same_store_fkey'),
    ('repair_orders', 'repair_orders_store_status_fkey'),
    ('order_events', 'order_events_order_same_store_fkey'),
    ('message_logs', 'message_logs_order_same_store_fkey'),
    ('customer_tag_assignments', 'customer_tag_assignments_customer_same_store_fkey'),
    ('customer_tag_assignments', 'customer_tag_assignments_tag_same_store_fkey'),
    ('customer_interactions', 'customer_interactions_customer_same_store_fkey'),
    ('customer_followups', 'customer_followups_customer_same_store_fkey'),
    ('inventory_items', 'inventory_items_customer_same_store_fkey'),
    ('inventory_items', 'inventory_items_buyer_same_store_fkey'),
    ('inventory_quality_checks', 'inventory_quality_checks_item_same_store_fkey'),
    ('inventory_transactions', 'inventory_transactions_item_same_store_fkey'),
    ('inventory_events', 'inventory_events_item_same_store_fkey'),
    ('order_workflow_transitions', 'order_workflow_transitions_from_fkey'),
    ('order_workflow_transitions', 'order_workflow_transitions_to_fkey')
)
select
  expected_constraints.table_name,
  expected_constraints.constraint_name,
  constraints.oid is not null as exists_in_database,
  constraints.convalidated,
  pg_get_constraintdef(constraints.oid) as definition
from expected_constraints
left join pg_constraint constraints
  on constraints.conrelid = format('public.%I', expected_constraints.table_name)::regclass
 and constraints.conname = expected_constraints.constraint_name
order by expected_constraints.table_name, expected_constraints.constraint_name;
```

No-go if any expected constraint returns `exists_in_database = false` or `convalidated = false`, unless the Owner approves a documented exception for a table that is not live in the target environment.

Specific attachment constraints that must not remain unvalidated once attachment repair is expected live:

```sql
select
  conrelid::regclass::text as table_name,
  conname,
  convalidated,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in ('public.order_attachments'::regclass, 'public.inventory_attachments'::regclass)
  and conname in (
    'order_attachments_kind_check',
    'order_attachments_file_size_check',
    'order_attachments_bucket_check',
    'order_attachments_public_url_null_check',
    'order_attachments_order_same_store_fkey',
    'inventory_attachments_kind_check',
    'inventory_attachments_file_size_check',
    'inventory_attachments_bucket_check',
    'inventory_attachments_public_url_null_check',
    'inventory_attachments_item_same_store_fkey'
  )
order by table_name, conname;
```

No-go if any row is missing or `convalidated = false` and the production migration plan assumes that constraint is active.

### 4b. Same-Store Unique Indexes

```sql
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'customers_id_store_id_uidx',
    'devices_id_store_id_uidx',
    'suppliers_id_store_id_uidx',
    'repair_orders_id_store_id_uidx',
    'customer_tags_id_store_id_uidx',
    'inventory_items_id_store_id_uidx'
  )
order by tablename, indexname;
```

No-go if composite `(id, store_id)` indexes needed by same-store foreign keys are missing.

### 5. RLS And Policies

```sql
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity,
  c.relforcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'customers', 'devices', 'suppliers', 'repair_orders', 'order_events',
    'message_logs', 'customer_interactions', 'customer_followups',
    'customer_tags', 'customer_tag_assignments', 'inventory_items',
    'inventory_quality_checks', 'inventory_transactions', 'inventory_events',
    'inventory_attachments', 'order_attachments', 'store_settings',
    'message_templates', 'order_workflow_statuses',
    'order_workflow_transitions', 'audit_logs'
  )
order by c.relname;
```

```sql
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;
```

No-go if business tables have direct `anon` or `authenticated` access without membership checks, unless that table is explicitly approved as public.

### 5b. Security Definer Functions And Public Views

```sql
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_userbyid(p.proowner) as owner_name,
  p.prosecdef as security_definer,
  p.proacl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'storage')
  and p.prosecdef
order by schema_name, function_name;
```

```sql
select
  n.nspname as schema_name,
  c.relname as view_name,
  c.relkind,
  c.reloptions
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('v', 'm')
order by schema_name, view_name;
```

No-go if a `security definer` function in an exposed schema is callable by `public`, `anon`, or `authenticated`, or if a public view can bypass RLS without explicit `security_invoker` or revoked grants. Offline-sync draft RPCs are a separate approval scope and should not be present in production unless that scope was approved.

### 6. Storage Buckets And Attachment Metadata

```sql
with expected_buckets(bucket_id) as (
  values
    ('repairdesk-order-attachments'),
    ('repairdesk-inventory-attachments')
)
select
  expected.bucket_id,
  (buckets.id is not null) as exists_in_storage,
  coalesce(buckets.public, true) as is_public,
  (buckets.file_size_limit is not null) as has_file_size_limit,
  (buckets.allowed_mime_types is not null) as has_mime_type_rules
from expected_buckets expected
left join storage.buckets buckets on buckets.id = expected.bucket_id
order by expected.bucket_id;
```

```sql
select 'wrong_bucket' as reason, count(*) as anomaly_count
from public.order_attachments
where storage_bucket <> 'repairdesk-order-attachments'
union all
select 'public_url_present', count(*)
from public.order_attachments
where public_url is not null
union all
select 'path_prefix_invalid', count(*)
from public.order_attachments
where storage_path not like (store_id::text || '/' || order_id::text || '/%');
```

```sql
select 'wrong_bucket' as reason, count(*) as anomaly_count
from public.inventory_attachments
where storage_bucket <> 'repairdesk-inventory-attachments'
union all
select 'public_url_present', count(*)
from public.inventory_attachments
where public_url is not null
union all
select 'path_prefix_invalid', count(*)
from public.inventory_attachments
where storage_path not like (store_id::text || '/' || item_id::text || '/%');
```

No-go if expected buckets are missing, buckets are public, attachment metadata has public URLs, or storage paths do not start with the row's store/object prefix.

Storage object parity, counts only:

```sql
select 'order_objects_without_metadata' as reason, count(*) as anomaly_count
from storage.objects objects
left join public.order_attachments attachments
  on attachments.storage_bucket = objects.bucket_id
 and attachments.storage_path = objects.name
where objects.bucket_id = 'repairdesk-order-attachments'
  and attachments.id is null
union all
select 'inventory_objects_without_metadata', count(*)
from storage.objects objects
left join public.inventory_attachments attachments
  on attachments.storage_bucket = objects.bucket_id
 and attachments.storage_path = objects.name
where objects.bucket_id = 'repairdesk-inventory-attachments'
  and attachments.id is null
union all
select 'order_metadata_without_object', count(*)
from public.order_attachments attachments
left join storage.objects objects
  on objects.bucket_id = attachments.storage_bucket
 and objects.name = attachments.storage_path
where attachments.storage_bucket = 'repairdesk-order-attachments'
  and objects.id is null
union all
select 'inventory_metadata_without_object', count(*)
from public.inventory_attachments attachments
left join storage.objects objects
  on objects.bucket_id = attachments.storage_bucket
 and objects.name = attachments.storage_path
where attachments.storage_bucket = 'repairdesk-inventory-attachments'
  and objects.id is null;
```

No-go if any storage-object anomaly count is greater than `0`, unless it is a documented abandoned upload with an approved cleanup plan. Do not paste object names or paths into evidence.

### 6b. Storage Object Prefix Counts

```sql
select
  bucket_id,
  count(*) as object_count,
  count(*) filter (where name !~ '^[0-9a-f-]{36}/[^/]+/.+') as non_store_prefixed_count
from storage.objects
where bucket_id in ('repairdesk-order-attachments', 'repairdesk-inventory-attachments')
group by bucket_id
order by bucket_id;
```

No-go if private attachment buckets contain objects outside the expected store/object prefix pattern. If historical objects exist, stop and create a migration/backfill plan before enabling or relying on production storage reads.

### 7. Grants

```sql
select
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema in ('public', 'storage')
  and lower(grantee) in ('anon', 'authenticated')
order by table_schema, table_name, grantee, privilege_type;
```

No-go if store business tables or private attachment metadata grant direct data access to `anon` or `authenticated`. RLS is not a substitute for accidental table exposure; both grant and policy must be intentional.

### 7b. Control-Plane RLS And Grants

```sql
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity,
  c.relforcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'stores',
    'store_memberships',
    'store_invitations',
    'store_invite_links',
    'store_invite_link_attempts',
    'onboarding_requests',
    'platform_admins',
    'platform_audit_logs'
  )
order by c.relname;
```

```sql
select
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'stores',
    'store_memberships',
    'store_invitations',
    'store_invite_links',
    'store_invite_link_attempts',
    'onboarding_requests',
    'platform_admins',
    'platform_audit_logs'
  )
  and lower(grantee) in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;
```

No-go if private control-plane tables expose direct access to `anon` or `authenticated` without an explicit, tested policy reason.

### 7c. Realtime Private Broadcast Boundary

```sql
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity,
  c.relforcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'realtime'
  and c.relname = 'messages';
```

```sql
select
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'realtime'
  and table_name = 'messages'
  and lower(grantee) in ('anon', 'authenticated', 'public')
order by grantee, privilege_type;
```

```sql
select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'realtime'
  and tablename = 'messages'
order by policyname;
```

No-go if Realtime public access is enabled for store topics without membership-scoped RLS, or if `anon/authenticated` clients can insert/update/delete business broadcast rows directly.

Sequence and routine grant checks:

```sql
select
  object_schema,
  object_name,
  object_type,
  grantee,
  privilege_type
from information_schema.usage_privileges
where object_schema in ('public', 'storage')
  and lower(grantee) in ('anon', 'authenticated')
order by object_schema, object_name, grantee, privilege_type;
```

```sql
select
  specific_schema,
  routine_name,
  grantee,
  privilege_type
from information_schema.routine_privileges
where specific_schema in ('public', 'storage')
  and lower(grantee) in ('public', 'anon', 'authenticated')
order by specific_schema, routine_name, grantee, privilege_type;
```

No-go if business-data sequences or routines are directly usable by `anon` or `authenticated`, or if a business RPC is exposed to `public` without explicit approval and tenant-scoped proof.

### 8. Cross-Table Tenant Mismatch Counts

These checks catch cross-store or orphaned relationships even if a same-store FK is missing or not validated. They return counts only. Run them only after the schema/column presence checks prove referenced columns exist; a missing table or column is a schema-parity no-go, not a skipped data check.

```sql
select 'devices.customer' as check_name, count(*) as mismatch_count
from public.devices d
left join public.customers c on c.id = d.customer_id
where c.id is null or c.store_id <> d.store_id
union all
select 'repair_orders.customer', count(*)
from public.repair_orders ro
left join public.customers c on c.id = ro.customer_id
where c.id is null or c.store_id <> ro.store_id
union all
select 'repair_orders.device', count(*)
from public.repair_orders ro
left join public.devices d on d.id = ro.device_id
where d.id is null or d.store_id <> ro.store_id
union all
select 'repair_orders.parts_supplier', count(*)
from public.repair_orders ro
left join public.suppliers s on s.id = ro.parts_supplier_id
where ro.parts_supplier_id is not null
  and (s.id is null or s.store_id <> ro.store_id)
union all
select 'order_events.order', count(*)
from public.order_events oe
left join public.repair_orders ro on ro.id = oe.order_id
where ro.id is null or ro.store_id <> oe.store_id
union all
select 'message_logs.order', count(*)
from public.message_logs ml
left join public.repair_orders ro on ro.id = ml.order_id
where ro.id is null or ro.store_id <> ml.store_id
union all
select 'customer_interactions.customer', count(*)
from public.customer_interactions ci
left join public.customers c on c.id = ci.customer_id
where c.id is null or c.store_id <> ci.store_id
union all
select 'customer_interactions.order', count(*)
from public.customer_interactions ci
left join public.repair_orders ro on ro.id = ci.order_id
where ci.order_id is not null
  and (ro.id is null or ro.store_id <> ci.store_id)
union all
select 'customer_followups.customer', count(*)
from public.customer_followups cf
left join public.customers c on c.id = cf.customer_id
where c.id is null or c.store_id <> cf.store_id
union all
select 'customer_followups.order', count(*)
from public.customer_followups cf
left join public.repair_orders ro on ro.id = cf.order_id
where cf.order_id is not null
  and (ro.id is null or ro.store_id <> cf.store_id)
union all
select 'customer_tag_assignments.customer', count(*)
from public.customer_tag_assignments cta
left join public.customers c on c.id = cta.customer_id
where c.id is null or c.store_id <> cta.store_id
union all
select 'customer_tag_assignments.tag', count(*)
from public.customer_tag_assignments cta
left join public.customer_tags ct on ct.id = cta.tag_id
where ct.id is null or ct.store_id <> cta.store_id
union all
select 'inventory_items.customer', count(*)
from public.inventory_items ii
left join public.customers c on c.id = ii.customer_id
where ii.customer_id is not null
  and (c.id is null or c.store_id <> ii.store_id)
union all
select 'inventory_items.buyer_customer', count(*)
from public.inventory_items ii
left join public.customers c on c.id = ii.buyer_customer_id
where ii.buyer_customer_id is not null
  and (c.id is null or c.store_id <> ii.store_id)
union all
select 'inventory_quality_checks.item', count(*)
from public.inventory_quality_checks iqc
left join public.inventory_items ii on ii.id = iqc.item_id
where ii.id is null or ii.store_id <> iqc.store_id
union all
select 'inventory_transactions.item', count(*)
from public.inventory_transactions it
left join public.inventory_items ii on ii.id = it.item_id
where ii.id is null or ii.store_id <> it.store_id
union all
select 'inventory_events.item', count(*)
from public.inventory_events ie
left join public.inventory_items ii on ii.id = ie.item_id
where ii.id is null or ii.store_id <> ie.store_id
union all
select 'order_attachments.order', count(*)
from public.order_attachments oa
left join public.repair_orders ro on ro.id = oa.order_id
where ro.id is null or ro.store_id <> oa.store_id
union all
select 'inventory_attachments.item', count(*)
from public.inventory_attachments ia
left join public.inventory_items ii on ii.id = ia.item_id
where ii.id is null or ii.store_id <> ia.store_id;
```

No-go if any `mismatch_count` is greater than `0`.

### 8b. Store Default Master Data Completeness

```sql
select
  count(*) as active_stores_without_settings
from public.stores stores
where stores.status = 'active'
  and not exists (
    select 1
    from public.store_settings settings
    where settings.store_id = stores.id
  );
```

```sql
select
  count(*) as active_stores_without_message_templates
from public.stores stores
where stores.status = 'active'
  and not exists (
    select 1
    from public.message_templates templates
    where templates.store_id = stores.id
  );
```

```sql
select
  count(*) as active_stores_without_workflow_statuses
from public.stores stores
where stores.status = 'active'
  and not exists (
    select 1
    from public.order_workflow_statuses statuses
    where statuses.store_id = stores.id
  );
```

```sql
select
  count(*) as active_stores_without_workflow_transitions
from public.stores stores
where stores.status = 'active'
  and not exists (
    select 1
    from public.order_workflow_transitions transitions
    where transitions.store_id = stores.id
  );
```

No-go if any active store lacks required settings/templates/workflow defaults after Phase 2 provisioning is expected live.

### 9. Control-Plane Invariants

```sql
select 'active_stores_without_active_owner' as check_name, count(*) as issue_count
from public.stores stores
where stores.status = 'active'
  and not exists (
    select 1
    from public.store_memberships memberships
    where memberships.store_id = stores.id
      and memberships.status = 'active'
      and memberships.role = 'owner'
  )
union all
select 'active_invitations_granting_owner', count(*)
from public.store_invitations invitations
where invitations.status in ('active', 'invited')
  and invitations.role = 'owner'
union all
select 'active_invite_links_granting_owner', count(*)
from public.store_invite_links links
where links.status = 'active'
  and links.role = 'owner'
union all
select 'approved_join_requests_owner_role', count(*)
from public.onboarding_requests requests
where requests.request_type = 'join_store'
  and requests.status = 'approved'
  and (requests.requested_role = 'owner' or requests.approved_role = 'owner')
union all
select 'store_review_requests_without_target_store', count(*)
from public.onboarding_requests requests
where requests.request_type = 'join_store'
  and requests.review_scope = 'store'
  and requests.target_store_id is null
union all
select 'invite_attempts_with_actor_email', count(*)
from public.store_invite_link_attempts attempts
where attempts.actor_email is not null;
```

No-go if an active store lacks an active owner, a pending/active invite path can grant `owner`, an approved join request assigns owner, or store-reviewed join requests lack a target store. `invite_attempts_with_actor_email` is a privacy-retention finding: stop and create a cleanup/minimization plan before production rollout unless the Owner explicitly accepts the retention risk.

Platform/support access no-go:

- Platform owners/admins are control-plane operators, not default readers of store business data.
- No Phase 5 result may claim platform support can view customer/order/payment/photo data until owner-granted, scoped, expiring, read-only-first support access and owner-visible audit are implemented and separately approved.
- No-go if any platform role has direct business-table grants or service route access that bypasses a store-owner support grant.

### 10. PostgREST Schema Cache Visibility

Database metadata can pass while the public API still serves a stale PostgREST schema cache. This check is read-only but may require a service key or protected deployment access, so it must not be run until the Owner approves the target environment and operator.

Allowed check shape after approval:

```bash
# Do not paste keys into chat or task memory.
# Use a local shell environment variable for the API key.
curl -sS -o /tmp/repairdesk-postgrest-customers-store-id.json -w '%{http_code}\n' \
  "$SUPABASE_URL/rest/v1/customers?select=store_id&limit=0" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Repeat the same `select=store_id&limit=0` shape for the business tables listed above. Record only HTTP status codes and generic PostgREST error codes. Do not paste response bodies if they contain row data, keys, URLs, or PII.

No-go if PostgREST returns a missing-column/schema-cache error for `store_id` on any store-scoped table. Do not run `notify pgrst, 'reload schema'` unless the Owner explicitly approves a schema-cache reload action.

### 10a. RLS And Storage Behavior Smoke

Metadata checks are not enough. After the Owner approves controlled test accounts/tokens, prove behavior with non-service credentials. Do not paste tokens, response bodies, row data, or object paths into evidence.

Required negative checks:

- Authenticated user from Store A cannot list Store B rows through REST/Data API.
- Authenticated user from Store A cannot fetch Store B order/customer/inventory detail by id through REST/Data API.
- Authenticated non-member cannot list private business/control-plane rows.
- Direct Storage list/download/upload for `repairdesk-order-attachments` and `repairdesk-inventory-attachments` is denied to anon/authenticated users unless a specific server-routed flow is being tested.
- Server-routed signed URL flow still works for the actor's own store after private Storage denial checks pass.

Record only:

```text
test_actor:
target_store_relation: same_store | cross_store | non_member
api_surface: rest | storage
operation: list | detail | upload | download | signed_url
expected: 0_rows | 403 | success
actual_status:
actual_count:
result: pass/fail
```

No-go if any cross-store or non-member read/write succeeds through non-service credentials, or if direct Storage access succeeds outside the approved server-routed flow.

### 10b. Service-Role Repository Release Matrix

Because server repositories use the Supabase service role, RLS cannot be the only isolation proof. Before release, create a repository matrix with:

| Domain | Entry point | Actor source | Store source | Store predicate | Permission check | Cross-store denial test |
|---|---|---|---|---|---|---|
| orders | `src/features/orders/server/order.repository.ts` | actor context | active actor store | required on list/detail/write | role/transition checks | required |
| customers | `src/features/customers/server/customer.repository.ts` | actor context | active actor store | required on list/detail/child data | role checks | required |
| inventory | `src/features/inventory/server/inventory.repository.ts` | actor context | active actor store | required on list/detail/write/attachments | role checks | required |
| messages/settings | `src/features/messages/server/message-settings.repository.ts` | actor context | explicit store context | required on settings/templates | owner/manager checks | required |
| stores/platform | `src/features/stores/server/store.repository.ts`, `src/features/platform/server/platform.repository.ts` | actor context | owner/member target only | required on member/join paths | owner-only join approval | required |

No-go if any service-role path accepts requester-supplied raw `store_id` or object id without deriving and checking actor store membership.

### 11. Onboarding Privacy And Direct-Write Protection

```sql
select
  conname,
  convalidated,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.onboarding_requests'::regclass
  and conname in (
    'onboarding_requests_join_store_private_target_check',
    'onboarding_requests_email_lowercase_check',
    'onboarding_requests_approved_role_not_owner_check'
  )
order by conname;
```

```sql
select
  request_type,
  status,
  count(*) as request_count,
  count(*) filter (where request_type = 'join_store' and target_owner_email is null) as join_without_owner_email,
  count(*) filter (where request_type = 'join_store' and target_store_id is not null and target_owner_email is null) as direct_target_join_count
from public.onboarding_requests
group by request_type, status
order by request_type, status;
```

No-go if applicants can create join requests with raw `target_store_id` and no owner-email routing proof, or if `owner` can be assigned through a join approval path.

### 12. Invite Attempt PII And Retention Readiness

```sql
select
  count(*) as total_attempts,
  count(*) filter (where actor_email is not null) as non_null_actor_email_attempts,
  min(created_at) as oldest_attempt_at,
  max(created_at) as newest_attempt_at
from public.store_invite_link_attempts;
```

```sql
select
  result,
  count(*) as attempt_count
from public.store_invite_link_attempts
group by result
order by result;
```

No-go for production release if raw `actor_email` rows remain without an approved retention/anonymization plan. Do not export raw emails in reports.

### 13. Audit Log Minimization Scan

```sql
select
  action,
  entity_type,
  count(*) as event_count
from public.audit_logs
group by action, entity_type
order by event_count desc, action, entity_type;
```

```sql
select
  'audit_logs' as table_name,
  count(*) as total_rows,
  count(*) filter (where actor_email is not null) as non_null_actor_email_rows,
  min(created_at) as oldest_row_at,
  max(created_at) as newest_row_at
from public.audit_logs
union all
select
  'platform_audit_logs',
  count(*),
  count(*) filter (where actor_email is not null),
  min(created_at),
  max(created_at)
from public.platform_audit_logs;
```

If `audit_logs.metadata` or similar JSON payload columns exist, run a key-only scan and report only key names:

```sql
select
  key,
  count(*) as row_count
from public.audit_logs
cross join lateral jsonb_object_keys(coalesce(metadata, '{}'::jsonb)) as keys(key)
group by key
order by row_count desc, key;
```

No-go if audit logs contain raw invite codes/tokens, unlock values, attachment signed URLs, payment payloads, or unnecessary full before/after customer PII without a sanitizer and retention plan.

### 14. Store Owner Invariant

Every active private store must have at least one active owner membership.

```sql
select
  count(*) as active_stores_without_active_owner
from public.stores stores
where stores.status = 'active'
  and not exists (
    select 1
    from public.store_memberships memberships
    where memberships.store_id = stores.id
      and memberships.status = 'active'
      and memberships.role = 'owner'
  );
```

```sql
select
  role,
  status,
  count(*) as invitation_count
from public.store_invitations
group by role, status
order by role, status;
```

```sql
select
  role,
  status,
  count(*) as link_count
from public.store_invite_links
group by role, status
order by role, status;
```

No-go if any active store lacks an active owner, or if active invite/link paths can assign `owner`.

## Verification Order

1. Confirm target project and backup plan.
2. Confirm explicit Owner approval for the named read-only live verification target.
3. Confirm local-vs-remote migration inventory and excluded draft migrations.
4. Run CLI dry-run preflight: `migration list`, `db push --dry-run`, and `db dump --dry-run`.
5. Run read-only schema/constraint/RLS/storage SQL inside the read-only transaction envelope.
6. Record counts only, not row contents with customer PII.
7. Run PostgREST schema-cache visibility checks only after the target and operator are approved.
8. Run approved non-service RLS/Storage behavior smokes with controlled test actors.
9. Complete the service-role repository release matrix and confirm cross-store denial tests.
10. If any no-go condition appears, stop and create a remediation plan.
11. If all read-only checks pass, prepare migration dry-run and release package.
12. Only after explicit Owner approval, run any linked migration, production mutation, schema-cache reload, deploy, or release.
13. After any approved production change, run the same read-only verification again.

## Backup And Rollback Requirements

- Backup must be taken before any approved production migration.
- Restore method must be known before the migration, not discovered after failure.
- Backup proof must include artifact identifier, target project ref, dump command/log reference, timestamp, retention window, storage location, restore owner, restore target, restore drill result, RPO/RTO estimate, and sign-off owner.
- No production mutation may run if backup/restore proof is missing, stale, or outside the approved maintenance window unless the Owner explicitly accepts the untested-restore risk in writing.
- Full database restore is a last resort in a shared database because it affects every store; prefer forward-fix or scoped remediation when constraints/RLS/storage policy changes fail.
- Constraint/RLS/storage changes are not always safely reversible by a simple rollback.
- If a migration tightens constraints after backfill, rollback may require forward-fix rather than dropping constraints.
- Choose the recovery mode before release: reversible SQL rollback, forward-fix constraint/policy/schema-cache remediation, backup restore with accepted data-loss window, or pause at Phase 4 if preflight fails.

## Vercel Release Sequence

Do not deploy Phase 4 fail-closed app code to production until Phase 5 proves live schema/RLS/storage parity or an approved compatibility migration has landed.

If an app release is approved after Phase 5:

1. Confirm Vercel project, branch, environment variables, and Supabase project ref.
2. Ensure DB changes are backward compatible with the currently deployed app.
3. Apply approved DB changes first only when required and only after backup/restore proof.
4. Run read-only verification again.
5. Deploy preview; run smoke against preview with the approved target environment.
6. Promote/alias only after smoke passes.
7. Keep new Phase 6 feature flags default-off.
8. Observe for at least 2 hours actively and 24 hours lightly.

Abort if error rate, auth/permission failures, storage signing failures, PostgREST missing-column errors, or onboarding/order/customer list failures exceed baseline.

## Operational Ownership And Observation

Assign named people or roles before any approved live action:

- Executor: runs the approved command/query pack only.
- Owner approver: confirms target, window, backup, and no-go thresholds.
- Observer: watches API, database, auth, storage, and Vercel signals during the active window.
- Rollback/forward-fix lead: owns the selected recovery path.
- Communication lead: records status and customer-facing impact if a rollback or pause is needed.

Observe and record these health signals without exporting PII:

- Zero PostgREST missing-column/schema-cache errors for tenant-critical columns.
- Zero unexpected RLS denials for valid same-store users.
- Zero successful cross-store reads, writes, attachment signing, or realtime broadcasts.
- Attachment signed URL failures stay at or below baseline.
- Onboarding create-store and join-request errors stay at or below baseline.
- Order/customer/settings member list load errors stay at or below baseline.
- API 5xx rate and p95 latency do not regress beyond the approved threshold.
- Database lock duration and migration runtime stay within the approved window.

## Phase 5 Read-Only Live Verification Owner Approval Package

Before any live or linked read-only verification, present `docs/SHARED_DB_TENANT_PHASE5_APPROVAL_PACKET.md` with:

- Target project ref and environment.
- Exact approved CLI dry-runs and query pack sections to run.
- Explicit list of excluded migrations, especially offline-sync drafts.
- Expected lock/latency risk for read-only metadata/count checks and any later separately approved migration.
- Backup and restore proof: artifact identifier, timestamp, restore drill result, restore target, RPO/RTO estimate, restore owner, and sign-off owner.
- Read-only preflight result summary.
- Query pack version/hash, executor, observer, approval timestamp, target project ref, and redacted evidence path.
- Stop/remediation plan for no-go results.
- Separate approval boundary for any later live mutation, schema-cache reload, deploy, push, or Phase 6 rollout.
- No-go thresholds.
- Vercel deployment order and rollback/alias plan if app release is part of the change.
- Observation window, operational owners, and health signals: onboarding create-store, join request, order list load, settings members, attachment signed URL creation, PostgREST schema errors, RLS denials, API 5xx/latency, DB lock duration, and error logs.

## Phase 6 Entry Gate

Do not start Phase 6 unified feature rollout controls until:

- Phase 5 read-only live checks pass or every exception has an Owner-approved remediation plan.
- Non-service RLS/Storage behavior smokes pass for same-store, cross-store, and non-member test actors.
- Service-role repository release matrix is complete and all required cross-store denial tests pass.
- Production schema cache can see tenant-critical columns and relationships.
- Private attachment buckets and metadata pass bucket/path/public-url checks.
- `store_invite_link_attempts.actor_email` has a retention/anonymization decision.
- Any `security definer` function in an exposed schema is approved, grant-limited, and tested.
- The application version with Phase 4 fail-closed behavior is not deployed against a schema that would make production order/customer/message pages fail closed unexpectedly.

Phase 6 deliverable should be a small feature-flag/settings model for global rollout controls:

- Default off for new risky capabilities.
- Server-side enforcement, not UI-only hiding.
- Store-aware but not per-store code forks.
- Owner-visible audit trail for enable/disable.
- Kill switch that can disable the feature globally.

## Completion Definition

Phase 5 is complete only when:

- All read-only checks pass or every exception is documented and approved.
- Any required migration has an owner-approved runbook, backup, and verification record.
- Post-change verification proves live schema/RLS/storage parity.
- Task memory and execution plan are updated with evidence.

Until then, the project may say "Phase 4 app-level tenant guardrails completed locally", but must not claim "production-grade tenant isolation fully verified."
