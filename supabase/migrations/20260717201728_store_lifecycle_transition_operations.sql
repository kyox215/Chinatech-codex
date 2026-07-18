set lock_timeout = '5s';

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

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_store_id::text, 0));

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
     or lower(btrim(p_confirmation_store_id_suffix)) <> right(replace(p_store_id::text, '-', ''), 8) then
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
  ) then
    raise exception using errcode = 'P0001', message = 'STORE_LIFECYCLE_BLOCKED';
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
     set status = 'inactive'::public.store_membership_status,
         updated_at = v_now
   where store_id = p_store_id
     and user_id <> p_actor_id
     and status = 'active'::public.store_membership_status;

  update public.store_invitations
     set status = 'inactive'::public.store_membership_status,
         updated_at = v_now
   where store_id = p_store_id
     and status = 'invited'::public.store_membership_status;

  update public.store_invite_links
     set status = 'inactive'::public.store_membership_status,
         revoked_by = p_actor_id,
         revoked_at = v_now,
         updated_at = v_now
   where store_id = p_store_id
     and status = 'active'::public.store_membership_status;

  update public.customer_kiosk_sessions
     set status = 'cancelled',
         cancelled_at = v_now,
         updated_at = v_now
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
     set state = 'completed', current_step = 'completed',
         result_revision = v_lifecycle.revision, result_summary = v_result,
         completed_at = v_now, updated_at = v_now
   where operation_id = p_operation_id;
  return v_result;
end;
$$;

create or replace function public.repairdesk_restore_store_rpc(
  p_store_id uuid,
  p_actor_id uuid,
  p_operation_id uuid,
  p_expected_revision bigint,
  p_challenge_id uuid
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
  v_kind text;
  v_result jsonb;
begin
  v_request_hash := encode(
    extensions.digest(
      convert_to(concat_ws('|', p_store_id::text, p_actor_id::text, p_expected_revision::text, 'restore'), 'UTF8'),
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
  if v_store.id is null
     or v_store.status <> 'active'::public.store_status
     or v_store.owner_user_id is distinct from p_actor_id
     or v_lifecycle.store_id is null
     or v_lifecycle.phase not in ('closing', 'archived')
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
  if v_lifecycle.legal_hold_until is not null and v_lifecycle.legal_hold_until > v_now then
    raise exception using errcode = 'P0001', message = 'STORE_LIFECYCLE_LEGAL_HOLD';
  end if;

  update public.store_lifecycle_challenges challenge
     set status = 'consumed', consumed_at = v_now
   where challenge.id = p_challenge_id
     and challenge.store_id = p_store_id
     and challenge.actor_id = p_actor_id
     and challenge.operation_kind = 'restore'
     and challenge.lifecycle_revision = p_expected_revision
     and challenge.assurance_level = 'aal2'
     and challenge.status = 'issued'
     and challenge.expires_at > v_now;
  if not found then
    raise exception using errcode = 'P0001', message = 'STORE_LIFECYCLE_REAUTH_REQUIRED';
  end if;

  v_kind := case when v_lifecycle.phase = 'closing' then 'cancel_close' else 'restore' end;
  insert into public.store_lifecycle_operations (
    operation_id, store_id, kind, request_hash, expected_revision, state,
    current_step, actor_id, created_at, updated_at
  ) values (
    p_operation_id, p_store_id, v_kind, v_request_hash, p_expected_revision,
    'running', 'restoring_access', p_actor_id, v_now, v_now
  );

  update public.store_lifecycles
     set phase = 'active', revision = revision + 1,
         close_requested_at = null, access_cutoff_at = null,
         archive_eligible_at = null, archived_at = null,
         purge_after = null, close_reason_code = null,
         last_operation_id = p_operation_id, updated_by = p_actor_id, updated_at = v_now
   where store_id = p_store_id
   returning * into v_lifecycle;

  insert into public.audit_logs (
    id, actor_id, actor_name, store_id, action, entity_type, entity_id,
    before_data, after_data, metadata
  ) values (
    gen_random_uuid()::text, p_actor_id, 'Store owner', p_store_id,
    v_kind, 'store_lifecycle', p_store_id::text,
    jsonb_build_object('phase', case when v_kind = 'cancel_close' then 'closing' else 'archived' end, 'revision', p_expected_revision),
    jsonb_build_object('phase', 'active', 'revision', v_lifecycle.revision),
    jsonb_build_object(
      'operation_id', p_operation_id,
      'revoked_tokens_reactivated', false,
      'revoked_invitations_reactivated', false,
      'disabled_memberships_reactivated', false
    )
  );

  v_result := jsonb_build_object(
    'operation_id', p_operation_id, 'store_id', p_store_id,
    'phase', v_lifecycle.phase, 'revision', v_lifecycle.revision, 'replayed', false
  );
  update public.store_lifecycle_operations
     set state = 'completed', current_step = 'completed',
         result_revision = v_lifecycle.revision, result_summary = v_result,
         completed_at = v_now, updated_at = v_now
   where operation_id = p_operation_id;
  return v_result;
end;
$$;

create or replace function public.repairdesk_finalize_store_archive_rpc(
  p_store_id uuid,
  p_operation_id uuid,
  p_expected_revision bigint,
  p_worker_id text
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
  v_result jsonb;
begin
  if nullif(btrim(p_worker_id), '') is null or char_length(btrim(p_worker_id)) > 120 then
    raise exception using errcode = 'P0001', message = 'STORE_LIFECYCLE_INVALID_WORKER';
  end if;
  v_request_hash := encode(
    extensions.digest(
      convert_to(concat_ws('|', p_store_id::text, p_expected_revision::text, btrim(p_worker_id)), 'UTF8'),
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
  if v_store.id is null or v_lifecycle.store_id is null or v_lifecycle.phase <> 'closing' then
    raise exception using errcode = 'P0001', message = 'STORE_LIFECYCLE_INVALID_STATE';
  end if;
  if v_lifecycle.revision <> p_expected_revision then
    raise exception using errcode = 'P0001', message = 'STORE_LIFECYCLE_VERSION_CONFLICT';
  end if;
  if v_lifecycle.archive_eligible_at is null or v_lifecycle.archive_eligible_at > v_now then
    raise exception using errcode = 'P0001', message = 'STORE_LIFECYCLE_ARCHIVE_DRAIN_PENDING';
  end if;

  insert into public.store_lifecycle_operations (
    operation_id, store_id, kind, request_hash, expected_revision, state,
    current_step, actor_id, lease_owner, created_at, updated_at
  ) values (
    p_operation_id, p_store_id, 'finalize_archive', v_request_hash, p_expected_revision,
    'running', 'archiving', v_store.owner_user_id, btrim(p_worker_id), v_now, v_now
  );
  update public.store_lifecycles
     set phase = 'archived', revision = revision + 1,
         archived_at = v_now, last_operation_id = p_operation_id,
         updated_by = v_store.owner_user_id, updated_at = v_now
   where store_id = p_store_id
   returning * into v_lifecycle;

  insert into public.audit_logs (
    id, actor_id, actor_name, store_id, action, entity_type, entity_id,
    before_data, after_data, metadata
  ) values (
    gen_random_uuid()::text, v_store.owner_user_id, 'Lifecycle worker', p_store_id,
    'finalize_archive', 'store_lifecycle', p_store_id::text,
    jsonb_build_object('phase', 'closing', 'revision', p_expected_revision),
    jsonb_build_object('phase', 'archived', 'revision', v_lifecycle.revision),
    jsonb_build_object('operation_id', p_operation_id, 'worker_id', btrim(p_worker_id))
  );
  v_result := jsonb_build_object(
    'operation_id', p_operation_id, 'store_id', p_store_id,
    'phase', v_lifecycle.phase, 'revision', v_lifecycle.revision, 'replayed', false
  );
  update public.store_lifecycle_operations
     set state = 'completed', current_step = 'completed',
         result_revision = v_lifecycle.revision, result_summary = v_result,
         completed_at = v_now, updated_at = v_now
   where operation_id = p_operation_id;
  return v_result;
end;
$$;

revoke all on function public.repairdesk_request_store_close_rpc(
  uuid, uuid, uuid, bigint, uuid, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.repairdesk_request_store_close_rpc(
  uuid, uuid, uuid, bigint, uuid, text, text, text, text
) to service_role;

revoke all on function public.repairdesk_restore_store_rpc(uuid, uuid, uuid, bigint, uuid)
  from public, anon, authenticated;
grant execute on function public.repairdesk_restore_store_rpc(uuid, uuid, uuid, bigint, uuid)
  to service_role;

revoke all on function public.repairdesk_finalize_store_archive_rpc(uuid, uuid, bigint, text)
  from public, anon, authenticated;
grant execute on function public.repairdesk_finalize_store_archive_rpc(uuid, uuid, bigint, text)
  to service_role;

select pg_notify('pgrst', 'reload schema');

reset lock_timeout;
