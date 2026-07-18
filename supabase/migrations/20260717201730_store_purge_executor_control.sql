set lock_timeout = '5s';

alter table public.store_purge_jobs
  add column if not exists other_tenant_before_sha256 char(64),
  add column if not exists storage_zero_verified_at timestamptz,
  add column if not exists database_zero_verified_at timestamptz;

alter table public.store_purge_jobs
  drop constraint if exists store_purge_jobs_other_tenant_before_sha256_check,
  add constraint store_purge_jobs_other_tenant_before_sha256_check
    check (
      other_tenant_before_sha256 is null
      or other_tenant_before_sha256 ~ '^[0-9a-f]{64}$'
    );

alter table public.store_tombstones
  add column if not exists artifact_sha256 char(64);
alter table public.store_tombstones
  drop constraint if exists store_tombstones_artifact_sha256_check,
  add constraint store_tombstones_artifact_sha256_check
    check (artifact_sha256 is null or artifact_sha256 ~ '^[0-9a-f]{64}$');

create or replace function public.repairdesk_store_purge_catalog()
returns table (
  table_name text,
  depends_on jsonb
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  with catalog as (
    select table_info.table_name::text
    from information_schema.tables table_info
    where table_info.table_schema = 'public'
      and table_info.table_type = 'BASE TABLE'
      and exists (
        select 1 from information_schema.columns column_info
        where column_info.table_schema = table_info.table_schema
          and column_info.table_name = table_info.table_name
          and column_info.column_name = 'store_id'
      )
      and table_info.table_name not in (
        'stores',
        'store_lifecycles',
        'store_lifecycle_operations',
        'store_lifecycle_preflights',
        'store_lifecycle_challenges',
        'store_export_jobs',
        'store_export_table_manifests',
        'store_export_storage_objects',
        'store_restore_proofs',
        'store_purge_jobs',
        'store_purge_steps',
        'store_tombstones'
      )
  )
  select
    catalog.table_name,
    coalesce(
      (
        select jsonb_agg(distinct parent.relname order by parent.relname)
        from pg_catalog.pg_constraint constraint_info
        join pg_catalog.pg_class child on child.oid = constraint_info.conrelid
        join pg_catalog.pg_namespace child_schema on child_schema.oid = child.relnamespace
        join pg_catalog.pg_class parent on parent.oid = constraint_info.confrelid
        join pg_catalog.pg_namespace parent_schema on parent_schema.oid = parent.relnamespace
        where constraint_info.contype = 'f'
          and constraint_info.confdeltype in ('a', 'r')
          and constraint_info.conname <> 'inventory_attachments_agreement_fkey'
          and child_schema.nspname = 'public'
          and parent_schema.nspname = 'public'
          and child.relname = catalog.table_name
          and parent.relname in (select parent_catalog.table_name from catalog parent_catalog)
          and parent.relname <> child.relname
      ),
      '[]'::jsonb
    ) as depends_on
  from catalog
  order by catalog.table_name;
$$;

create or replace function public.repairdesk_store_purge_residual_counts(p_store_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_catalog record;
  v_count bigint;
  v_counts jsonb := '{}'::jsonb;
begin
  for v_catalog in select * from public.repairdesk_store_purge_catalog() loop
    execute format('select count(*) from public.%I where store_id = $1', v_catalog.table_name)
      into v_count using p_store_id;
    if v_count > 0 then
      v_counts := v_counts || jsonb_build_object(v_catalog.table_name, v_count);
    end if;
  end loop;
  return v_counts;
end;
$$;

create or replace function public.repairdesk_other_tenant_guard_sha256(p_store_id uuid)
returns char(64)
language plpgsql
security invoker
set search_path = pg_catalog, public, extensions
as $$
declare
  v_catalog record;
  v_count bigint;
  v_lines text := '';
begin
  for v_catalog in select * from public.repairdesk_store_purge_catalog() loop
    execute format(
      'select count(*) from public.%I where store_id is distinct from $1',
      v_catalog.table_name
    ) into v_count using p_store_id;
    v_lines := v_lines || v_catalog.table_name || ':' || v_count::text || E'\n';
  end loop;
  return encode(extensions.digest(convert_to(v_lines, 'UTF8'), 'sha256'), 'hex');
end;
$$;

create or replace function public.repairdesk_schedule_store_purge_rpc(
  p_store_id uuid,
  p_actor_id uuid,
  p_operation_id uuid,
  p_expected_revision bigint,
  p_challenge_id uuid,
  p_preflight_snapshot_hash text,
  p_export_job_id uuid,
  p_approval_ref_hash text,
  p_purge_after timestamptz
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
  v_export public.store_export_jobs%rowtype;
  v_job_id uuid := gen_random_uuid();
  v_request_hash char(64);
  v_operation public.store_lifecycle_operations%rowtype;
  v_result jsonb;
  v_step text;
begin
  if p_approval_ref_hash !~ '^[0-9a-f]{64}$'
     or p_preflight_snapshot_hash !~ '^[0-9a-f]{64}$'
     or p_purge_after is null
     or p_purge_after < v_now then
    raise exception using errcode = 'P0001', message = 'STORE_PURGE_INVALID_APPROVAL';
  end if;
  v_request_hash := encode(
    extensions.digest(
      convert_to(concat_ws(
        '|', p_store_id::text, p_actor_id::text, p_expected_revision::text,
        p_preflight_snapshot_hash, p_export_job_id::text, p_approval_ref_hash,
        p_purge_after::text
      ), 'UTF8'),
      'sha256'
    ),
    'hex'
  );
  select * into v_operation from public.store_lifecycle_operations where operation_id = p_operation_id;
  if found then
    if v_operation.store_id <> p_store_id or v_operation.request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'STORE_LIFECYCLE_IDEMPOTENCY_CONFLICT';
    end if;
    if v_operation.state = 'completed' then
      return v_operation.result_summary || jsonb_build_object('replayed', true);
    end if;
    raise exception using errcode = 'P0001', message = 'STORE_LIFECYCLE_OPERATION_IN_PROGRESS';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_store_id::text, 0));
  select * into v_store from public.stores where id = p_store_id for update;
  select * into v_lifecycle from public.store_lifecycles where store_id = p_store_id for update;
  select * into v_export
  from public.store_export_jobs where id = p_export_job_id and store_id = p_store_id for update;
  if v_store.id is null
     or v_store.owner_user_id is distinct from p_actor_id
     or v_lifecycle.store_id is null
     or v_lifecycle.phase <> 'archived'
     or v_export.id is null
     or v_export.state <> 'restore_verified'
     or not exists (
       select 1 from public.store_memberships membership
       where membership.store_id = p_store_id
         and membership.user_id = p_actor_id
         and membership.role = 'owner'::public.staff_role
         and membership.status = 'active'::public.store_membership_status
     ) then
    raise exception using errcode = 'P0001', message = 'STORE_LIFECYCLE_FORBIDDEN';
  end if;
  if v_lifecycle.revision <> p_expected_revision then
    raise exception using errcode = 'P0001', message = 'STORE_LIFECYCLE_VERSION_CONFLICT';
  end if;
  if (v_lifecycle.retention_until is not null and v_lifecycle.retention_until > v_now)
     or (v_lifecycle.legal_hold_until is not null and v_lifecycle.legal_hold_until > v_now) then
    raise exception using errcode = 'P0001', message = 'STORE_LIFECYCLE_LEGAL_HOLD';
  end if;
  if not exists (
    select 1 from public.store_lifecycle_preflights preflight
    where preflight.store_id = p_store_id
      and preflight.lifecycle_revision = p_expected_revision
      and preflight.snapshot_hash = p_preflight_snapshot_hash
      and preflight.state = 'eligible'
      and preflight.expires_at > v_now
      and jsonb_array_length(preflight.blockers) = 0
  ) then
    raise exception using errcode = 'P0001', message = 'STORE_LIFECYCLE_BLOCKED';
  end if;
  update public.store_lifecycle_challenges challenge
     set status = 'consumed', consumed_at = v_now
   where challenge.id = p_challenge_id
     and challenge.store_id = p_store_id
     and challenge.actor_id = p_actor_id
     and challenge.operation_kind = 'schedule_purge'
     and challenge.lifecycle_revision = p_expected_revision
     and challenge.preflight_snapshot_hash = p_preflight_snapshot_hash
     and challenge.assurance_level = 'aal2'
     and challenge.status = 'issued'
     and challenge.expires_at > v_now;
  if not found then
    raise exception using errcode = 'P0001', message = 'STORE_LIFECYCLE_REAUTH_REQUIRED';
  end if;

  insert into public.store_lifecycle_operations (
    operation_id, store_id, kind, request_hash, expected_revision, state,
    current_step, actor_id, created_at, updated_at
  ) values (
    p_operation_id, p_store_id, 'schedule_purge', v_request_hash, p_expected_revision,
    'running', 'scheduling', p_actor_id, v_now, v_now
  );
  insert into public.store_purge_jobs (
    id, store_id, export_job_id, preflight_id, operation_id,
    approval_ref_hash, state, current_step, purge_after, actor_id
  ) select
    v_job_id, p_store_id, p_export_job_id, preflight.id, p_operation_id,
    p_approval_ref_hash, 'scheduled', 'prepare', p_purge_after, p_actor_id
  from public.store_lifecycle_preflights preflight
  where preflight.snapshot_hash = p_preflight_snapshot_hash;
  foreach v_step in array array[
    'prepare', 'storage_delete_batches', 'verify_storage_zero',
    'database_delete_batches', 'verify_database_zero', 'write_tombstone', 'complete'
  ] loop
    insert into public.store_purge_steps (purge_job_id, step_key)
    values (v_job_id, v_step);
  end loop;
  update public.store_lifecycles
     set phase = 'purge_scheduled', revision = revision + 1,
         purge_after = p_purge_after, last_operation_id = p_operation_id,
         updated_by = p_actor_id, updated_at = v_now
   where store_id = p_store_id
   returning * into v_lifecycle;
  v_result := jsonb_build_object(
    'operation_id', p_operation_id, 'purge_job_id', v_job_id,
    'store_id', p_store_id, 'phase', v_lifecycle.phase,
    'revision', v_lifecycle.revision, 'purge_after', p_purge_after,
    'replayed', false
  );
  update public.store_lifecycle_operations
     set state = 'completed', current_step = 'completed',
         result_revision = v_lifecycle.revision, result_summary = v_result,
         completed_at = v_now, updated_at = v_now
   where operation_id = p_operation_id;
  return v_result;
end;
$$;

create or replace function public.repairdesk_queue_due_store_purge_jobs()
returns integer
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_count integer;
begin
  update public.store_purge_jobs
     set state = 'queued', next_attempt_at = now(), updated_at = now()
   where state = 'scheduled' and purge_after <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.repairdesk_start_store_purge_rpc(
  p_job_id uuid,
  p_worker_id text,
  p_other_tenant_before_sha256 text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := now();
  v_job public.store_purge_jobs%rowtype;
begin
  if p_other_tenant_before_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'P0001', message = 'STORE_PURGE_INVALID_TENANT_PROOF';
  end if;
  select * into v_job from public.store_purge_jobs where id = p_job_id for update;
  if v_job.id is null
     or v_job.state <> 'running'
     or v_job.lease_owner is distinct from btrim(p_worker_id)
     or v_job.lease_expires_at <= v_now
     or v_job.purge_after > v_now then
    raise exception using errcode = 'P0001', message = 'STORE_PURGE_LEASE_INVALID';
  end if;
  if not exists (
    select 1
    from public.store_lifecycles lifecycle
    join public.store_export_jobs export_job on export_job.id = v_job.export_job_id
    where lifecycle.store_id = v_job.store_id
      and lifecycle.phase in ('purge_scheduled', 'purging')
      and export_job.state = 'restore_verified'
      and (lifecycle.retention_until is null or lifecycle.retention_until <= v_now)
      and (lifecycle.legal_hold_until is null or lifecycle.legal_hold_until <= v_now)
  ) then
    raise exception using errcode = 'P0001', message = 'STORE_PURGE_GATE_BLOCKED';
  end if;
  update public.store_lifecycles
     set phase = 'purging', revision = revision + 1,
         last_operation_id = v_job.operation_id, updated_by = v_job.actor_id,
         updated_at = v_now
   where store_id = v_job.store_id and phase = 'purge_scheduled';
  update public.store_purge_jobs
     set destructive_step_started = true,
         other_tenant_before_sha256 = p_other_tenant_before_sha256,
         current_step = 'storage_delete_batches', updated_at = v_now
   where id = p_job_id;
  update public.store_purge_steps
     set state = 'completed', attempt_count = attempt_count + 1,
         started_at = coalesce(started_at, v_now), completed_at = v_now, updated_at = v_now
   where purge_job_id = p_job_id and step_key = 'prepare';
  return jsonb_build_object('job_id', p_job_id, 'store_id', v_job.store_id, 'started', true);
end;
$$;

create or replace function public.repairdesk_renew_store_purge_lease_rpc(
  p_job_id uuid,
  p_worker_id text,
  p_lease_seconds integer default 60
)
returns timestamptz
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_expires_at timestamptz;
begin
  if p_lease_seconds < 15 or p_lease_seconds > 300 then
    raise exception using errcode = 'P0001', message = 'STORE_PURGE_INVALID_WORKER_LEASE';
  end if;
  update public.store_purge_jobs
     set lease_expires_at = now() + make_interval(secs => p_lease_seconds),
         updated_at = now()
   where id = p_job_id
     and state = 'running'
     and lease_owner = btrim(p_worker_id)
     and lease_expires_at > now()
   returning lease_expires_at into v_expires_at;
  if v_expires_at is null then
    raise exception using errcode = 'P0001', message = 'STORE_PURGE_LEASE_INVALID';
  end if;
  return v_expires_at;
end;
$$;

create or replace function public.repairdesk_prepare_store_purge_database_rpc(
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
  v_unlinked bigint;
begin
  select * into v_job from public.store_purge_jobs where id = p_job_id for update;
  if v_job.id is null
     or v_job.state <> 'running'
     or v_job.lease_owner is distinct from btrim(p_worker_id)
     or v_job.lease_expires_at <= now()
     or not v_job.destructive_step_started
     or not exists (
       select 1 from public.store_purge_steps step
       where step.purge_job_id = p_job_id
         and step.step_key = 'verify_storage_zero'
         and step.state = 'completed'
     ) then
    raise exception using errcode = 'P0001', message = 'STORE_PURGE_LEASE_INVALID';
  end if;

  -- Buyback agreements require their signature attachment, while an attachment
  -- may point back to its agreement. The nullable reverse edge is cleared only
  -- for the leased target UUID before the dependency-ordered delete begins.
  update public.inventory_attachments attachment
     set agreement_id = null,
         updated_at = now()
   where attachment.store_id = v_job.store_id
     and attachment.agreement_id is not null;
  get diagnostics v_unlinked = row_count;

  update public.store_purge_jobs
     set current_step = 'database_delete_batches', updated_at = now()
   where id = p_job_id;
  return jsonb_build_object('job_id', p_job_id, 'unlinked_cycle_rows', v_unlinked);
end;
$$;

create or replace function public.repairdesk_purge_store_table_batch_rpc(
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
  v_deleted bigint;
begin
  if p_batch_size < 1 or p_batch_size > 2000
     or not exists (
       select 1 from public.repairdesk_store_purge_catalog() catalog
       where catalog.table_name = p_table_name
     ) then
    raise exception using errcode = 'P0001', message = 'STORE_PURGE_INVALID_TABLE_BATCH';
  end if;
  select * into v_job from public.store_purge_jobs where id = p_job_id for update;
  if v_job.id is null
     or v_job.state <> 'running'
     or v_job.lease_owner is distinct from btrim(p_worker_id)
     or v_job.lease_expires_at <= now()
     or not v_job.destructive_step_started then
    raise exception using errcode = 'P0001', message = 'STORE_PURGE_LEASE_INVALID';
  end if;
  execute format(
    'delete from public.%1$I where ctid in (select ctid from public.%1$I where store_id = $1 limit $2)',
    p_table_name
  ) using v_job.store_id, p_batch_size;
  get diagnostics v_deleted = row_count;
  update public.store_purge_jobs
     set current_step = 'database_delete_batches', updated_at = now()
   where id = p_job_id;
  return jsonb_build_object('table_name', p_table_name, 'deleted_count', v_deleted);
end;
$$;

create or replace function public.repairdesk_checkpoint_store_purge_step_rpc(
  p_job_id uuid,
  p_worker_id text,
  p_step_key text,
  p_state text,
  p_cursor jsonb,
  p_progress jsonb,
  p_row_count bigint,
  p_result_sha256 text,
  p_error_code text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := now();
begin
  if p_state not in ('running', 'completed', 'failed')
     or jsonb_typeof(p_cursor) <> 'object'
     or jsonb_typeof(p_progress) <> 'object'
     or (p_result_sha256 is not null and p_result_sha256 !~ '^[0-9a-f]{64}$')
     or not exists (
       select 1 from public.store_purge_jobs job
       where job.id = p_job_id
         and job.state = 'running'
         and job.lease_owner = btrim(p_worker_id)
         and job.lease_expires_at > v_now
     ) then
    raise exception using errcode = 'P0001', message = 'STORE_PURGE_CHECKPOINT_REJECTED';
  end if;
  update public.store_purge_steps
     set state = p_state,
         attempt_count = case when p_state = 'running' then attempt_count + 1 else attempt_count end,
         cursor = p_cursor,
         progress = p_progress,
         row_count = p_row_count,
         result_sha256 = p_result_sha256,
         error_code = p_error_code,
         started_at = case when p_state = 'running' then coalesce(started_at, v_now) else started_at end,
         completed_at = case when p_state = 'completed' then v_now else null end,
         updated_at = v_now
   where purge_job_id = p_job_id and step_key = p_step_key;
  if not found then
    raise exception using errcode = 'P0001', message = 'STORE_PURGE_CHECKPOINT_REJECTED';
  end if;
  update public.store_purge_jobs
     set current_step = p_step_key,
         state = case when p_state = 'failed' then 'retry' else state end,
         last_error_code = p_error_code,
         next_attempt_at = case when p_state = 'failed' then v_now + interval '1 minute' else next_attempt_at end,
         lease_owner = case when p_state = 'failed' then null else lease_owner end,
         lease_expires_at = case when p_state = 'failed' then null else lease_expires_at end,
         updated_at = v_now
   where id = p_job_id;
  return jsonb_build_object('job_id', p_job_id, 'step_key', p_step_key, 'state', p_state);
end;
$$;

create or replace function public.repairdesk_mark_store_purge_zero_proof_rpc(
  p_job_id uuid,
  p_worker_id text,
  p_storage_object_count bigint,
  p_other_tenant_after_sha256 text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_job public.store_purge_jobs%rowtype;
  v_residual jsonb;
begin
  select * into v_job from public.store_purge_jobs where id = p_job_id for update;
  if v_job.id is null
     or v_job.state <> 'running'
     or v_job.lease_owner is distinct from btrim(p_worker_id)
     or v_job.lease_expires_at <= now()
     or p_storage_object_count <> 0
     or p_other_tenant_after_sha256 !~ '^[0-9a-f]{64}$'
     or v_job.other_tenant_before_sha256 is distinct from p_other_tenant_after_sha256 then
    raise exception using errcode = 'P0001', message = 'STORE_PURGE_ZERO_PROOF_REJECTED';
  end if;
  v_residual := public.repairdesk_store_purge_residual_counts(v_job.store_id);
  if v_residual <> '{}'::jsonb then
    raise exception using errcode = 'P0001', message = 'STORE_PURGE_DATABASE_RESIDUAL';
  end if;
  update public.store_purge_jobs
     set storage_zero_verified_at = now(), database_zero_verified_at = now(),
         current_step = 'write_tombstone', updated_at = now()
   where id = p_job_id;
  return jsonb_build_object(
    'job_id', p_job_id, 'storage_object_count', 0,
    'database_residual_counts', v_residual,
    'other_tenant_sha256', p_other_tenant_after_sha256
  );
end;
$$;

create or replace function public.repairdesk_complete_store_purge_rpc(
  p_job_id uuid,
  p_worker_id text,
  p_zero_residual_proof_sha256 text,
  p_other_tenant_after_sha256 text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, extensions
as $$
declare
  v_now timestamptz := now();
  v_job public.store_purge_jobs%rowtype;
  v_export public.store_export_jobs%rowtype;
  v_store_id_hash char(64);
  v_store_id uuid;
  v_result jsonb;
begin
  select * into v_job from public.store_purge_jobs where id = p_job_id for update;
  if v_job.id is null
     or v_job.state <> 'running'
     or v_job.lease_owner is distinct from btrim(p_worker_id)
     or v_job.lease_expires_at <= v_now
     or v_job.storage_zero_verified_at is null
     or v_job.database_zero_verified_at is null
     or v_job.other_tenant_before_sha256 is distinct from p_other_tenant_after_sha256
     or p_zero_residual_proof_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'P0001', message = 'STORE_PURGE_COMPLETION_REJECTED';
  end if;
  if public.repairdesk_store_purge_residual_counts(v_job.store_id) <> '{}'::jsonb then
    raise exception using errcode = 'P0001', message = 'STORE_PURGE_DATABASE_RESIDUAL';
  end if;
  select * into v_export from public.store_export_jobs where id = v_job.export_job_id;
  if v_export.id is null
     or v_export.state <> 'restore_verified'
     or v_export.database_manifest_sha256 is null
     or v_export.storage_manifest_sha256 is null
     or v_export.artifact_sha256 is null then
    raise exception using errcode = 'P0001', message = 'STORE_PURGE_EXPORT_PROOF_MISSING';
  end if;
  v_store_id := v_job.store_id;
  v_store_id_hash := encode(
    extensions.digest(convert_to(v_store_id::text, 'UTF8'), 'sha256'),
    'hex'
  );
  insert into public.store_tombstones (
    store_id_hash, purge_operation_id, approval_ref_hash,
    database_manifest_sha256, storage_manifest_sha256, artifact_sha256,
    zero_residual_proof_sha256, completed_at
  ) values (
    v_store_id_hash, v_job.operation_id, v_job.approval_ref_hash,
    v_export.database_manifest_sha256, v_export.storage_manifest_sha256, v_export.artifact_sha256,
    p_zero_residual_proof_sha256, v_now
  ) on conflict (purge_operation_id) do nothing;

  update public.onboarding_requests
     set target_store_id = null,
         target_store_tombstone_hash = v_store_id_hash,
         updated_at = v_now
   where target_store_id = v_store_id;

  delete from public.store_purge_steps
   where purge_job_id in (
     select purge_job.id from public.store_purge_jobs purge_job
     where purge_job.store_id = v_store_id
   );
  delete from public.store_purge_jobs where store_id = v_store_id;
  delete from public.store_restore_proofs where store_id = v_store_id;
  delete from public.store_export_jobs where store_id = v_store_id;
  delete from public.store_lifecycle_challenges where store_id = v_store_id;
  delete from public.store_lifecycle_operations where store_id = v_store_id;
  delete from public.store_lifecycle_preflights where store_id = v_store_id;
  delete from public.store_lifecycles where store_id = v_store_id;
  delete from public.stores where id = v_store_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'STORE_PURGE_STORE_DELETE_FAILED';
  end if;

  v_result := jsonb_build_object(
    'purged', true,
    'store_id_hash', v_store_id_hash,
    'purge_operation_id', v_job.operation_id,
    'completed_at', v_now,
    'zero_residual_proof_sha256', p_zero_residual_proof_sha256
  );
  return v_result;
end;
$$;

revoke all on function public.repairdesk_store_purge_catalog() from public, anon, authenticated;
grant execute on function public.repairdesk_store_purge_catalog() to service_role;
revoke all on function public.repairdesk_store_purge_residual_counts(uuid)
  from public, anon, authenticated;
grant execute on function public.repairdesk_store_purge_residual_counts(uuid) to service_role;
revoke all on function public.repairdesk_other_tenant_guard_sha256(uuid)
  from public, anon, authenticated;
grant execute on function public.repairdesk_other_tenant_guard_sha256(uuid) to service_role;
revoke all on function public.repairdesk_schedule_store_purge_rpc(
  uuid, uuid, uuid, bigint, uuid, text, uuid, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.repairdesk_schedule_store_purge_rpc(
  uuid, uuid, uuid, bigint, uuid, text, uuid, text, timestamptz
) to service_role;
revoke all on function public.repairdesk_queue_due_store_purge_jobs()
  from public, anon, authenticated;
grant execute on function public.repairdesk_queue_due_store_purge_jobs() to service_role;
revoke all on function public.repairdesk_start_store_purge_rpc(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.repairdesk_start_store_purge_rpc(uuid, text, text)
  to service_role;
revoke all on function public.repairdesk_renew_store_purge_lease_rpc(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.repairdesk_renew_store_purge_lease_rpc(uuid, text, integer)
  to service_role;
revoke all on function public.repairdesk_prepare_store_purge_database_rpc(uuid, text)
  from public, anon, authenticated;
grant execute on function public.repairdesk_prepare_store_purge_database_rpc(uuid, text)
  to service_role;
revoke all on function public.repairdesk_purge_store_table_batch_rpc(uuid, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.repairdesk_purge_store_table_batch_rpc(uuid, text, text, integer)
  to service_role;
revoke all on function public.repairdesk_checkpoint_store_purge_step_rpc(
  uuid, text, text, text, jsonb, jsonb, bigint, text, text
) from public, anon, authenticated;
grant execute on function public.repairdesk_checkpoint_store_purge_step_rpc(
  uuid, text, text, text, jsonb, jsonb, bigint, text, text
) to service_role;
revoke all on function public.repairdesk_mark_store_purge_zero_proof_rpc(uuid, text, bigint, text)
  from public, anon, authenticated;
grant execute on function public.repairdesk_mark_store_purge_zero_proof_rpc(uuid, text, bigint, text)
  to service_role;
revoke all on function public.repairdesk_complete_store_purge_rpc(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.repairdesk_complete_store_purge_rpc(uuid, text, text, text)
  to service_role;

grant delete on table public.store_purge_steps to service_role;
grant delete on table public.store_purge_jobs to service_role;
grant delete on table public.store_restore_proofs to service_role;
grant delete on table public.store_export_jobs to service_role;
grant delete on table public.store_lifecycle_challenges to service_role;
grant delete on table public.store_lifecycle_preflights to service_role;

select pg_notify('pgrst', 'reload schema');

reset lock_timeout;
