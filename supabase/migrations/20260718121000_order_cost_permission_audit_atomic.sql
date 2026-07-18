-- Make sensitive member-permission changes and their audit record one transaction.

set lock_timeout = '5s';
set statement_timeout = '60s';

create or replace function public.repairdesk_replace_member_permission_grants_rpc(
  p_store_id uuid,
  p_membership_id uuid,
  p_actions text[] default array[]::text[],
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_role public.staff_role;
  v_user_id uuid;
  v_actions text[];
  v_before text[];
  v_actor_email text;
  v_actor_name text;
begin
  select actor_profile.email,
         coalesce(actor_membership.display_name, actor_profile.display_name)
  into v_actor_email, v_actor_name
  from public.staff_profiles as actor_profile
  join public.store_memberships as actor_membership
    on actor_membership.user_id = actor_profile.id
   and actor_membership.store_id = p_store_id
   and actor_membership.status::text = 'active'
   and actor_membership.role::text = 'owner'
  join public.stores as actor_store
    on actor_store.id = actor_membership.store_id
   and actor_store.status::text = 'active'
  where actor_profile.id = p_actor_id
    and actor_profile.status::text = 'active'
  limit 1;

  if p_actor_id is null or v_actor_email is null then
    raise exception 'actor_forbidden';
  end if;

  select membership.role, membership.user_id
  into v_role, v_user_id
  from public.store_memberships membership
  where membership.id = p_membership_id
    and membership.store_id = p_store_id
  for update;

  if not found or v_role = 'owner' then
    raise exception 'membership_not_grantable';
  end if;

  select coalesce(array_agg(action order by action), array[]::text[])
  into v_actions
  from (
    select distinct btrim(raw_action) as action
    from unnest(coalesce(p_actions, array[]::text[])) as raw_action
    where btrim(raw_action) <> ''
  ) normalized;

  if exists (
    select 1
    from unnest(v_actions) action
    where action not in (
      'supplier:read',
      'supplier:assign',
      'supplier:manage',
      'order:archive_browse',
      'finance:aggregate_read',
      'finance:profit_read',
      'finance:cost_manage'
    )
  ) then
    raise exception 'invalid_permission_action';
  end if;

  if v_role = 'viewer' and cardinality(v_actions) > 0 then
    raise exception 'role_cannot_receive_grants';
  end if;

  if v_role <> 'manager' and v_actions && array[
    'order:archive_browse',
    'finance:aggregate_read',
    'finance:profit_read',
    'finance:cost_manage'
  ]::text[] then
    raise exception 'role_cannot_receive_manager_grants';
  end if;

  select coalesce(array_agg(grant_row.action order by grant_row.action), array[]::text[])
  into v_before
  from public.store_member_permission_grants grant_row
  where grant_row.store_id = p_store_id
    and grant_row.membership_id = p_membership_id
    and grant_row.revoked_at is null;

  update public.store_member_permission_grants
  set revoked_at = v_now, revoked_by = p_actor_id, updated_at = v_now
  where store_id = p_store_id
    and membership_id = p_membership_id
    and revoked_at is null;

  insert into public.store_member_permission_grants (
    store_id,
    membership_id,
    user_id,
    action,
    granted_by,
    created_at,
    updated_at
  )
  select
    p_store_id,
    p_membership_id,
    v_user_id,
    action,
    p_actor_id,
    v_now,
    v_now
  from unnest(v_actions) action;

  update public.store_memberships
  set updated_at = v_now
  where id = p_membership_id
    and store_id = p_store_id;

  insert into public.audit_logs (
    id,
    actor_id,
    actor_email,
    actor_name,
    store_id,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data,
    metadata,
    created_at
  ) values (
    gen_random_uuid()::text,
    p_actor_id,
    v_actor_email,
    coalesce(v_actor_name, 'unknown'),
    p_store_id,
    'update_member_permissions',
    'store_membership',
    p_membership_id::text,
    jsonb_build_object('permission_grants', to_jsonb(v_before)),
    jsonb_build_object('permission_grants', to_jsonb(v_actions)),
    jsonb_build_object('target_user_id', v_user_id),
    v_now
  );

  return jsonb_build_object(
    'before', to_jsonb(v_before),
    'after', to_jsonb(v_actions)
  );
end;
$$;

revoke all on function public.repairdesk_replace_member_permission_grants_rpc(
  uuid, uuid, text[], uuid
) from public, anon, authenticated, service_role;
grant execute on function public.repairdesk_replace_member_permission_grants_rpc(
  uuid, uuid, text[], uuid
) to service_role;

reset statement_timeout;
reset lock_timeout;

notify pgrst, 'reload schema';
