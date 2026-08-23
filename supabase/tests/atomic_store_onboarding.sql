begin;

create extension if not exists pgtap with schema extensions;
select plan(19);

select ok(
  not has_function_privilege(
    'anon',
    'public.repairdesk_create_store_atomic_rpc(uuid,text,uuid,uuid,text,text,text,text,text,text,text,text,jsonb)',
    'execute'
  ),
  'anon cannot execute atomic store creation'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.repairdesk_create_store_atomic_rpc(uuid,text,uuid,uuid,text,text,text,text,text,text,text,text,jsonb)',
    'execute'
  ),
  'authenticated cannot execute atomic store creation directly'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.repairdesk_create_store_atomic_rpc(uuid,text,uuid,uuid,text,text,text,text,text,text,text,text,jsonb)',
    'execute'
  ),
  'service role can execute atomic store creation'
);
select ok(
  (
    select proconfig @> array['search_path=""']
      from pg_catalog.pg_proc
     where oid = 'public.repairdesk_create_store_atomic_rpc(uuid,text,uuid,uuid,text,text,text,text,text,text,text,text,jsonb)'::regprocedure
  ),
  'security definer RPC has an empty search path'
);

insert into auth.users (id, email, email_confirmed_at, created_at, updated_at)
values (
  'a1000000-0000-4000-8000-000000000001',
  'atomic-owner@example.test',
  now(),
  now(),
  now()
);

create temporary table atomic_test_payload(payload jsonb) on commit drop;
insert into atomic_test_payload values (
  jsonb_build_object(
    'settings', jsonb_build_object(
      'id', 'store-settings:a1000000-0000-4000-8000-000000000010',
      'default_order_warranty_text', '6个月',
      'default_order_warranty_months', 6,
      'default_inventory_warranty_months', 12,
      'print_footer', 'Grazie'
    ),
    'templates', jsonb_build_array(jsonb_build_object(
      'id', 'atomic-template',
      'domain', 'order',
      'kind', 'approval_request',
      'channel', 'whatsapp',
      'language', 'it',
      'label', 'Atomic template',
      'body_template', 'Atomic body',
      'enabled', true,
      'sort_order', 10
    )),
    'statuses', jsonb_build_array(
      jsonb_build_object(
        'id', 'a1000000-0000-4000-8000-000000000101',
        'code', 'new', 'label', 'New', 'short_label', 'New',
        'tone', 'info', 'bucket', 'intake', 'sort_order', 10,
        'enabled', true, 'show_in_order_filters', true,
        'allowed_for_create', true, 'is_default_create_status', true,
        'is_system', true
      ),
      jsonb_build_object(
        'id', 'a1000000-0000-4000-8000-000000000102',
        'code', 'diagnosing', 'label', 'Diagnosing', 'short_label', 'Diag',
        'tone', 'progress', 'bucket', 'diagnosing', 'sort_order', 20,
        'enabled', true, 'show_in_order_filters', true,
        'allowed_for_create', true, 'is_default_create_status', false,
        'is_system', true
      )
    ),
    'transitions', jsonb_build_array(jsonb_build_object(
      'id', 'a1000000-0000-4000-8000-000000000201',
      'from_status_code', 'new', 'to_status_code', 'diagnosing',
      'is_primary', true, 'sort_order', 10, 'enabled', true
    ))
  )
);
grant select on atomic_test_payload to service_role;

set role anon;
select throws_ok(
  $$select * from public.repairdesk_create_store_atomic_rpc(
    'a1000000-0000-4000-8000-000000000009', repeat('f', 64),
    'a1000000-0000-4000-8000-000000000090',
    'a1000000-0000-4000-8000-000000000001',
    'atomic-owner@example.test', 'Atomic Owner', 'FORBIDDEN-1',
    'Forbidden Store', 'forbidden-store-0001', 'Europe/Rome', 'EUR', '',
    '{}'::jsonb
  )$$,
  '42501',
  null,
  'anon cannot invoke atomic store creation'
);
reset role;

set role authenticated;
select throws_ok(
  $$select * from public.repairdesk_create_store_atomic_rpc(
    'a1000000-0000-4000-8000-000000000009', repeat('f', 64),
    'a1000000-0000-4000-8000-000000000090',
    'a1000000-0000-4000-8000-000000000001',
    'atomic-owner@example.test', 'Atomic Owner', 'FORBIDDEN-1',
    'Forbidden Store', 'forbidden-store-0001', 'Europe/Rome', 'EUR', '',
    '{}'::jsonb
  )$$,
  '42501',
  null,
  'authenticated cannot invoke atomic store creation'
);
reset role;

select throws_ok(
  $$select * from public.repairdesk_create_store_atomic_rpc(
    'a1000000-0000-4000-8000-000000000009', 'invalid-hash',
    'a1000000-0000-4000-8000-000000000090',
    'a1000000-0000-4000-8000-000000000001',
    'atomic-owner@example.test', 'Atomic Owner', 'INVALID-1',
    'Invalid Store', 'invalid-store-0001', 'Europe/Rome', 'EUR', '',
    (select payload from atomic_test_payload)
  )$$,
  '22023',
  'STORE_CREATE_INVALID_INPUT',
  'runtime validates input without a legacy request-claim dependency'
);

set role service_role;
reset request.jwt.claim.role;

select throws_ok(
  $$select * from public.repairdesk_create_store_atomic_rpc(
    'a1000000-0000-4000-8000-000000000008', repeat('e', 64),
    'a1000000-0000-4000-8000-000000000080',
    'a1000000-0000-4000-8000-000000000001',
    'wrong-owner@example.test', 'Atomic Owner', 'EMAIL-FAIL-1',
    'Email Fail', 'email-fail-store-0001', 'Europe/Rome', 'EUR', '',
    (select payload from atomic_test_payload)
  )$$,
  '42501',
  'STORE_CREATE_EMAIL_NOT_VERIFIED',
  'runtime rejects an actor and verified-email mismatch'
);

create temporary table atomic_first_result on commit drop as
select * from public.repairdesk_create_store_atomic_rpc(
  'a1000000-0000-4000-8000-000000000002',
  repeat('a', 64),
  'a1000000-0000-4000-8000-000000000010',
  'a1000000-0000-4000-8000-000000000001',
  'atomic-owner@example.test',
  'Atomic Owner',
  'ATOMIC-000001',
  'Atomic Store',
  'atomic-store-0001',
  'Europe/Rome',
  'EUR',
  'Via Atomic 1',
  (select payload from atomic_test_payload)
);

reset role;

select is((select count(*) from atomic_first_result), 1::bigint, 'atomic RPC returns one store');
select is(
  (select status::text from public.stores where id = 'a1000000-0000-4000-8000-000000000010'),
  'active',
  'store commits active'
);
select is(
  (select phase::text from public.store_lifecycles where store_id = 'a1000000-0000-4000-8000-000000000010'),
  'active',
  'lifecycle commits active'
);
select is(
  (select count(*) from public.store_memberships
    where store_id = 'a1000000-0000-4000-8000-000000000010'
      and user_id = 'a1000000-0000-4000-8000-000000000001'
      and role = 'owner' and status = 'active'),
  1::bigint,
  'active owner membership commits with store'
);
select is(
  (select count(*) from public.store_settings
    where store_id = 'a1000000-0000-4000-8000-000000000010'),
  1::bigint,
  'store settings commit with store'
);
select is(
  (select count(*) from public.order_workflow_statuses
    where store_id = 'a1000000-0000-4000-8000-000000000010'),
  2::bigint,
  'workflow defaults commit with store'
);

select is(
  (
    select id::text from public.repairdesk_create_store_atomic_rpc(
      'a1000000-0000-4000-8000-000000000002',
      repeat('a', 64),
      'a1000000-0000-4000-8000-000000000099',
      'a1000000-0000-4000-8000-000000000001',
      'atomic-owner@example.test', 'Atomic Owner', 'IGNORED-REPLAY',
      'Ignored replay', 'ignored-replay-0001', 'Europe/Rome', 'EUR', '',
      (select payload from atomic_test_payload)
    )
  ),
  'a1000000-0000-4000-8000-000000000010',
  'same actor and request id replays the original store'
);
select is(
  (select count(*) from public.stores where owner_user_id = 'a1000000-0000-4000-8000-000000000001'),
  1::bigint,
  'idempotent replay does not create another store'
);

select throws_ok(
  $$select * from public.repairdesk_create_store_atomic_rpc(
    'a1000000-0000-4000-8000-000000000002', repeat('b', 64),
    'a1000000-0000-4000-8000-000000000099',
    'a1000000-0000-4000-8000-000000000001',
    'atomic-owner@example.test', 'Atomic Owner', 'CONFLICT-1',
    'Conflict', 'conflict-store-0001', 'Europe/Rome', 'EUR', '',
    (select payload from atomic_test_payload)
  )$$,
  '23505',
  'STORE_CREATE_IDEMPOTENCY_CONFLICT',
  'same request id with a different payload hash is rejected'
);

select throws_ok(
  $$select * from public.repairdesk_create_store_atomic_rpc(
    'a1000000-0000-4000-8000-000000000003', repeat('c', 64),
    'a1000000-0000-4000-8000-000000000020',
    'a1000000-0000-4000-8000-000000000001',
    'atomic-owner@example.test', 'Atomic Owner', 'ATOMIC-FAIL-1',
    'Atomic Fail', 'atomic-fail-0001', 'Europe/Rome', 'EUR', '',
    jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(
      (select payload from atomic_test_payload),
      '{settings,id}', '"store-settings:a1000000-0000-4000-8000-000000000020"'::jsonb
    ), '{templates,0,id}', '"atomic-template-failure"'::jsonb
    ), '{statuses,0,id}', '"a1000000-0000-4000-8000-000000000111"'::jsonb
    ), '{statuses,1,id}', '"a1000000-0000-4000-8000-000000000112"'::jsonb
    ), '{transitions,0,id}', '"a1000000-0000-4000-8000-000000000211"'::jsonb
    ), '{transitions,0,to_status_code}', '"missing_status"'::jsonb)
  )$$,
  '23503',
  null,
  'a child-row foreign-key failure aborts the atomic transaction'
);
select is(
  (select count(*) from public.stores where id = 'a1000000-0000-4000-8000-000000000020'),
  0::bigint,
  'failed atomic creation leaves no store residue'
);

select * from finish();
rollback;
