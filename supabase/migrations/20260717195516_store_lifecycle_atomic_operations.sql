set lock_timeout = '5s';

-- Trusted server lifecycle RPCs use pgcrypto in this dedicated schema when
-- calculating idempotency hashes.
grant usage on schema extensions to service_role;

create or replace function public.repairdesk_store_lifecycle_active(p_store_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.stores s
    join public.store_lifecycles lifecycle on lifecycle.store_id = s.id
    where s.id = p_store_id
      and s.status = 'active'::public.store_status
      and lifecycle.phase = 'active'
  );
$$;

revoke all on function public.repairdesk_store_lifecycle_active(uuid)
  from public, anon, authenticated;
grant execute on function public.repairdesk_store_lifecycle_active(uuid) to service_role;

create or replace function public.claim_store_invite_link(p_token_hash text)
returns table (
  id uuid,
  store_id uuid,
  label text,
  role public.staff_role,
  status public.store_membership_status,
  expires_at timestamptz,
  max_uses integer,
  used_count integer,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  return query
  update public.store_invite_links link
     set used_count = link.used_count + 1,
         updated_at = now()
   where link.token_hash = p_token_hash
     and link.status = 'active'::public.store_membership_status
     and link.expires_at > now()
     and (link.max_uses is null or link.used_count < link.max_uses)
     and public.repairdesk_store_lifecycle_active(link.store_id)
   returning
     link.id,
     link.store_id,
     link.label,
     link.role,
     link.status,
     link.expires_at,
     link.max_uses,
     link.used_count,
     link.created_by,
     link.created_at,
     link.updated_at;
end;
$$;

revoke all on function public.claim_store_invite_link(text) from public, anon, authenticated;
grant execute on function public.claim_store_invite_link(text) to service_role;

create or replace function public.repairdesk_rename_store_rpc(
  p_store_id uuid,
  p_actor_id uuid,
  p_operation_id uuid,
  p_expected_revision bigint,
  p_challenge_id uuid,
  p_new_name text,
  p_sync_customer_facing_name boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, extensions
as $$
declare
  v_now timestamptz := now();
  v_name text := btrim(p_new_name);
  v_request_hash char(64);
  v_store public.stores%rowtype;
  v_lifecycle public.store_lifecycles%rowtype;
  v_operation public.store_lifecycle_operations%rowtype;
  v_result jsonb;
begin
  if v_name = '' or char_length(v_name) < 2 or char_length(v_name) > 80 or v_name ~ '[[:cntrl:]]' then
    raise exception using errcode = 'P0001', message = 'STORE_LIFECYCLE_INVALID_NAME';
  end if;
  if p_expected_revision is null or p_expected_revision < 1 then
    raise exception using errcode = 'P0001', message = 'STORE_LIFECYCLE_VERSION_CONFLICT';
  end if;

  v_request_hash := encode(
    extensions.digest(
      convert_to(
        concat_ws(
          '|',
          p_store_id::text,
          p_actor_id::text,
          p_expected_revision::text,
          v_name,
          coalesce(p_sync_customer_facing_name, false)::text
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

  select * into v_store
  from public.stores
  where id = p_store_id
  for update;
  select * into v_lifecycle
  from public.store_lifecycles
  where store_id = p_store_id
  for update;

  if v_store.id is null
     or v_store.status <> 'active'::public.store_status
     or v_store.owner_user_id is distinct from p_actor_id
     or v_lifecycle.store_id is null
     or v_lifecycle.phase <> 'active'
     or not exists (
       select 1
       from public.store_memberships membership
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

  update public.store_lifecycle_challenges challenge
     set status = 'consumed', consumed_at = v_now
   where challenge.id = p_challenge_id
     and challenge.store_id = p_store_id
     and challenge.actor_id = p_actor_id
     and challenge.operation_kind = 'rename'
     and challenge.lifecycle_revision = p_expected_revision
     and challenge.assurance_level = 'aal2'
     and challenge.status = 'issued'
     and challenge.expires_at > v_now;
  if not found then
    raise exception using errcode = 'P0001', message = 'STORE_LIFECYCLE_REAUTH_REQUIRED';
  end if;

  insert into public.store_lifecycle_operations (
    operation_id,
    store_id,
    kind,
    request_hash,
    expected_revision,
    state,
    current_step,
    actor_id,
    created_at,
    updated_at
  ) values (
    p_operation_id,
    p_store_id,
    'rename',
    v_request_hash,
    p_expected_revision,
    'running',
    'locked',
    p_actor_id,
    v_now,
    v_now
  );

  update public.stores
     set name = v_name, updated_at = v_now
   where id = p_store_id;

  if coalesce(p_sync_customer_facing_name, false) then
    update public.store_settings
       set store_name = v_name, updated_by = p_actor_id, updated_at = v_now
     where store_id = p_store_id;
  end if;

  update public.store_lifecycles
     set revision = revision + 1,
         last_operation_id = p_operation_id,
         updated_by = p_actor_id,
         updated_at = v_now
   where store_id = p_store_id
   returning * into v_lifecycle;

  insert into public.audit_logs (
    id,
    actor_id,
    actor_name,
    store_id,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data,
    metadata
  ) values (
    gen_random_uuid()::text,
    p_actor_id,
    'Store owner',
    p_store_id,
    'rename',
    'store',
    p_store_id::text,
    jsonb_build_object('name', v_store.name, 'revision', p_expected_revision),
    jsonb_build_object('name', v_name, 'revision', v_lifecycle.revision),
    jsonb_build_object(
      'operation_id', p_operation_id,
      'customer_facing_name_synced', coalesce(p_sync_customer_facing_name, false),
      'slug_unchanged', true
    )
  );

  v_result := jsonb_build_object(
    'operation_id', p_operation_id,
    'store_id', p_store_id,
    'store_name', v_name,
    'phase', v_lifecycle.phase,
    'revision', v_lifecycle.revision,
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

revoke all on function public.repairdesk_rename_store_rpc(
  uuid, uuid, uuid, bigint, uuid, text, boolean
) from public, anon, authenticated;
grant execute on function public.repairdesk_rename_store_rpc(
  uuid, uuid, uuid, bigint, uuid, text, boolean
) to service_role;

select pg_notify('pgrst', 'reload schema');

reset lock_timeout;
