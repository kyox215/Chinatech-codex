-- Store lifecycle contract v2.
-- Adds a database writer fence and rechecks live close blockers while holding
-- the same per-store advisory lock used by ordinary tenant writes.

set lock_timeout = '5s';

-- PostgreSQL runs triggers for the same timing/event in name order. The
-- lifecycle row must exist before any other AFTER INSERT initializer writes a
-- store-scoped business row (for example the default cost-currency config).
drop trigger if exists repairdesk_initialize_store_lifecycle_trigger on public.stores;
drop trigger if exists repairdesk_00_initialize_store_lifecycle_trigger on public.stores;
create trigger repairdesk_00_initialize_store_lifecycle_trigger
after insert on public.stores
for each row execute function public.repairdesk_initialize_store_lifecycle();

create or replace function public.repairdesk_store_lifecycle_contract_version()
returns integer
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select 2;
$$;

revoke all on function public.repairdesk_store_lifecycle_contract_version() from public;
revoke all on function public.repairdesk_store_lifecycle_contract_version() from anon;
revoke all on function public.repairdesk_store_lifecycle_contract_version() from authenticated;
grant execute on function public.repairdesk_store_lifecycle_contract_version() to service_role;

create or replace function public.repairdesk_store_close_blockers(p_store_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'open_orders',
      (
        select count(*)::integer
        from public.repair_orders orders
        where orders.store_id = p_store_id
          and orders.status::text not in ('completed', 'cancelled')
          and coalesce(orders.exception_status, '') <> 'cancelled'
      ),
    'unsettled_balance_count',
      (
        select count(*)::integer
        from public.repair_orders orders
        where orders.store_id = p_store_id
          and orders.balance_amount > 0
      ),
    'unsettled_balance_amount',
      (
        select coalesce(sum(orders.balance_amount), 0)
        from public.repair_orders orders
        where orders.store_id = p_store_id
          and orders.balance_amount > 0
      ),
    'devices_in_custody',
      (
        select count(*)::integer
        from public.repair_orders orders
        where orders.store_id = p_store_id
          and orders.device_custody_status = 'with_shop'
      )
  );
$$;

revoke all on function public.repairdesk_store_close_blockers(uuid) from public;
revoke all on function public.repairdesk_store_close_blockers(uuid) from anon;
revoke all on function public.repairdesk_store_close_blockers(uuid) from authenticated;
grant execute on function public.repairdesk_store_close_blockers(uuid) to service_role;

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
    raise exception using
      errcode = 'P0001',
      message = 'STORE_LIFECYCLE_CROSS_STORE_WRITE_FORBIDDEN';
  end if;
  v_store_id := coalesce(v_new_store_id, v_old_store_id);
  if v_store_id is null then
    raise exception using errcode = 'P0001', message = 'STORE_LIFECYCLE_STORE_REQUIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock_shared(
    pg_catalog.hashtextextended(v_store_id::text, 0)
  );
  select store.status::text, lifecycle.phase::text
    into v_store_status, v_lifecycle_phase
    from public.stores store
    join public.store_lifecycles lifecycle on lifecycle.store_id = store.id
   where store.id = v_store_id;
  if v_store_status is distinct from 'active'
     or v_lifecycle_phase is distinct from 'active' then
    raise exception using errcode = 'P0001', message = 'STORE_LIFECYCLE_WRITE_BLOCKED';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.repairdesk_enforce_active_store_write() from public;
revoke all on function public.repairdesk_enforce_active_store_write() from anon;
revoke all on function public.repairdesk_enforce_active_store_write() from authenticated;

create or replace function public.repairdesk_enforce_active_store_row_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_store_id uuid;
  v_lifecycle_phase text;
begin
  if tg_op = 'INSERT' then
    return new;
  end if;
  v_store_id := old.id;
  perform pg_catalog.pg_advisory_xact_lock_shared(
    pg_catalog.hashtextextended(v_store_id::text, 0)
  );
  select lifecycle.phase::text
    into v_lifecycle_phase
    from public.store_lifecycles lifecycle
   where lifecycle.store_id = v_store_id;
  if v_lifecycle_phase is not null and v_lifecycle_phase <> 'active' then
    raise exception using errcode = 'P0001', message = 'STORE_LIFECYCLE_WRITE_BLOCKED';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.repairdesk_enforce_active_store_row_write() from public;
revoke all on function public.repairdesk_enforce_active_store_row_write() from anon;
revoke all on function public.repairdesk_enforce_active_store_row_write() from authenticated;

drop trigger if exists repairdesk_store_lifecycle_write_fence on public.stores;
create trigger repairdesk_store_lifecycle_write_fence
before update or delete on public.stores
for each row execute function public.repairdesk_enforce_active_store_row_write();

do $$
declare
  target record;
  trigger_name text;
begin
  for target in
    select columns.table_schema, columns.table_name
      from information_schema.columns columns
      join pg_catalog.pg_class relation
        on relation.relname = columns.table_name
      join pg_catalog.pg_namespace namespace
        on namespace.oid = relation.relnamespace
       and namespace.nspname = columns.table_schema
     where columns.table_schema = 'public'
       and columns.column_name = 'store_id'
       and relation.relkind in ('r', 'p')
       and not relation.relispartition
       and columns.table_name not in (
         'audit_logs',
         'store_lifecycles',
         'store_lifecycle_preflights',
         'store_lifecycle_challenges',
         'store_lifecycle_operations',
         'store_export_jobs',
         'store_restore_proofs',
         'store_purge_jobs'
       )
     order by columns.table_name
  loop
    trigger_name := left('repairdesk_lifecycle_fence_' || target.table_name, 63);
    execute format(
      'drop trigger if exists %I on %I.%I',
      trigger_name,
      target.table_schema,
      target.table_name
    );
    execute format(
      'create trigger %I before insert or update or delete on %I.%I for each row execute function public.repairdesk_enforce_active_store_write()',
      trigger_name,
      target.table_schema,
      target.table_name
    );
  end loop;
end;
$$;

create or replace function public.repairdesk_request_store_close_rpc(
  p_store_id uuid,
  p_actor_id uuid,
  p_operation_id uuid,
  p_expected_revision bigint,
  p_challenge_id uuid,
  p_preflight_snapshot_hash text,
  p_confirmation_store_name text,
  p_confirmation_store_id_suffix text,
  p_reason_code text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, extensions
as $$
declare
  v_now timestamptz := now();
  v_request_hash char(64);
  v_store public.stores%rowtype;
  v_lifecycle public.store_lifecycles%rowtype;
  v_operation public.store_lifecycle_operations%rowtype;
  v_live_blockers jsonb;
  v_result jsonb;
begin
  if p_preflight_snapshot_hash is null
     or p_preflight_snapshot_hash !~ '^[0-9a-f]{64}$'
     or nullif(btrim(p_reason_code), '') is null
     or char_length(btrim(p_reason_code)) > 80 then
    raise exception using errcode = 'P0001', message = 'STORE_LIFECYCLE_INVALID_REQUEST';
  end if;

  v_request_hash := encode(
    extensions.digest(
      convert_to(
        concat_ws(
          '|', p_store_id::text, p_actor_id::text, p_expected_revision::text,
          p_preflight_snapshot_hash, p_confirmation_store_name,
          lower(btrim(p_confirmation_store_id_suffix)), btrim(p_reason_code)
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_store_id::text, 0)
  );

  select * into v_operation
    from public.store_lifecycle_operations
   where operation_id = p_operation_id;
  if found then
    if v_operation.store_id <> p_store_id or v_operation.request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'STORE_LIFECYCLE_IDEMPOTENCY_CONFLICT';
    end if;
    if v_operation.state = 'completed' then
      return v_operation.result_summary || jsonb_build_object('replayed', true);
    end if;
    raise exception using errcode = 'P0001', message = 'STORE_LIFECYCLE_OPERATION_IN_PROGRESS';
  end if;

  select * into v_store from public.stores where id = p_store_id for update;
  select * into v_lifecycle
    from public.store_lifecycles where store_id = p_store_id for update;

  if v_store.id is null
     or v_store.status <> 'active'::public.store_status
     or v_store.owner_user_id is distinct from p_actor_id
     or v_lifecycle.store_id is null
     or v_lifecycle.phase <> 'active'
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
  if p_confirmation_store_name is distinct from v_store.name
     or lower(btrim(p_confirmation_store_id_suffix))
        <> right(replace(p_store_id::text, '-', ''), 8) then
    raise exception using errcode = 'P0001', message = 'STORE_LIFECYCLE_CONFIRMATION_MISMATCH';
  end if;
  if not exists (
    select 1
      from public.store_lifecycle_preflights preflight
     where preflight.store_id = p_store_id
       and preflight.lifecycle_revision = p_expected_revision
       and preflight.snapshot_hash = p_preflight_snapshot_hash
       and preflight.state = 'eligible'
       and preflight.expires_at > v_now
       and jsonb_array_length(preflight.blockers) = 0
       and coalesce((preflight.storage_summary ->> 'complete')::boolean, false)
  ) then
    raise exception using errcode = 'P0001', message = 'STORE_LIFECYCLE_BLOCKED';
  end if;

  v_live_blockers := public.repairdesk_store_close_blockers(p_store_id);
  if coalesce((v_live_blockers ->> 'open_orders')::integer, 0) > 0
     or coalesce((v_live_blockers ->> 'unsettled_balance_count')::integer, 0) > 0
     or coalesce((v_live_blockers ->> 'devices_in_custody')::integer, 0) > 0 then
    raise exception using
      errcode = 'P0001',
      message = 'STORE_LIFECYCLE_BLOCKED',
      detail = v_live_blockers::text;
  end if;

  update public.store_lifecycle_challenges challenge
     set status = 'consumed', consumed_at = v_now
   where challenge.id = p_challenge_id
     and challenge.store_id = p_store_id
     and challenge.actor_id = p_actor_id
     and challenge.operation_kind = 'request_close'
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
    p_operation_id, p_store_id, 'request_close', v_request_hash, p_expected_revision,
    'running', 'revoking_public_access', p_actor_id, v_now, v_now
  );

  update public.store_memberships
     set status = 'inactive'::public.store_membership_status, updated_at = v_now
   where store_id = p_store_id
     and user_id <> p_actor_id
     and status = 'active'::public.store_membership_status;

  update public.store_invitations
     set status = 'inactive'::public.store_membership_status, updated_at = v_now
   where store_id = p_store_id
     and status = 'invited'::public.store_membership_status;

  update public.store_invite_links
     set status = 'inactive'::public.store_membership_status,
         revoked_by = p_actor_id, revoked_at = v_now, updated_at = v_now
   where store_id = p_store_id
     and status = 'active'::public.store_membership_status;

  update public.customer_kiosk_sessions
     set status = 'cancelled', cancelled_at = v_now, updated_at = v_now
   where store_id = p_store_id
     and status in ('queued', 'active', 'submitted', 'returned');

  update public.store_kiosk_devices
     set status = 'revoked',
         device_token_hash = null,
         pairing_code_hash = null,
         pairing_code_expires_at = null,
         revoked_by = p_actor_id::text,
         revoked_at = v_now,
         updated_at = v_now
   where store_id = p_store_id
     and status <> 'revoked';

  update public.store_lifecycles
     set phase = 'closing',
         revision = revision + 1,
         close_requested_at = v_now,
         access_cutoff_at = v_now,
         archive_eligible_at = v_now + interval '1 hour',
         close_reason_code = btrim(p_reason_code),
         last_operation_id = p_operation_id,
         updated_by = p_actor_id,
         updated_at = v_now
   where store_id = p_store_id
   returning * into v_lifecycle;

  insert into public.audit_logs (
    id, actor_id, actor_name, store_id, action, entity_type, entity_id,
    before_data, after_data, metadata
  ) values (
    gen_random_uuid()::text, p_actor_id, 'Store owner', p_store_id,
    'request_close', 'store_lifecycle', p_store_id::text,
    jsonb_build_object('phase', 'active', 'revision', p_expected_revision),
    jsonb_build_object('phase', v_lifecycle.phase, 'revision', v_lifecycle.revision),
    jsonb_build_object(
      'operation_id', p_operation_id,
      'preflight_snapshot_hash', p_preflight_snapshot_hash,
      'reason_code', btrim(p_reason_code),
      'live_blockers', v_live_blockers,
      'public_credentials_revoked', true,
      'non_owner_memberships_disabled', true
    )
  );

  v_result := jsonb_build_object(
    'operation_id', p_operation_id,
    'store_id', p_store_id,
    'phase', v_lifecycle.phase,
    'revision', v_lifecycle.revision,
    'archive_eligible_at', v_lifecycle.archive_eligible_at,
    'replayed', false
  );
  update public.store_lifecycle_operations
     set state = 'completed',
         current_step = 'completed',
         result_revision = v_lifecycle.revision,
         result_summary = v_result,
         completed_at = v_now,
         updated_at = v_now
   where operation_id = p_operation_id;
  return v_result;
end;
$$;

revoke all on function public.repairdesk_request_store_close_rpc(
  uuid, uuid, uuid, bigint, uuid, text, text, text, text
) from public;
revoke all on function public.repairdesk_request_store_close_rpc(
  uuid, uuid, uuid, bigint, uuid, text, text, text, text
) from anon;
revoke all on function public.repairdesk_request_store_close_rpc(
  uuid, uuid, uuid, bigint, uuid, text, text, text, text
) from authenticated;
grant execute on function public.repairdesk_request_store_close_rpc(
  uuid, uuid, uuid, bigint, uuid, text, text, text, text
) to service_role;

comment on function public.repairdesk_store_lifecycle_contract_version() is
  'Service-role lifecycle contract probe. Version 2 means writer fencing and live close blocker checks are installed.';
comment on function public.repairdesk_enforce_active_store_write() is
  'Fail-closed tenant writer fence. New store-scoped business tables must attach this trigger in their creating migration.';
comment on function public.repairdesk_request_store_close_rpc(
  uuid, uuid, uuid, bigint, uuid, text, text, text, text
) is
  'Idempotent owner close transition. Serializes tenant writes, rechecks blockers, revokes access, and enters recoverable closing.';
