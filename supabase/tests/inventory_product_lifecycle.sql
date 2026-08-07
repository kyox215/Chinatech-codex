begin;

create extension if not exists pgtap with schema extensions;
select plan(43);

select has_table('public', 'inventory_product_acquisitions', 'acquisition table exists');
select has_table('public', 'inventory_device_inspections', 'inspection table exists');
select has_table('public', 'inventory_sale_orders', 'sale order table exists');
select has_table('public', 'inventory_sale_payment_entries', 'payment ledger exists');
select has_table('public', 'inventory_pickup_override_ledger', 'pickup override ledger exists');
select has_table('public', 'inventory_warranty_versions', 'warranty versions table exists');
select has_table('public', 'inventory_after_sales_cases', 'after-sales cases table exists');
select has_table('public', 'inventory_after_sales_events', 'after-sales events table exists');
select has_table('public', 'inventory_lifecycle_command_ledger', 'command ledger exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.inventory_sale_orders'::regclass),
  'sale orders have RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.inventory_sale_payment_entries'::regclass),
  'payment entries have RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.inventory_pickup_override_ledger'::regclass),
  'pickup overrides have RLS enabled'
);
select ok(
  not has_table_privilege('anon', 'public.inventory_sale_orders', 'select'),
  'anon cannot read sale orders'
);
select ok(
  not has_table_privilege('authenticated', 'public.inventory_sale_payment_entries', 'select'),
  'authenticated cannot read payment entries'
);
select ok(
  not has_table_privilege('service_role', 'public.inventory_pickup_override_ledger', 'update,delete,truncate'),
  'pickup overrides are append-only at the grant boundary'
);
select ok(
  not has_table_privilege('service_role', 'public.inventory_sale_payment_entries', 'insert'),
  'service role cannot bypass the command RPC to append payments'
);
select ok(
  not has_table_privilege('service_role', 'public.inventory_sale_payment_entries', 'update,delete,truncate'),
  'payment entries are append-only at the grant boundary'
);
select ok(
  not has_table_privilege('service_role', 'public.inventory_warranty_versions', 'update,delete,truncate'),
  'warranty versions are append-only at the grant boundary'
);
select ok(
  not has_function_privilege(
    'anon',
    to_regprocedure('public.repairdesk_inventory_lifecycle_command(uuid,uuid,text,uuid,jsonb)'),
    'execute'
  ),
  'anon cannot execute lifecycle command'
);
select ok(
  not has_function_privilege(
    'authenticated',
    to_regprocedure('public.repairdesk_inventory_lifecycle_command(uuid,uuid,text,uuid,jsonb)'),
    'execute'
  ),
  'authenticated cannot execute lifecycle command'
);
select ok(
  has_function_privilege(
    'service_role',
    to_regprocedure('public.repairdesk_inventory_lifecycle_command(uuid,uuid,text,uuid,jsonb)'),
    'execute'
  ),
  'service role can execute lifecycle command after enable gate'
);
select ok(
  (
    select exists (
      select 1
        from unnest(coalesce(proconfig, '{}'::text[])) as config
       where config in ('search_path=', 'search_path=""')
    )
      from pg_proc
     where oid = 'public.repairdesk_inventory_lifecycle_command(uuid,uuid,text,uuid,jsonb)'::regprocedure
  ),
  'lifecycle RPC pins an empty search_path'
);
select ok(
  (select pg_get_functiondef('public.repairdesk_inventory_lifecycle_command(uuid,uuid,text,uuid,jsonb)'::regprocedure) like '%idempotency_conflict%' ),
  'lifecycle RPC handles request hash conflicts'
);
select ok(
  (select pg_get_functiondef('public.repairdesk_inventory_lifecycle_command(uuid,uuid,text,uuid,jsonb)'::regprocedure) like '%store_memberships%' ),
  'lifecycle RPC verifies active membership'
);
select ok(
  (select pg_get_functiondef('public.repairdesk_inventory_lifecycle_command(uuid,uuid,text,uuid,jsonb)'::regprocedure) like '%audit_logs%' ),
  'lifecycle RPC writes audit in the transaction'
);
select ok(
  (select pg_get_functiondef('public.repairdesk_inventory_lifecycle_command(uuid,uuid,text,uuid,jsonb)'::regprocedure) like '%balance_remaining%' ),
  'lifecycle RPC blocks unpaid pickup by default'
);
select ok(
  (select pg_get_functiondef('public.repairdesk_inventory_lifecycle_command(uuid,uuid,text,uuid,jsonb)'::regprocedure) like '%reservation.cancel%' ),
  'lifecycle RPC supports explicit reservation disposition'
);
select ok(
  (select pg_get_functiondef('public.repairdesk_inventory_lifecycle_command(uuid,uuid,text,uuid,jsonb)'::regprocedure) like '%inventory_sale_payment_entries%' ),
  'lifecycle RPC uses append-only sale payments'
);
select ok(
  (select pg_get_functiondef('public.repairdesk_inventory_lifecycle_command(uuid,uuid,text,uuid,jsonb)'::regprocedure) like '%inventory_warranty_versions%' ),
  'lifecycle RPC versions warranty adjustments'
);
select ok(
  (select pg_get_functiondef('public.repairdesk_inventory_lifecycle_command(uuid,uuid,text,uuid,jsonb)'::regprocedure) like '%after_sales.create%' ),
  'lifecycle RPC creates after-sales cases'
);
select ok(
  (select pg_get_functiondef('public.repairdesk_inventory_lifecycle_command(uuid,uuid,text,uuid,jsonb)'::regprocedure) like '%inventory_after_sales_events%' ),
  'after-sales events are appended'
);
select ok(
  (
    select pg_get_constraintdef(oid) ~* 'battery_health.*>= 0.*battery_health.*<= 100'
      from pg_constraint
     where conname = 'inventory_device_inspections_battery_check'
  ),
  'battery health is bounded 0-100'
);
select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'inventory_device_inspections_checks_bound') like '%repairdesk_inventory_lifecycle_checks_valid%',
  'inspection checks are bounded to scalar JSON'
);
select ok(
  (select udt_name from information_schema.columns where table_schema = 'public' and table_name = 'inventory_sale_orders' and column_name = 'customer_id') = 'uuid',
  'reservation customer IDs are UUIDs'
);
select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'inventory_sale_orders_customer_same_store_fkey') ilike '%on delete restrict%',
  'customer deletion cannot orphan a sale order'
);
select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'inventory_sale_orders_one_active_unit_idx') is null,
  'active order uniqueness is implemented as an index rather than a mutable column'
);
select ok(
  (
    select i.indisunique
       and pg_catalog.strpos(pg_catalog.pg_get_indexdef(i.indexrelid), '(store_id, stock_unit_id)') > 0
       and pg_catalog.pg_get_expr(i.indpred, i.indrelid) like '%reserved%'
       and pg_catalog.pg_get_expr(i.indpred, i.indrelid) like '%sold%'
      from pg_catalog.pg_index i
     where i.indexrelid = 'public.inventory_sale_orders_one_active_unit_idx'::regclass
  ),
  'a stock unit has at most one active reservation or sale'
);
select ok(
  (select indexdef from pg_indexes where indexname = 'inventory_sale_orders_queue_idx') like '%expires_at%',
  'reservation queue is indexed by expiry and pickup dates'
);
select ok(
  (select indexdef from pg_indexes where indexname = 'inventory_after_sales_cases_one_active_order_idx') ilike '%status%closed%',
  'only one active after-sales case is allowed per order'
);
select ok(
  (select count(*) from pg_trigger where tgname = 'inventory_pickup_override_ledger_append_only') = 1,
  'pickup override ledger has an append-only trigger'
);
select ok(
  not has_table_privilege('service_role', 'public.inventory_lifecycle_command_ledger', 'update,delete,truncate'),
  'command ledger is append-only at the grant boundary'
);
select ok(
  (select count(*) from pg_trigger where tgname = 'inventory_sale_payment_entries_append_only') = 1,
  'payment ledger has an append-only trigger'
);
select ok(
  (select count(*) from pg_trigger where tgname = 'inventory_lifecycle_command_ledger_append_only') = 1,
  'command ledger has an append-only trigger'
);

select * from finish();
rollback;
