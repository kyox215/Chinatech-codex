begin;

create extension if not exists pgtap with schema extensions;
select plan(32);

select has_table('public', 'repair_order_line_cost_revisions', 'cost revision ledger exists');
select has_table('public', 'store_fault_cost_default_versions', 'default-cost history exists');
select has_column(
  'public', 'repair_order_line_costs', 'evidence_status', 'current projection has evidence status'
);
select has_column(
  'public', 'repair_order_line_costs', 'original_currency_code',
  'current projection has original currency snapshot'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.repair_order_line_cost_revisions'::regclass),
  'cost revision ledger has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.store_fault_cost_default_versions'::regclass),
  'default-cost history has RLS enabled'
);
select ok(
  not has_table_privilege('anon', 'public.repair_order_line_cost_revisions', 'select'),
  'anon cannot select cost revisions'
);
select ok(
  not has_table_privilege('authenticated', 'public.repair_order_line_cost_revisions', 'select'),
  'authenticated cannot select cost revisions'
);
select ok(
  has_table_privilege('service_role', 'public.repair_order_line_cost_revisions', 'select'),
  'service role can select cost revisions'
);
select ok(
  has_function_privilege(
    'service_role',
    to_regprocedure('public.repairdesk_read_order_cost_history_rpc(uuid,uuid,uuid)'),
    'execute'
  ),
  'service role can execute cost-history RPC'
);
select ok(
  not has_function_privilege(
    'authenticated',
    to_regprocedure('public.repairdesk_read_order_cost_history_rpc(uuid,uuid,uuid)'),
    'execute'
  ),
  'authenticated cannot execute cost-history RPC'
);
select ok(
  (select convalidated
   from pg_constraint
   where conrelid = 'public.repair_order_line_costs'::regclass
     and conname = 'repair_order_line_costs_evidence_amount_check'),
  'projection evidence constraint is validated'
);

insert into auth.users (id, email, created_at, updated_at) values
  ('00000000-0000-4000-8000-000000008001', 'phase2-owner@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000008002', 'phase2-manager@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000008003', 'phase2-tech@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000009001', 'phase2-other@example.test', now(), now());

insert into public.stores (id, store_code, name, slug, status) values
  ('00000000-0000-4000-8000-000000008000', 'COST_P2_A', 'Cost Phase 2 A', 'cost-phase2-a', 'active'),
  ('00000000-0000-4000-8000-000000009000', 'COST_P2_B', 'Cost Phase 2 B', 'cost-phase2-b', 'active');

insert into public.staff_profiles (id, email, display_name, role, status) values
  ('00000000-0000-4000-8000-000000008001', 'phase2-owner@example.test', 'Phase 2 Owner', 'owner', 'active'),
  ('00000000-0000-4000-8000-000000008002', 'phase2-manager@example.test', 'Phase 2 Manager', 'manager', 'active'),
  ('00000000-0000-4000-8000-000000008003', 'phase2-tech@example.test', 'Phase 2 Tech', 'technician', 'active'),
  ('00000000-0000-4000-8000-000000009001', 'phase2-other@example.test', 'Phase 2 Other', 'owner', 'active');

insert into public.store_memberships (
  id, store_id, user_id, email, display_name, role, status
) values
  ('00000000-0000-4000-8000-000000008011', '00000000-0000-4000-8000-000000008000', '00000000-0000-4000-8000-000000008001', 'phase2-owner@example.test', 'Phase 2 Owner', 'owner', 'active'),
  ('00000000-0000-4000-8000-000000008012', '00000000-0000-4000-8000-000000008000', '00000000-0000-4000-8000-000000008002', 'phase2-manager@example.test', 'Phase 2 Manager', 'manager', 'active'),
  ('00000000-0000-4000-8000-000000008013', '00000000-0000-4000-8000-000000008000', '00000000-0000-4000-8000-000000008003', 'phase2-tech@example.test', 'Phase 2 Tech', 'technician', 'active'),
  ('00000000-0000-4000-8000-000000009011', '00000000-0000-4000-8000-000000009000', '00000000-0000-4000-8000-000000009001', 'phase2-other@example.test', 'Phase 2 Other', 'owner', 'active');

select ok(
  public.repairdesk_actor_has_phase2_cost_permission(
    '00000000-0000-4000-8000-000000008000',
    '00000000-0000-4000-8000-000000008001',
    'finance:profit_read'
  ),
  'owner inherently has profit read'
);
select ok(
  not public.repairdesk_actor_has_phase2_cost_permission(
    '00000000-0000-4000-8000-000000008000',
    '00000000-0000-4000-8000-000000008002',
    'finance:cost_manage'
  ),
  'manager has no cost management without a grant'
);

insert into public.store_member_permission_grants (
  store_id, membership_id, user_id, action, granted_by
) values
  ('00000000-0000-4000-8000-000000008000', '00000000-0000-4000-8000-000000008012', '00000000-0000-4000-8000-000000008002', 'finance:cost_manage', '00000000-0000-4000-8000-000000008001'),
  ('00000000-0000-4000-8000-000000008000', '00000000-0000-4000-8000-000000008013', '00000000-0000-4000-8000-000000008003', 'finance:cost_manage', '00000000-0000-4000-8000-000000008001');

select ok(
  public.repairdesk_actor_has_phase2_cost_permission(
    '00000000-0000-4000-8000-000000008000',
    '00000000-0000-4000-8000-000000008002',
    'finance:cost_manage'
  ),
  'manager receives explicitly granted cost management'
);
select ok(
  not public.repairdesk_actor_has_phase2_cost_permission(
    '00000000-0000-4000-8000-000000008000',
    '00000000-0000-4000-8000-000000008002',
    'finance:cost_backfill_apply'
  ),
  'manager cannot receive bulk backfill apply'
);
select ok(
  not public.repairdesk_actor_has_phase2_cost_permission(
    '00000000-0000-4000-8000-000000008000',
    '00000000-0000-4000-8000-000000008002',
    'finance:currency_manage'
  ),
  'manager cannot receive currency management'
);
select ok(
  not public.repairdesk_actor_has_phase2_cost_permission(
    '00000000-0000-4000-8000-000000008000',
    '00000000-0000-4000-8000-000000008003',
    'finance:cost_manage'
  ),
  'technician forged grant is ignored by the database policy'
);

insert into public.store_fault_cost_defaults (
  store_id, catalog_key, catalog_name, default_cost_amount,
  currency_code, revision, updated_by
) values (
  '00000000-0000-4000-8000-000000008000',
  'phone:screen', 'Screen', 15, 'EUR', 1,
  '00000000-0000-4000-8000-000000008001'
);

select is(
  (select count(*)::integer
   from public.store_fault_cost_default_versions
   where store_id = '00000000-0000-4000-8000-000000008000'
     and catalog_key = 'phone:screen'
     and effective_to is null),
  1,
  'new defaults create exactly one open history version'
);
select is(
  (select default_cost_amount
   from public.store_fault_cost_default_versions
   where store_id = '00000000-0000-4000-8000-000000008000'
     and catalog_key = 'phone:screen'
     and effective_to is null),
  15.00::numeric,
  'open default history preserves the configured amount'
);

insert into public.customers (id, store_id, name, phone_e164, phone_raw) values (
  '00000000-0000-4000-8000-000000008020',
  '00000000-0000-4000-8000-000000008000',
  'Phase 2 Customer', '+390000008020', '390000008020'
);

insert into public.repair_orders (
  id, store_id, public_no, order_type, status, customer_id, issue_description,
  quotation_amount, deposit_amount, balance_amount, is_paid, approval_status,
  technician_name, assignee_membership_id, fault_prices, workflow_status,
  payment_status, created_at, updated_at
) values (
  '00000000-0000-4000-8000-000000008101',
  '00000000-0000-4000-8000-000000008000',
  'COST-P2-01', 'quick_repair', 'new',
  '00000000-0000-4000-8000-000000008020',
  'Phase 2 ledger fixture', 100, 0, 100, false, 'pending',
  'Phase 2 Manager', '00000000-0000-4000-8000-000000008012',
  '[{"line_id":"00000000-0000-4000-8000-000000008201","catalog_key":"phone:screen","name":"Screen","price":100,"currency_code":"EUR"}]'::jsonb,
  'intake', 'unpaid', now(), now()
);

select is(
  (select cost_amount from public.repair_order_line_costs
   where order_id = '00000000-0000-4000-8000-000000008101'
     and line_id = '00000000-0000-4000-8000-000000008201'),
  15.00::numeric,
  'new order line receives the current default cost'
);
select is(
  (select evidence_status from public.repair_order_line_costs
   where order_id = '00000000-0000-4000-8000-000000008101'
     and line_id = '00000000-0000-4000-8000-000000008201'),
  'estimated',
  'default cost is estimated'
);
select is(
  (select original_currency_code from public.repair_order_line_costs
   where order_id = '00000000-0000-4000-8000-000000008101'
     and line_id = '00000000-0000-4000-8000-000000008201'),
  'EUR',
  'default cost receives an EUR source snapshot'
);
select is(
  (select count(*)::integer from public.repair_order_line_cost_revisions
   where order_id = '00000000-0000-4000-8000-000000008101'),
  1,
  'projection creation appends one cost revision'
);

create temp table phase2_cost_results (label text primary key, payload jsonb);

insert into phase2_cost_results values (
  'manual_zero',
  public.repairdesk_apply_order_cost_inputs_rpc(
    '00000000-0000-4000-8000-000000008000',
    '00000000-0000-4000-8000-000000008101',
    '00000000-0000-4000-8000-000000008002',
    1,
    '[{"line_id":"00000000-0000-4000-8000-000000008201","mode":"manual","amount":0}]'::jsonb
  )
);

select is(
  (select payload ->> 'code' from phase2_cost_results where label = 'manual_zero'),
  'updated',
  'manager manual zero update succeeds'
);
select is(
  (select cost_amount from public.repair_order_line_costs
   where order_id = '00000000-0000-4000-8000-000000008101'),
  0.00::numeric,
  'explicit zero remains a known cost'
);
select is(
  (select evidence_status from public.repair_order_line_costs
   where order_id = '00000000-0000-4000-8000-000000008101'),
  'confirmed',
  'manual zero is confirmed'
);
select is(
  (select original_amount from public.repair_order_line_costs
   where order_id = '00000000-0000-4000-8000-000000008101'),
  0.000000::numeric,
  'manual zero keeps its original amount snapshot'
);
select is(
  (select count(*)::integer from public.repair_order_line_cost_revisions
   where order_id = '00000000-0000-4000-8000-000000008101'),
  2,
  'manual update appends rather than replacing history'
);

insert into phase2_cost_results values (
  'manual_blank',
  public.repairdesk_apply_order_cost_inputs_rpc(
    '00000000-0000-4000-8000-000000008000',
    '00000000-0000-4000-8000-000000008101',
    '00000000-0000-4000-8000-000000008002',
    2,
    '[{"line_id":"00000000-0000-4000-8000-000000008201","mode":"blank"}]'::jsonb
  )
);

select is(
  (select payload ->> 'code' from phase2_cost_results where label = 'manual_blank'),
  'updated',
  'manual blank update succeeds'
);
select is(
  (select cost_amount from public.repair_order_line_costs
   where order_id = '00000000-0000-4000-8000-000000008101'),
  null,
  'blank cost remains null rather than zero'
);
select is(
  (select evidence_status from public.repair_order_line_costs
   where order_id = '00000000-0000-4000-8000-000000008101'),
  'unknown',
  'blank cost is unknown'
);
select is(
  public.repairdesk_read_order_cost_history_rpc(
    '00000000-0000-4000-8000-000000008000',
    '00000000-0000-4000-8000-000000008101',
    '00000000-0000-4000-8000-000000008001'
  ) ->> 'code',
  'read',
  'owner can read cost history'
);
select is(
  public.repairdesk_read_order_cost_history_rpc(
    '00000000-0000-4000-8000-000000008000',
    '00000000-0000-4000-8000-000000008101',
    '00000000-0000-4000-8000-000000008003'
  ) ->> 'code',
  'actor_forbidden',
  'technician cannot read cost history despite a forged grant'
);
select ok(
  jsonb_array_length(
    public.repairdesk_read_order_cost_history_rpc(
      '00000000-0000-4000-8000-000000008000',
      '00000000-0000-4000-8000-000000008101',
      '00000000-0000-4000-8000-000000008001'
    ) -> 'items'
  ) >= 3,
  'history contains create, zero and blank snapshots'
);
select is(
  public.repairdesk_read_order_cost_history_rpc(
    '00000000-0000-4000-8000-000000009000',
    '00000000-0000-4000-8000-000000008101',
    '00000000-0000-4000-8000-000000009001'
  ) ->> 'code',
  'order_not_found',
  'cross-store cost history does not disclose the order'
);

select * from finish();
rollback;
