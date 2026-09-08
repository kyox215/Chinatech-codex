-- Separate service-role enable, after reviewed expand, synthetic tests and production preflight.
begin;
do $$
begin
  if to_regprocedure('public.repairdesk_inventory_sales_list(uuid,uuid,jsonb)') is null
    or to_regprocedure('public.repairdesk_inventory_sales_command(uuid,uuid,text,uuid,jsonb)') is null
    or to_regprocedure('public.repairdesk_inventory_sales_read(uuid,uuid,text,uuid,text,uuid,text)') is null
    or to_regprocedure('public.repairdesk_complete_inventory_sale_v2(uuid,uuid,uuid,timestamptz,uuid,uuid,numeric,numeric,text,text,integer,jsonb,text,text,timestamptz)') is null
    or to_regprocedure('public.repairdesk_guard_inventory_v2_unit_sale()') is null then
    raise exception 'inventory sales prerequisite RPC missing';
  end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
    and c.relname in ('inventory_sale_orders','inventory_sale_payment_entries','inventory_warranty_versions','inventory_sales_command_ledger')
    and c.relrowsecurity)<>4 then raise exception 'inventory sales RLS preflight failed'; end if;
  if (select count(*) from pg_trigger where not tgisinternal and tgenabled='O' and tgname in
    ('inventory_sales_item_occupancy','inventory_sales_unit_occupancy','inventory_sales_transaction_occupancy','inventory_sales_movement_occupancy',
     'inventory_sales_payments_immutable','inventory_sales_warranty_immutable','inventory_sales_ledger_immutable',
     'inventory_sales_order_immutable','inventory_sales_revision','inventory_v2_unit_sale_guard',
     'inventory_sales_identifier_facts','inventory_sales_variant_facts'))<>12 then
    raise exception 'inventory sales trigger preflight failed'; end if;
  if exists(select 1 from pg_proc where oid in (
    'public.repairdesk_inventory_sales_read(uuid,uuid,text,uuid,text,uuid,text)'::regprocedure,
    'public.repairdesk_inventory_sales_list(uuid,uuid,jsonb)'::regprocedure) and provolatile<>'s') then
    raise exception 'inventory sales read snapshot preflight failed'; end if;
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in ('inventory_sale_orders','inventory_sale_payment_entries','inventory_warranty_versions','inventory_sales_command_ledger')
    and (has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE')
      or has_table_privilege('service_role',c.oid,'INSERT,UPDATE,DELETE'))) then raise exception 'inventory sales table ACL preflight failed'; end if;
end $$;
revoke all on function public.repairdesk_inventory_sales_command(uuid,uuid,text,uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.repairdesk_inventory_sales_read(uuid,uuid,text,uuid,text,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.repairdesk_inventory_sales_command(uuid,uuid,text,uuid,jsonb) to service_role;
grant execute on function public.repairdesk_inventory_sales_read(uuid,uuid,text,uuid,text,uuid,text) to service_role;
revoke all on function public.repairdesk_inventory_sales_list(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.repairdesk_inventory_sales_list(uuid,uuid,jsonb) to service_role;
-- Application SALES flags remain independently default-off. This file never edits flags.
commit;
