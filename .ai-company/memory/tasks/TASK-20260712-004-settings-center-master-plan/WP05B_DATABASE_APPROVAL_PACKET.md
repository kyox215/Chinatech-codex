# WP05-B database approval packet

- Scope: Kiosk integrity expansion only
- Current state: local migration created; linked database untouched
- Owner approval required for: every linked preflight/apply/post-check command and every production flag/deploy action
- Last verified locally: 2026-07-16

## Intended migration

`supabase/migrations/20260714180000_kiosk_integrity_expand.sql` adds only:

- a unique device `(id, store_id)` index;
- a full session `(device_id, store_id)` reference-side index;
- a `NOT VALID` same-store device foreign key;
- `NOT VALID` session version, expiry, and state-shape checks;
- `NOT VALID` device hash and state-shape checks;
- a partial open-session expiry index;
- bounded `5s` lock and `2min` statement timeouts for this migration session;
- a PostgREST schema reload notification.

It contains no historical update/delete/truncate, no constraint validation, no function/grant/RLS change, and no order/customer foreign key.

## Gate 1 — linked read-only preflight (not authorized or run)

Run only after the Owner explicitly approves read-only linked inspection. Save redacted output as task evidence.

```sql
select
  c.relname as table_name,
  a.attname as column_name,
  format_type(a.atttypid, a.atttypmod) as physical_type,
  a.attnotnull as is_not_null,
  pg_get_expr(d.adbin, d.adrelid) as column_default
from pg_catalog.pg_attribute a
join pg_catalog.pg_class c on c.oid = a.attrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
left join pg_catalog.pg_attrdef d
  on d.adrelid = a.attrelid
 and d.adnum = a.attnum
where n.nspname = 'public'
  and a.attnum > 0
  and not a.attisdropped
  and (c.relname, a.attname) in (
    ('customer_kiosk_sessions', 'id'),
    ('customer_kiosk_sessions', 'store_id'),
    ('customer_kiosk_sessions', 'device_id'),
    ('customer_kiosk_sessions', 'order_id'),
    ('customer_kiosk_sessions', 'customer_id'),
    ('customer_kiosk_sessions', 'session_type'),
    ('customer_kiosk_sessions', 'status'),
    ('customer_kiosk_sessions', 'request_payload'),
    ('customer_kiosk_sessions', 'submission_payload'),
    ('customer_kiosk_sessions', 'submission_version'),
    ('customer_kiosk_sessions', 'expires_at'),
    ('customer_kiosk_sessions', 'submitted_at'),
    ('customer_kiosk_sessions', 'accepted_by'),
    ('customer_kiosk_sessions', 'accepted_at'),
    ('customer_kiosk_sessions', 'returned_at'),
    ('customer_kiosk_sessions', 'cancelled_at'),
    ('customer_kiosk_sessions', 'created_at'),
    ('store_kiosk_devices', 'id'),
    ('store_kiosk_devices', 'store_id'),
    ('store_kiosk_devices', 'label'),
    ('store_kiosk_devices', 'status'),
    ('store_kiosk_devices', 'device_token_hash'),
    ('store_kiosk_devices', 'pairing_code_hash'),
    ('store_kiosk_devices', 'pairing_code_expires_at'),
    ('store_kiosk_devices', 'paired_at'),
    ('store_kiosk_devices', 'revoked_at'),
    ('store_kiosk_devices', 'created_at'),
    ('repair_orders', 'id'),
    ('repair_orders', 'store_id'),
    ('customers', 'id'),
    ('customers', 'store_id')
  )
order by c.relname, a.attname;
```

Compare the complete result with the local base migration. At minimum, the following columns must still be `NOT NULL`: session `id/store_id/device_id/session_type/status/request_payload/submission_version/expires_at/created_at`, and device `id/store_id/label/status/created_at`. A missing or nullable required column is a stop because PostgreSQL `CHECK` constraints treat a null result as passing.

```sql
select
  conrelid::regclass::text as table_name,
  conname,
  contype,
  convalidated,
  pg_get_constraintdef(oid, true) as definition
from pg_catalog.pg_constraint
where conrelid in (
  'public.customer_kiosk_sessions'::regclass,
  'public.store_kiosk_devices'::regclass
)
order by table_name, conname;
```

Any target WP05-B constraint name already present is a stop for partial-apply reconciliation; do not run the migration over it.

```sql
select
  idx.relname as index_name,
  i.indisunique,
  i.indisvalid,
  i.indisready,
  pg_get_indexdef(i.indexrelid) as index_definition
from pg_catalog.pg_index i
join pg_catalog.pg_class idx on idx.oid = i.indexrelid
join pg_catalog.pg_namespace n on n.oid = idx.relnamespace
where n.nspname = 'public'
  and idx.relname in (
    'store_kiosk_devices_id_store_id_uidx',
    'customer_kiosk_sessions_device_store_idx',
    'customer_kiosk_sessions_open_expiry_idx'
  )
order by idx.relname;
```

The expected preflight result is no row for all three new index names. Any row is a stop for definition/validity/partial-apply reconciliation; the migration intentionally does not use `IF NOT EXISTS`.

```sql
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('customer_kiosk_sessions', 'store_kiosk_devices');

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where schemaname = 'public'
  and tablename in ('customer_kiosk_sessions', 'store_kiosk_devices')
order by tablename, policyname;

select
  c.relname as table_name,
  pg_get_userbyid(x.grantor) as grantor,
  case when x.grantee = 0 then 'PUBLIC' else pg_get_userbyid(x.grantee) end as grantee,
  x.privilege_type,
  x.is_grantable
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
cross join lateral pg_catalog.aclexplode(
  coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))
) x
where n.nspname = 'public'
  and c.relname in ('customer_kiosk_sessions', 'store_kiosk_devices')
order by c.relname, grantee, x.privilege_type, grantor;
```

Capture table size before reviewing the lock window. `CREATE INDEX` and `ALTER TABLE ... ADD CONSTRAINT` are ordinary, non-concurrent DDL and can block conflicting writes. The migration sets `lock_timeout = '5s'` and `statement_timeout = '2min'`; any timeout is a hard abort, not permission to weaken the limits.

```sql
select
  relname as table_name,
  n_live_tup as estimated_live_rows,
  n_dead_tup as estimated_dead_rows,
  pg_size_pretty(pg_total_relation_size(relid)) as total_size
from pg_catalog.pg_stat_user_tables
where schemaname = 'public'
  and relname in ('customer_kiosk_sessions', 'store_kiosk_devices')
order by relname;
```

Only after confirming the existing physical types, run compatible anomaly queries. The device query is expected to be type-compatible:

```sql
select count(*) as missing_same_store_device_rows
from public.customer_kiosk_sessions s
left join public.store_kiosk_devices d
  on d.id = s.device_id
 and d.store_id = s.store_id
where d.id is null;
```

```sql
select
  count(*) filter (where submission_version < 0) as invalid_versions,
  count(*) filter (where expires_at <= created_at) as invalid_expiry,
  count(*) filter (
    where status in ('submitted', 'accepted', 'returned')
      and (submission_payload is null or submitted_at is null)
  ) as invalid_submission_state,
  count(*) filter (
    where status = 'accepted'
      and (accepted_at is null or nullif(btrim(accepted_by), '') is null)
  ) as invalid_accepted_state,
  count(*) filter (
    where status = 'returned'
      and (
        returned_at is null
        or nullif(btrim(submission_payload ->> 'customer_return_reason'), '') is null
      )
  ) as invalid_returned_state,
  count(*) filter (where status = 'cancelled' and cancelled_at is null) as invalid_cancelled_state
from public.customer_kiosk_sessions;
```

```sql
select
  count(*) filter (
    where device_token_hash is not null
      and device_token_hash !~ '^[a-f0-9]{64}$'
  ) as invalid_token_hash,
  count(*) filter (
    where pairing_code_hash is not null
      and pairing_code_hash !~ '^[a-f0-9]{64}$'
  ) as invalid_pairing_hash,
  count(*) filter (
    where status = 'pairing'
      and not (
        device_token_hash is null
        and pairing_code_hash is not null
        and pairing_code_expires_at is not null
        and pairing_code_expires_at > created_at
      )
  ) as invalid_pairing_state,
  count(*) filter (
    where status = 'active'
      and not (
        device_token_hash is not null
        and paired_at is not null
        and pairing_code_hash is null
        and pairing_code_expires_at is null
      )
  ) as invalid_active_state,
  count(*) filter (
    where status = 'revoked'
      and not (
        device_token_hash is null
        and pairing_code_hash is null
        and pairing_code_expires_at is null
        and revoked_at is not null
      )
  ) as invalid_revoked_state
from public.store_kiosk_devices;
```

Stop immediately if a table/column is absent, a physical type differs from the reviewed expectation, a required parent composite key cannot be created safely, or any session/device anomaly count is non-zero. Also stop if table size, traffic, or lock evidence has not been reviewed into an approved maintenance window. Do not auto-cast, backfill, delete, or repair data under this packet.

## Gate 2A — isolated executable apply (required; not yet satisfied)

The textual Vitest contract does not prove that PostgreSQL can execute the migration. Before any linked dry-run/apply, reset an isolated local Supabase stack from the full migration history, lint it, and run the Gate 4 object/anomaly checks against that isolated database.

```sh
supabase start
supabase db reset --local --no-seed
supabase db lint --local --schema public --level error --fail-on error
```

Current evidence on 2026-07-13: Supabase CLI `2.101.0` is available, but the local Docker daemon is unavailable, so Gate 2A has **not** passed. An isolated preview branch is an alternative only with separate Owner approval and the same post-check evidence. Never use a linked production database to substitute for this gate.

## Gate 2B — migration-order and linked dry-run review (not authorized or run)

Use a clean release worktree and the exact linked project selected by the Owner.

```sh
supabase migration list
supabase db push --dry-run
```

Stop if Gate 2A is missing or if the dry-run includes any migration other than the explicitly reviewed pending set. A dry-run lists pending SQL but is not executable-apply evidence. Do not use `--include-all` to bypass migration-history divergence. Confirm the reviewed window can tolerate the non-concurrent index/constraint DDL; a lock or statement timeout must abort the attempt rather than trigger an improvised retry. Redact project identifiers and never capture tokens or database credentials in task evidence.

## Gate 3 — linked apply (not authorized or run)

Requires a new Owner approval after Gates 1, 2A, and 2B are attached to the task. Before apply, production traffic must be proven absent or contained by the deployed default-off Kiosk interlock. The apply must use the reviewed clean worktree, reviewed pending set, bounded migration timeouts, and approved maintenance window. Do not combine it with data repair, constraint validation, RPC/grant changes, flag enablement, deployment, or push.

## Gate 4 — post-apply verification (mandatory after an approved apply)

```sql
select
  conname,
  contype,
  convalidated,
  pg_get_constraintdef(oid, true) as definition
from pg_catalog.pg_constraint
where conrelid in (
  'public.customer_kiosk_sessions'::regclass,
  'public.store_kiosk_devices'::regclass
)
  and conname in (
    'customer_kiosk_sessions_device_same_store_fkey',
    'customer_kiosk_sessions_submission_version_nonnegative',
    'customer_kiosk_sessions_expiry_after_creation',
    'customer_kiosk_sessions_submission_state_shape',
    'customer_kiosk_sessions_accepted_state_shape',
    'customer_kiosk_sessions_returned_state_shape',
    'customer_kiosk_sessions_cancelled_state_shape',
    'store_kiosk_devices_token_hash_format',
    'store_kiosk_devices_pairing_hash_format',
    'store_kiosk_devices_pairing_state_shape',
    'store_kiosk_devices_active_state_shape',
    'store_kiosk_devices_revoked_state_shape'
  )
order by conname;
```

```sql
select indexname, indexdef
from pg_catalog.pg_indexes
where schemaname = 'public'
  and indexname in (
    'store_kiosk_devices_id_store_id_uidx',
    'customer_kiosk_sessions_device_store_idx',
    'customer_kiosk_sessions_open_expiry_idx'
  )
order by indexname;
```

Repeat the Gate 1 RLS, full policy-definition, and raw ACL queries and compare their complete result sets with the saved preflight snapshot. Then repeat all three Gate 1 anomaly queries (same-store device, session shapes, and device shapes).

Expected: all listed objects exist; the newly added constraints remain `convalidated = false` until a later validation approval; every repeated anomaly count is zero; RLS/policies/grants exactly match the saved preflight snapshot; the application flags remain disabled. Any mismatch is a release stop and must be recorded before a reviewed forward fix or rollback decision.

## Separate decisions that this packet does not authorize

- order/customer same-store foreign keys;
- Stage 2 parent composite-key/orphan analysis beyond the physical-type snapshot in Gate 1;
- historical data repair or `VALIDATE CONSTRAINT`;
- transactional finalize RPC, function grants, or outbox/sweeper;
- reviewer-role changes;
- retention periods or privacy/consent wording;
- distributed rate-limit/token policy;
- `REPAIRDESK_KIOSK_PRODUCTION_ENABLED=1`;
- `REPAIRDESK_KIOSK_REVIEW_WRITES_ENABLED=1`;
- commit push, deployment, or production traffic.
