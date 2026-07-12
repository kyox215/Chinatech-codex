-- Extend the existing store-scoped grant catalog without changing current grants.
-- Role policy remains enforced by the server; this constraint only limits persisted actions.

alter table public.store_member_permission_grants
  drop constraint if exists store_member_permission_grants_supplier_action_check;

alter table public.store_member_permission_grants
  add constraint store_member_permission_grants_action_check
  check (
    action in (
      'supplier:read',
      'supplier:assign',
      'supplier:manage',
      'order:archive_browse',
      'finance:aggregate_read',
      'finance:profit_read'
    )
  );

comment on table public.store_member_permission_grants is
  'Owner-managed, store-scoped employee grants. Server role policy remains authoritative.';

create or replace function public.repairdesk_update_member_access_rpc(
  p_store_id uuid,
  p_membership_id uuid,
  p_role public.staff_role default null,
  p_status public.store_membership_status default null,
  p_actor_id uuid default null
)
returns setof public.store_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_changed boolean := false;
begin
  update public.store_memberships
  set
    role = coalesce(p_role, role),
    status = coalesce(p_status, status),
    updated_at = v_now
  where id = p_membership_id
    and store_id = p_store_id
    and role <> 'owner'
    and coalesce(p_role, role) <> 'owner'
  returning true into v_changed;

  if not coalesce(v_changed, false) then
    raise exception 'membership_not_changed';
  end if;

  update public.store_member_permission_grants
  set revoked_at = v_now, revoked_by = p_actor_id, updated_at = v_now
  where store_id = p_store_id
    and membership_id = p_membership_id
    and revoked_at is null;

  return query
  select membership.*
  from public.store_memberships membership
  where membership.id = p_membership_id
    and membership.store_id = p_store_id;
end;
$$;

revoke all on function public.repairdesk_update_member_access_rpc(
  uuid, uuid, public.staff_role, public.store_membership_status, uuid
) from public, anon, authenticated;
grant execute on function public.repairdesk_update_member_access_rpc(
  uuid, uuid, public.staff_role, public.store_membership_status, uuid
) to service_role;

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
  v_now timestamptz := now();
  v_role public.staff_role;
  v_user_id uuid;
  v_actions text[];
  v_before text[];
begin
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
      'finance:profit_read'
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
    'finance:profit_read'
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

  return jsonb_build_object(
    'before', to_jsonb(v_before),
    'after', to_jsonb(v_actions)
  );
end;
$$;

revoke all on function public.repairdesk_replace_member_permission_grants_rpc(
  uuid, uuid, text[], uuid
) from public, anon, authenticated;
grant execute on function public.repairdesk_replace_member_permission_grants_rpc(
  uuid, uuid, text[], uuid
) to service_role;

notify pgrst, 'reload schema';
