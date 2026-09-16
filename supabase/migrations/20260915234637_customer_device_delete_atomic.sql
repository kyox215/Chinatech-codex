-- Lock the device before checking order references: legacy SET NULL FKs are not a deletion policy.
set lock_timeout = '5s';
set statement_timeout = '60s';
create or replace function public.repairdesk_delete_customer_device(
  p_store_id uuid, p_actor_id uuid, p_customer_id uuid, p_device_id uuid,
  p_expected_updated_at timestamptz
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_device public.devices%rowtype;
  v_deleted_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended(p_store_id::text, 0));
  -- Matches BFF customer:update: owner/manager/sales. Technician requires a scope
  -- which this endpoint does not grant; customer:update is not a grantable override.
  if not exists (
    select 1 from public.store_memberships membership
    join public.staff_profiles staff on staff.id = membership.user_id
    join public.stores store_row on store_row.id = membership.store_id
    join public.store_lifecycles lifecycle on lifecycle.store_id = store_row.id
    where membership.store_id = p_store_id and membership.user_id = p_actor_id
      and membership.status::text = 'active' and staff.status::text = 'active'
      and store_row.status::text = 'active' and lifecycle.phase::text = 'active'
      and membership.role::text in ('owner', 'manager', 'sales')
  ) then raise exception using errcode = 'P0001', message = 'CUSTOMER_FORBIDDEN'; end if;
  if p_expected_updated_at is null then
    raise exception using errcode = 'P0001', message = 'CUSTOMER_VERSION_REQUIRED';
  end if;
  -- FOR UPDATE conflicts with a new order FK's KEY SHARE lock. A competing order
  -- either commits before this reference check or waits until deletion is final.
  select * into v_device from public.devices
    where store_id = p_store_id and customer_id = p_customer_id and id = p_device_id
    for update;
  if not found then raise exception using errcode = 'P0001', message = 'CUSTOMER_DEVICE_NOT_FOUND'; end if;
  if v_device.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = 'P0001', message = 'CUSTOMER_STALE_VERSION';
  end if;
  if exists (select 1 from public.repair_orders where store_id = p_store_id and device_id = p_device_id) then
    raise exception using errcode = 'P0001', message = 'CUSTOMER_DEVICE_HAS_ORDERS';
  end if;
  delete from public.devices
    where store_id = p_store_id and customer_id = p_customer_id and id = p_device_id
      and updated_at = p_expected_updated_at returning id into v_deleted_id;
  if not found then raise exception using errcode = 'P0001', message = 'CUSTOMER_DELETE_FAILED'; end if;
  return jsonb_build_object('ok', true, 'id', v_deleted_id);
end;
$$;
revoke all on function public.repairdesk_delete_customer_device(uuid, uuid, uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.repairdesk_delete_customer_device(uuid, uuid, uuid, uuid, timestamptz) to service_role;
