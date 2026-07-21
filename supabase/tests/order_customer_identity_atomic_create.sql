begin;

create extension if not exists pgtap with schema extensions;
select plan(18);

select has_table('public', 'repairdesk_order_create_operations', 'order-create idempotency ledger exists');
select has_table('public', 'repairdesk_customer_identity_challenges', 'identity challenge table exists');
select has_column('public', 'repair_orders', 'customer_name_snapshot', 'order stores customer name snapshot');
select ok(
  not has_function_privilege(
    'authenticated',
    to_regprocedure('public.repairdesk_create_order_v2(uuid,uuid,uuid,text,jsonb)'),
    'execute'
  ),
  'authenticated clients cannot call atomic create directly'
);
select ok(
  has_function_privilege(
    'service_role',
    to_regprocedure('public.repairdesk_create_order_v2(uuid,uuid,uuid,text,jsonb)'),
    'execute'
  ),
  'service role can call atomic create'
);

insert into auth.users (id, email, created_at, updated_at) values
  ('00000000-0000-4000-8000-000000000901', 'identity-owner@example.test', now(), now());

insert into public.stores (id, store_code, name, slug, status) values
  ('00000000-0000-4000-8000-000000000900', 'IDENTITY_TEST', 'Identity Test Store', 'identity-test-store', 'active');

insert into public.store_memberships (store_id, user_id, email, display_name, role, status) values
  ('00000000-0000-4000-8000-000000000900', '00000000-0000-4000-8000-000000000901', 'identity-owner@example.test', 'Identity Owner', 'owner', 'active');

insert into public.order_workflow_statuses (
  store_id, code, label, short_label, bucket, allowed_for_create, is_default_create_status
) values (
  '00000000-0000-4000-8000-000000000900', 'new', 'New', 'New', 'intake', true, true
);

insert into public.customers (id, store_id, name, phone_e164, phone_raw) values
  ('00000000-0000-4000-8000-000000000902', '00000000-0000-4000-8000-000000000900', 'Existing Customer', '+390000000902', '390000000902');

create temporary table identity_test_values (
  label text primary key,
  payload jsonb not null
) on commit drop;
grant all on table identity_test_values to service_role;

set local role service_role;
insert into identity_test_values values (
  'conflict',
  public.repairdesk_create_order_v2(
    '00000000-0000-4000-8000-000000000900',
    '00000000-0000-4000-8000-000000000901',
    '00000000-0000-4000-8000-000000000903',
    repeat('a', 64),
    jsonb_build_object(
      'customer_name', 'Different Customer',
      'customer_phone', '+390000000902',
      'phone_raw', '390000000902',
      'phone_e164', '+390000000902',
      'contact_phones', '[]'::jsonb,
      'customer_identity_resolution', jsonb_build_object('mode', 'auto'),
      'device_brand', 'Apple',
      'device_model', 'iPhone Test',
      'device_imei', '',
      'order', jsonb_build_object(
        'order_type', 'quick_repair',
        'status', 'new',
        'workflow_status', 'intake',
        'payment_status', 'unpaid',
        'approval_flow_status', 'not_required',
        'parts_status', 'not_required',
        'notify_status', 'not_sent',
        'issue_description', 'Synthetic identity conflict test',
        'quotation_amount', 50,
        'deposit_amount', 0,
        'balance_amount', 50,
        'is_paid', false,
        'technician_name', 'Identity Owner',
        'device_custody_status', 'with_shop',
        'warranty_text', '6个月',
        'warranty_months', 6,
        'fault_prices', jsonb_build_array(jsonb_build_object('name', 'Display', 'price', 50, 'currency_code', 'EUR')),
        'operator_name', 'Identity Owner'
      )
    )
  )
);
reset role;

select is((select payload->>'code' from identity_test_values where label = 'conflict'), 'customer_identity_conflict', 'same phone with different name is blocked');
select is((select count(*) from public.customers where store_id = '00000000-0000-4000-8000-000000000900'), 1::bigint, 'conflict creates no customer');
select is((select count(*) from public.devices where store_id = '00000000-0000-4000-8000-000000000900'), 0::bigint, 'conflict creates no device');
select is((select count(*) from public.repair_orders where store_id = '00000000-0000-4000-8000-000000000900'), 0::bigint, 'conflict creates no order');
select is((select count(*) from public.order_events where store_id = '00000000-0000-4000-8000-000000000900'), 0::bigint, 'conflict creates no event');

set local role service_role;
insert into identity_test_values values (
  'resolved',
  public.repairdesk_create_order_v2(
    '00000000-0000-4000-8000-000000000900',
    '00000000-0000-4000-8000-000000000901',
    '00000000-0000-4000-8000-000000000903',
    repeat('a', 64),
    jsonb_build_object(
      'customer_name', 'Different Customer',
      'customer_phone', '+390000000902',
      'phone_raw', '390000000902',
      'phone_e164', '+390000000902',
      'contact_phones', '[]'::jsonb,
      'customer_identity_resolution', jsonb_build_object(
        'mode', 'use_existing',
        'customer_id', '00000000-0000-4000-8000-000000000902',
        'conflict_token', (select payload->>'conflictToken' from identity_test_values where label = 'conflict')
      ),
      'device_brand', 'Apple',
      'device_model', 'iPhone Test',
      'device_imei', '',
      'order', jsonb_build_object(
        'order_type', 'quick_repair',
        'status', 'new',
        'workflow_status', 'intake',
        'payment_status', 'unpaid',
        'approval_flow_status', 'not_required',
        'parts_status', 'not_required',
        'notify_status', 'not_sent',
        'issue_description', 'Synthetic resolved identity test',
        'quotation_amount', 50,
        'deposit_amount', 0,
        'balance_amount', 50,
        'is_paid', false,
        'technician_name', 'Identity Owner',
        'device_custody_status', 'with_shop',
        'warranty_text', '6个月',
        'warranty_months', 6,
        'fault_prices', jsonb_build_array(jsonb_build_object('name', 'Display', 'price', 50, 'currency_code', 'EUR')),
        'operator_name', 'Identity Owner'
      )
    )
  )
);
reset role;

select is((select payload->>'code' from identity_test_values where label = 'resolved'), 'created', 'explicit existing-customer resolution creates order');
select is((select count(*) from public.customers where store_id = '00000000-0000-4000-8000-000000000900'), 1::bigint, 'resolution does not duplicate customer');
select is((select count(*) from public.devices where store_id = '00000000-0000-4000-8000-000000000900'), 1::bigint, 'resolution creates one device');
select is((select count(*) from public.repair_orders where store_id = '00000000-0000-4000-8000-000000000900'), 1::bigint, 'resolution creates one order');
select is((select count(*) from public.order_events where store_id = '00000000-0000-4000-8000-000000000900'), 1::bigint, 'resolution creates one event');
select is((select name from public.customers where id = '00000000-0000-4000-8000-000000000902'), 'Existing Customer', 'existing customer is never silently renamed');
select is((select customer_name_snapshot from public.repair_orders where store_id = '00000000-0000-4000-8000-000000000900'), 'Existing Customer', 'order stores confirmed customer snapshot');
select is((select customer_identity_snapshot_source from public.repair_orders where store_id = '00000000-0000-4000-8000-000000000900'), 'selected', 'snapshot records identity resolution source');

select * from finish();
rollback;
