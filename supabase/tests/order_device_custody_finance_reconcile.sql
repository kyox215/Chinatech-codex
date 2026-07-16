begin;

create extension if not exists pgtap with schema extensions;
select plan(42);

select has_column('public', 'repair_orders', 'device_custody_status', 'custody column exists');
select is(
  (select column_default from information_schema.columns
   where table_schema = 'public' and table_name = 'repair_orders'
     and column_name = 'device_custody_status'),
  '''with_shop''::text',
  'future orders default to shop custody'
);
select ok(
  (select convalidated from pg_constraint
   where conrelid = 'public.repair_orders'::regclass
     and conname = 'repair_orders_device_custody_status_check'),
  'custody enum constraint is validated'
);
select ok(
  (select convalidated from pg_constraint
   where conrelid = 'public.repair_orders'::regclass
     and conname = 'repair_orders_customer_custody_unlock_clear_check'),
  'customer custody credential constraint is validated'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.repair_orders'::regclass
      and tgname = 'repairdesk_protect_voided_order_trigger'
      and not tgisinternal
  ),
  'finance terminal trigger remains attached'
);
select ok(
  not has_function_privilege(
    'anon',
    to_regprocedure('public.repairdesk_apply_order_atomic_mutation(uuid,uuid,uuid,timestamptz,jsonb,text,jsonb,uuid)'),
    'execute'
  ),
  'anon cannot execute generic order mutation'
);
select ok(
  not has_function_privilege(
    'authenticated',
    to_regprocedure('public.repairdesk_correct_terminal_order_custody(uuid,uuid,uuid,timestamptz,uuid,text,text)'),
    'execute'
  ),
  'authenticated cannot execute terminal custody correction'
);
select ok(
  has_function_privilege(
    'service_role',
    to_regprocedure('public.repairdesk_apply_order_atomic_mutation(uuid,uuid,uuid,timestamptz,jsonb,text,jsonb,uuid)'),
    'execute'
  ),
  'service role can execute generic order mutation'
);
select ok(
  has_function_privilege(
    'service_role',
    to_regprocedure('public.repairdesk_correct_terminal_order_custody(uuid,uuid,uuid,timestamptz,uuid,text,text)'),
    'execute'
  ),
  'service role can execute terminal custody correction'
);
select ok(
  has_function_privilege(
    'service_role',
    to_regprocedure('public.repairdesk_confirm_cancelled_order_return(uuid,uuid,uuid,timestamptz,uuid)'),
    'execute'
  ),
  'service role can execute cancelled return'
);

insert into auth.users (id, email, created_at, updated_at) values
  ('00000000-0000-4000-8000-000000003001', 'custody-owner@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000003002', 'custody-manager@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000004001', 'custody-other-owner@example.test', now(), now());

insert into public.stores (id, store_code, name, slug, status) values
  ('00000000-0000-4000-8000-000000003000', 'CUSTODY_A', 'Custody Store A', 'custody-store-a', 'active'),
  ('00000000-0000-4000-8000-000000004000', 'CUSTODY_B', 'Custody Store B', 'custody-store-b', 'active');

insert into public.staff_profiles (id, email, display_name, role, status) values
  ('00000000-0000-4000-8000-000000003001', 'custody-owner@example.test', 'Custody Owner', 'owner', 'active'),
  ('00000000-0000-4000-8000-000000003002', 'custody-manager@example.test', 'Custody Manager', 'manager', 'active'),
  ('00000000-0000-4000-8000-000000004001', 'custody-other-owner@example.test', 'Other Owner', 'owner', 'active');

insert into public.store_memberships (id, store_id, user_id, email, display_name, role, status) values
  ('00000000-0000-4000-8000-000000003011', '00000000-0000-4000-8000-000000003000', '00000000-0000-4000-8000-000000003001', 'custody-owner@example.test', 'Custody Owner', 'owner', 'active'),
  ('00000000-0000-4000-8000-000000003012', '00000000-0000-4000-8000-000000003000', '00000000-0000-4000-8000-000000003002', 'custody-manager@example.test', 'Custody Manager', 'manager', 'active'),
  ('00000000-0000-4000-8000-000000004011', '00000000-0000-4000-8000-000000004000', '00000000-0000-4000-8000-000000004001', 'custody-other-owner@example.test', 'Other Owner', 'owner', 'active');

insert into public.order_workflow_statuses (
  store_id, code, label, short_label, bucket, enabled, allowed_for_create,
  is_default_create_status
) values
  ('00000000-0000-4000-8000-000000003000', 'new', 'New', 'New', 'intake', true, true, true),
  ('00000000-0000-4000-8000-000000003000', 'diagnosing', 'Diagnosing', 'Diag', 'diagnosing', true, false, false),
  ('00000000-0000-4000-8000-000000003000', 'completed', 'Completed', 'Done', 'done', true, false, false),
  ('00000000-0000-4000-8000-000000003000', 'cancelled', 'Cancelled', 'Cancel', 'cancelled', true, false, false),
  ('00000000-0000-4000-8000-000000003000', 'custom_done', 'Custom Done', 'Done', 'done', true, false, false),
  ('00000000-0000-4000-8000-000000003000', 'custom_cancelled', 'Custom Cancelled', 'Cancel', 'cancelled', true, false, false),
  ('00000000-0000-4000-8000-000000004000', 'completed', 'Completed', 'Done', 'done', true, false, false);

insert into public.customers (id, store_id, name, phone_e164, phone_raw) values
  ('00000000-0000-4000-8000-000000003020', '00000000-0000-4000-8000-000000003000', 'Custody Customer A', '+390000003020', '390000003020'),
  ('00000000-0000-4000-8000-000000004020', '00000000-0000-4000-8000-000000004000', 'Custody Customer B', '+390000004020', '390000004020');

insert into public.repair_orders (
  id, store_id, public_no, order_type, status, customer_id, issue_description,
  quotation_amount, deposit_amount, balance_amount, is_paid, approval_status,
  technician_name, assignee_membership_id, fault_prices, workflow_status,
  exception_status, payment_status, device_custody_status, device_unlock_method,
  device_unlock_value, device_unlock_pattern, completed_at, delivered_at,
  created_at, updated_at
) values
  ('00000000-0000-4000-8000-000000003101', '00000000-0000-4000-8000-000000003000', 'CUST-01', 'quick_repair', 'new', '00000000-0000-4000-8000-000000003020', 'Active shop', 0, 0, 0, false, 'pending', 'Custody Owner', '00000000-0000-4000-8000-000000003011', '[]', 'intake', null, 'unpaid', 'with_shop', 'pin', '1234', null, null, null, '2026-07-17T10:01:00Z', '2026-07-17T10:01:00Z'),
  ('00000000-0000-4000-8000-000000003102', '00000000-0000-4000-8000-000000003000', 'CUST-02', 'quick_repair', 'new', '00000000-0000-4000-8000-000000003020', 'Legacy unknown', 0, 0, 0, false, 'pending', 'Custody Owner', '00000000-0000-4000-8000-000000003011', '[]', 'intake', null, 'unpaid', null, null, null, null, null, null, '2026-07-17T10:02:00Z', '2026-07-17T10:02:00Z'),
  ('00000000-0000-4000-8000-000000003103', '00000000-0000-4000-8000-000000003000', 'CUST-03', 'quick_repair', 'completed', '00000000-0000-4000-8000-000000003020', 'Legacy terminal unknown', 0, 0, 0, false, 'pending', 'Custody Manager', '00000000-0000-4000-8000-000000003012', '[]', 'closed', null, 'unpaid', null, 'pin', '2468', null, '2026-07-17T09:03:00Z', null, '2026-07-17T10:03:00Z', '2026-07-17T10:03:00Z'),
  ('00000000-0000-4000-8000-000000003104', '00000000-0000-4000-8000-000000003000', 'CUST-04', 'quick_repair', 'cancelled', '00000000-0000-4000-8000-000000003020', 'Cancelled shop', 0, 0, 0, false, 'pending', 'Custody Owner', '00000000-0000-4000-8000-000000003011', '[]', 'closed', 'cancelled', 'unpaid', 'with_shop', 'pin', '1357', null, null, null, '2026-07-17T10:04:00Z', '2026-07-17T10:04:00Z'),
  ('00000000-0000-4000-8000-000000003105', '00000000-0000-4000-8000-000000003000', 'CUST-05', 'quick_repair', 'custom_cancelled', '00000000-0000-4000-8000-000000003020', 'Custom cancelled shop', 0, 0, 0, false, 'pending', 'Custody Owner', '00000000-0000-4000-8000-000000003011', '[]', 'repair', null, 'unpaid', 'with_shop', null, null, null, null, null, '2026-07-17T10:05:00Z', '2026-07-17T10:05:00Z'),
  ('00000000-0000-4000-8000-000000003106', '00000000-0000-4000-8000-000000003000', 'CUST-06', 'quick_repair', 'completed', '00000000-0000-4000-8000-000000003020', 'Completed customer', 0, 0, 0, false, 'pending', 'Custody Owner', '00000000-0000-4000-8000-000000003011', '[]', 'closed', null, 'unpaid', 'with_customer', null, null, null, '2026-07-17T09:06:00Z', '2026-07-17T09:06:00Z', '2026-07-17T10:06:00Z', '2026-07-17T10:06:00Z'),
  ('00000000-0000-4000-8000-000000003107', '00000000-0000-4000-8000-000000003000', 'CUST-07', 'quick_repair', 'completed', '00000000-0000-4000-8000-000000003020', 'Completed shop', 0, 0, 0, false, 'pending', 'Custody Owner', '00000000-0000-4000-8000-000000003011', '[]', 'closed', null, 'unpaid', 'with_shop', null, null, null, '2026-07-17T09:07:00Z', null, '2026-07-17T10:07:00Z', '2026-07-17T10:07:00Z'),
  ('00000000-0000-4000-8000-000000003108', '00000000-0000-4000-8000-000000003000', 'CUST-08', 'quick_repair', 'cancelled', '00000000-0000-4000-8000-000000003020', 'Cancelled unknown', 0, 0, 0, false, 'pending', 'Custody Owner', '00000000-0000-4000-8000-000000003011', '[]', 'closed', 'cancelled', 'unpaid', null, null, null, null, null, null, '2026-07-17T10:08:00Z', '2026-07-17T10:08:00Z'),
  ('00000000-0000-4000-8000-000000004101', '00000000-0000-4000-8000-000000004000', 'CUST-B1', 'quick_repair', 'completed', '00000000-0000-4000-8000-000000004020', 'Other store terminal', 0, 0, 0, false, 'pending', 'Other Owner', '00000000-0000-4000-8000-000000004011', '[]', 'closed', null, 'unpaid', null, null, null, null, '2026-07-17T09:09:00Z', null, '2026-07-17T11:09:00Z', '2026-07-17T11:09:00Z');

insert into public.repair_orders (
  id, store_id, public_no, order_type, status, customer_id, issue_description,
  quotation_amount, deposit_amount, balance_amount, is_paid, approval_status,
  technician_name, assignee_membership_id, fault_prices, workflow_status,
  payment_status, created_at, updated_at
) values (
  '00000000-0000-4000-8000-000000003109', '00000000-0000-4000-8000-000000003000',
  'CUST-09', 'quick_repair', 'new', '00000000-0000-4000-8000-000000003020',
  'Future default', 0, 0, 0, false, 'pending', 'Custody Owner',
  '00000000-0000-4000-8000-000000003011', '[]', 'intake', 'unpaid',
  '2026-07-17T10:09:00Z', '2026-07-17T10:09:00Z'
);

create temp table custody_results (
  label text primary key,
  payload jsonb,
  failed boolean
);
grant all on custody_results to service_role;

select is(
  (select device_custody_status from public.repair_orders where public_no = 'CUST-09'),
  'with_shop',
  'new rows receive the future shop default'
);
select is(
  (select device_custody_status from public.repair_orders where public_no = 'CUST-02'),
  null,
  'legacy explicit null remains unknown'
);

do $$
begin
  begin
    insert into public.repair_orders (
      id, store_id, public_no, order_type, status, customer_id, issue_description,
      quotation_amount, deposit_amount, balance_amount, is_paid, approval_status,
      technician_name, assignee_membership_id, fault_prices, workflow_status,
      payment_status, device_custody_status, device_unlock_method, device_unlock_value,
      created_at, updated_at
    ) values (
      '00000000-0000-4000-8000-000000003110',
      '00000000-0000-4000-8000-000000003000', 'CUST-10', 'quick_repair', 'new',
      '00000000-0000-4000-8000-000000003020', 'Invalid customer secret', 0, 0, 0,
      false, 'pending', 'Custody Owner', '00000000-0000-4000-8000-000000003011',
      '[]', 'intake', 'unpaid', 'with_customer', 'pin', '9999', now(), now()
    );
    insert into custody_results values ('customer_secret_constraint', null, false);
  exception when check_violation then
    insert into custody_results values ('customer_secret_constraint', null, true);
  end;
end;
$$;
select ok(
  (select failed from custody_results where label = 'customer_secret_constraint'),
  'customer custody cannot retain unlock credentials'
);

set local role service_role;
insert into custody_results (label, payload)
select 'active_handover', public.repairdesk_apply_order_atomic_mutation(
  '00000000-0000-4000-8000-000000003000',
  '00000000-0000-4000-8000-000000003101',
  '00000000-0000-4000-8000-000000003001',
  '2026-07-17T10:01:00Z',
  jsonb_build_object(
    'device_custody_status', 'with_customer',
    'delivered_at', '2026-07-17T10:01:30Z',
    'device_unlock_method', null,
    'device_unlock_value', null,
    'device_unlock_pattern', null
  ),
  'note',
  jsonb_build_object('action', 'device_custody_changed', 'reason', 'customer pickup'),
  '00000000-0000-4000-8000-000000003201'
);
insert into custody_results (label, payload)
select 'unknown_cancel', public.repairdesk_apply_order_atomic_mutation(
  '00000000-0000-4000-8000-000000003000',
  '00000000-0000-4000-8000-000000003102',
  '00000000-0000-4000-8000-000000003001',
  '2026-07-17T10:02:00Z',
  jsonb_build_object('status', 'custom_cancelled', 'workflow_status', 'closed'),
  'status_changed', jsonb_build_object('from', 'new', 'to', 'custom_cancelled'),
  '00000000-0000-4000-8000-000000003202'
);
insert into custody_results (label, payload)
select 'terminal_generic', public.repairdesk_apply_order_atomic_mutation(
  '00000000-0000-4000-8000-000000003000',
  '00000000-0000-4000-8000-000000003106',
  '00000000-0000-4000-8000-000000003001',
  '2026-07-17T10:06:00Z', jsonb_build_object('diagnosis_result', 'forbidden'),
  'note', jsonb_build_object('action', 'order_updated'),
  '00000000-0000-4000-8000-000000003203'
);
insert into custody_results (label, payload)
select 'cross_store_actor', public.repairdesk_correct_terminal_order_custody(
  '00000000-0000-4000-8000-000000003000',
  '00000000-0000-4000-8000-000000003103',
  '00000000-0000-4000-8000-000000004001',
  '2026-07-17T10:03:00Z', '00000000-0000-4000-8000-000000003204',
  'with_customer', 'cross store forbidden'
);
insert into custody_results (label, payload)
select 'null_terminal_target', public.repairdesk_correct_terminal_order_custody(
  '00000000-0000-4000-8000-000000003000',
  '00000000-0000-4000-8000-000000003103',
  '00000000-0000-4000-8000-000000003001',
  '2026-07-17T10:03:00Z', '00000000-0000-4000-8000-000000003205',
  null, 'null target forbidden'
);
insert into custody_results (label, payload)
select 'terminal_correction', public.repairdesk_correct_terminal_order_custody(
  '00000000-0000-4000-8000-000000003000',
  '00000000-0000-4000-8000-000000003103',
  '00000000-0000-4000-8000-000000003002',
  '2026-07-17T10:03:00Z', '00000000-0000-4000-8000-000000003206',
  'with_customer', 'legacy custody confirmed'
);
insert into custody_results (label, payload)
select 'terminal_back_to_shop', public.repairdesk_correct_terminal_order_custody(
  '00000000-0000-4000-8000-000000003000',
  '00000000-0000-4000-8000-000000003103',
  '00000000-0000-4000-8000-000000003002',
  (select updated_at from public.repair_orders where id = '00000000-0000-4000-8000-000000003103'),
  '00000000-0000-4000-8000-000000003207', 'with_shop', 'device returned to shop'
);
insert into custody_results (label, payload)
select 'cancelled_return', public.repairdesk_confirm_cancelled_order_return(
  '00000000-0000-4000-8000-000000003000',
  '00000000-0000-4000-8000-000000003104',
  '00000000-0000-4000-8000-000000003001',
  '2026-07-17T10:04:00Z', '00000000-0000-4000-8000-000000003208'
);
insert into custody_results (label, payload)
select 'cancelled_return_replay', public.repairdesk_confirm_cancelled_order_return(
  '00000000-0000-4000-8000-000000003000',
  '00000000-0000-4000-8000-000000003104',
  '00000000-0000-4000-8000-000000003001',
  '2026-07-17T10:04:00Z', '00000000-0000-4000-8000-000000003208'
);
insert into custody_results (label, payload)
select 'custom_cancelled_return', public.repairdesk_confirm_cancelled_order_return(
  '00000000-0000-4000-8000-000000003000',
  '00000000-0000-4000-8000-000000003105',
  '00000000-0000-4000-8000-000000003001',
  '2026-07-17T10:05:00Z', '00000000-0000-4000-8000-000000003209'
);
reset role;

select is((select payload->>'code' from custody_results where label = 'active_handover'), 'updated', 'active handover uses generic atomic mutation');
select is((select device_custody_status from public.repair_orders where public_no = 'CUST-01'), 'with_customer', 'active handover updates custody');
select ok((select device_unlock_method is null and device_unlock_value is null from public.repair_orders where public_no = 'CUST-01'), 'active handover clears credentials');
select is((select payload->>'code' from custody_results where label = 'unknown_cancel'), 'custody_unknown', 'custom cancellation rejects unknown custody');
select is((select payload->>'code' from custody_results where label = 'terminal_generic'), 'terminal_operation_required', 'generic mutation rejects terminal orders');
select is((select payload->>'code' from custody_results where label = 'cross_store_actor'), 'actor_forbidden', 'cross-store actor cannot correct terminal custody');
select is((select payload->>'code' from custody_results where label = 'null_terminal_target'), 'invalid_custody_status', 'terminal correction rejects null custody');
select is((select payload->>'code' from custody_results where label = 'terminal_correction'), 'recorded', 'manager records terminal custody correction');
select is((select device_custody_status from public.repair_orders where public_no = 'CUST-03'), 'with_customer', 'terminal correction updates custody');
select is((select delivered_at from public.repair_orders where public_no = 'CUST-03'), null, 'legacy correction does not invent delivery time');
select ok((select device_unlock_method is null and device_unlock_value is null from public.repair_orders where public_no = 'CUST-03'), 'terminal correction clears credentials');
select is((select count(*) from public.order_terminal_operations where idempotency_key = '00000000-0000-4000-8000-000000003206'), 1::bigint, 'terminal correction writes one ledger row');
select is((select payload->>'code' from custody_results where label = 'terminal_back_to_shop'), 'terminal_reopen_required', 'completed device cannot return to shop without reopen');
select is((select payload->>'code' from custody_results where label = 'cancelled_return'), 'recorded', 'cancelled return records atomically');
select ok((select device_custody_status = 'with_customer' and delivered_at is not null and completed_at is not null from public.repair_orders where public_no = 'CUST-04'), 'cancelled return updates custody timestamps');
select ok((select device_unlock_method is null and device_unlock_value is null from public.repair_orders where public_no = 'CUST-04'), 'cancelled return clears credentials');
select is((select count(*) from public.order_terminal_operations where idempotency_key = '00000000-0000-4000-8000-000000003208'), 1::bigint, 'cancelled return writes one ledger row');
select is((select payload->>'code' from custody_results where label = 'cancelled_return_replay'), 'idempotent_replay', 'cancelled return replay is idempotent');
select is((select payload->>'code' from custody_results where label = 'custom_cancelled_return'), 'recorded', 'custom cancelled bucket uses return RPC');
select is((select device_custody_status from public.repair_orders where public_no = 'CUST-05'), 'with_customer', 'custom cancelled return updates custody');

do $$
begin
  begin
    update public.repair_orders set device_custody_status = 'with_shop'
    where id = '00000000-0000-4000-8000-000000003106';
    insert into custody_results values ('direct_terminal_mutation', null, false);
  exception when others then
    insert into custody_results values ('direct_terminal_mutation', null, true);
  end;
end;
$$;
select ok((select failed from custody_results where label = 'direct_terminal_mutation'), 'direct terminal custody mutation is blocked');

set local role service_role;
do $$
begin
  begin
    perform public.repairdesk_reopen_terminal_order(
      '00000000-0000-4000-8000-000000003000',
      '00000000-0000-4000-8000-000000003106',
      '00000000-0000-4000-8000-000000003002',
      '2026-07-17T10:06:00Z', '00000000-0000-4000-8000-000000003210',
      'diagnosing', 'customer device cannot diagnose'
    );
    insert into custody_results values ('reopen_customer_physical', null, false);
  exception when others then
    insert into custody_results values ('reopen_customer_physical', null, true);
  end;
  begin
    perform public.repairdesk_void_order(
      '00000000-0000-4000-8000-000000003000',
      '00000000-0000-4000-8000-000000003107',
      '00000000-0000-4000-8000-000000003001',
      '2026-07-17T10:07:00Z', '00000000-0000-4000-8000-000000003211',
      'shop device cannot be voided', 'CUST-07'
    );
    insert into custody_results values ('void_shop', null, false);
  exception when others then
    insert into custody_results values ('void_shop', null, true);
  end;
  begin
    perform public.repairdesk_void_order(
      '00000000-0000-4000-8000-000000003000',
      '00000000-0000-4000-8000-000000003108',
      '00000000-0000-4000-8000-000000003001',
      '2026-07-17T10:08:00Z', '00000000-0000-4000-8000-000000003212',
      'unknown device cannot be voided', 'CUST-08'
    );
    insert into custody_results values ('void_unknown', null, false);
  exception when others then
    insert into custody_results values ('void_unknown', null, true);
  end;
end;
$$;
insert into custody_results (label, payload)
select 'reopen_shop', public.repairdesk_reopen_terminal_order(
  '00000000-0000-4000-8000-000000003000',
  '00000000-0000-4000-8000-000000003107',
  '00000000-0000-4000-8000-000000003002',
  '2026-07-17T10:07:00Z', '00000000-0000-4000-8000-000000003213',
  'diagnosing', 'shop device enters diagnosis'
);
insert into custody_results (label, payload)
select 'void_customer', public.repairdesk_void_order(
  '00000000-0000-4000-8000-000000003000',
  '00000000-0000-4000-8000-000000003106',
  '00000000-0000-4000-8000-000000003001',
  '2026-07-17T10:06:00Z', '00000000-0000-4000-8000-000000003214',
  'duplicate completed order', 'CUST-06'
);
reset role;

select ok((select failed from custody_results where label = 'reopen_customer_physical'), 'customer-held device cannot reopen into physical work');
select ok((select failed from custody_results where label = 'void_shop'), 'shop-held device cannot be voided');
select ok((select failed from custody_results where label = 'void_unknown'), 'unknown custody cannot be voided');
select is((select payload->>'code' from custody_results where label = 'reopen_shop'), 'recorded', 'shop-held device can reopen into diagnosis');
select is((select status from public.repair_orders where public_no = 'CUST-07'), 'diagnosing', 'successful reopen updates status');
select is((select payload->>'code' from custody_results where label = 'void_customer'), 'recorded', 'customer-held terminal order can be voided');
select is((select record_state from public.repair_orders where public_no = 'CUST-06'), 'voided', 'successful void updates lifecycle state');

do $$
begin
  begin
    update public.repair_orders set issue_description = 'forbidden void edit'
    where id = '00000000-0000-4000-8000-000000003106';
    insert into custody_results values ('voided_immutable', null, false);
  exception when others then
    insert into custody_results values ('voided_immutable', null, true);
  end;
end;
$$;
select ok((select failed from custody_results where label = 'voided_immutable'), 'voided custody record remains immutable');

select * from finish();
rollback;
