begin;

create extension if not exists pgtap with schema extensions;
select plan(21);

select has_table('public', 'order_initial_deposit_corrections', 'deposit correction ledger exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.order_initial_deposit_corrections'::regclass),
  'deposit correction ledger has RLS enabled'
);
select ok(
  not has_function_privilege(
    'anon',
    to_regprocedure('public.repairdesk_correct_initial_deposit(uuid,uuid,uuid,timestamptz,uuid,numeric,text)'),
    'execute'
  ),
  'anon cannot execute correction RPC'
);
select ok(
  not has_function_privilege(
    'authenticated',
    to_regprocedure('public.repairdesk_correct_initial_deposit(uuid,uuid,uuid,timestamptz,uuid,numeric,text)'),
    'execute'
  ),
  'authenticated cannot execute correction RPC'
);
select ok(
  has_function_privilege(
    'service_role',
    to_regprocedure('public.repairdesk_correct_initial_deposit(uuid,uuid,uuid,timestamptz,uuid,numeric,text)'),
    'execute'
  ),
  'service role can execute correction RPC'
);
select ok(
  not has_table_privilege('service_role', 'public.order_initial_deposit_corrections', 'update'),
  'service role cannot rewrite correction history'
);

insert into auth.users (id, email, created_at, updated_at) values
  ('00000000-0000-4000-8000-000000000131', 'deposit-sales@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000000132', 'deposit-tech@example.test', now(), now());

insert into public.stores (id, store_code, name, slug, status) values
  ('00000000-0000-4000-8000-000000000130', 'DEPOSIT_TEST', 'Deposit Test Store', 'deposit-test-store', 'active');

insert into public.staff_profiles (id, email, display_name, role, status) values
  ('00000000-0000-4000-8000-000000000131', 'deposit-sales@example.test', 'Deposit Sales', 'sales', 'active'),
  ('00000000-0000-4000-8000-000000000132', 'deposit-tech@example.test', 'Deposit Tech', 'technician', 'active');

insert into public.store_memberships (store_id, user_id, email, display_name, role, status) values
  ('00000000-0000-4000-8000-000000000130', '00000000-0000-4000-8000-000000000131', 'deposit-sales@example.test', 'Deposit Sales', 'sales', 'active'),
  ('00000000-0000-4000-8000-000000000130', '00000000-0000-4000-8000-000000000132', 'deposit-tech@example.test', 'Deposit Tech', 'technician', 'active');

insert into public.order_workflow_statuses (
  store_id, code, label, short_label, bucket, allowed_for_create, is_default_create_status
) values (
  '00000000-0000-4000-8000-000000000130', 'new', 'New', 'New', 'intake', true, true
);

insert into public.customers (id, store_id, name, phone_e164, phone_raw) values
  ('00000000-0000-4000-8000-000000000133', '00000000-0000-4000-8000-000000000130', 'Deposit Customer', '+390000000131', '390000000131');

insert into public.repair_orders (
  id, store_id, public_no, order_type, status, customer_id, issue_description,
  quotation_amount, deposit_amount, balance_amount, is_paid, approval_status,
  technician_name, assignee_membership_id, fault_prices, updated_at
) values
  (
    '00000000-0000-4000-8000-000000000134', '00000000-0000-4000-8000-000000000130',
    'DEP-TEST-0001', 'quick_repair', 'new', '00000000-0000-4000-8000-000000000133',
    'Sales correction', 100, 20, 80, false, 'pending', 'Deposit Tech', null, '[]'::jsonb,
    '2026-07-21T13:30:00Z'
  ),
  (
    '00000000-0000-4000-8000-000000000135', '00000000-0000-4000-8000-000000000130',
    'DEP-TEST-0002', 'quick_repair', 'new', '00000000-0000-4000-8000-000000000133',
    'Assigned technician correction', 120, 20, 100, false, 'pending', 'Deposit Tech',
    (select id from public.store_memberships where user_id = '00000000-0000-4000-8000-000000000132' and store_id = '00000000-0000-4000-8000-000000000130'),
    '[]'::jsonb, '2026-07-21T13:31:00Z'
  );

create temporary table deposit_test_results (label text primary key, payload jsonb) on commit drop;
grant all on table deposit_test_results to service_role;

set local role service_role;
insert into deposit_test_results values (
  'sales', public.repairdesk_correct_initial_deposit(
    '00000000-0000-4000-8000-000000000130', '00000000-0000-4000-8000-000000000134',
    '00000000-0000-4000-8000-000000000131', '2026-07-21T13:30:00Z',
    '00000000-0000-4000-8000-000000000136', 30, 'Corrected cash intake amount'
  )
);
insert into deposit_test_results values (
  'replay', public.repairdesk_correct_initial_deposit(
    '00000000-0000-4000-8000-000000000130', '00000000-0000-4000-8000-000000000134',
    '00000000-0000-4000-8000-000000000131', '2026-07-21T13:30:00Z',
    '00000000-0000-4000-8000-000000000136', 30, 'Corrected cash intake amount'
  )
);
insert into deposit_test_results values (
  'conflict', public.repairdesk_correct_initial_deposit(
    '00000000-0000-4000-8000-000000000130', '00000000-0000-4000-8000-000000000134',
    '00000000-0000-4000-8000-000000000131', '2026-07-21T13:30:00Z',
    '00000000-0000-4000-8000-000000000136', 35, 'Different correction request'
  )
);
insert into deposit_test_results values (
  'assigned_technician', public.repairdesk_correct_initial_deposit(
    '00000000-0000-4000-8000-000000000130', '00000000-0000-4000-8000-000000000135',
    '00000000-0000-4000-8000-000000000132', '2026-07-21T13:31:00Z',
    '00000000-0000-4000-8000-000000000137', 25, 'Technician verified intake amount'
  )
);
insert into deposit_test_results values (
  'unassigned_technician', public.repairdesk_correct_initial_deposit(
    '00000000-0000-4000-8000-000000000130', '00000000-0000-4000-8000-000000000134',
    '00000000-0000-4000-8000-000000000132',
    (select updated_at from public.repair_orders where id = '00000000-0000-4000-8000-000000000134'),
    '00000000-0000-4000-8000-000000000138', 40, 'Should be denied by assignment'
  )
);
insert into deposit_test_results values (
  'stale', public.repairdesk_correct_initial_deposit(
    '00000000-0000-4000-8000-000000000130', '00000000-0000-4000-8000-000000000134',
    '00000000-0000-4000-8000-000000000131', '2026-07-21T13:30:00Z',
    '00000000-0000-4000-8000-000000000139', 40, 'Stale version must be rejected'
  )
);
insert into deposit_test_results values (
  'no_change', public.repairdesk_correct_initial_deposit(
    '00000000-0000-4000-8000-000000000130', '00000000-0000-4000-8000-000000000134',
    '00000000-0000-4000-8000-000000000131',
    (select updated_at from public.repair_orders where id = '00000000-0000-4000-8000-000000000134'),
    '00000000-0000-4000-8000-000000000140', 30, 'No-op correction must be rejected'
  )
);
reset role;

update public.repair_orders set approval_status = 'approved'
where id = '00000000-0000-4000-8000-000000000134';
set local role service_role;
insert into deposit_test_results values (
  'approved', public.repairdesk_correct_initial_deposit(
    '00000000-0000-4000-8000-000000000130', '00000000-0000-4000-8000-000000000134',
    '00000000-0000-4000-8000-000000000131',
    (select updated_at from public.repair_orders where id = '00000000-0000-4000-8000-000000000134'),
    '00000000-0000-4000-8000-000000000141', 40, 'Approved quote must be protected'
  )
);
reset role;

insert into public.order_payment_ledger (
  store_id, order_id, idempotency_key, actor_id, actor_name_snapshot, amount,
  payment_method, currency_code, balance_before, balance_after,
  order_updated_at_before, order_updated_at_after
) select
  store_id, id, '00000000-0000-4000-8000-000000000142',
  '00000000-0000-4000-8000-000000000131', 'Deposit Sales', 5, '现金', currency_code,
  balance_amount, balance_amount - 5, updated_at, updated_at
from public.repair_orders where id = '00000000-0000-4000-8000-000000000135';

set local role service_role;
insert into deposit_test_results values (
  'payment_history', public.repairdesk_correct_initial_deposit(
    '00000000-0000-4000-8000-000000000130', '00000000-0000-4000-8000-000000000135',
    '00000000-0000-4000-8000-000000000132',
    (select updated_at from public.repair_orders where id = '00000000-0000-4000-8000-000000000135'),
    '00000000-0000-4000-8000-000000000143', 30, 'Payment history must be protected'
  )
);
reset role;

select is((select payload->>'code' from deposit_test_results where label = 'sales'), 'recorded', 'sales can correct initial deposit');
select is((select deposit_amount from public.repair_orders where id = '00000000-0000-4000-8000-000000000134'), 30.00::numeric, 'deposit summary updates');
select is((select balance_amount from public.repair_orders where id = '00000000-0000-4000-8000-000000000134'), 70.00::numeric, 'balance remains consistent');
select is((select count(*) from public.order_initial_deposit_corrections), 2::bigint, 'sales and assigned technician create immutable corrections');
select is((select count(*) from public.order_events where payload->>'action' = 'initial_deposit_corrected'), 2::bigint, 'corrections create timeline events');
select is((select count(*) from public.audit_logs where action = 'initial_deposit_correction'), 2::bigint, 'corrections create audit rows');
select is((select payload->>'code' from deposit_test_results where label = 'replay'), 'idempotent_replay', 'same request replays');
select is((select payload->>'code' from deposit_test_results where label = 'conflict'), 'idempotency_conflict', 'same key with different request conflicts');
select is((select payload->>'code' from deposit_test_results where label = 'assigned_technician'), 'recorded', 'assigned technician can correct');
select is((select payload->>'code' from deposit_test_results where label = 'unassigned_technician'), 'actor_forbidden', 'unassigned technician is denied');
select is((select count(*) from public.order_initial_deposit_corrections where order_id = '00000000-0000-4000-8000-000000000134'), 1::bigint, 'replay and denied attempts do not duplicate history');
select is((select payload->>'code' from deposit_test_results where label = 'stale'), 'stale_version', 'stale version is denied');
select is((select payload->>'code' from deposit_test_results where label = 'no_change'), 'no_change', 'no-op correction is denied');
select is((select payload->>'code' from deposit_test_results where label = 'approved'), 'approval_already_touched', 'approved quote is protected even without approval timestamps');
select is((select payload->>'code' from deposit_test_results where label = 'payment_history'), 'payment_history_exists', 'payment history blocks initial deposit correction');

select * from finish();
rollback;
