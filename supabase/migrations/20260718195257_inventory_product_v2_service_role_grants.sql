-- Inventory Product V2 enable step: expose only the two server-side commands
-- to service_role. Browser-facing roles remain unable to execute either RPC.

set lock_timeout = '5s';

do $$
begin
  if to_regprocedure(
    'public.repairdesk_complete_inventory_sale_v2(uuid,uuid,uuid,timestamp with time zone,uuid,uuid,numeric,numeric,text,text,integer,jsonb,text,text,timestamp with time zone)'
  ) is null then
    raise exception 'Missing prerequisite RPC: repairdesk_complete_inventory_sale_v2';
  end if;

  if to_regprocedure(
    'public.repairdesk_create_inventory_unit_v2(uuid,uuid,uuid,text,uuid,uuid,text,text,text,text,text,text,jsonb,numeric,numeric,integer,text,text,text,timestamp with time zone)'
  ) is null then
    raise exception 'Missing prerequisite RPC: repairdesk_create_inventory_unit_v2';
  end if;
end;
$$;

revoke all on function public.repairdesk_complete_inventory_sale_v2(
  uuid,
  uuid,
  uuid,
  timestamptz,
  uuid,
  uuid,
  numeric,
  numeric,
  text,
  text,
  integer,
  jsonb,
  text,
  text,
  timestamptz
) from public, anon, authenticated, service_role;

grant execute on function public.repairdesk_complete_inventory_sale_v2(
  uuid,
  uuid,
  uuid,
  timestamptz,
  uuid,
  uuid,
  numeric,
  numeric,
  text,
  text,
  integer,
  jsonb,
  text,
  text,
  timestamptz
) to service_role;

revoke all on function public.repairdesk_create_inventory_unit_v2(
  uuid,
  uuid,
  uuid,
  text,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  numeric,
  numeric,
  integer,
  text,
  text,
  text,
  timestamptz
) from public, anon, authenticated, service_role;

grant execute on function public.repairdesk_create_inventory_unit_v2(
  uuid,
  uuid,
  uuid,
  text,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  numeric,
  numeric,
  integer,
  text,
  text,
  text,
  timestamptz
) to service_role;

comment on function public.repairdesk_complete_inventory_sale_v2(
  uuid,
  uuid,
  uuid,
  timestamptz,
  uuid,
  uuid,
  numeric,
  numeric,
  text,
  text,
  integer,
  jsonb,
  text,
  text,
  timestamptz
) is 'Atomic inventory sale command. Runtime EXECUTE is restricted to service_role.';

comment on function public.repairdesk_create_inventory_unit_v2(
  uuid,
  uuid,
  uuid,
  text,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  numeric,
  numeric,
  integer,
  text,
  text,
  text,
  timestamptz
) is 'Atomic serial-unit intake command. Runtime EXECUTE is restricted to service_role.';
