begin;

create extension if not exists pgtap with schema extensions;
select plan(31);

select has_table('public', 'buyback_quote_revisions', 'quote revision ledger exists');
select has_table('public', 'buyback_quote_responses', 'quote response ledger exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.buyback_quote_revisions'::regclass)
    and (select relrowsecurity from pg_class where oid = 'public.buyback_quote_responses'::regclass),
  'both ledgers have RLS enabled'
);
select ok(
  has_table_privilege('service_role', 'public.buyback_quote_revisions', 'select,insert,delete')
    and has_table_privilege('service_role', 'public.buyback_quote_responses', 'select,insert,delete'),
  'service role has only the ledger operations needed by the BFF and verified purge'
);
select ok(
  not has_table_privilege('service_role', 'public.buyback_quote_revisions', 'update,truncate')
    and not has_table_privilege('service_role', 'public.buyback_quote_responses', 'update,truncate'),
  'service role cannot update or truncate ledgers'
);
select ok(
  not has_table_privilege('anon', 'public.buyback_quote_revisions', 'select')
    and not has_table_privilege('anon', 'public.buyback_quote_responses', 'select'),
  'anonymous clients cannot read ledgers'
);
select ok(
  not has_table_privilege('authenticated', 'public.buyback_quote_revisions', 'select')
    and not has_table_privilege('authenticated', 'public.buyback_quote_responses', 'select'),
  'authenticated clients cannot read ledgers directly'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.repairdesk_create_buyback_quote_v1(uuid,uuid,uuid,text,text,uuid,uuid,jsonb,jsonb)',
    'execute'
  ),
  'service role can execute create quote RPC'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.repairdesk_create_buyback_quote_v1(uuid,uuid,uuid,text,text,uuid,uuid,jsonb,jsonb)',
    'execute'
  ),
  'browser role cannot execute create quote RPC'
);
select ok(
  (select pg_get_constraintdef(oid)
     from pg_constraint
    where conrelid = 'public.buyback_quote_responses'::regclass
      and conname = 'buyback_quote_responses_revision_fkey')
    like 'FOREIGN KEY (quote_revision_id, store_id, item_id) REFERENCES buyback_quote_revisions(id, store_id, item_id)%',
  'responses bind to the same store, item and quote revision'
);

insert into auth.users (id, email, created_at, updated_at) values
  ('92000000-0000-4000-8000-000000000001', 'quote-owner@example.test', now(), now()),
  ('92000000-0000-4000-8000-000000000002', 'quote-manager@example.test', now(), now()),
  ('92000000-0000-4000-8000-000000000003', 'quote-sales@example.test', now(), now()),
  ('92000000-0000-4000-8000-000000000004', 'quote-tech@example.test', now(), now());

insert into public.staff_profiles (id, email, display_name, role, status) values
  ('92000000-0000-4000-8000-000000000001', 'quote-owner@example.test', 'Quote Owner', 'owner', 'active'),
  ('92000000-0000-4000-8000-000000000002', 'quote-manager@example.test', 'Quote Manager', 'manager', 'active'),
  ('92000000-0000-4000-8000-000000000003', 'quote-sales@example.test', 'Quote Sales', 'sales', 'active'),
  ('92000000-0000-4000-8000-000000000004', 'quote-tech@example.test', 'Quote Tech', 'technician', 'active');

insert into public.stores (id, store_code, name, slug, owner_user_id, status) values
  ('92000000-0000-4000-8000-000000000010', 'QUOTE_A', 'Quote Store A', 'quote-store-a', '92000000-0000-4000-8000-000000000001', 'active');
insert into public.store_lifecycles (store_id, phase, revision) values
  ('92000000-0000-4000-8000-000000000010', 'active', 1)
on conflict (store_id) do update set phase = 'active';
insert into public.store_memberships (id, store_id, user_id, email, display_name, role, status) values
  ('92000000-0000-4000-8000-000000000101', '92000000-0000-4000-8000-000000000010', '92000000-0000-4000-8000-000000000001', 'quote-owner@example.test', 'Quote Owner', 'owner', 'active'),
  ('92000000-0000-4000-8000-000000000102', '92000000-0000-4000-8000-000000000010', '92000000-0000-4000-8000-000000000002', 'quote-manager@example.test', 'Quote Manager', 'manager', 'active'),
  ('92000000-0000-4000-8000-000000000103', '92000000-0000-4000-8000-000000000010', '92000000-0000-4000-8000-000000000003', 'quote-sales@example.test', 'Quote Sales', 'sales', 'active'),
  ('92000000-0000-4000-8000-000000000104', '92000000-0000-4000-8000-000000000010', '92000000-0000-4000-8000-000000000004', 'quote-tech@example.test', 'Quote Tech', 'technician', 'active');

create temporary table quote_test_results (label text primary key, payload jsonb) on commit drop;

insert into quote_test_results values (
  'create',
  public.repairdesk_create_buyback_quote_v1(
    '92000000-0000-4000-8000-000000000010',
    '92000000-0000-4000-8000-000000000201',
    '92000000-0000-4000-8000-000000000001',
    'Forged Name', 'forged@example.test',
    '92000000-0000-4000-8000-000000000301', null,
    '{"brand":"Apple","model":"iPhone 15","storage_capacity":"128GB"}'::jsonb,
    jsonb_build_object(
      'reference_low', 300, 'reference_high', 400, 'final_offer', 365,
      'deductions', jsonb_build_array(jsonb_build_object(
        'code', 'battery', 'label', 'Battery adjustment', 'amount', 35
      )),
      'risk_level', 'low', 'hard_block', false,
      'expires_at', (now() + interval '7 days')::text
    )
  )
);
select is((select payload->>'code' from quote_test_results where label = 'create'), 'created', 'owner creates one quote');
select is((select count(*) from public.inventory_items where id = '92000000-0000-4000-8000-000000000201'), 1::bigint, 'create writes one current projection');
select is((select buyback_price from public.inventory_items where id = '92000000-0000-4000-8000-000000000201'), 0.00::numeric, 'quote-only create never records an acquisition cost');
select is((select count(*) from public.buyback_quote_revisions where item_id = '92000000-0000-4000-8000-000000000201'), 1::bigint, 'create appends one revision');
select is((select actor_name from public.buyback_quote_revisions where item_id = '92000000-0000-4000-8000-000000000201'), 'Quote Owner', 'actor snapshot comes from the database');

insert into quote_test_results values (
  'replay',
  public.repairdesk_create_buyback_quote_v1(
    '92000000-0000-4000-8000-000000000010',
    '92000000-0000-4000-8000-000000000201',
    '92000000-0000-4000-8000-000000000001',
    'Ignored', 'ignored@example.test',
    '92000000-0000-4000-8000-000000000301', null,
    '{"brand":"Apple","model":"iPhone 15","storage_capacity":"128GB"}'::jsonb,
    jsonb_build_object(
      'reference_low', 300, 'reference_high', 400, 'final_offer', 365,
      'deductions', jsonb_build_array(jsonb_build_object(
        'code', 'battery', 'label', 'Battery adjustment', 'amount', 35
      )),
      'risk_level', 'low', 'hard_block', false,
      'expires_at', (select quote_snapshot->>'expires_at' from public.buyback_quote_revisions where item_id = '92000000-0000-4000-8000-000000000201')
    )
  )
);
select is((select payload->>'code' from quote_test_results where label = 'replay'), 'idempotent_replay', 'same key and payload replays');
select is((select count(*) from public.buyback_quote_revisions where item_id = '92000000-0000-4000-8000-000000000201'), 1::bigint, 'replay does not duplicate a revision');

insert into quote_test_results values (
  'conflict',
  public.repairdesk_create_buyback_quote_v1(
    '92000000-0000-4000-8000-000000000010',
    '92000000-0000-4000-8000-000000000202',
    '92000000-0000-4000-8000-000000000001',
    'Quote Owner', 'quote-owner@example.test',
    '92000000-0000-4000-8000-000000000301', null,
    '{"brand":"Apple","model":"iPhone 15"}'::jsonb,
    jsonb_build_object(
      'reference_low', 300, 'reference_high', 400, 'final_offer', 400,
      'deductions', '[]'::jsonb, 'risk_level', 'low', 'hard_block', false,
      'expires_at', (now() + interval '7 days')::text
    )
  )
);
select is((select payload->>'code' from quote_test_results where label = 'conflict'), 'idempotency_conflict', 'same store key cannot move to a different item');
select is((select count(*) from public.inventory_items where id = '92000000-0000-4000-8000-000000000202'), 0::bigint, 'idempotency conflict writes no item');

insert into quote_test_results values (
  'tech_forbidden',
  public.repairdesk_create_buyback_quote_v1(
    '92000000-0000-4000-8000-000000000010',
    '92000000-0000-4000-8000-000000000203',
    '92000000-0000-4000-8000-000000000004',
    'Quote Tech', 'quote-tech@example.test',
    '92000000-0000-4000-8000-000000000303', null,
    '{"brand":"Apple","model":"iPhone 14"}'::jsonb,
    jsonb_build_object(
      'reference_low', 250, 'reference_high', 350, 'final_offer', 350,
      'deductions', '[]'::jsonb, 'risk_level', 'low', 'hard_block', false,
      'expires_at', (now() + interval '7 days')::text
    )
  )
);
select is((select payload->>'code' from quote_test_results where label = 'tech_forbidden'), 'actor_forbidden', 'technician cannot create quotes');

insert into quote_test_results values (
  'revise',
  public.repairdesk_revise_buyback_quote_v1(
    '92000000-0000-4000-8000-000000000010',
    '92000000-0000-4000-8000-000000000201',
    '92000000-0000-4000-8000-000000000002',
    'Forged Manager', 'forged-manager@example.test',
    (select (payload->>'updated_at')::timestamptz from quote_test_results where label = 'create'),
    '92000000-0000-4000-8000-000000000304',
    jsonb_build_object(
      'reference_low', 300, 'reference_high', 400, 'final_offer', 355,
      'deductions', jsonb_build_array(jsonb_build_object(
        'code', 'battery', 'label', 'Battery adjustment', 'amount', 45
      )),
      'risk_level', 'low', 'hard_block', false,
      'expires_at', (now() + interval '7 days')::text
    ),
    'Battery retested'
  )
);
select is((select payload->>'code' from quote_test_results where label = 'revise'), 'revised', 'manager appends a new quote version');
select is((select count(*) from public.buyback_quote_revisions where item_id = '92000000-0000-4000-8000-000000000201'), 2::bigint, 'revision history remains append-only');

insert into quote_test_results values (
  'sales_revise',
  public.repairdesk_revise_buyback_quote_v1(
    '92000000-0000-4000-8000-000000000010',
    '92000000-0000-4000-8000-000000000201',
    '92000000-0000-4000-8000-000000000003',
    'Quote Sales', 'quote-sales@example.test',
    (select (payload->>'updated_at')::timestamptz from quote_test_results where label = 'revise'),
    '92000000-0000-4000-8000-000000000305',
    jsonb_build_object(
      'reference_low', 300, 'reference_high', 400, 'final_offer', 350,
      'deductions', jsonb_build_array(jsonb_build_object(
        'code', 'battery', 'label', 'Battery adjustment', 'amount', 50
      )),
      'risk_level', 'low', 'hard_block', false,
      'expires_at', (now() + interval '7 days')::text
    ),
    'Sales cannot revise'
  )
);
select is((select payload->>'code' from quote_test_results where label = 'sales_revise'), 'actor_forbidden', 'sales cannot revise a quote');

insert into quote_test_results values (
  'accept',
  public.repairdesk_record_buyback_quote_response_v1(
    '92000000-0000-4000-8000-000000000010',
    '92000000-0000-4000-8000-000000000201',
    '92000000-0000-4000-8000-000000000001',
    'Ignored', 'ignored@example.test',
    (select (payload->>'updated_at')::timestamptz from quote_test_results where label = 'revise'),
    '92000000-0000-4000-8000-000000000306',
    (select (payload->>'quote_revision_id')::uuid from quote_test_results where label = 'revise'),
    'accepted', null, null
  )
);
select is((select payload->>'code' from quote_test_results where label = 'accept'), 'response_recorded', 'owner records verbal acceptance');
select is((select legacy_payload #>> '{buyback_quote,intent_outcome}' from public.inventory_items where id = '92000000-0000-4000-8000-000000000201'), 'accepted', 'current projection records accepted intent only');

insert into quote_test_results values (
  'locked',
  public.repairdesk_record_buyback_quote_response_v1(
    '92000000-0000-4000-8000-000000000010',
    '92000000-0000-4000-8000-000000000201',
    '92000000-0000-4000-8000-000000000001',
    'Quote Owner', 'quote-owner@example.test',
    (select updated_at from public.inventory_items where id = '92000000-0000-4000-8000-000000000201'),
    '92000000-0000-4000-8000-000000000307',
    (select (payload->>'quote_revision_id')::uuid from quote_test_results where label = 'revise'),
    'deferred', null, null
  )
);
select is((select payload->>'code' from quote_test_results where label = 'locked'), 'response_locked', 'accepted or rejected response is locked');

select throws_ok(
  $$update public.buyback_quote_revisions set actor_name = 'tampered' where item_id = '92000000-0000-4000-8000-000000000201'$$,
  'P0001', 'buyback quote ledger is append-only', 'ordinary revision update is refused'
);
select throws_ok(
  $$delete from public.buyback_quote_responses where item_id = '92000000-0000-4000-8000-000000000201'$$,
  'P0001', 'buyback quote ledger is append-only', 'ordinary response delete is refused'
);

create function public.test_fail_buyback_audit_insert()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception using message = 'forced buyback audit failure';
end;
$$;
create trigger test_fail_buyback_audit_insert
before insert on public.audit_logs
for each row when (new.action = 'buyback_quote_create')
execute function public.test_fail_buyback_audit_insert();

select throws_ok(
  $$select public.repairdesk_create_buyback_quote_v1(
    '92000000-0000-4000-8000-000000000010',
    '92000000-0000-4000-8000-000000000204',
    '92000000-0000-4000-8000-000000000001',
    'Quote Owner', 'quote-owner@example.test',
    '92000000-0000-4000-8000-000000000308', null,
    '{"brand":"Apple","model":"iPhone 12"}'::jsonb,
    jsonb_build_object(
      'reference_low', 200, 'reference_high', 300, 'final_offer', 300,
      'deductions', '[]'::jsonb, 'risk_level', 'low', 'hard_block', false,
      'expires_at', (now() + interval '7 days')::text
    )
  )$$,
  'P0001', 'forced buyback audit failure', 'audit failure aborts the quote transaction'
);
select is((select count(*) from public.inventory_items where id = '92000000-0000-4000-8000-000000000204'), 0::bigint, 'audit failure rolls back current projection');
select is((select count(*) from public.buyback_quote_revisions where item_id = '92000000-0000-4000-8000-000000000204'), 0::bigint, 'audit failure rolls back the ledger');

select * from finish();
rollback;
