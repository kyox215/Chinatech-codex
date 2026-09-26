-- Synthetic fixture for a task-owned empty PG17 database bootstrapped by orders_remediation_bootstrap.py.
-- Raises on every failed assertion. No external services, secrets or production data.
\set ON_ERROR_STOP on
create function pg_temp.assert_true(value boolean, message text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'assertion failed: %',message; end if; end $$;
insert into public.stores values('00000000-0000-4000-8000-000000000001','active'),('00000000-0000-4000-8000-000000000002','active');
insert into public.store_lifecycles(store_id) select id from public.stores;
insert into public.staff_profiles(id,display_name,status) values
 ('00000000-0000-4000-8000-000000000011','Owner','active'),
 ('00000000-0000-4000-8000-000000000012','Tech','active'),
 ('00000000-0000-4000-8000-000000000013','Foreign','active');
insert into public.store_memberships(id,store_id,user_id,role,status) values
 ('00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000011','owner','active'),
 ('00000000-0000-4000-8000-000000000022','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000012','technician','active'),
 ('00000000-0000-4000-8000-000000000023','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000013','owner','active');
insert into public.order_workflow_statuses(id,store_id,code,label,bucket,sort_order,enabled,allowed_for_create,is_default_create_status) values
 ('00000000-0000-4000-8000-000000000031','00000000-0000-4000-8000-000000000001','new','New','intake',10,true,true,true),
 ('00000000-0000-4000-8000-000000000032','00000000-0000-4000-8000-000000000001','repairing','Repair','repair',20,true,false,false),
 ('00000000-0000-4000-8000-000000000033','00000000-0000-4000-8000-000000000001','completed','Done','done',30,true,false,false);
insert into public.order_workflow_transitions(store_id,from_status_code,to_status_code,enabled,is_primary) values
 ('00000000-0000-4000-8000-000000000001','new','repairing',true,true),
 ('00000000-0000-4000-8000-000000000001','new','completed',false,false);
insert into public.repair_orders(id,store_id,status,workflow_status,assignee_membership_id,device_custody_status,updated_at) values
 ('00000000-0000-4000-8000-000000000041','00000000-0000-4000-8000-000000000001','new','intake','00000000-0000-4000-8000-000000000021','with_shop','2026-09-26T00:00:00Z'),
 ('00000000-0000-4000-8000-000000000042','00000000-0000-4000-8000-000000000001','new','intake','00000000-0000-4000-8000-000000000021','with_shop','2026-09-26T00:00:00Z');
select pg_temp.assert_true(not has_function_privilege('anon','public.repairdesk_save_order_workflow(uuid,uuid,text,jsonb)','execute'),'anon configuration RPC denied');
select pg_temp.assert_true(not has_function_privilege('authenticated','public.repairdesk_order_transition_receipt(uuid,uuid,uuid,uuid,text)','execute'),'authenticated receipt denied');
select pg_temp.assert_true(not exists(select 1 from pg_proc where oid in ('public.repairdesk_save_order_workflow(uuid,uuid,text,jsonb)'::regprocedure,'public.repairdesk_order_transition_receipt(uuid,uuid,uuid,uuid,text)'::regprocedure) and prosecdef),'RPCs are invoker');
select pg_temp.assert_true((select count(*)=2 from pg_proc where oid in ('public.repairdesk_save_order_workflow(uuid,uuid,text,jsonb)'::regprocedure,'public.repairdesk_order_transition_receipt(uuid,uuid,uuid,uuid,text)'::regprocedure) and proconfig @> array['search_path=""']),'RPCs use fixed empty search path');
create function pg_temp.config(mode text,input jsonb, actor_id uuid default '00000000-0000-4000-8000-000000000011') returns jsonb language sql as $$
 select public.repairdesk_save_order_workflow('00000000-0000-4000-8000-000000000001',actor_id,mode,input);
$$;
create function pg_temp.receipt(hash text default repeat('a',64),actor_id uuid default '00000000-0000-4000-8000-000000000011',store_id uuid default '00000000-0000-4000-8000-000000000001') returns jsonb language sql as $$
 select public.repairdesk_order_transition_receipt(store_id,actor_id,'00000000-0000-4000-8000-000000000041','00000000-0000-4000-8000-000000000051',hash);
$$;
grant execute on function pg_temp.assert_true(boolean,text),pg_temp.config(text,jsonb,uuid),pg_temp.receipt(text,uuid,uuid) to service_role;
create temp table snapshots(label text primary key,value jsonb);
grant all on snapshots to service_role;
insert into snapshots values('statuses',(select jsonb_agg(to_jsonb(s) order by id) from public.order_workflow_statuses s)),('edges',(select jsonb_agg(to_jsonb(t) order by id) from public.order_workflow_transitions t));
create function pg_temp.inject_failure() returns trigger language plpgsql as $$
begin
 if current_setting('repairdesk.test_failure',true)='status' and to_jsonb(new)->>'code'='repairing' then raise exception 'injected status failure'; end if;
 if current_setting('repairdesk.test_failure',true)='edge' and to_jsonb(new)->>'to_status_code'='completed' and (to_jsonb(new)->>'enabled')::boolean then raise exception 'injected edge failure'; end if;
 return new;
end $$;
create trigger test_status_failure before update or insert on public.order_workflow_statuses for each row execute function pg_temp.inject_failure();
create trigger test_edge_failure before update or insert on public.order_workflow_transitions for each row execute function pg_temp.inject_failure();
set role service_role;
set repairdesk.test_failure='status';
do $$ begin
 begin perform pg_temp.config('update_status','{"id":"00000000-0000-4000-8000-000000000032","is_default_create_status":true}'); raise exception 'expected failure missing';
 exception when raise_exception then if sqlerrm<>'injected status failure' then raise; end if; end;
end $$;
select pg_temp.assert_true((select jsonb_agg(to_jsonb(s) order by id) from public.order_workflow_statuses s)=(select value from snapshots where label='statuses'),'late status failure rolls default switch back byte for byte');
-- A duplicate-code insert fails AFTER the default is unset, and must restore it too.
set repairdesk.test_failure='';
do $$ begin
 begin perform pg_temp.config('create_status','{"code":"new","label":"Duplicate","is_default_create_status":true}'); raise exception 'expected unique violation missing';
 exception when unique_violation then null; end;
end $$;
select pg_temp.assert_true((select jsonb_agg(to_jsonb(s) order by id) from public.order_workflow_statuses s)=(select value from snapshots where label='statuses'),'failed create restores default and all timestamps');
set repairdesk.test_failure='edge';
do $$ begin
 begin perform pg_temp.config('transitions','{"from_status_code":"new","transitions":[{"to_status_code":"completed","enabled":true,"is_primary":true}]}'); raise exception 'expected failure missing';
 exception when raise_exception then if sqlerrm<>'injected edge failure' then raise; end if; end;
end $$;
select pg_temp.assert_true((select jsonb_agg(to_jsonb(t) order by id) from public.order_workflow_transitions t)=(select value from snapshots where label='edges'),'late edge failure restores all edges byte for byte');
set repairdesk.test_failure='';
do $$ begin
 begin perform pg_temp.config('update_status','{"id":"00000000-0000-4000-8000-000000000032","is_default_create_status":true}','00000000-0000-4000-8000-000000000013'); raise exception 'expected forbidden missing';
 exception when insufficient_privilege then null; end;
 begin perform pg_temp.config('transitions','{"from_status_code":"new","transitions":[]}','00000000-0000-4000-8000-000000000012'); raise exception 'expected forbidden missing';
 exception when insufficient_privilege then null; end;
end $$;
select pg_temp.config('update_status','{"id":"00000000-0000-4000-8000-000000000032","is_default_create_status":true}');
select pg_temp.assert_true((select count(*)=1 from public.order_workflow_statuses where is_default_create_status and enabled),'exactly one default survives success');
select pg_temp.assert_true((select allowed_for_create from public.order_workflow_statuses where code='repairing'),'new default always allowed for create');
select pg_temp.config('transitions','{"from_status_code":"new","transitions":[{"to_status_code":"repairing","enabled":true},{"to_status_code":"completed","enabled":true,"is_primary":true}]}');
select pg_temp.assert_true((select count(*)=1 from public.order_workflow_transitions where enabled and is_primary),'one primary edge after success');
select pg_temp.assert_true((select to_status_code='completed' from public.order_workflow_transitions where enabled and is_primary),'requested primary selected');
select pg_temp.assert_true(pg_temp.receipt()->>'found'='false','no receipt before write');
select pg_temp.assert_true(public.repairdesk_apply_order_atomic_mutation(
 '00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000041','00000000-0000-4000-8000-000000000011','2026-09-25T00:00:00Z',
 '{"status":"repairing","workflow_status":"repair"}','status_changed',jsonb_build_object('from','new','to','repairing','transition_request_hash',repeat('b',64)),
 '00000000-0000-4000-8000-000000000052')->>'code'='stale_version','stale observed version cannot mutate');
select pg_temp.assert_true(public.repairdesk_apply_order_atomic_mutation(
 '00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000041','00000000-0000-4000-8000-000000000011','2026-09-26T00:00:00Z',
 '{"status":"completed","workflow_status":"closed","device_custody_status":"with_customer","delivered_at":"2026-09-26T10:00:00Z","completed_at":"2026-09-26T10:00:00Z"}',
 'status_changed',jsonb_build_object('from','new','to','completed','transition_request_hash',repeat('a',64)),
 '00000000-0000-4000-8000-000000000051')->>'ok'='true','completion commits');
select pg_temp.assert_true(pg_temp.receipt()->'receipt'='{"ok":true,"from":"new","to":"completed"}'::jsonb,'completion replay returns original receipt despite terminal current state');
select pg_temp.assert_true(pg_temp.receipt(repeat('b',64))->>'code'='idempotency_conflict','changed intent rejected');
select pg_temp.assert_true(pg_temp.receipt(repeat('a',64),'00000000-0000-4000-8000-000000000013')->>'code'='actor_forbidden','foreign actor cannot read receipt');
select pg_temp.assert_true(pg_temp.receipt(repeat('a',64),'00000000-0000-4000-8000-000000000012')->>'code'='actor_forbidden','unassigned technician cannot read receipt');
select pg_temp.assert_true(pg_temp.receipt(repeat('a',64),'00000000-0000-4000-8000-000000000013','00000000-0000-4000-8000-000000000002')->>'code'='order_not_found','foreign store cannot read receipt');
update public.store_memberships set status='inactive' where id='00000000-0000-4000-8000-000000000021';
select pg_temp.assert_true(pg_temp.receipt()->>'code'='actor_forbidden','revoked membership cannot replay');
update public.store_memberships set status='active' where id='00000000-0000-4000-8000-000000000021';
update public.stores set status='suspended' where id='00000000-0000-4000-8000-000000000001';
select pg_temp.assert_true(pg_temp.receipt()->>'code'='actor_forbidden','suspended store cannot replay');
update public.stores set status='active' where id='00000000-0000-4000-8000-000000000001';
select pg_temp.assert_true((select count(*)=1 from public.order_events where order_id='00000000-0000-4000-8000-000000000041'),'receipt reads add no event');
reset role;
drop trigger test_status_failure on public.order_workflow_statuses;
drop trigger test_edge_failure on public.order_workflow_transitions;
select 'orders remediation atomic assertions passed' as result;
