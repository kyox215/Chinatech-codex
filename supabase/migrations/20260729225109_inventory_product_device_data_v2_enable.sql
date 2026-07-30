do $$
begin
  if to_regprocedure('public.repairdesk_create_inventory_product_v2(uuid,uuid,jsonb)') is null
     or to_regprocedure('public.repairdesk_update_inventory_product_v1(uuid,uuid,jsonb)') is null then
    raise exception 'Missing inventory device data RPC prerequisites';
  end if;
end $$;

revoke all on function public.repairdesk_create_inventory_product_v2(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.repairdesk_update_inventory_product_v1(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.repairdesk_create_inventory_product_v2(uuid, uuid, jsonb)
  to service_role;
grant execute on function public.repairdesk_update_inventory_product_v1(uuid, uuid, jsonb)
  to service_role;
