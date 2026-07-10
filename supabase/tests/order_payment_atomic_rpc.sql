begin;

create extension if not exists pgtap with schema extensions;
select plan(19);

select has_table('public', 'order_payment_ledger', 'payment ledger exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.order_payment_ledger'::regclass),
  'payment ledger has RLS enabled'
);
select ok(
  not has_function_privilege(
    'anon',
    to_regprocedure('public.repairdesk_record_order_payment(uuid,uuid,uuid,numeric,text,timestamptz,uuid)'),
    'execute'
  ),
  'anon cannot execute payment RPC'
);
select ok(
  not has_function_privilege(
    'authenticated',
    to_regprocedure('public.repairdesk_record_order_payment(uuid,uuid,uuid,numeric,text,timestamptz,uuid)'),
    'execute'
  ),
  'authenticated cannot execute payment RPC'
);
select ok(
  has_function_privilege(
    'service_role',
    to_regprocedure('public.repairdesk_record_order_payment(uuid,uuid,uuid,numeric,text,timestamptz,uuid)'),
    'execute'
  ),
  'service role can execute payment RPC'
);
select ok(
  not has_table_privilege('service_role', 'public.order_payment_ledger', 'update'),
  'service role cannot update immutable ledger rows'
);

insert into auth.users (id, email, created_at, updated_at)
values (
  '00000000-0000-4000-8000-000000000011',
  'payment-owner@example.test',
  now(),
  now()
);

insert into public.stores (id, store_code, name, slug, status)
values (
  '00000000-0000-4000-8000-000000000010',
  'PAYMENT_TEST',
  'Payment Test Store',
  'payment-test-store',
  'active'
);

insert into public.staff_profiles (id, email, display_name, role, status)
values (
  '00000000-0000-4000-8000-000000000011',
  'payment-owner@example.test',
  'Payment Owner',
  'owner',
  'active'
);

insert into public.store_memberships (store_id, user_id, email, display_name, role, status)
values (
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000011',
  'payment-owner@example.test',
  'Payment Owner',
  'owner',
  'active'
);

insert into public.order_workflow_statuses (
  store_id,
  code,
  label,
  short_label,
  bucket,
  allowed_for_create,
  is_default_create_status
) values (
  '00000000-0000-4000-8000-000000000010',
  'new',
  'New',
  'New',
  'intake',
  true,
  true
);

insert into public.customers (id, store_id, name, phone_e164, phone_raw)
values (
  '00000000-0000-4000-8000-000000000012',
  '00000000-0000-4000-8000-000000000010',
  'Test Customer',
  '+390000000001',
  '390000000001'
);

insert into public.repair_orders (
  id,
  store_id,
  public_no,
  order_type,
  status,
  customer_id,
  issue_description,
  quotation_amount,
  deposit_amount,
  balance_amount,
  is_paid,
  approval_status,
  technician_name,
  fault_prices,
  updated_at
) values (
  '00000000-0000-4000-8000-000000000013',
  '00000000-0000-4000-8000-000000000010',
  'PAY-TEST-0001',
  'quick_repair',
  'new',
  '00000000-0000-4000-8000-000000000012',
  'Payment transaction test',
  100,
  0,
  100,
  false,
  'pending',
  'Payment Owner',
  '[]'::jsonb,
  '2026-07-10T14:00:00Z'
);

create temporary table payment_test_results (
  label text primary key,
  payload jsonb,
  failed boolean
) on commit drop;
grant all on table payment_test_results to service_role;

set local role service_role;
insert into payment_test_results (label, payload)
select 'recorded', public.repairdesk_record_order_payment(
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000013',
  '00000000-0000-4000-8000-000000000011',
  25,
  '现金',
  '2026-07-10T14:00:00Z',
  '00000000-0000-4000-8000-000000000014'
);
reset role;

select is((select payload->>'code' from payment_test_results where label = 'recorded'), 'recorded', 'payment records once');
select is((select balance_amount from public.repair_orders where id = '00000000-0000-4000-8000-000000000013'), 75.00::numeric, 'balance updates atomically');
select is((select count(*) from public.order_payment_ledger), 1::bigint, 'one ledger row is written');
select is((select count(*) from public.order_events where event_type = 'payment'), 1::bigint, 'one payment event is written');
select is((select count(*) from public.audit_logs where action = 'payment'), 1::bigint, 'one payment audit row is written');

set local role service_role;
insert into payment_test_results (label, payload)
select 'replay', public.repairdesk_record_order_payment(
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000013',
  '00000000-0000-4000-8000-000000000011',
  25,
  '现金',
  '2026-07-10T14:00:00Z',
  '00000000-0000-4000-8000-000000000014'
);
insert into payment_test_results (label, payload)
select 'conflict', public.repairdesk_record_order_payment(
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000013',
  '00000000-0000-4000-8000-000000000011',
  26,
  '现金',
  '2026-07-10T14:00:00Z',
  '00000000-0000-4000-8000-000000000014'
);
insert into payment_test_results (label, payload)
select 'stale', public.repairdesk_record_order_payment(
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000013',
  '00000000-0000-4000-8000-000000000011',
  5,
  '现金',
  '2026-07-10T14:00:00Z',
  '00000000-0000-4000-8000-000000000015'
);
reset role;

select is((select payload->>'code' from payment_test_results where label = 'replay'), 'idempotent_replay', 'same key replays original receipt');
select is((select count(*) from public.order_payment_ledger), 1::bigint, 'replay does not duplicate ledger rows');
select is((select payload->>'code' from payment_test_results where label = 'conflict'), 'idempotency_conflict', 'same key with different payload conflicts');
select is((select payload->>'code' from payment_test_results where label = 'stale'), 'stale_version', 'different key with stale version is rejected');

update public.store_memberships
set role = 'technician'
where store_id = '00000000-0000-4000-8000-000000000010'
  and user_id = '00000000-0000-4000-8000-000000000011';

set local role service_role;
insert into payment_test_results (label, payload)
select 'forbidden', public.repairdesk_record_order_payment(
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000013',
  '00000000-0000-4000-8000-000000000011',
  5,
  '现金',
  (select updated_at from public.repair_orders where id = '00000000-0000-4000-8000-000000000013'),
  '00000000-0000-4000-8000-000000000016'
);
reset role;

select is((select payload->>'code' from payment_test_results where label = 'forbidden'), 'actor_forbidden', 'technician cannot collect payment');

update public.store_memberships
set role = 'owner'
where store_id = '00000000-0000-4000-8000-000000000010'
  and user_id = '00000000-0000-4000-8000-000000000011';

create function pg_temp.fail_payment_event_test()
returns trigger
language plpgsql
as $$
begin
  if new.event_type = 'payment' and (new.payload->>'amount')::numeric = 5 then
    raise exception 'forced payment event failure';
  end if;
  return new;
end;
$$;

create trigger payment_event_failure_test
before insert on public.order_events
for each row execute function pg_temp.fail_payment_event_test();

set local role service_role;
do $$
begin
  begin
    perform public.repairdesk_record_order_payment(
      '00000000-0000-4000-8000-000000000010',
      '00000000-0000-4000-8000-000000000013',
      '00000000-0000-4000-8000-000000000011',
      5,
      '现金',
      (select updated_at from public.repair_orders where id = '00000000-0000-4000-8000-000000000013'),
      '00000000-0000-4000-8000-000000000017'
    );
    insert into payment_test_results (label, failed) values ('forced_failure', false);
  exception when others then
    insert into payment_test_results (label, failed) values ('forced_failure', true);
  end;
end;
$$;
reset role;

select ok((select failed from payment_test_results where label = 'forced_failure'), 'event failure aborts the payment statement');
select is((select balance_amount from public.repair_orders where id = '00000000-0000-4000-8000-000000000013'), 75.00::numeric, 'event failure rolls balance back');
select is((select count(*) from public.order_payment_ledger where idempotency_key = '00000000-0000-4000-8000-000000000017'), 0::bigint, 'event failure rolls ledger back');

select * from finish();
rollback;
