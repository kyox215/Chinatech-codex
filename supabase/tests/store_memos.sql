begin;

create extension if not exists pgtap with schema extensions;
select plan(43);

select has_table('public', 'store_memos', 'memo business table exists');
select has_table('public', 'store_memo_operation_receipts', 'memo receipt table exists');
select has_table('public', 'repairdesk_authenticated_rate_limits', 'generic authenticated limiter exists');
select ok((select relrowsecurity from pg_class where oid = 'public.store_memos'::regclass), 'memo RLS enabled');
select ok(not has_table_privilege('service_role', 'public.store_memos', 'insert'), 'service role cannot insert memos');
select ok(not has_table_privilege('service_role', 'public.store_memos', 'update'), 'service role cannot update memos');
select ok(has_table_privilege('service_role', 'public.store_memos', 'select'), 'service role can export memos');
select ok(has_table_privilege('service_role', 'public.store_memos', 'delete'), 'service role can run verified purge');
select ok(
  not has_table_privilege('service_role', 'public.store_memos', 'truncate')
    and not has_table_privilege('service_role', 'public.store_memo_operation_receipts', 'truncate'),
  'service role cannot truncate memo business tables'
);
select ok(not has_table_privilege('authenticated', 'public.store_memos', 'select'), 'browser cannot read memo table');
select ok(
  has_function_privilege('service_role', 'public.repairdesk_mutate_store_memo_rpc(uuid,uuid,uuid,text,uuid,uuid,bigint,text,text,text,timestamptz,uuid)', 'execute'),
  'service role can execute memo RPC'
);
select ok(
  has_function_privilege('service_role', 'public.repairdesk_consume_authenticated_rate_limit_rpc(character,text)', 'execute'),
  'service role can execute limiter RPC'
);
select ok(
  not has_function_privilege('authenticated', 'public.repairdesk_mutate_store_memo_rpc(uuid,uuid,uuid,text,uuid,uuid,bigint,text,text,text,timestamptz,uuid)', 'execute'),
  'browser cannot execute memo RPC'
);
select ok(
  not has_table_privilege('service_role', 'public.repairdesk_authenticated_rate_limits', 'select,insert,update,delete'),
  'service role has no limiter table DML'
);

insert into auth.users(id,email,created_at,updated_at) values
  ('91000000-0000-4000-8000-000000000001','memo-a@example.test',now(),now()),
  ('91000000-0000-4000-8000-000000000002','memo-b@example.test',now(),now()),
  ('91000000-0000-4000-8000-000000000003','memo-viewer@example.test',now(),now()),
  ('91000000-0000-4000-8000-000000000004','memo-tech@example.test',now(),now()),
  ('91000000-0000-4000-8000-000000000005','memo-sales@example.test',now(),now());

insert into public.staff_profiles(id,email,display_name,role,status) values
  ('91000000-0000-4000-8000-000000000001','memo-a@example.test','Owner A','owner','active'),
  ('91000000-0000-4000-8000-000000000002','memo-b@example.test','Owner B','owner','active'),
  ('91000000-0000-4000-8000-000000000003','memo-viewer@example.test','Viewer','viewer','active'),
  ('91000000-0000-4000-8000-000000000004','memo-tech@example.test','Tech','technician','active'),
  ('91000000-0000-4000-8000-000000000005','memo-sales@example.test','Sales','sales','active');

insert into public.stores(id,store_code,name,slug,owner_user_id,status) values
  ('91000000-0000-4000-8000-000000000010','MEMO_A','Memo A','memo-a','91000000-0000-4000-8000-000000000001','active'),
  ('91000000-0000-4000-8000-000000000020','MEMO_B','Memo B','memo-b','91000000-0000-4000-8000-000000000002','active');
insert into public.store_lifecycles(store_id,phase,revision) values
  ('91000000-0000-4000-8000-000000000010','active',1),
  ('91000000-0000-4000-8000-000000000020','active',1)
on conflict (store_id) do update set phase='active';

insert into public.store_memberships(id,store_id,user_id,email,display_name,role,status) values
  ('91000000-0000-4000-8000-000000000101','91000000-0000-4000-8000-000000000010','91000000-0000-4000-8000-000000000001','memo-a@example.test','Owner A','owner','active'),
  ('91000000-0000-4000-8000-000000000102','91000000-0000-4000-8000-000000000020','91000000-0000-4000-8000-000000000002','memo-b@example.test','Owner B','owner','active'),
  ('91000000-0000-4000-8000-000000000103','91000000-0000-4000-8000-000000000010','91000000-0000-4000-8000-000000000003','memo-viewer@example.test','Viewer','viewer','active'),
  ('91000000-0000-4000-8000-000000000104','91000000-0000-4000-8000-000000000010','91000000-0000-4000-8000-000000000004','memo-tech@example.test','Tech','technician','active'),
  ('91000000-0000-4000-8000-000000000105','91000000-0000-4000-8000-000000000010','91000000-0000-4000-8000-000000000005','memo-sales@example.test','Sales','sales','active');

create temporary table memo_test_results(label text primary key,payload jsonb) on commit drop;
insert into memo_test_results values (
  'owner_create',
  public.repairdesk_mutate_store_memo_rpc(
    '91000000-0000-4000-8000-000000000010','91000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000101','create','91000000-0000-4000-8000-000000000201',
    null,null,'todo','  Pipe | title  ','body | value',null,null
  )
);
select is((select payload->>'replayed' from memo_test_results where label='owner_create'),'false','create returns non-replay envelope');
select is((select payload#>>'{memo,title}' from memo_test_results where label='owner_create'),'Pipe | title','database trims title');

insert into memo_test_results values (
  'owner_replay',
  public.repairdesk_mutate_store_memo_rpc(
    '91000000-0000-4000-8000-000000000010','91000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000101','create','91000000-0000-4000-8000-000000000201',
    null,null,'todo','  Pipe | title  ','body | value',null,null
  )
);
select is((select payload->>'replayed' from memo_test_results where label='owner_replay'),'true','same key and payload replays');
select is((select payload->>'appliedVersion' from memo_test_results where label='owner_replay'),'1','replay preserves applied version');

select throws_ok(
  $$select public.repairdesk_mutate_store_memo_rpc(
    '91000000-0000-4000-8000-000000000010','91000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000101','create','91000000-0000-4000-8000-000000000201',
    null,null,'todo','Pipe','title | body | value',null,null)$$,
  'P0001','MEMO_IDEMPOTENCY_CONFLICT','pipe-delimited payloads cannot collide'
);
select throws_ok(
  $$select public.repairdesk_mutate_store_memo_rpc(
    '91000000-0000-4000-8000-000000000010','91000000-0000-4000-8000-000000000003',
    '91000000-0000-4000-8000-000000000103','create','91000000-0000-4000-8000-000000000202',
    null,null,'note','Viewer','',null,null)$$,
  'P0001','MEMO_FORBIDDEN','viewer cannot create'
);
select throws_ok(
  $$select public.repairdesk_mutate_store_memo_rpc(
    '91000000-0000-4000-8000-000000000020','91000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000101','create','91000000-0000-4000-8000-000000000203',
    null,null,'note','Cross store','',null,null)$$,
  'P0001','MEMO_FORBIDDEN','Store A membership cannot write Store B'
);

select throws_ok(
  format($sql$select public.repairdesk_mutate_store_memo_rpc(
    '91000000-0000-4000-8000-000000000010','91000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000101','update','91000000-0000-4000-8000-000000000204',
    %L,99,null,'stale','',null,null)$sql$,
    (select payload#>>'{memo,id}' from memo_test_results where label='owner_create')),
  'P0001','MEMO_VERSION_CONFLICT','stale expected version is rejected'
);
select throws_ok(
  format($sql$select public.repairdesk_mutate_store_memo_rpc(
    '91000000-0000-4000-8000-000000000010','91000000-0000-4000-8000-000000000004',
    '91000000-0000-4000-8000-000000000104','update','91000000-0000-4000-8000-000000000205',
    %L,1,null,'staff edit','',null,null)$sql$,
    (select payload#>>'{memo,id}' from memo_test_results where label='owner_create')),
  'P0001','MEMO_FORBIDDEN','assignee-independent staff cannot edit owner body'
);

insert into memo_test_results values (
  'tech_claim',
  public.repairdesk_mutate_store_memo_rpc(
    '91000000-0000-4000-8000-000000000010','91000000-0000-4000-8000-000000000004',
    '91000000-0000-4000-8000-000000000104','claim','91000000-0000-4000-8000-000000000206',
    (select (payload#>>'{memo,id}')::uuid from memo_test_results where label='owner_create'),1,null,null,null,null,null
  )
);
select is((select payload#>>'{memo,assignee_membership_id}' from memo_test_results where label='tech_claim'),'91000000-0000-4000-8000-000000000104','claim assigns only the actor');
select throws_ok(
  format($sql$select public.repairdesk_mutate_store_memo_rpc(
    '91000000-0000-4000-8000-000000000010','91000000-0000-4000-8000-000000000005',
    '91000000-0000-4000-8000-000000000105','claim','91000000-0000-4000-8000-000000000212',
    %L,1,null,null,null,null,null)$sql$,
    (select payload#>>'{memo,id}' from memo_test_results where label='owner_create')),
  'P0001','MEMO_VERSION_CONFLICT','concurrent stale claim loses deterministically'
);
select throws_ok(
  format($sql$select public.repairdesk_mutate_store_memo_rpc(
    '91000000-0000-4000-8000-000000000010','91000000-0000-4000-8000-000000000005',
    '91000000-0000-4000-8000-000000000105','complete','91000000-0000-4000-8000-000000000207',
    %L,2,null,null,null,null,null)$sql$,
    (select payload#>>'{memo,id}' from memo_test_results where label='owner_create')),
  'P0001','MEMO_FORBIDDEN','other staff cannot complete another assignee task'
);
insert into memo_test_results values (
  'tech_complete',
  public.repairdesk_mutate_store_memo_rpc(
    '91000000-0000-4000-8000-000000000010','91000000-0000-4000-8000-000000000004',
    '91000000-0000-4000-8000-000000000104','complete','91000000-0000-4000-8000-000000000208',
    (select (payload#>>'{memo,id}')::uuid from memo_test_results where label='owner_create'),2,null,null,null,null,null
  )
);
select is((select payload#>>'{memo,todo_status}' from memo_test_results where label='tech_complete'),'completed','creator or assignee can complete');

insert into memo_test_results values (
  'tech_create',
  public.repairdesk_mutate_store_memo_rpc(
    '91000000-0000-4000-8000-000000000010','91000000-0000-4000-8000-000000000004',
    '91000000-0000-4000-8000-000000000104','create','91000000-0000-4000-8000-000000000209',
    null,null,'todo','Tech todo','',null,'91000000-0000-4000-8000-000000000104'
  )
);
select throws_ok(
  format($sql$select public.repairdesk_mutate_store_memo_rpc(
    '91000000-0000-4000-8000-000000000010','91000000-0000-4000-8000-000000000004',
    '91000000-0000-4000-8000-000000000104','update','91000000-0000-4000-8000-000000000210',
    %L,1,null,'Tech todo','',null,null)$sql$,
    (select payload#>>'{memo,id}' from memo_test_results where label='tech_create')),
  'P0001','MEMO_FORBIDDEN','staff cannot unassign an existing owner'
);

update public.store_lifecycles set phase='archived',archived_at=now(),updated_at=now()
 where store_id='91000000-0000-4000-8000-000000000010';
select throws_ok(
  $$select public.repairdesk_mutate_store_memo_rpc(
    '91000000-0000-4000-8000-000000000010','91000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000101','create','91000000-0000-4000-8000-000000000211',
    null,null,'note','closed','',null,null)$$,
  'P0001','MEMO_FORBIDDEN','closed lifecycle rejects mutation before replay lookup'
);
update public.store_lifecycles set phase='active',archived_at=null,updated_at=now()
 where store_id='91000000-0000-4000-8000-000000000010';

select throws_ok(
  format('delete from public.store_memos where id=%L', (select payload#>>'{memo,id}' from memo_test_results where label='tech_create')),
  'P0001','MEMO_HARD_DELETE_FORBIDDEN','ordinary hard delete is refused'
);
select is(
  (select count(*) from pg_constraint where conname in (
    'store_memos_store_id_fkey','store_memo_operation_receipts_store_id_fkey','store_memo_receipts_memo_same_store_fkey'
  ) and confdeltype='r'),
  3::bigint,'store and receipt foreign keys are restrictive'
);
select is(
  (select count(*) from pg_trigger where tgname in (
    'repairdesk_lifecycle_fence_store_memos','repairdesk_lifecycle_fence_store_memo_operation_receipts'
  ) and not tgisinternal),
  2::bigint,'both memo business tables have lifecycle fences'
);
select is(
  (select count(*) from information_schema.columns where table_schema='public'
    and table_name in ('store_memos','store_memo_operation_receipts') and column_name='store_id'),
  2::bigint,'dynamic export and purge catalog discovers both memo tables'
);
select ok(
  pg_get_functiondef('private.bump_repairdesk_memos_domain_version()'::regprocedure)
    like '%tg_op = ''DELETE'' then return old%',
  'memo purge skips revision'
);
select ok(
  pg_get_functiondef('private.bump_repairdesk_order_domain_version()'::regprocedure)
    like '%repairdesk_purge_worker_write_allowed%',
  'order purge skips revision only through verified worker'
);

select public.repairdesk_consume_authenticated_rate_limit_rpc(repeat('a',64)::char(64),'write')
  from generate_series(1,31);
select is(
  (public.repairdesk_consume_authenticated_rate_limit_rpc(repeat('a',64)::char(64),'write')->>'allowed')::boolean,
  false,'failed write attempts remain durably counted'
);
insert into public.repairdesk_authenticated_rate_limits values
  (repeat('b',64),'read',date_trunc('minute',now())-interval '5 minutes',1,now()-interval '1 minute');
select public.repairdesk_consume_authenticated_rate_limit_rpc(repeat('c',64)::char(64),'read');
select is((select count(*) from public.repairdesk_authenticated_rate_limits where scope_hash=repeat('b',64)),0::bigint,'limiter opportunistically clears expired rows');
select throws_ok(
  $$update public.store_memos set title=' untrimmed ' where id=(select (payload#>>'{memo,id}')::uuid from memo_test_results where label='tech_create')$$,
  '23514',null,'database rejects untrimmed titles'
);
select throws_ok(
  $$update public.store_memos set updated_at=created_at-interval '1 second' where id=(select (payload#>>'{memo,id}')::uuid from memo_test_results where label='tech_create')$$,
  '23514',null,'database rejects invalid time ordering'
);
select is((select count(*) from public.store_memos where store_id='91000000-0000-4000-8000-000000000020'),0::bigint,'other tenant remains untouched');
select is((select prosecdef from pg_proc where oid='public.repairdesk_mutate_store_memo_rpc(uuid,uuid,uuid,text,uuid,uuid,bigint,text,text,text,timestamptz,uuid)'::regprocedure),true,'memo RPC is security definer');
select is((select proconfig[1] from pg_proc where oid='public.repairdesk_mutate_store_memo_rpc(uuid,uuid,uuid,text,uuid,uuid,bigint,text,text,text,timestamptz,uuid)'::regprocedure),'search_path=""','memo RPC fixes empty search path');
select is((select pg_get_userbyid(proowner) from pg_proc where oid='public.repairdesk_mutate_store_memo_rpc(uuid,uuid,uuid,text,uuid,uuid,bigint,text,text,text,timestamptz,uuid)'::regprocedure),'postgres','memo RPC is postgres-owned');

select * from finish();
rollback;
