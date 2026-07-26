-- Production migration history version: 20260726181537.
set lock_timeout = '5s';

do $$
begin
  if exists (
    select 1
      from public.inventory_items as item
      left join public.inventory_stock_units as unit
        on unit.store_id = item.store_id
       and unit.legacy_inventory_item_id = item.id
     where coalesce((item.legacy_payload ->> 'inventory_v2_intake')::boolean, false)
       and (
         unit.id is null
         or coalesce(item.legacy_payload ->> 'inventory_v2_unit_id', '') <> unit.id::text
         or item.status::text <> unit.status
         or item.buyback_price <> unit.cost_amount
         or item.list_price <> unit.list_price
       )
  ) then
    raise exception using
      errcode = 'check_violation',
      message = 'Inventory V2 workflow enable blocked: legacy/V2 projection mismatch';
  end if;
end;
$$;

revoke all on function public.repairdesk_apply_inventory_unit_workflow_v2(
  uuid, uuid, uuid, timestamptz, bigint, uuid, text, text, jsonb, jsonb, text
) from public, anon, authenticated, service_role;

grant execute on function public.repairdesk_apply_inventory_unit_workflow_v2(
  uuid, uuid, uuid, timestamptz, bigint, uuid, text, text, jsonb, jsonb, text
) to service_role;

comment on function public.repairdesk_apply_inventory_unit_workflow_v2(
  uuid, uuid, uuid, timestamptz, bigint, uuid, text, text, jsonb, jsonb, text
) is 'Owner-approved service-role-only atomic V2 inspection/commercial/listing workflow.';
