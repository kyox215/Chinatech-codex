begin;

create extension if not exists pgtap with schema extensions;
select plan(102);

select has_table('public', 'order_terminal_operations', 'terminal operation ledger exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.order_terminal_operations'::regclass),
  'terminal operation ledger has RLS enabled'
);
select ok(
  not has_function_privilege(
    'anon',
    to_regprocedure('public.repairdesk_apply_terminal_operation(uuid,uuid,uuid,timestamptz,uuid,text,text,jsonb,text,text)'),
    'execute'
  ),
  'anon cannot execute the terminal operation RPC'
);
select ok(
  not has_function_privilege(
    'authenticated',
    to_regprocedure('public.repairdesk_apply_terminal_operation(uuid,uuid,uuid,timestamptz,uuid,text,text,jsonb,text,text)'),
    'execute'
  ),
  'authenticated cannot execute the terminal operation RPC'
);
select ok(
  has_function_privilege(
    'service_role',
    to_regprocedure('public.repairdesk_correct_terminal_order(uuid,uuid,uuid,timestamptz,uuid,jsonb,text)'),
    'execute'
  ),
  'service role can execute terminal correction'
);
select ok(
  has_function_privilege(
    'service_role',
    to_regprocedure('public.repairdesk_reopen_terminal_order(uuid,uuid,uuid,timestamptz,uuid,text,text)'),
    'execute'
  ),
  'service role can execute terminal reopen'
);
select ok(
  has_function_privilege(
    'service_role',
    to_regprocedure('public.repairdesk_void_order(uuid,uuid,uuid,timestamptz,uuid,text,text)'),
    'execute'
  ),
  'service role can execute safe void'
);
select ok(
  has_function_privilege(
    'service_role',
    to_regprocedure('public.repairdesk_confirm_cancelled_order_return(uuid,uuid,uuid,timestamptz,uuid)'),
    'execute'
  ),
  'service role can execute cancelled return confirmation'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.repair_orders'::regclass
      and tgname = 'repairdesk_protect_voided_order_trigger'
      and not tgisinternal
  ),
  'terminal order protection trigger exists'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.order_data_batches'::regclass
      and tgname = 'repairdesk_protect_terminal_order_data_batch_trigger'
      and not tgisinternal
  ),
  'terminal batch protection trigger exists'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.customer_interactions'::regclass
      and conname = 'customer_interactions_order_same_store_fkey'
      and convalidated
  ),
  'customer interaction same-store order FK is validated'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.customer_followups'::regclass
      and conname = 'customer_followups_order_same_store_fkey'
      and convalidated
  ),
  'customer followup same-store order FK is validated'
);
select ok(
  pg_catalog.strpos(
    pg_get_functiondef(
      to_regprocedure('public.repairdesk_record_order_payment(uuid,uuid,uuid,numeric,text,timestamptz,uuid)')
    ),
    'v_workflow_bucket = ''cancelled'''
  ) > 0
  and pg_catalog.strpos(
    pg_get_functiondef(
      to_regprocedure('public.repairdesk_record_order_payment(uuid,uuid,uuid,numeric,text,timestamptz,uuid)')
    ),
    'v_order.record_state::text <> ''active'''
  ) > 0,
  'final payment RPC contains catalog-cancelled and lifecycle guards'
);

insert into auth.users (id, email, created_at, updated_at) values
  ('00000000-0000-4000-8000-000000001001', 'lifecycle-owner@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000001002', 'lifecycle-manager@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000001003', 'lifecycle-tech@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000001004', 'lifecycle-viewer@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000002001', 'lifecycle-other-owner@example.test', now(), now());

insert into public.stores (id, store_code, name, slug, status) values
  ('00000000-0000-4000-8000-000000001000', 'LIFECYCLE_A', 'Lifecycle Store A', 'lifecycle-store-a', 'active'),
  ('00000000-0000-4000-8000-000000002000', 'LIFECYCLE_B', 'Lifecycle Store B', 'lifecycle-store-b', 'active');

insert into public.staff_profiles (id, email, display_name, role, status) values
  ('00000000-0000-4000-8000-000000001001', 'lifecycle-owner@example.test', 'Lifecycle Owner', 'owner', 'active'),
  ('00000000-0000-4000-8000-000000001002', 'lifecycle-manager@example.test', 'Lifecycle Manager', 'manager', 'active'),
  ('00000000-0000-4000-8000-000000001003', 'lifecycle-tech@example.test', 'Lifecycle Tech', 'technician', 'active'),
  ('00000000-0000-4000-8000-000000001004', 'lifecycle-viewer@example.test', 'Lifecycle Viewer', 'viewer', 'active'),
  ('00000000-0000-4000-8000-000000002001', 'lifecycle-other-owner@example.test', 'Other Owner', 'owner', 'active');

insert into public.store_memberships (id, store_id, user_id, email, display_name, role, status) values
  ('00000000-0000-4000-8000-000000001011', '00000000-0000-4000-8000-000000001000', '00000000-0000-4000-8000-000000001001', 'lifecycle-owner@example.test', 'Lifecycle Owner', 'owner', 'active'),
  ('00000000-0000-4000-8000-000000001012', '00000000-0000-4000-8000-000000001000', '00000000-0000-4000-8000-000000001002', 'lifecycle-manager@example.test', 'Lifecycle Manager', 'manager', 'active'),
  ('00000000-0000-4000-8000-000000001013', '00000000-0000-4000-8000-000000001000', '00000000-0000-4000-8000-000000001003', 'lifecycle-tech@example.test', 'Lifecycle Tech', 'technician', 'active'),
  ('00000000-0000-4000-8000-000000001014', '00000000-0000-4000-8000-000000001000', '00000000-0000-4000-8000-000000001004', 'lifecycle-viewer@example.test', 'Lifecycle Viewer', 'viewer', 'active'),
  ('00000000-0000-4000-8000-000000002011', '00000000-0000-4000-8000-000000002000', '00000000-0000-4000-8000-000000002001', 'lifecycle-other-owner@example.test', 'Other Owner', 'owner', 'active');

insert into public.order_workflow_statuses (
  store_id, code, label, short_label, bucket, enabled, allowed_for_create, is_default_create_status
) values
  ('00000000-0000-4000-8000-000000001000', 'new', 'New', 'New', 'intake', true, true, true),
  ('00000000-0000-4000-8000-000000001000', 'diagnosing', 'Diagnosing', 'Diag', 'diagnosing', true, false, false),
  ('00000000-0000-4000-8000-000000001000', 'completed', 'Completed', 'Done', 'done', true, false, false),
  ('00000000-0000-4000-8000-000000001000', 'cancelled', 'Cancelled', 'Cancel', 'cancelled', true, false, false),
  ('00000000-0000-4000-8000-000000001000', 'custom_active', 'Custom Active', 'Active', 'custom', true, false, false),
  ('00000000-0000-4000-8000-000000001000', 'custom_done', 'Custom Done', 'Done', 'done', true, false, false),
  ('00000000-0000-4000-8000-000000001000', 'custom_cancelled', 'Custom Cancelled', 'Cancel', 'cancelled', true, false, false),
  ('00000000-0000-4000-8000-000000002000', 'new', 'New', 'New', 'intake', true, true, true),
  ('00000000-0000-4000-8000-000000002000', 'completed', 'Completed', 'Done', 'done', true, false, false);

insert into public.customers (id, store_id, name, phone_e164, phone_raw) values
  ('00000000-0000-4000-8000-000000001020', '00000000-0000-4000-8000-000000001000', 'Lifecycle Customer A', '+390000001020', '390000001020'),
  ('00000000-0000-4000-8000-000000002020', '00000000-0000-4000-8000-000000002000', 'Lifecycle Customer B', '+390000002020', '390000002020');

insert into public.repair_orders (
  id, store_id, public_no, order_type, status, customer_id, issue_description,
  diagnosis_result, quotation_amount, deposit_amount, balance_amount, is_paid,
  approval_status, technician_name, assignee_membership_id, fault_prices,
  workflow_status, exception_status, payment_status, pause_reason,
  completed_at, delivered_at, created_at, updated_at
) values
  ('00000000-0000-4000-8000-000000001101', '00000000-0000-4000-8000-000000001000', 'LIFE-0001', 'quick_repair', 'completed', '00000000-0000-4000-8000-000000001020', 'Screen', 'Old diagnosis', 90, 0, 90, false, 'pending', 'Lifecycle Manager', '00000000-0000-4000-8000-000000001012', '[]', 'closed', null, 'unpaid', 'old pause', '2026-07-16T10:00:00Z', '2026-07-16T10:00:00Z', '2026-07-16T10:00:00Z', '2026-07-16T10:00:00Z'),
  ('00000000-0000-4000-8000-000000001102', '00000000-0000-4000-8000-000000001000', 'LIFE-0002', 'quick_repair', 'cancelled', '00000000-0000-4000-8000-000000001020', 'Cancelled assigned', null, 90, 0, 90, false, 'pending', 'Lifecycle Tech', '00000000-0000-4000-8000-000000001013', '[]', 'closed', 'cancelled', 'unpaid', null, null, null, '2026-07-16T10:02:00Z', '2026-07-16T10:02:00Z'),
  ('00000000-0000-4000-8000-000000001103', '00000000-0000-4000-8000-000000001000', 'LIFE-0003', 'quick_repair', 'completed', '00000000-0000-4000-8000-000000001020', 'Pristine duplicate', null, 40, 0, 40, false, 'pending', 'Lifecycle Owner', '00000000-0000-4000-8000-000000001011', '[]', 'closed', null, 'unpaid', null, '2026-07-16T10:03:00Z', '2026-07-16T10:03:00Z', '2026-07-16T10:03:00Z', '2026-07-16T10:03:00Z'),
  ('00000000-0000-4000-8000-000000001104', '00000000-0000-4000-8000-000000001000', 'LIFE-0004', 'quick_repair', 'completed', '00000000-0000-4000-8000-000000001020', 'Paid evidence', null, 60, 20, 40, false, 'pending', 'Lifecycle Owner', '00000000-0000-4000-8000-000000001011', '[]', 'closed', null, 'partial', null, '2026-07-16T10:04:00Z', '2026-07-16T10:04:00Z', '2026-07-16T10:04:00Z', '2026-07-16T10:04:00Z'),
  ('00000000-0000-4000-8000-000000001105', '00000000-0000-4000-8000-000000001000', 'LIFE-0005', 'quick_repair', 'custom_active', '00000000-0000-4000-8000-000000001020', 'Custom active', null, 30, 0, 30, false, 'pending', 'Lifecycle Owner', '00000000-0000-4000-8000-000000001011', '[]', 'closed', null, 'unpaid', null, null, null, '2026-07-16T10:05:00Z', '2026-07-16T10:05:00Z'),
  ('00000000-0000-4000-8000-000000001106', '00000000-0000-4000-8000-000000001000', 'LIFE-0006', 'quick_repair', 'custom_done', '00000000-0000-4000-8000-000000001020', 'Custom done', null, 50, 40, 10, false, 'pending', 'Lifecycle Owner', '00000000-0000-4000-8000-000000001011', '[]', 'repair', null, 'partial', null, '2026-07-16T10:06:00Z', '2026-07-16T10:06:00Z', '2026-07-16T10:06:00Z', '2026-07-16T10:06:00Z'),
  ('00000000-0000-4000-8000-000000001107', '00000000-0000-4000-8000-000000001000', 'LIFE-0007', 'quick_repair', 'custom_cancelled', '00000000-0000-4000-8000-000000001020', 'Custom cancelled', null, 999, 0, 999, false, 'pending', 'Lifecycle Owner', '00000000-0000-4000-8000-000000001011', '[]', 'repair', null, 'unpaid', null, null, null, '2026-07-16T10:07:00Z', '2026-07-16T10:07:00Z'),
  ('00000000-0000-4000-8000-000000001108', '00000000-0000-4000-8000-000000001000', 'LIFE-0008', 'quick_repair', 'cancelled', '00000000-0000-4000-8000-000000001020', 'Cancelled unassigned', null, 0, 0, 0, false, 'pending', 'Lifecycle Owner', '00000000-0000-4000-8000-000000001011', '[]', 'closed', 'cancelled', 'unpaid', null, null, null, '2026-07-16T10:08:00Z', '2026-07-16T10:08:00Z'),
  ('00000000-0000-4000-8000-000000001109', '00000000-0000-4000-8000-000000001000', 'LIFE-0009', 'quick_repair', 'cancelled', '00000000-0000-4000-8000-000000001020', 'Cancelled rollback', null, 0, 0, 0, false, 'pending', 'Lifecycle Tech', '00000000-0000-4000-8000-000000001013', '[]', 'closed', 'cancelled', 'unpaid', null, null, null, '2026-07-16T10:09:00Z', '2026-07-16T10:09:00Z'),
  ('00000000-0000-4000-8000-000000001110', '00000000-0000-4000-8000-000000001000', 'LIFE-0010', 'quick_repair', 'completed', '00000000-0000-4000-8000-000000001020', 'Ledger evidence', null, 25, 0, 25, false, 'pending', 'Lifecycle Owner', '00000000-0000-4000-8000-000000001011', '[]', 'closed', null, 'unpaid', null, '2026-07-16T10:10:00Z', '2026-07-16T10:10:00Z', '2026-07-16T10:10:00Z', '2026-07-16T10:10:00Z'),
  ('00000000-0000-4000-8000-000000002101', '00000000-0000-4000-8000-000000002000', 'LIFE-B001', 'quick_repair', 'completed', '00000000-0000-4000-8000-000000002020', 'Other store', null, 777, 0, 777, false, 'pending', 'Other Owner', '00000000-0000-4000-8000-000000002011', '[]', 'closed', null, 'unpaid', null, '2026-07-16T11:00:00Z', '2026-07-16T11:00:00Z', '2026-07-16T11:00:00Z', '2026-07-16T11:00:00Z');

insert into public.order_payment_ledger (
  id, store_id, order_id, idempotency_key, actor_id, actor_name_snapshot,
  entry_type, amount, payment_method, currency_code, balance_before, balance_after,
  order_updated_at_before, order_updated_at_after
) values (
  '00000000-0000-4000-8000-000000001210',
  '00000000-0000-4000-8000-000000001000',
  '00000000-0000-4000-8000-000000001110',
  '00000000-0000-4000-8000-000000001211',
  '00000000-0000-4000-8000-000000001001',
  'Lifecycle Owner', 'collection', 5, 'cash', 'EUR', 30, 25,
  '2026-07-16T10:09:59Z', '2026-07-16T10:10:00Z'
);

create temporary table lifecycle_results (
  label text primary key,
  payload jsonb,
  failed boolean
) on commit drop;
grant all on table lifecycle_results to service_role;

create temporary table lifecycle_versions (
  label text primary key,
  updated_at timestamptz not null
) on commit drop;
grant all on table lifecycle_versions to service_role;

set local role service_role;
insert into lifecycle_results (label, payload)
select 'v3_before', public.repairdesk_customer_list_page_v3(
  '00000000-0000-4000-8000-000000001000', null, null, 'all', 'all', 'all', 1, 50
);
insert into lifecycle_results (label, payload)
select 'v2_work_before', public.repairdesk_customer_list_page_v2(
  '00000000-0000-4000-8000-000000001000', null, null, 'all', 'all', 'all', 1, 50
);
insert into lifecycle_results (label, payload)
select 'v2_legacy_before', public.repairdesk_customer_list_page_v2(
  '00000000-0000-4000-8000-000000001000', null, null, 'all', 'all', 1, 50
);
reset role;

select is((select (payload#>>'{items,0,order_count}')::integer from lifecycle_results where label = 'v3_before'), 10, 'v3 preserves all historical orders in order_count');
select is((select (payload#>>'{items,0,valid_order_count}')::integer from lifecycle_results where label = 'v3_before'), 6, 'v3 counts only valid billable orders');
select is((select (payload#>>'{items,0,last_order_at}')::timestamptz from lifecycle_results where label = 'v3_before'), '2026-07-16T10:10:00Z'::timestamptz, 'v3 preserves the latest historical order timestamp');
select is((select (payload#>>'{items,0,valid_order_count}')::integer from lifecycle_results where label = 'v2_work_before'), 6, 'work-filter v2 overload follows the final v3 contract');
select is((select (payload#>>'{items,0,valid_order_count}')::integer from lifecycle_results where label = 'v2_legacy_before'), 6, 'legacy v2 overload follows the final v3 contract');
select is((select (payload#>>'{items,0,active_order_count}')::integer from lifecycle_results where label = 'v3_before'), 1, 'v3 treats the custom active bucket as active despite stale canonical closed');
select is((select (payload#>>'{items,0,lifetime_quoted_amount}')::numeric from lifecycle_results where label = 'v3_before'), 295::numeric, 'v3 lifetime quote excludes cancelled buckets and remains tenant scoped');
select is((select (payload#>>'{items,0,outstanding_amount}')::numeric from lifecycle_results where label = 'v3_before'), 235::numeric, 'v3 outstanding amount uses valid positive balances');
select is((select (payload#>>'{stats,activeRepairs}')::integer from lifecycle_results where label = 'v3_before'), 1, 'v3 active repair stats use bucket precedence');
select is((select (payload->>'total')::integer from lifecycle_results where label = 'v3_before'), 1, 'v3 customer page is scoped to one store');

set local role service_role;
insert into lifecycle_results (label, payload)
select 'correct_recorded', public.repairdesk_correct_terminal_order(
  '00000000-0000-4000-8000-000000001000', '00000000-0000-4000-8000-000000001101',
  '00000000-0000-4000-8000-000000001002', '2026-07-16T10:00:00Z',
  '00000000-0000-4000-8000-000000001301',
  '{"diagnosis_result":"New diagnosis","warranty_months":12,"warranty_text":"12个月","warranty_change_reason":"客户购买延保"}',
  '修正诊断和质保记录'
);
insert into lifecycle_results (label, payload)
select 'correct_replay', public.repairdesk_correct_terminal_order(
  '00000000-0000-4000-8000-000000001000', '00000000-0000-4000-8000-000000001101',
  '00000000-0000-4000-8000-000000001002', '2026-07-16T10:00:00Z',
  '00000000-0000-4000-8000-000000001301',
  '{"diagnosis_result":"New diagnosis","warranty_months":12,"warranty_text":"12个月","warranty_change_reason":"客户购买延保"}',
  '修正诊断和质保记录'
);
insert into lifecycle_results (label, payload)
select 'correct_conflict', public.repairdesk_correct_terminal_order(
  '00000000-0000-4000-8000-000000001000', '00000000-0000-4000-8000-000000001101',
  '00000000-0000-4000-8000-000000001002', '2026-07-16T10:00:00Z',
  '00000000-0000-4000-8000-000000001301', '{"diagnosis_result":"Other"}', '不同请求内容'
);
insert into lifecycle_results (label, payload)
select 'correct_viewer', public.repairdesk_correct_terminal_order(
  '00000000-0000-4000-8000-000000001000', '00000000-0000-4000-8000-000000001101',
  '00000000-0000-4000-8000-000000001004',
  (select updated_at from public.repair_orders where id = '00000000-0000-4000-8000-000000001101'),
  '00000000-0000-4000-8000-000000001302', '{"diagnosis_result":"Viewer"}', '查看者不能纠正'
);
insert into lifecycle_results (label, payload)
select 'correct_stale', public.repairdesk_correct_terminal_order(
  '00000000-0000-4000-8000-000000001000', '00000000-0000-4000-8000-000000001101',
  '00000000-0000-4000-8000-000000001002', '2026-07-16T10:00:00Z',
  '00000000-0000-4000-8000-000000001303', '{"diagnosis_result":"Stale"}', '过期版本纠正'
);
insert into lifecycle_results (label, payload)
select 'correct_finance', public.repairdesk_correct_terminal_order(
  '00000000-0000-4000-8000-000000001000', '00000000-0000-4000-8000-000000001101',
  '00000000-0000-4000-8000-000000001002',
  (select updated_at from public.repair_orders where id = '00000000-0000-4000-8000-000000001101'),
  '00000000-0000-4000-8000-000000001304', '{"quotation_amount":0}', '禁止修改财务字段'
);
insert into lifecycle_results (label, payload)
select 'custom_active_terminal', public.repairdesk_correct_terminal_order(
  '00000000-0000-4000-8000-000000001000', '00000000-0000-4000-8000-000000001105',
  '00000000-0000-4000-8000-000000001002', '2026-07-16T10:05:00Z',
  '00000000-0000-4000-8000-000000001305', '{"diagnosis_result":"Should fail"}', '自定义活动状态不可纠正'
);
insert into lifecycle_results (label, payload)
select 'custom_done_terminal', public.repairdesk_correct_terminal_order(
  '00000000-0000-4000-8000-000000001000', '00000000-0000-4000-8000-000000001106',
  '00000000-0000-4000-8000-000000001002', '2026-07-16T10:06:00Z',
  '00000000-0000-4000-8000-000000001306', '{"diagnosis_result":"Custom done corrected"}', '纠正自定义完成状态'
);
reset role;

select is((select payload->>'code' from lifecycle_results where label = 'correct_recorded'), 'recorded', 'manager correction records atomically');
select is((select diagnosis_result from public.repair_orders where id = '00000000-0000-4000-8000-000000001101'), 'New diagnosis', 'correction updates the allowed diagnosis field');
select is((select warranty_text from public.repair_orders where id = '00000000-0000-4000-8000-000000001101'), '12个月', 'correction stores a canonical warranty text');
select is((select warranty_changed_by from public.repair_orders where id = '00000000-0000-4000-8000-000000001101'), '00000000-0000-4000-8000-000000001002'::uuid, 'correction records the warranty actor');
select is((select count(*) from public.order_terminal_operations where order_id = '00000000-0000-4000-8000-000000001101' and operation_type = 'correction'), 1::bigint, 'correction writes one terminal operation');
select is((select count(*) from public.order_events where order_id = '00000000-0000-4000-8000-000000001101' and payload->>'action' = 'terminal_correction'), 1::bigint, 'correction writes one event');
select is((select count(*) from public.audit_logs where entity_id = '00000000-0000-4000-8000-000000001101' and action = 'order_terminal_correction'), 1::bigint, 'correction writes one audit record');
select ok((select before_data ? 'warranty_changed_by' and after_data ? 'warranty_changed_at' from public.order_terminal_operations where idempotency_key = '00000000-0000-4000-8000-000000001301'), 'warranty before and after evidence includes actor timestamps');
select is((select payload->>'code' from lifecycle_results where label = 'correct_replay'), 'idempotent_replay', 'same correction key replays');
select is((select count(*) from public.order_terminal_operations where idempotency_key = '00000000-0000-4000-8000-000000001301'), 1::bigint, 'correction replay does not duplicate evidence');
select is((select payload->>'code' from lifecycle_results where label = 'correct_conflict'), 'idempotency_conflict', 'same key with another correction conflicts');
select is((select payload->>'code' from lifecycle_results where label = 'correct_viewer'), 'actor_forbidden', 'viewer cannot correct terminal orders');
select is((select payload->>'code' from lifecycle_results where label = 'correct_stale'), 'stale_version', 'stale terminal correction is rejected');
select is((select payload->>'code' from lifecycle_results where label = 'correct_finance'), 'invalid_changes', 'terminal correction rejects finance fields');
select is((select payload->>'code' from lifecycle_results where label = 'custom_active_terminal'), 'invalid_state', 'custom active bucket overrides stale canonical closed');
select is((select payload->>'code' from lifecycle_results where label = 'custom_done_terminal'), 'recorded', 'custom done bucket is eligible for terminal correction');

set local role service_role;
insert into lifecycle_results (label, payload)
select 'payment_custom_cancelled', public.repairdesk_record_order_payment(
  '00000000-0000-4000-8000-000000001000', '00000000-0000-4000-8000-000000001107',
  '00000000-0000-4000-8000-000000001001', 10, 'cash', '2026-07-16T10:07:00Z',
  '00000000-0000-4000-8000-000000001601'
);
insert into lifecycle_versions (label, updated_at)
select 'custom_done', updated_at
from public.repair_orders
where id = '00000000-0000-4000-8000-000000001106';
insert into lifecycle_results (label, payload)
select 'payment_custom_done', public.repairdesk_record_order_payment(
  '00000000-0000-4000-8000-000000001000', '00000000-0000-4000-8000-000000001106',
  '00000000-0000-4000-8000-000000001001', 5, 'cash',
  (select updated_at from lifecycle_versions where label = 'custom_done'),
  '00000000-0000-4000-8000-000000001602'
);
insert into lifecycle_results (label, payload)
select 'payment_custom_done_replay', public.repairdesk_record_order_payment(
  '00000000-0000-4000-8000-000000001000', '00000000-0000-4000-8000-000000001106',
  '00000000-0000-4000-8000-000000001001', 5, 'cash',
  (select updated_at from lifecycle_versions where label = 'custom_done'),
  '00000000-0000-4000-8000-000000001602'
);
reset role;

select is((select payload->>'code' from lifecycle_results where label = 'payment_custom_cancelled'), 'order_cancelled', 'custom cancelled bucket rejects payment with a stable code');
select is((select count(*) from public.order_payment_ledger where idempotency_key = '00000000-0000-4000-8000-000000001601'), 0::bigint, 'custom cancelled payment writes no ledger row');
select is((select balance_amount from public.repair_orders where id = '00000000-0000-4000-8000-000000001107'), 999::numeric, 'custom cancelled payment leaves the order balance unchanged');
select is((select count(*) from public.order_events where order_id = '00000000-0000-4000-8000-000000001107' and event_type = 'payment'), 0::bigint, 'custom cancelled payment writes no event');
select is((select count(*) from public.audit_logs where entity_id = '00000000-0000-4000-8000-000000001107' and action = 'payment'), 0::bigint, 'custom cancelled payment writes no audit row');
select is((select payload->>'code' from lifecycle_results where label = 'payment_custom_done'), 'recorded', 'custom done order with a balance remains collectible');
select is((select payload->>'code' from lifecycle_results where label = 'payment_custom_done_replay'), 'idempotent_replay', 'custom done payment replay stays idempotent');
select is((select count(*) from public.order_payment_ledger where idempotency_key = '00000000-0000-4000-8000-000000001602'), 1::bigint, 'custom done payment writes one ledger row');
select is((select balance_amount from public.repair_orders where id = '00000000-0000-4000-8000-000000001106'), 5::numeric, 'custom done payment reduces the balance once');
select is((select count(*) from public.order_events where order_id = '00000000-0000-4000-8000-000000001106' and event_type = 'payment'), 1::bigint, 'custom done payment writes one event');
select is((select count(*) from public.audit_logs where entity_id = '00000000-0000-4000-8000-000000001106' and action = 'payment'), 1::bigint, 'custom done payment writes one audit row');

set local role service_role;
insert into lifecycle_results (label, payload)
select 'reopen_recorded', public.repairdesk_reopen_terminal_order(
  '00000000-0000-4000-8000-000000001000', '00000000-0000-4000-8000-000000001101',
  '00000000-0000-4000-8000-000000001002',
  (select updated_at from public.repair_orders where id = '00000000-0000-4000-8000-000000001101'),
  '00000000-0000-4000-8000-000000001307', 'diagnosing', '重新进入检测流程'
);
reset role;

select is((select payload->>'code' from lifecycle_results where label = 'reopen_recorded'), 'recorded', 'manager reopens a terminal order');
select is((select status from public.repair_orders where id = '00000000-0000-4000-8000-000000001101'), 'diagnosing', 'reopen changes the order status');
select is((select workflow_status from public.repair_orders where id = '00000000-0000-4000-8000-000000001101'), 'diagnosis', 'reopen restores the canonical workflow');
select is((select pause_reason from public.repair_orders where id = '00000000-0000-4000-8000-000000001101'), null, 'reopen clears a stale pause reason');
select ok((select completed_at is null and delivered_at is null from public.repair_orders where id = '00000000-0000-4000-8000-000000001101'), 'reopen clears terminal timestamps');
select is((select count(*) from public.order_terminal_operations where order_id = '00000000-0000-4000-8000-000000001101' and operation_type = 'reopen'), 1::bigint, 'reopen writes one terminal operation');

select pg_catalog.set_config('repairdesk.terminal_operation', '', true);
do $$
begin
  begin
    update public.repair_orders set diagnosis_result = 'Direct bypass' where id = '00000000-0000-4000-8000-000000001106';
    insert into lifecycle_results (label, failed) values ('direct_terminal_update', false);
  exception when others then
    insert into lifecycle_results (label, failed) values ('direct_terminal_update', true);
  end;
end;
$$;
select ok((select failed from lifecycle_results where label = 'direct_terminal_update'), 'direct terminal mutation is rejected by the trigger');

select pg_catalog.set_config('repairdesk.terminal_operation', '', true);
update public.repair_orders set diagnosis_result = 'Custom active update' where id = '00000000-0000-4000-8000-000000001105';
select is((select diagnosis_result from public.repair_orders where id = '00000000-0000-4000-8000-000000001105'), 'Custom active update', 'custom active bucket remains routinely editable');

select pg_catalog.set_config('repairdesk.terminal_operation', '', true);
do $$
begin
  begin
    update public.repair_orders set delivered_at = now() where id = '00000000-0000-4000-8000-000000001102';
    insert into lifecycle_results (label, failed) values ('direct_custody_update', false);
  exception when others then
    insert into lifecycle_results (label, failed) values ('direct_custody_update', true);
  end;
end;
$$;
select ok((select failed from lifecycle_results where label = 'direct_custody_update'), 'cancelled return timestamp cannot bypass the custody RPC');

set local role service_role;
insert into lifecycle_results (label, payload)
select 'custody_stale', public.repairdesk_confirm_cancelled_order_return(
  '00000000-0000-4000-8000-000000001000', '00000000-0000-4000-8000-000000001102',
  '00000000-0000-4000-8000-000000001003', '2026-07-16T10:01:00Z',
  '00000000-0000-4000-8000-000000001401'
);
insert into lifecycle_results (label, payload)
select 'custody_unassigned', public.repairdesk_confirm_cancelled_order_return(
  '00000000-0000-4000-8000-000000001000', '00000000-0000-4000-8000-000000001108',
  '00000000-0000-4000-8000-000000001003', '2026-07-16T10:08:00Z',
  '00000000-0000-4000-8000-000000001402'
);
insert into lifecycle_results (label, payload)
select 'custody_viewer', public.repairdesk_confirm_cancelled_order_return(
  '00000000-0000-4000-8000-000000001000', '00000000-0000-4000-8000-000000001102',
  '00000000-0000-4000-8000-000000001004', '2026-07-16T10:02:00Z',
  '00000000-0000-4000-8000-000000001403'
);
insert into lifecycle_results (label, payload)
select 'custody_cross_store', public.repairdesk_confirm_cancelled_order_return(
  '00000000-0000-4000-8000-000000001000', '00000000-0000-4000-8000-000000001102',
  '00000000-0000-4000-8000-000000002001', '2026-07-16T10:02:00Z',
  '00000000-0000-4000-8000-000000001404'
);
insert into lifecycle_results (label, payload)
select 'custody_recorded', public.repairdesk_confirm_cancelled_order_return(
  '00000000-0000-4000-8000-000000001000', '00000000-0000-4000-8000-000000001102',
  '00000000-0000-4000-8000-000000001003', '2026-07-16T10:02:00Z',
  '00000000-0000-4000-8000-000000001405'
);
insert into lifecycle_results (label, payload)
select 'custody_replay', public.repairdesk_confirm_cancelled_order_return(
  '00000000-0000-4000-8000-000000001000', '00000000-0000-4000-8000-000000001102',
  '00000000-0000-4000-8000-000000001003', '2026-07-16T10:02:00Z',
  '00000000-0000-4000-8000-000000001405'
);
insert into lifecycle_results (label, payload)
select 'custody_conflict', public.repairdesk_confirm_cancelled_order_return(
  '00000000-0000-4000-8000-000000001000', '00000000-0000-4000-8000-000000001102',
  '00000000-0000-4000-8000-000000001003', '2026-07-16T10:02:01Z',
  '00000000-0000-4000-8000-000000001405'
);
reset role;

select is((select payload->>'code' from lifecycle_results where label = 'custody_stale'), 'stale_version', 'custody return rejects a stale version');
select is((select payload->>'code' from lifecycle_results where label = 'custody_unassigned'), 'actor_forbidden', 'unassigned technician cannot confirm custody return');
select is((select payload->>'code' from lifecycle_results where label = 'custody_viewer'), 'actor_forbidden', 'viewer cannot confirm custody return');
select is((select payload->>'code' from lifecycle_results where label = 'custody_cross_store'), 'actor_forbidden', 'other-store owner cannot confirm custody return');
select is((select payload->>'code' from lifecycle_results where label = 'custody_recorded'), 'recorded', 'assigned technician confirms custody return atomically');
select ok((select completed_at is not null and delivered_at is not null from public.repair_orders where id = '00000000-0000-4000-8000-000000001102'), 'custody RPC records both custody timestamps');
select is((select count(*) from public.order_terminal_operations where idempotency_key = '00000000-0000-4000-8000-000000001405'), 1::bigint, 'custody RPC writes one terminal operation');
select is((select count(*) from public.order_events where order_id = '00000000-0000-4000-8000-000000001102' and payload->>'action' = 'custody_return_confirmed'), 1::bigint, 'custody RPC writes one event');
select is((select count(*) from public.audit_logs where entity_id = '00000000-0000-4000-8000-000000001102' and action = 'order_custody_return_confirmed'), 1::bigint, 'custody RPC writes one audit record');
select is((select payload->>'code' from lifecycle_results where label = 'custody_replay'), 'idempotent_replay', 'custody replay is idempotent');
select is((select payload->>'code' from lifecycle_results where label = 'custody_conflict'), 'idempotency_conflict', 'custody key conflict is rejected');

create function pg_temp.fail_custody_event()
returns trigger
language plpgsql
as $$
begin
  if new.order_id = '00000000-0000-4000-8000-000000001109'::uuid
     and new.payload->>'action' = 'custody_return_confirmed' then
    raise exception 'forced custody event failure';
  end if;
  return new;
end;
$$;
create trigger lifecycle_custody_event_failure
before insert on public.order_events
for each row execute function pg_temp.fail_custody_event();

set local role service_role;
do $$
begin
  begin
    perform public.repairdesk_confirm_cancelled_order_return(
      '00000000-0000-4000-8000-000000001000', '00000000-0000-4000-8000-000000001109',
      '00000000-0000-4000-8000-000000001003', '2026-07-16T10:09:00Z',
      '00000000-0000-4000-8000-000000001406'
    );
    insert into lifecycle_results (label, failed) values ('custody_forced_failure', false);
  exception when others then
    insert into lifecycle_results (label, failed) values ('custody_forced_failure', true);
  end;
end;
$$;
reset role;

select ok((select failed from lifecycle_results where label = 'custody_forced_failure'), 'custody event failure aborts the RPC statement');
select ok((select completed_at is null and delivered_at is null from public.repair_orders where id = '00000000-0000-4000-8000-000000001109'), 'custody event failure rolls timestamps back');
select is((select count(*) from public.order_terminal_operations where idempotency_key = '00000000-0000-4000-8000-000000001406'), 0::bigint, 'custody event failure rolls the operation back');
select is((select count(*) from public.audit_logs where entity_id = '00000000-0000-4000-8000-000000001109' and action = 'order_custody_return_confirmed'), 0::bigint, 'custody event failure leaves no audit row');
drop trigger lifecycle_custody_event_failure on public.order_events;

set local role service_role;
insert into lifecycle_results (label, payload)
select 'void_manager', public.repairdesk_void_order(
  '00000000-0000-4000-8000-000000001000', '00000000-0000-4000-8000-000000001103',
  '00000000-0000-4000-8000-000000001002', '2026-07-16T10:03:00Z',
  '00000000-0000-4000-8000-000000001501', '重复订单需要作废', 'LIFE-0003'
);
insert into lifecycle_results (label, payload)
select 'void_confirmation', public.repairdesk_void_order(
  '00000000-0000-4000-8000-000000001000', '00000000-0000-4000-8000-000000001103',
  '00000000-0000-4000-8000-000000001001', '2026-07-16T10:03:00Z',
  '00000000-0000-4000-8000-000000001502', '重复订单需要作废', 'WRONG'
);
insert into lifecycle_results (label, payload)
select 'void_paid', public.repairdesk_void_order(
  '00000000-0000-4000-8000-000000001000', '00000000-0000-4000-8000-000000001104',
  '00000000-0000-4000-8000-000000001001', '2026-07-16T10:04:00Z',
  '00000000-0000-4000-8000-000000001503', '存在定金不可作废', 'LIFE-0004'
);
insert into lifecycle_results (label, payload)
select 'void_ledger', public.repairdesk_void_order(
  '00000000-0000-4000-8000-000000001000', '00000000-0000-4000-8000-000000001110',
  '00000000-0000-4000-8000-000000001001', '2026-07-16T10:10:00Z',
  '00000000-0000-4000-8000-000000001504', '存在流水不可作废', 'LIFE-0010'
);
insert into lifecycle_results (label, payload)
select 'void_recorded', public.repairdesk_void_order(
  '00000000-0000-4000-8000-000000001000', '00000000-0000-4000-8000-000000001103',
  '00000000-0000-4000-8000-000000001001', '2026-07-16T10:03:00Z',
  '00000000-0000-4000-8000-000000001505', '重复订单需要安全作废', 'LIFE-0003'
);
insert into lifecycle_results (label, payload)
select 'void_replay', public.repairdesk_void_order(
  '00000000-0000-4000-8000-000000001000', '00000000-0000-4000-8000-000000001103',
  '00000000-0000-4000-8000-000000001001', '2026-07-16T10:03:00Z',
  '00000000-0000-4000-8000-000000001505', '重复订单需要安全作废', 'LIFE-0003'
);
insert into lifecycle_results (label, payload)
select 'void_conflict', public.repairdesk_void_order(
  '00000000-0000-4000-8000-000000001000', '00000000-0000-4000-8000-000000001103',
  '00000000-0000-4000-8000-000000001001', '2026-07-16T10:03:00Z',
  '00000000-0000-4000-8000-000000001505', '另一个作废原因内容', 'LIFE-0003'
);
reset role;

select is((select payload->>'code' from lifecycle_results where label = 'void_manager'), 'actor_forbidden', 'manager cannot void a terminal order');
select is((select payload->>'code' from lifecycle_results where label = 'void_confirmation'), 'invalid_confirmation', 'void requires an exact public number confirmation');
select is((select payload->>'code' from lifecycle_results where label = 'void_paid'), 'financial_history_requires_resolution', 'void refuses deposit evidence');
select is((select payload->>'code' from lifecycle_results where label = 'void_ledger'), 'financial_history_requires_resolution', 'void refuses ledger evidence');
select is((select payload->>'code' from lifecycle_results where label = 'void_recorded'), 'recorded', 'Owner void records atomically');
select is((select record_state from public.repair_orders where id = '00000000-0000-4000-8000-000000001103'), 'voided', 'void changes the lifecycle state');
select ok((select deleted_at = voided_at and voided_by = '00000000-0000-4000-8000-000000001001'::uuid from public.repair_orders where id = '00000000-0000-4000-8000-000000001103'), 'void stores complete immutable metadata');
select ok((select before_data ? 'voided_by' and after_data->>'voided_by' = '00000000-0000-4000-8000-000000001001' from public.order_terminal_operations where idempotency_key = '00000000-0000-4000-8000-000000001505'), 'void ledger preserves actor in before and after evidence');
select is((select payload->>'code' from lifecycle_results where label = 'void_replay'), 'idempotent_replay', 'void replay is idempotent');
select is((select payload->>'code' from lifecycle_results where label = 'void_conflict'), 'idempotency_conflict', 'void key conflict is rejected');

set local role service_role;
insert into lifecycle_results (label, payload)
select 'payment_voided', public.repairdesk_record_order_payment(
  '00000000-0000-4000-8000-000000001000', '00000000-0000-4000-8000-000000001103',
  '00000000-0000-4000-8000-000000001001', 1, 'cash', '2026-07-16T10:03:00Z',
  '00000000-0000-4000-8000-000000001603'
);
reset role;

select is((select payload->>'code' from lifecycle_results where label = 'payment_voided'), 'order_voided', 'voided order rejects payment with a stable code');
select is((select count(*) from public.order_payment_ledger where idempotency_key = '00000000-0000-4000-8000-000000001603'), 0::bigint, 'voided payment writes no ledger row');
select is((select balance_amount from public.repair_orders where id = '00000000-0000-4000-8000-000000001103'), 40::numeric, 'voided payment leaves the order balance unchanged');
select is((select count(*) from public.order_events where order_id = '00000000-0000-4000-8000-000000001103' and event_type = 'payment'), 0::bigint, 'voided payment writes no event');
select is((select count(*) from public.audit_logs where entity_id = '00000000-0000-4000-8000-000000001103' and action = 'payment'), 0::bigint, 'voided payment writes no audit row');

select pg_catalog.set_config('repairdesk.terminal_operation', '', true);
do $$
begin
  begin
    update public.repair_orders
       set voided_by = '00000000-0000-4000-8000-000000001002'
     where id = '00000000-0000-4000-8000-000000001103';
    insert into lifecycle_results (label, failed) values ('voided_actor_mutation', false);
  exception when others then
    insert into lifecycle_results (label, failed) values ('voided_actor_mutation', true);
  end;
end;
$$;
select ok((select failed from lifecycle_results where label = 'voided_actor_mutation'), 'voided actor metadata is immutable');

set local role service_role;
insert into lifecycle_results (label, payload)
select 'v3_after', public.repairdesk_customer_list_page_v3(
  '00000000-0000-4000-8000-000000001000', null, null, 'all', 'all', 'all', 1, 50
);
reset role;
select is((select (payload#>>'{items,0,order_count}')::integer from lifecycle_results where label = 'v3_after'), 10, 'void preserves the historical order count');
select is((select (payload#>>'{items,0,valid_order_count}')::integer from lifecycle_results where label = 'v3_after'), 5, 'voided order is removed from valid customer counts');
select is((select (payload#>>'{items,0,last_order_at}')::timestamptz from lifecycle_results where label = 'v3_after'), '2026-07-16T10:10:00Z'::timestamptz, 'void preserves the latest historical order timestamp');
select is((select (payload#>>'{items,0,lifetime_quoted_amount}')::numeric from lifecycle_results where label = 'v3_after'), 255::numeric, 'voided order is removed from lifetime quoted amount');
select is((select (payload#>>'{items,0,outstanding_amount}')::numeric from lifecycle_results where label = 'v3_after'), 190::numeric, 'voided orders and the recorded payment are removed from live outstanding amount');

insert into public.repair_orders (
  id, store_id, public_no, order_type, status, customer_id, issue_description,
  quotation_amount, deposit_amount, balance_amount, is_paid, approval_status,
  technician_name, fault_prices, workflow_status, payment_status, updated_at
) values (
  '00000000-0000-4000-8000-000000002102', '00000000-0000-4000-8000-000000002000',
  'LIFE-B002', 'quick_repair', 'new', '00000000-0000-4000-8000-000000002020',
  'Disposable CRM relation', 0, 0, 0, false, 'pending', 'Other Owner', '[]',
  'intake', 'unpaid', '2026-07-16T11:01:00Z'
);
insert into public.customer_interactions (
  id, store_id, customer_id, order_id, channel, direction, message_body, status, operator_name
) values (
  'same-store-interaction', '00000000-0000-4000-8000-000000002000',
  '00000000-0000-4000-8000-000000002020', '00000000-0000-4000-8000-000000002102',
  'whatsapp', 'note', 'same store', 'sent', 'test'
);
insert into public.customer_followups (
  id, store_id, customer_id, order_id, title, due_at
) values (
  'same-store-followup', '00000000-0000-4000-8000-000000002000',
  '00000000-0000-4000-8000-000000002020', '00000000-0000-4000-8000-000000002102',
  'same store', now()
);
delete from public.repair_orders where id = '00000000-0000-4000-8000-000000002102';

select ok((select order_id is null and store_id = '00000000-0000-4000-8000-000000002000' from public.customer_interactions where id = 'same-store-interaction'), 'deleting a same-store order clears only the interaction order reference');
select ok((select order_id is null and store_id = '00000000-0000-4000-8000-000000002000' from public.customer_followups where id = 'same-store-followup'), 'deleting a same-store order clears only the followup order reference');

do $$
begin
  begin
    insert into public.customer_followups (id, store_id, customer_id, title, due_at)
    values (
      'null-store-followup', null, '00000000-0000-4000-8000-000000002020',
      'must fail', now()
    );
    insert into lifecycle_results (label, failed) values ('crm_followup_null_store', false);
  exception when not_null_violation then
    insert into lifecycle_results (label, failed) values ('crm_followup_null_store', true);
  end;
end;
$$;
select ok((select failed from lifecycle_results where label = 'crm_followup_null_store'), 'customer followup cannot omit its store');
select ok((select pg_get_constraintdef(oid) like '%ON DELETE SET NULL (order_id)%' from pg_constraint where conrelid = 'public.customer_interactions'::regclass and conname = 'customer_interactions_order_same_store_fkey'), 'interaction composite FK clears only order_id on delete');
select ok((select pg_get_constraintdef(oid) like '%ON DELETE SET NULL (order_id)%' from pg_constraint where conrelid = 'public.customer_followups'::regclass and conname = 'customer_followups_order_same_store_fkey'), 'followup composite FK clears only order_id on delete');

do $$
begin
  begin
    insert into public.customer_interactions (
      id, store_id, customer_id, order_id, channel, direction, message_body, status, operator_name
    ) values (
      'cross-store-interaction', '00000000-0000-4000-8000-000000002000',
      '00000000-0000-4000-8000-000000002020', '00000000-0000-4000-8000-000000001101',
      'whatsapp', 'note', 'must fail', 'sent', 'test'
    );
    insert into lifecycle_results (label, failed) values ('crm_interaction_cross_store', false);
  exception when foreign_key_violation then
    insert into lifecycle_results (label, failed) values ('crm_interaction_cross_store', true);
  end;
  begin
    insert into public.customer_followups (
      id, store_id, customer_id, order_id, title, due_at
    ) values (
      'cross-store-followup', '00000000-0000-4000-8000-000000002000',
      '00000000-0000-4000-8000-000000002020', '00000000-0000-4000-8000-000000001101',
      'must fail', now()
    );
    insert into lifecycle_results (label, failed) values ('crm_followup_cross_store', false);
  exception when foreign_key_violation then
    insert into lifecycle_results (label, failed) values ('crm_followup_cross_store', true);
  end;
end;
$$;
select ok((select failed from lifecycle_results where label = 'crm_interaction_cross_store'), 'customer interaction cannot reference an order from another store');
select ok((select failed from lifecycle_results where label = 'crm_followup_cross_store'), 'customer followup cannot reference an order from another store');

select * from finish();
rollback;
