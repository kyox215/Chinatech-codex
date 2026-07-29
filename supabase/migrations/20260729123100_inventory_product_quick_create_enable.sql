do $$
begin
  if to_regprocedure(
    'public.repairdesk_create_inventory_product(uuid,uuid,uuid,text,text,text,text,text,text,text,numeric,numeric,text,integer,text)'
  ) is null then
    raise exception 'Missing prerequisite RPC: repairdesk_create_inventory_product';
  end if;
end $$;

revoke all on function public.repairdesk_create_inventory_product(
  uuid, uuid, uuid, text, text, text, text, text, text, text,
  numeric, numeric, text, integer, text
) from public, anon, authenticated, service_role;

grant execute on function public.repairdesk_create_inventory_product(
  uuid, uuid, uuid, text, text, text, text, text, text, text,
  numeric, numeric, text, integer, text
) to service_role;

comment on function public.repairdesk_create_inventory_product(
  uuid, uuid, uuid, text, text, text, text, text, text, text,
  numeric, numeric, text, integer, text
) is 'Enabled atomic idempotent V2 product intake. EXECUTE remains service-role only.';
