-- Self-service store purge safety contract.
--
-- This migration deliberately does not delete data or enable any feature flag.
-- It adds a server-owned request ledger, a 24 hour cooling period, two distinct
-- AAL2 challenges, cancellation before the destructive step, and a lease-bound
-- exception to the v2 lifecycle writer fence for the existing purge worker.

set lock_timeout = '5s';

create or replace function public.repairdesk_store_lifecycle_contract_version()
returns integer
language sql
stable
security definer
set search_path = pg_catalog, public
as $$ select 3; $$;

revoke all on function public.repairdesk_store_lifecycle_contract_version()
  from public, anon, authenticated;
grant execute on function public.repairdesk_store_lifecycle_contract_version() to service_role;

create or replace function public.repairdesk_store_data_catalog()
returns table (
  table_name text,
  primary_key_columns jsonb
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select
    table_info.table_name::text,
    coalesce(
      (
        select jsonb_agg(attribute.attname order by key_column.ordinality)
        from pg_catalog.pg_index index_info
        join lateral unnest(index_info.indkey) with ordinality as key_column(attnum, ordinality)
          on true
        join pg_catalog.pg_attribute attribute
          on attribute.attrelid = index_info.indrelid
         and attribute.attnum = key_column.attnum
        where index_info.indrelid = format('public.%I', table_info.table_name)::regclass
          and index_info.indisprimary
      ),
      '[]'::jsonb
    ) as primary_key_columns
  from information_schema.tables table_info
  where table_info.table_schema = 'public'
    and table_info.table_type = 'BASE TABLE'
    and (
      table_info.table_name = 'stores'
      or exists (
        select 1 from information_schema.columns column_info
        where column_info.table_schema = table_info.table_schema
          and column_info.table_name = table_info.table_name
          and column_info.column_name = 'store_id'
          and column_info.udt_name = 'uuid'
      )
    )
    and table_info.table_name not in (
      'store_lifecycle_operations',
      'store_lifecycle_preflights',
      'store_lifecycle_challenges',
      'store_export_jobs',
      'store_restore_proofs',
      'store_purge_jobs',
      'store_purge_requests'
    )
  order by table_info.table_name;
$$;

revoke all on function public.repairdesk_store_data_catalog()
  from public, anon, authenticated;
grant execute on function public.repairdesk_store_data_catalog() to service_role;

alter table public.store_lifecycle_challenges
  drop constraint if exists store_lifecycle_challenges_operation_kind_check;
alter table public.store_lifecycle_challenges
  add constraint store_lifecycle_challenges_operation_kind_check
  check (operation_kind in (
    'rename', 'request_close', 'cancel_close', 'restore', 'schedule_purge',
    'request_purge', 'confirm_purge'
  ));

create table if not exists public.store_purge_requests (
  id uuid primary key,
  store_id uuid not null references public.stores(id) on update cascade on delete restrict,
  actor_id uuid not null,
  lifecycle_revision bigint not null check (lifecycle_revision >= 1),
  preflight_id uuid not null
    references public.store_lifecycle_preflights(id) on update cascade on delete restrict,
  export_job_id uuid not null
    references public.store_export_jobs(id) on update cascade on delete restrict,
  state text not null default 'cooling'
    check (state in (
      'cooling', 'preparing_export', 'ready_for_confirmation', 'scheduled',
      'cancelled', 'purging', 'failed', 'completed'
    )),
  requested_at timestamptz not null default now(),
  cooling_until timestamptz not null,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  purge_job_id uuid references public.store_purge_jobs(id) on update cascade on delete set null,
  request_approval_sha256 char(64) not null
    check (request_approval_sha256 ~ '^[0-9a-f]{64}$'),
  final_approval_sha256 char(64)
    check (final_approval_sha256 is null or final_approval_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cooling_until >= requested_at + interval '24 hours'),
  check ((state = 'cancelled') = (cancelled_at is not null)),
  check (confirmed_at is null or final_approval_sha256 is not null)
);

create unique index if not exists store_purge_requests_one_open_store_idx
  on public.store_purge_requests(store_id)
  where state in (
    'cooling', 'preparing_export', 'ready_for_confirmation', 'scheduled', 'purging'
  );
create index if not exists store_purge_requests_actor_created_idx
  on public.store_purge_requests(actor_id, created_at desc);

alter table public.store_purge_requests enable row level security;
revoke all on table public.store_purge_requests from public, anon, authenticated;
grant select, insert, update, delete on table public.store_purge_requests to service_role;

create or replace function public.repairdesk_request_store_purge_rpc(
  p_store_id uuid,
  p_actor_id uuid,
  p_expected_revision bigint,
  p_challenge_id uuid,
  p_preflight_snapshot_hash text,
  p_confirmation_store_name text,
  p_confirmation_store_id_suffix text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, extensions
as $$
declare
  v_now timestamptz := now();
  v_store public.stores%rowtype;
  v_lifecycle public.store_lifecycles%rowtype;
  v_preflight public.store_lifecycle_preflights%rowtype;
  v_request_id uuid := gen_random_uuid();
  v_export_job_id uuid := gen_random_uuid();
  v_cooling_until timestamptz := v_now + interval '24 hours';
  v_approval char(64);
begin
  if p_preflight_snapshot_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'P0001', message = 'STORE_LIFECYCLE_INVALID_REQUEST';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_store_id::text, 0));
  select * into v_store from public.stores where id = p_store_id for update;
  select * into v_lifecycle from public.store_lifecycles where store_id = p_store_id for update;
  select * into v_preflight
    from public.store_lifecycle_preflights
   where store_id = p_store_id
     and lifecycle_revision = p_expected_revision
     and snapshot_hash = p_preflight_snapshot_hash
     and state = 'eligible'
     and expires_at > v_now
     and jsonb_array_length(blockers) = 0
   for update;
  if v_store.id is null
     or v_store.status <> 'active'::public.store_status
     or v_store.owner_user_id is distinct from p_actor_id
     or v_lifecycle.store_id is null
     or v_lifecycle.phase <> 'archived'
     or v_lifecycle.revision <> p_expected_revision
     or v_preflight.id is null
     or (v_lifecycle.retention_until is not null and v_lifecycle.retention_until > v_now)
     or (v_lifecycle.legal_hold_until is not null and v_lifecycle.legal_hold_until > v_now)
     or not exists (
       select 1 from public.store_memberships membership
        where membership.store_id = p_store_id
          and membership.user_id = p_actor_id
          and membership.role = 'owner'::public.staff_role
          and membership.status = 'active'::public.store_membership_status
     ) then
    raise exception using errcode = 'P0001', message = 'STORE_LIFECYCLE_FORBIDDEN';
  end if;
  if p_confirmation_store_name is distinct from v_store.name
     or lower(btrim(p_confirmation_store_id_suffix))
        <> right(replace(p_store_id::text, '-', ''), 8) then
    raise exception using errcode = 'P0001', message = 'STORE_LIFECYCLE_CONFIRMATION_MISMATCH';
  end if;
  if exists (
    select 1 from public.store_purge_requests request
     where request.store_id = p_store_id
       and request.state in (
         'cooling', 'preparing_export', 'ready_for_confirmation', 'scheduled', 'purging'
       )
  ) then
    raise exception using errcode = 'P0001', message = 'STORE_PURGE_REQUEST_ALREADY_OPEN';
  end if;
  update public.store_lifecycle_challenges challenge
     set status = 'consumed', consumed_at = v_now
   where challenge.id = p_challenge_id
     and challenge.store_id = p_store_id
     and challenge.actor_id = p_actor_id
     and challenge.operation_kind = 'request_purge'
     and challenge.lifecycle_revision = p_expected_revision
     and challenge.preflight_snapshot_hash = p_preflight_snapshot_hash
     and challenge.assurance_level = 'aal2'
     and challenge.status = 'issued'
     and challenge.expires_at > v_now;
  if not found then
    raise exception using errcode = 'P0001', message = 'STORE_LIFECYCLE_REAUTH_REQUIRED';
  end if;

  v_approval := encode(extensions.digest(convert_to(concat_ws(
    '|', 'request_purge_v1', v_request_id::text, p_store_id::text,
    p_actor_id::text, p_expected_revision::text, p_preflight_snapshot_hash,
    v_cooling_until::text
  ), 'UTF8'), 'sha256'), 'hex');

  insert into public.store_export_jobs (
    id, store_id, preflight_id, state, schema_version, app_version, actor_id
  ) values (
    v_export_job_id, p_store_id, v_preflight.id, 'pending',
    'store-export-v1', 'self-service-purge-v1', p_actor_id
  );
  insert into public.store_purge_requests (
    id, store_id, actor_id, lifecycle_revision, preflight_id, export_job_id,
    state, requested_at, cooling_until, request_approval_sha256
  ) values (
    v_request_id, p_store_id, p_actor_id, p_expected_revision, v_preflight.id,
    v_export_job_id, 'cooling', v_now, v_cooling_until, v_approval
  );
  insert into public.audit_logs (
    id, store_id, actor_id, actor_name, action, entity_type, entity_id, metadata
  )
  values (
    gen_random_uuid()::text, p_store_id, p_actor_id, 'Store owner',
    'store.purge_requested', 'store', p_store_id::text,
    jsonb_build_object(
      'purge_request_id', v_request_id,
      'cooling_until', v_cooling_until,
      'preflight_snapshot_hash', p_preflight_snapshot_hash
    )
  );
  return jsonb_build_object(
    'request_id', v_request_id, 'store_id', p_store_id, 'state', 'cooling',
    'requested_at', v_now, 'cooling_until', v_cooling_until,
    'export_job_id', v_export_job_id
  );
end;
$$;

create or replace function public.repairdesk_cancel_store_purge_request_rpc(
  p_store_id uuid,
  p_actor_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := now();
  v_request public.store_purge_requests%rowtype;
  v_job public.store_purge_jobs%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_store_id::text, 0));
  select * into v_request from public.store_purge_requests
   where id = p_request_id and store_id = p_store_id for update;
  if v_request.id is null
     or v_request.state not in ('cooling', 'preparing_export', 'ready_for_confirmation', 'scheduled')
     or not exists (
       select 1 from public.stores store
       join public.store_memberships membership on membership.store_id = store.id
        where store.id = p_store_id
          and store.owner_user_id = p_actor_id
          and membership.user_id = p_actor_id
          and membership.role = 'owner'::public.staff_role
          and membership.status = 'active'::public.store_membership_status
     ) then
    raise exception using errcode = 'P0001', message = 'STORE_PURGE_CANCEL_FORBIDDEN';
  end if;
  if v_request.purge_job_id is not null then
    select * into v_job from public.store_purge_jobs where id = v_request.purge_job_id for update;
    if v_job.id is null or v_job.destructive_step_started or v_job.state = 'running' then
      raise exception using errcode = 'P0001', message = 'STORE_PURGE_IRREVERSIBLE';
    end if;
    delete from public.store_purge_steps where purge_job_id = v_job.id;
    delete from public.store_purge_jobs where id = v_job.id;
    update public.store_lifecycles
       set phase = 'archived', purge_after = null, revision = revision + 1,
           last_operation_id = null, updated_by = p_actor_id, updated_at = v_now
     where store_id = p_store_id and phase = 'purge_scheduled';
  end if;
  update public.store_export_jobs
     set state = case when state in ('pending', 'exporting') then 'failed' else state end,
         error_code = case when state in ('pending', 'exporting') then 'OWNER_CANCELLED' else error_code end,
         updated_at = v_now
   where id = v_request.export_job_id;
  update public.store_purge_requests
     set state = 'cancelled', cancelled_at = v_now, updated_at = v_now
   where id = v_request.id;
  insert into public.audit_logs (
    id, store_id, actor_id, actor_name, action, entity_type, entity_id, metadata
  )
  values (
    gen_random_uuid()::text, p_store_id, p_actor_id, 'Store owner',
    'store.purge_cancelled', 'store', p_store_id::text,
    jsonb_build_object('purge_request_id', p_request_id)
  );
  return jsonb_build_object(
    'request_id', p_request_id, 'store_id', p_store_id,
    'state', 'cancelled', 'cancelled_at', v_now
  );
end;
$$;

create or replace function public.repairdesk_confirm_store_purge_request_rpc(
  p_store_id uuid,
  p_actor_id uuid,
  p_request_id uuid,
  p_expected_revision bigint,
  p_challenge_id uuid,
  p_preflight_snapshot_hash text,
  p_confirmation_store_name text,
  p_confirmation_store_id_suffix text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, extensions
as $$
declare
  v_now timestamptz := now();
  v_request public.store_purge_requests%rowtype;
  v_store public.stores%rowtype;
  v_export public.store_export_jobs%rowtype;
  v_schedule_challenge_id uuid := gen_random_uuid();
  v_operation_id uuid := gen_random_uuid();
  v_purge_after timestamptz := v_now + interval '5 minutes';
  v_approval char(64);
  v_scheduled jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_store_id::text, 0));
  select * into v_request from public.store_purge_requests
   where id = p_request_id and store_id = p_store_id for update;
  select * into v_store from public.stores where id = p_store_id for update;
  select * into v_export from public.store_export_jobs
   where id = v_request.export_job_id and store_id = p_store_id for update;
  if v_request.id is null
     or v_request.state not in ('cooling', 'preparing_export', 'ready_for_confirmation')
     or v_request.cooling_until > v_now
     or v_request.lifecycle_revision <> p_expected_revision
     or v_export.id is null
     or v_export.state <> 'restore_verified'
     or v_store.owner_user_id is distinct from p_actor_id
     or not exists (
       select 1 from public.store_lifecycle_preflights preflight
        where preflight.store_id = p_store_id
          and preflight.lifecycle_revision = p_expected_revision
          and preflight.snapshot_hash = p_preflight_snapshot_hash
          and preflight.state = 'eligible'
          and preflight.expires_at > v_now
          and jsonb_array_length(preflight.blockers) = 0
     )
     or p_confirmation_store_name is distinct from v_store.name
     or lower(btrim(p_confirmation_store_id_suffix))
        <> right(replace(p_store_id::text, '-', ''), 8) then
    raise exception using errcode = 'P0001', message = 'STORE_PURGE_FINAL_CONFIRMATION_BLOCKED';
  end if;
  update public.store_lifecycle_challenges challenge
     set status = 'consumed', consumed_at = v_now
   where challenge.id = p_challenge_id
     and challenge.store_id = p_store_id
     and challenge.actor_id = p_actor_id
     and challenge.operation_kind = 'confirm_purge'
     and challenge.lifecycle_revision = p_expected_revision
     and challenge.preflight_snapshot_hash = p_preflight_snapshot_hash
     and challenge.assurance_level = 'aal2'
     and challenge.status = 'issued'
     and challenge.expires_at > v_now;
  if not found then
    raise exception using errcode = 'P0001', message = 'STORE_LIFECYCLE_REAUTH_REQUIRED';
  end if;
  v_approval := encode(extensions.digest(convert_to(concat_ws(
    '|', 'confirm_purge_v1', v_request.id::text, p_store_id::text,
    p_actor_id::text, p_expected_revision::text, p_preflight_snapshot_hash,
    v_export.id::text, v_export.artifact_sha256, v_purge_after::text
  ), 'UTF8'), 'sha256'), 'hex');
  insert into public.store_lifecycle_challenges (
    id, store_id, actor_id, operation_kind, lifecycle_revision,
    preflight_snapshot_hash, assurance_level, status, expires_at
  ) values (
    v_schedule_challenge_id, p_store_id, p_actor_id, 'schedule_purge',
    p_expected_revision, p_preflight_snapshot_hash, 'aal2', 'issued',
    v_now + interval '1 minute'
  );
  v_scheduled := public.repairdesk_schedule_store_purge_rpc(
    p_store_id, p_actor_id, v_operation_id, p_expected_revision,
    v_schedule_challenge_id, p_preflight_snapshot_hash, v_export.id,
    v_approval, v_purge_after
  );
  update public.store_purge_requests
     set state = 'scheduled', confirmed_at = v_now,
         final_approval_sha256 = v_approval,
         purge_job_id = (v_scheduled ->> 'purge_job_id')::uuid,
         updated_at = v_now
   where id = v_request.id;
  insert into public.audit_logs (
    id, store_id, actor_id, actor_name, action, entity_type, entity_id, metadata
  )
  values (
    gen_random_uuid()::text, p_store_id, p_actor_id, 'Store owner',
    'store.purge_final_confirmed', 'store', p_store_id::text,
    jsonb_build_object(
      'purge_request_id', v_request.id,
      'purge_job_id', v_scheduled ->> 'purge_job_id',
      'purge_after', v_purge_after
    )
  );
  return jsonb_build_object(
    'request_id', v_request.id, 'store_id', p_store_id, 'state', 'scheduled',
    'requested_at', v_request.requested_at, 'cooling_until', v_request.cooling_until,
    'export_job_id', v_export.id, 'purge_job_id', v_scheduled ->> 'purge_job_id',
    'purge_after', v_purge_after
  );
end;
$$;

-- A custom GUC alone is never trusted. The writer fence also verifies the
-- service-role JWT, exact store UUID, job UUID, worker identity and live lease.
create or replace function public.repairdesk_purge_worker_write_allowed(
  p_store_id uuid,
  p_operation text
)
returns boolean
language sql
volatile
security definer
set search_path = pg_catalog, public
as $$
  select
    coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    and current_setting('repairdesk.purge_store_id', true) = p_store_id::text
    and current_setting('repairdesk.purge_operation', true) = p_operation
    and exists (
      select 1 from public.store_purge_jobs job
       where job.id::text = current_setting('repairdesk.purge_job_id', true)
         and job.store_id = p_store_id
         and job.state = 'running'
         and job.lease_owner = current_setting('repairdesk.purge_worker_id', true)
         and job.lease_expires_at > now()
         and job.destructive_step_started
    );
$$;

revoke all on function public.repairdesk_purge_worker_write_allowed(uuid, text)
  from public, anon, authenticated;

create or replace function public.repairdesk_enforce_active_store_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_old_store_id uuid;
  v_new_store_id uuid;
  v_store_id uuid;
  v_store_status text;
  v_lifecycle_phase text;
begin
  if tg_op <> 'INSERT' then
    v_old_store_id := nullif(to_jsonb(old) ->> 'store_id', '')::uuid;
  end if;
  if tg_op <> 'DELETE' then
    v_new_store_id := nullif(to_jsonb(new) ->> 'store_id', '')::uuid;
  end if;
  if tg_op = 'UPDATE' and v_old_store_id is distinct from v_new_store_id then
    raise exception using errcode = 'P0001', message = 'STORE_LIFECYCLE_CROSS_STORE_WRITE_FORBIDDEN';
  end if;
  v_store_id := coalesce(v_new_store_id, v_old_store_id);
  if v_store_id is null then
    raise exception using errcode = 'P0001', message = 'STORE_LIFECYCLE_STORE_REQUIRED';
  end if;
  if (tg_op = 'DELETE' and public.repairdesk_purge_worker_write_allowed(v_store_id, 'delete'))
     or (tg_op = 'UPDATE' and tg_table_name = 'inventory_attachments'
       and public.repairdesk_purge_worker_write_allowed(v_store_id, 'prepare')) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended(v_store_id::text, 0));
  select store.status::text, lifecycle.phase::text
    into v_store_status, v_lifecycle_phase
    from public.stores store
    join public.store_lifecycles lifecycle on lifecycle.store_id = store.id
   where store.id = v_store_id;
  if v_store_status is distinct from 'active' or v_lifecycle_phase is distinct from 'active' then
    raise exception using errcode = 'P0001', message = 'STORE_LIFECYCLE_WRITE_BLOCKED';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- Completion deletes the job before the root store row because of FK order.
-- The store-row fence therefore binds the final delete to the tombstone and
-- operation id created inside the same service-role-only completion RPC.
create or replace function public.repairdesk_enforce_active_store_row_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_store_id uuid;
  v_lifecycle_phase text;
  v_store_hash char(64);
begin
  if tg_op = 'INSERT' then return new; end if;
  v_store_id := old.id;
  if tg_op = 'DELETE'
     and coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
     and current_setting('repairdesk.purge_store_id', true) = v_store_id::text
     and current_setting('repairdesk.purge_operation', true) in ('delete', 'complete') then
    v_store_hash := encode(extensions.digest(convert_to(v_store_id::text, 'UTF8'), 'sha256'), 'hex');
    if exists (
      select 1 from public.store_tombstones tombstone
       where tombstone.store_id_hash = v_store_hash
         and tombstone.purge_operation_id::text = current_setting('repairdesk.purge_operation_id', true)
    ) then
      return old;
    end if;
  end if;
  perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended(v_store_id::text, 0));
  select lifecycle.phase::text into v_lifecycle_phase
    from public.store_lifecycles lifecycle where lifecycle.store_id = v_store_id;
  if v_lifecycle_phase is not null and v_lifecycle_phase <> 'active' then
    raise exception using errcode = 'P0001', message = 'STORE_LIFECYCLE_WRITE_BLOCKED';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.repairdesk_prepare_store_purge_database_v3_rpc(
  p_job_id uuid,
  p_worker_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_job public.store_purge_jobs%rowtype;
begin
  select * into v_job from public.store_purge_jobs where id = p_job_id for update;
  if v_job.id is null
     or v_job.state <> 'running'
     or v_job.lease_owner is distinct from btrim(p_worker_id)
     or v_job.lease_expires_at <= now()
     or not v_job.destructive_step_started then
    raise exception using errcode = 'P0001', message = 'STORE_PURGE_LEASE_INVALID';
  end if;
  perform set_config('repairdesk.purge_job_id', v_job.id::text, true);
  perform set_config('repairdesk.purge_store_id', v_job.store_id::text, true);
  perform set_config('repairdesk.purge_worker_id', btrim(p_worker_id), true);
  perform set_config('repairdesk.purge_operation', 'prepare', true);
  return public.repairdesk_prepare_store_purge_database_rpc(p_job_id, p_worker_id);
end;
$$;

create or replace function public.repairdesk_purge_store_table_batch_v3_rpc(
  p_job_id uuid,
  p_worker_id text,
  p_table_name text,
  p_batch_size integer default 500
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_job public.store_purge_jobs%rowtype;
begin
  select * into v_job from public.store_purge_jobs where id = p_job_id for update;
  if v_job.id is null
     or v_job.state <> 'running'
     or v_job.lease_owner is distinct from btrim(p_worker_id)
     or v_job.lease_expires_at <= now()
     or not v_job.destructive_step_started then
    raise exception using errcode = 'P0001', message = 'STORE_PURGE_LEASE_INVALID';
  end if;
  perform set_config('repairdesk.purge_job_id', v_job.id::text, true);
  perform set_config('repairdesk.purge_store_id', v_job.store_id::text, true);
  perform set_config('repairdesk.purge_worker_id', btrim(p_worker_id), true);
  perform set_config('repairdesk.purge_operation', 'delete', true);
  return public.repairdesk_purge_store_table_batch_rpc(
    p_job_id, p_worker_id, p_table_name, p_batch_size
  );
end;
$$;

create or replace function public.repairdesk_complete_store_purge_v3_rpc(
  p_job_id uuid,
  p_worker_id text,
  p_zero_residual_proof_sha256 text,
  p_other_tenant_after_sha256 text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_job public.store_purge_jobs%rowtype;
  v_result jsonb;
begin
  select * into v_job from public.store_purge_jobs where id = p_job_id for update;
  if v_job.id is null
     or v_job.state <> 'running'
     or v_job.lease_owner is distinct from btrim(p_worker_id)
     or v_job.lease_expires_at <= now()
     or not v_job.destructive_step_started then
    raise exception using errcode = 'P0001', message = 'STORE_PURGE_LEASE_INVALID';
  end if;
  perform set_config('repairdesk.purge_job_id', v_job.id::text, true);
  perform set_config('repairdesk.purge_store_id', v_job.store_id::text, true);
  perform set_config('repairdesk.purge_worker_id', btrim(p_worker_id), true);
  perform set_config('repairdesk.purge_operation', 'delete', true);
  perform set_config('repairdesk.purge_operation_id', v_job.operation_id::text, true);
  v_result := public.repairdesk_complete_store_purge_rpc(
    p_job_id, p_worker_id, p_zero_residual_proof_sha256,
    p_other_tenant_after_sha256
  );
  return v_result;
end;
$$;

revoke all on function public.repairdesk_request_store_purge_rpc(
  uuid, uuid, bigint, uuid, text, text, text
) from public, anon, authenticated;
grant execute on function public.repairdesk_request_store_purge_rpc(
  uuid, uuid, bigint, uuid, text, text, text
) to service_role;
revoke all on function public.repairdesk_cancel_store_purge_request_rpc(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.repairdesk_cancel_store_purge_request_rpc(uuid, uuid, uuid)
  to service_role;
revoke all on function public.repairdesk_confirm_store_purge_request_rpc(
  uuid, uuid, uuid, bigint, uuid, text, text, text
) from public, anon, authenticated;
grant execute on function public.repairdesk_confirm_store_purge_request_rpc(
  uuid, uuid, uuid, bigint, uuid, text, text, text
) to service_role;
revoke all on function public.repairdesk_prepare_store_purge_database_v3_rpc(uuid, text)
  from public, anon, authenticated;
grant execute on function public.repairdesk_prepare_store_purge_database_v3_rpc(uuid, text)
  to service_role;
revoke all on function public.repairdesk_purge_store_table_batch_v3_rpc(uuid, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.repairdesk_purge_store_table_batch_v3_rpc(uuid, text, text, integer)
  to service_role;
revoke all on function public.repairdesk_complete_store_purge_v3_rpc(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.repairdesk_complete_store_purge_v3_rpc(uuid, text, text, text)
  to service_role;

select pg_notify('pgrst', 'reload schema');
reset lock_timeout;
