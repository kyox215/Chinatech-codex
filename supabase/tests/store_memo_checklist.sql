begin;

create extension if not exists pgtap with schema extensions;
select plan(22);

select has_column('public', 'store_memos', 'checklist', 'memo checklist column exists');
select has_column('public', 'store_memos', 'checklist_total', 'memo checklist total exists');
select has_column('public', 'store_memos', 'checklist_completed', 'memo checklist completed count exists');
select ok(
  has_function_privilege(
    'service_role',
    'public.repairdesk_mutate_store_memo_v2_rpc(uuid,uuid,uuid,text,uuid,uuid,bigint,text,text,text,timestamptz,uuid,jsonb,uuid,boolean)',
    'execute'
  ) and not has_function_privilege(
    'authenticated',
    'public.repairdesk_mutate_store_memo_v2_rpc(uuid,uuid,uuid,text,uuid,uuid,bigint,text,text,text,timestamptz,uuid,jsonb,uuid,boolean)',
    'execute'
  ),
  'checklist RPC remains service-role only'
);

insert into auth.users(id,email,created_at,updated_at) values
  ('92000000-0000-4000-8000-000000000001','checklist-owner@example.test',now(),now()),
  ('92000000-0000-4000-8000-000000000002','checklist-tech@example.test',now(),now()),
  ('92000000-0000-4000-8000-000000000003','checklist-viewer@example.test',now(),now());
insert into public.staff_profiles(id,email,display_name,role,status) values
  ('92000000-0000-4000-8000-000000000001','checklist-owner@example.test','Checklist Owner','owner','active'),
  ('92000000-0000-4000-8000-000000000002','checklist-tech@example.test','Checklist Tech','technician','active'),
  ('92000000-0000-4000-8000-000000000003','checklist-viewer@example.test','Checklist Viewer','viewer','active');
insert into public.stores(id,store_code,name,slug,owner_user_id,status) values
  ('92000000-0000-4000-8000-000000000010','CHECKLIST','Checklist Store','checklist-store','92000000-0000-4000-8000-000000000001','active');
insert into public.store_lifecycles(store_id,phase,revision) values
  ('92000000-0000-4000-8000-000000000010','active',1)
on conflict (store_id) do update set phase='active';
insert into public.store_memberships(id,store_id,user_id,email,display_name,role,status) values
  ('92000000-0000-4000-8000-000000000101','92000000-0000-4000-8000-000000000010','92000000-0000-4000-8000-000000000001','checklist-owner@example.test','Checklist Owner','owner','active'),
  ('92000000-0000-4000-8000-000000000102','92000000-0000-4000-8000-000000000010','92000000-0000-4000-8000-000000000002','checklist-tech@example.test','Checklist Tech','technician','active'),
  ('92000000-0000-4000-8000-000000000103','92000000-0000-4000-8000-000000000010','92000000-0000-4000-8000-000000000003','checklist-viewer@example.test','Checklist Viewer','viewer','active');

create temporary table checklist_results(label text primary key,payload jsonb) on commit drop;
insert into checklist_results values (
  'create',
  public.repairdesk_mutate_store_memo_v2_rpc(
    '92000000-0000-4000-8000-000000000010','92000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000101','create','92000000-0000-4000-8000-000000000201',
    null,null,'todo','Opening checklist','body',null,'92000000-0000-4000-8000-000000000102',
    '[{"id":"92000000-0000-4000-8000-000000000301","text":"Open shutters","completed":false},{"id":"92000000-0000-4000-8000-000000000302","text":"Count till","completed":true}]'::jsonb,
    null,null
  )
);
select is((select payload#>>'{memo,checklist_total}' from checklist_results where label='create'),'2','create stores list count');
select is((select payload#>>'{memo,checklist_completed}' from checklist_results where label='create'),'1','create stores completed count');
select is((select payload#>>'{memo,todo_status}' from checklist_results where label='create'),'pending','partial checklist keeps parent pending');
select is(
  (select version from public.repairdesk_store_domain_versions where store_id='92000000-0000-4000-8000-000000000010' and domain='memos'),
  1::bigint,
  'create advances memo revision once'
);

insert into checklist_results values (
  'checked',
  public.repairdesk_mutate_store_memo_v2_rpc(
    '92000000-0000-4000-8000-000000000010','92000000-0000-4000-8000-000000000002',
    '92000000-0000-4000-8000-000000000102','set_checklist_item','92000000-0000-4000-8000-000000000202',
    (select (payload#>>'{memo,id}')::uuid from checklist_results where label='create'),1,
    null,null,null,null,null,null,'92000000-0000-4000-8000-000000000301',true
  )
);
select is((select payload#>>'{memo,todo_status}' from checklist_results where label='checked'),'completed','checking last pending item completes parent');
select is((select payload#>>'{memo,version}' from checklist_results where label='checked'),'2','inline check advances memo version');
select is(
  (select version from public.repairdesk_store_domain_versions where store_id='92000000-0000-4000-8000-000000000010' and domain='memos'),
  2::bigint,
  'inline check advances memo revision once'
);

insert into checklist_results values (
  'replay',
  public.repairdesk_mutate_store_memo_v2_rpc(
    '92000000-0000-4000-8000-000000000010','92000000-0000-4000-8000-000000000002',
    '92000000-0000-4000-8000-000000000102','set_checklist_item','92000000-0000-4000-8000-000000000202',
    (select (payload#>>'{memo,id}')::uuid from checklist_results where label='create'),1,
    null,null,null,null,null,null,'92000000-0000-4000-8000-000000000301',true
  )
);
select is((select payload->>'replayed' from checklist_results where label='replay'),'true','same item command safely replays');
select is(
  (select version from public.repairdesk_store_domain_versions where store_id='92000000-0000-4000-8000-000000000010' and domain='memos'),
  2::bigint,
  'replay does not advance memo revision'
);

select throws_ok(
  format($sql$select public.repairdesk_mutate_store_memo_v2_rpc(
    '92000000-0000-4000-8000-000000000010','92000000-0000-4000-8000-000000000002',
    '92000000-0000-4000-8000-000000000102','set_checklist_item','92000000-0000-4000-8000-000000000203',
    %L,1,null,null,null,null,null,null,'92000000-0000-4000-8000-000000000302',false)$sql$,
    (select payload#>>'{memo,id}' from checklist_results where label='create')),
  'P0001','MEMO_VERSION_CONFLICT','stale inline check fails closed'
);
select is(
  (select version from public.repairdesk_store_domain_versions where store_id='92000000-0000-4000-8000-000000000010' and domain='memos'),
  2::bigint,
  'rejected CAS does not advance memo revision'
);

select throws_ok(
  format($sql$select public.repairdesk_mutate_store_memo_rpc(
    '92000000-0000-4000-8000-000000000010','92000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000101','reopen','92000000-0000-4000-8000-000000000204',
    %L,2,null,null,null,null,null)$sql$,
    (select payload#>>'{memo,id}' from checklist_results where label='create')),
  'P0001','MEMO_CHECKLIST_MANAGED','legacy transition cannot bypass checklist aggregate'
);

insert into checklist_results values (
  'cleared',
  public.repairdesk_mutate_store_memo_v2_rpc(
    '92000000-0000-4000-8000-000000000010','92000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000101','update','92000000-0000-4000-8000-000000000205',
    (select (payload#>>'{memo,id}')::uuid from checklist_results where label='create'),2,null,
    'Opening checklist','body',null,'92000000-0000-4000-8000-000000000102','[]'::jsonb,null,null
  )
);
select is((select payload#>>'{memo,checklist_total}' from checklist_results where label='cleared'),'0','explicit empty array clears checklist');
select is((select payload#>>'{memo,todo_status}' from checklist_results where label='cleared'),'completed','removing last item retains prior parent status');

select throws_ok(
  $$update public.store_memos set checklist='[{"id":"92000000-0000-4000-8000-000000000399","text":"","completed":false}]'::jsonb
    where store_id='92000000-0000-4000-8000-000000000010'$$,
  '23514',null,'database rejects blank checklist text'
);
select throws_ok(
  $$update public.store_memos set checklist='[{"id":"92000000-0000-4000-8000-000000000ABC","text":"Canonical UUID","completed":false}]'::jsonb
    where store_id='92000000-0000-4000-8000-000000000010'$$,
  '23514',null,'database rejects non-canonical uppercase checklist ids'
);
select throws_ok(
  format($sql$select public.repairdesk_mutate_store_memo_v2_rpc(
    '92000000-0000-4000-8000-000000000010','92000000-0000-4000-8000-000000000003',
    '92000000-0000-4000-8000-000000000103','set_checklist_item','92000000-0000-4000-8000-000000000206',
    %L,3,null,null,null,null,null,null,'92000000-0000-4000-8000-000000000301',false)$sql$,
    (select payload#>>'{memo,id}' from checklist_results where label='create')),
  'P0001','MEMO_FORBIDDEN','viewer cannot mutate checklist'
);
select is(
  (select count(*) from public.audit_logs where store_id='92000000-0000-4000-8000-000000000010' and action='memo_set_checklist_item'),
  1::bigint,
  'successful inline checklist mutation has one audit event'
);

select * from finish();
rollback;
