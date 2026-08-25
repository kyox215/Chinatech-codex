-- Inventory Product Lifecycle V1 runtime enablement.
-- Apply only after the linked migration, RLS/grant catalog, recovery and
-- application flag gates have been verified for the target store.

set lock_timeout = '5s';

do $$
begin
  if to_regprocedure('public.repairdesk_inventory_lifecycle_command(uuid,uuid,text,uuid,jsonb)') is null then
    raise exception 'Missing prerequisite RPC: repairdesk_inventory_lifecycle_command';
  end if;
end
$$;

-- Enablement is fail-closed: verify the complete object/ACL contract before
-- granting the runtime RPC. Feature flags remain application-owned and must
-- stay off until this migration and the controlled rollout are approved.
do $$
declare
  v_missing text;
  v_table text;
  v_rls boolean;
  v_owner text;
  v_security_definer boolean;
  v_config text[];
begin
  select string_agg(requirement, ', ' order by requirement)
    into v_missing
    from (
      select table_name || '.table' as requirement
        from unnest(array[
          'inventory_product_acquisitions', 'inventory_device_inspections',
          'inventory_sale_orders', 'inventory_sale_payment_entries',
          'inventory_pickup_override_ledger', 'inventory_warranty_versions',
          'inventory_after_sales_cases', 'inventory_after_sales_events',
          'inventory_lifecycle_command_ledger', 'inventory_stock_units',
          'inventory_stock_movements', 'inventory_sale_command_ledger',
          'inventory_transactions', 'inventory_events'
        ]) as table_name
       where to_regclass('public.' || table_name) is null
      union all
      select 'inventory_sale_orders.customer_id uuid'
       where not exists (
         select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'inventory_sale_orders'
            and column_name = 'customer_id' and udt_name = 'uuid'
       )
      union all
      select 'inventory_after_sales_cases(id,store_id) unique'
       where not exists (
         select 1
           from pg_catalog.pg_index i
           join pg_catalog.pg_class c on c.oid = i.indrelid
           join pg_catalog.pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relname = 'inventory_after_sales_cases'
            and i.indisunique
            and pg_catalog.strpos(pg_catalog.pg_get_indexdef(i.indexrelid), '(id, store_id)') > 0
       )
      union all
      select 'inventory_after_sales_cases active order partial unique'
       where not exists (
         select 1
           from pg_catalog.pg_index i
           join pg_catalog.pg_class c on c.oid = i.indrelid
           join pg_catalog.pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relname = 'inventory_after_sales_cases'
            and i.indisunique
            and pg_catalog.strpos(
              pg_catalog.pg_get_indexdef(i.indexrelid),
              '(store_id, sale_order_id)'
            ) > 0
            and pg_catalog.pg_get_expr(i.indpred, i.indrelid) ~* 'status.*closed'
       )
    ) missing;
  if v_missing is not null then
    raise exception using errcode = '55000',
      message = 'inventory lifecycle enable preflight failed: ' || v_missing;
  end if;

  for v_table in
    select unnest(array[
      'inventory_product_acquisitions', 'inventory_device_inspections',
      'inventory_sale_orders', 'inventory_sale_payment_entries',
      'inventory_pickup_override_ledger', 'inventory_warranty_versions',
      'inventory_after_sales_cases', 'inventory_after_sales_events',
      'inventory_lifecycle_command_ledger'
    ])
  loop
    select c.relrowsecurity into v_rls
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = v_table;
    if coalesce(v_rls, false) is not true then
      raise exception using errcode = '55000',
        message = 'inventory lifecycle enable preflight failed: RLS off for ' || v_table;
    end if;
    if has_table_privilege('anon', 'public.' || v_table, 'SELECT')
       or has_table_privilege('anon', 'public.' || v_table, 'INSERT')
       or has_table_privilege('anon', 'public.' || v_table, 'UPDATE')
       or has_table_privilege('anon', 'public.' || v_table, 'DELETE')
       or has_table_privilege('anon', 'public.' || v_table, 'TRUNCATE')
       or has_table_privilege('authenticated', 'public.' || v_table, 'SELECT')
       or has_table_privilege('authenticated', 'public.' || v_table, 'INSERT')
       or has_table_privilege('authenticated', 'public.' || v_table, 'UPDATE')
       or has_table_privilege('authenticated', 'public.' || v_table, 'DELETE')
       or has_table_privilege('authenticated', 'public.' || v_table, 'TRUNCATE') then
      raise exception using errcode = '55000',
        message = 'inventory lifecycle enable preflight failed: public table ACL for ' || v_table;
    end if;
    if not has_table_privilege('service_role', 'public.' || v_table, 'SELECT')
       or has_table_privilege('service_role', 'public.' || v_table, 'INSERT')
       or has_table_privilege('service_role', 'public.' || v_table, 'UPDATE')
       or has_table_privilege('service_role', 'public.' || v_table, 'DELETE')
       or has_table_privilege('service_role', 'public.' || v_table, 'TRUNCATE') then
      raise exception using errcode = '55000',
        message = 'inventory lifecycle enable preflight failed: service role table ACL for ' || v_table;
    end if;
  end loop;

  select pg_catalog.pg_get_userbyid(p.proowner), p.prosecdef, p.proconfig
    into v_owner, v_security_definer, v_config
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.oid = to_regprocedure('public.repairdesk_inventory_lifecycle_command(uuid,uuid,text,uuid,jsonb)');
  if v_owner not in ('postgres', 'supabase_admin') or v_security_definer is not true
     or not exists (
       select 1
         from unnest(coalesce(v_config, '{}'::text[])) as config
        where config in ('search_path=', 'search_path=""')
     ) then
    raise exception using errcode = '55000',
      message = 'inventory lifecycle enable preflight failed: RPC owner/security/search_path';
  end if;
  if has_function_privilege('service_role', 'public.repairdesk_inventory_lifecycle_command(uuid,uuid,text,uuid,jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'public.repairdesk_inventory_lifecycle_command(uuid,uuid,text,uuid,jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.repairdesk_inventory_lifecycle_command(uuid,uuid,text,uuid,jsonb)', 'EXECUTE') then
    raise exception using errcode = '55000',
      message = 'inventory lifecycle enable preflight failed: RPC already executable';
  end if;
end;
$$;

revoke all on function public.repairdesk_inventory_lifecycle_command(uuid, uuid, text, uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.repairdesk_inventory_lifecycle_checks_valid(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.repairdesk_inventory_lifecycle_command(uuid, uuid, text, uuid, jsonb)
  to service_role;
grant execute on function public.repairdesk_inventory_lifecycle_checks_valid(jsonb)
  to service_role;

comment on function public.repairdesk_inventory_lifecycle_command(uuid, uuid, text, uuid, jsonb)
  is 'Enabled inventory lifecycle command boundary. Service role only; application rollout remains fail-closed behind INVENTORY_LIFECYCLE_* flags.';

notify pgrst, 'reload schema';
reset lock_timeout;
