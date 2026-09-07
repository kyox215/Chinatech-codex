begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
select ok(not has_function_privilege('anon', 'public.repairdesk_mutate_order_v3(uuid,uuid,uuid,timestamptz,uuid,text,text,jsonb,jsonb)', 'execute'), 'anon cannot execute mutation');
select ok(not has_function_privilege('authenticated', 'public.repairdesk_mutate_order_v3(uuid,uuid,uuid,timestamptz,uuid,text,text,jsonb,jsonb)', 'execute'), 'authenticated cannot execute mutation');
select ok(has_function_privilege('service_role', 'public.repairdesk_mutate_order_v3(uuid,uuid,uuid,timestamptz,uuid,text,text,jsonb,jsonb)', 'execute'), 'service can execute mutation');
select ok(not (select prosecdef from pg_proc where oid = 'public.repairdesk_mutate_order_v3(uuid,uuid,uuid,timestamptz,uuid,text,text,jsonb,jsonb)'::regprocedure), 'mutation uses invoker rights');
select ok((select relrowsecurity from pg_class where oid = 'public.repairdesk_order_mutation_operations'::regclass), 'receipts have RLS');

select ok(has_table_privilege('service_role', 'public.repairdesk_order_mutation_operations', 'select'), 'service can read receipts');
select ok(has_table_privilege('service_role', 'public.repairdesk_order_mutation_operations', 'insert'), 'service can insert receipts');
select ok(not has_table_privilege('service_role', 'public.repairdesk_order_mutation_operations', 'update'), 'service cannot mutate receipts');
select ok(not has_table_privilege('service_role', 'public.repairdesk_order_mutation_operations', 'delete'), 'service cannot delete receipts');
select ok(not has_table_privilege('authenticated', 'public.repairdesk_order_mutation_operations', 'select'), 'authenticated cannot read receipts');

insert into auth.users(id,email,created_at,updated_at) values
 ('00000000-0000-4000-8000-000000007701','mutation-owner@example.test',now(),now()),
 ('00000000-0000-4000-8000-000000007702','mutation-other@example.test',now(),now()),
 ('00000000-0000-4000-8000-000000007703','mutation-tech@example.test',now(),now()),
 ('00000000-0000-4000-8000-000000007704','mutation-sales@example.test',now(),now());
insert into public.staff_profiles(id,email,display_name,role,status) values
 ('00000000-0000-4000-8000-000000007701','mutation-owner@example.test','Owner','owner','active'),
 ('00000000-0000-4000-8000-000000007702','mutation-other@example.test','Other','owner','active'),
 ('00000000-0000-4000-8000-000000007703','mutation-tech@example.test','Tech','technician','active'),
 ('00000000-0000-4000-8000-000000007704','mutation-sales@example.test','Sales','sales','active');
insert into public.stores(id,store_code,name,slug,status) values
 ('00000000-0000-4000-8000-000000007700','MUTATION_TEST','Mutation Test','mutation-v3-test','active'),
 ('00000000-0000-4000-8000-000000007710','MUTATION_OTHER','Mutation Other','mutation-v3-other','active');
insert into public.store_memberships(id,store_id,user_id,email,display_name,role,status) values
 ('00000000-0000-4000-8000-000000007711','00000000-0000-4000-8000-000000007700','00000000-0000-4000-8000-000000007701','mutation-owner@example.test','Owner','owner','active'),
 ('00000000-0000-4000-8000-000000007712','00000000-0000-4000-8000-000000007700','00000000-0000-4000-8000-000000007702','mutation-other@example.test','Other','owner','active'),
 ('00000000-0000-4000-8000-000000007713','00000000-0000-4000-8000-000000007700','00000000-0000-4000-8000-000000007703','mutation-tech@example.test','Tech','technician','active'),
 ('00000000-0000-4000-8000-000000007714','00000000-0000-4000-8000-000000007700','00000000-0000-4000-8000-000000007704','mutation-sales@example.test','Sales','sales','active'),
 ('00000000-0000-4000-8000-000000007715','00000000-0000-4000-8000-000000007710','00000000-0000-4000-8000-000000007701','mutation-owner@example.test','Owner','owner','active');
insert into public.order_workflow_statuses(store_id,code,label,short_label,bucket,enabled,allowed_for_create) values
 ('00000000-0000-4000-8000-000000007700','new','New','New','intake',true,true),
 ('00000000-0000-4000-8000-000000007700','completed','Completed','Completed','done',true,false);
insert into public.customers(id,store_id,name,phone_e164,phone_raw) values
 ('00000000-0000-4000-8000-000000007720','00000000-0000-4000-8000-000000007700','Synthetic Customer','+390000007720','390000007720');
insert into public.devices(id,store_id,customer_id,brand,model,serial_or_imei) values
 ('00000000-0000-4000-8000-000000007721','00000000-0000-4000-8000-000000007700','00000000-0000-4000-8000-000000007720','Test','Device','');
insert into public.repair_orders(id,store_id,customer_id,device_id,order_type,status,workflow_status,issue_description,
 quotation_amount,deposit_amount,balance_amount,is_paid,payment_status,approval_status,approval_flow_status,
 device_custody_status,record_state,technician_name,assignee_membership_id,fault_prices,warranty_months,warranty_text,updated_at) values
 ('00000000-0000-4000-8000-000000007730','00000000-0000-4000-8000-000000007700','00000000-0000-4000-8000-000000007720','00000000-0000-4000-8000-000000007721',
 'quick_repair','new','intake','Synthetic issue',100,0,50,false,'partial','pending','not_required','with_customer','active','Owner','00000000-0000-4000-8000-000000007711',
 '[{"name":"Repair","price":100,"currency_code":"EUR"}]',6,'6个月','2026-09-07T10:00:00Z');

create function pg_temp.mutate(
 quote numeric, op integer default 1, deposit numeric default 0,
 expected timestamptz default '2026-09-07T10:00:00Z', actor_suffix integer default 7701,
 target_store uuid default '00000000-0000-4000-8000-000000007700',
 mode text default 'finance', extra jsonb default '{}'::jsonb, customer jsonb default '{}'::jsonb
) returns jsonb language sql as $f$
 select public.repairdesk_mutate_order_v3(target_store,
  ('00000000-0000-4000-8000-' || lpad(actor_suffix::text,12,'0'))::uuid,
  '00000000-0000-4000-8000-000000007730', expected,
  ('00000000-0000-4000-8000-' || lpad((7800+op)::text,12,'0'))::uuid,
  repeat(md5(jsonb_build_object('quote',quote,'deposit',deposit,'expected',expected,'extra',extra,'customer',customer)::text),2), mode,
  case when mode = 'patch' then extra else jsonb_build_object('fault_prices',jsonb_build_array(jsonb_build_object('name','Repair','price',quote,'currency_code','EUR')),'quotation_amount',quote,'deposit_amount',deposit) || extra end,
  customer);
$f$;
grant execute on function pg_temp.mutate(numeric,integer,numeric,timestamptz,integer,uuid,text,jsonb,jsonb) to service_role;
create temporary table mutation_results(label text primary key, value jsonb);
grant all on mutation_results to service_role;
set local role service_role;
select is(pg_temp.mutate(20)->>'code','quote_below_received_amount','quote100/paid50 to20 rejected');
select is((select balance_amount::numeric from public.repair_orders where id='00000000-0000-4000-8000-000000007730'),50::numeric,'rejection preserves balance');
select is((select count(*) from public.repairdesk_order_mutation_operations where store_id='00000000-0000-4000-8000-000000007700'),0::bigint,'rejection has no receipt');
select is(pg_temp.mutate(120,2,10)->>'code','deposit_correction_required','derived payment prevents deposit edits');
insert into mutation_results values ('success',pg_temp.mutate(120));
select is((select value->>'ok' from mutation_results where label='success'),'true','quote120 succeeds');
select is((select balance_amount::numeric from public.repair_orders where id='00000000-0000-4000-8000-000000007730'),70::numeric,'quote120/paid50 produces balance70');
select is(pg_temp.mutate(120)->>'replayed','true','same intent replays despite stale version');
select is((select count(*) from public.order_events where order_id='00000000-0000-4000-8000-000000007730'),1::bigint,'replay adds no event');
select is((select count(*) from public.audit_logs where entity_id='00000000-0000-4000-8000-000000007730'),1::bigint,'replay adds no audit');
select is(pg_temp.mutate(121)->>'code','idempotency_conflict','same key changed payload conflicts');
select is(pg_temp.mutate(120,1,0,'2026-09-07T10:00:00Z',7702)->>'code','idempotency_conflict','another actor cannot replay');
select is(pg_temp.mutate(120,1,0,'2026-09-07T10:00:00Z',7701,'00000000-0000-4000-8000-000000007710')->>'code','order_not_found','another store cannot replay');
select is(pg_temp.mutate(120,5)->>'code','stale_version','new intent stale version rejected');
select is(pg_temp.mutate(120,6,0,'2026-09-07T10:00:00Z',7703)->>'code','actor_forbidden','technician cannot edit finance');
select is(pg_temp.mutate(120,7,0,'2026-09-07T10:00:00Z',7704)->>'code','actor_forbidden','sales cannot edit finance');
select is(pg_temp.mutate(0,8,0,(select updated_at from public.repair_orders where id='00000000-0000-4000-8000-000000007730'),7703,
 '00000000-0000-4000-8000-000000007700','patch','{"issue_description":"Forbidden"}')->>'code','actor_forbidden','technician cannot patch unassigned order');
reset role;

-- Inject failures at the two late writes; compare full earlier rows and all receipts.
create function pg_temp.fail_mutation_writes() returns trigger language plpgsql as $$
begin
 if current_setting('repairdesk.test_fail',true) = tg_table_name then raise exception 'synthetic write failure'; end if;
 return new;
end $$;
create trigger mutation_event_failure before insert on public.order_events for each row execute function pg_temp.fail_mutation_writes();
create trigger mutation_audit_failure before insert on public.audit_logs for each row execute function pg_temp.fail_mutation_writes();
insert into mutation_results values
 ('before_order',(select to_jsonb(ro) from public.repair_orders ro where id='00000000-0000-4000-8000-000000007730')),
 ('before_customer',(select to_jsonb(c) from public.customers c where id='00000000-0000-4000-8000-000000007720'));
set local role service_role;
set local repairdesk.test_fail = 'order_events';
select throws_ok($q$select pg_temp.mutate(140,10,0,(select updated_at from public.repair_orders where id='00000000-0000-4000-8000-000000007730'),7701,
 '00000000-0000-4000-8000-000000007700','update','{"warranty_months":12,"warranty_text":"12个月"}','{"name":"Changed"}')$q$,
 'P0001','synthetic write failure','event failure rolls back full edit');
select is((select to_jsonb(ro) from public.repair_orders ro where id='00000000-0000-4000-8000-000000007730'),(select value from mutation_results where label='before_order'),'event failure restores order');
select is((select to_jsonb(c) from public.customers c where id='00000000-0000-4000-8000-000000007720'),(select value from mutation_results where label='before_customer'),'event failure restores customer');
set local repairdesk.test_fail = 'audit_logs';
select throws_ok($q$select pg_temp.mutate(140,11,0,(select updated_at from public.repair_orders where id='00000000-0000-4000-8000-000000007730'),7701,
 '00000000-0000-4000-8000-000000007700','update','{"warranty_months":12,"warranty_text":"12个月"}','{"name":"Changed"}')$q$,
 'P0001','synthetic write failure','audit failure rolls back full edit');
select is((select to_jsonb(ro) from public.repair_orders ro where id='00000000-0000-4000-8000-000000007730'),(select value from mutation_results where label='before_order'),'audit failure restores order');
select is((select to_jsonb(c) from public.customers c where id='00000000-0000-4000-8000-000000007720'),(select value from mutation_results where label='before_customer'),'audit failure restores customer');
select is((select count(*) from public.order_events where order_id='00000000-0000-4000-8000-000000007730'),1::bigint,'late failure also rolls back warranty event');
select is((select count(*) from public.repairdesk_order_mutation_operations where store_id='00000000-0000-4000-8000-000000007700'),1::bigint,'late failure leaves no receipt');
set local repairdesk.test_fail = '';
select is(pg_temp.mutate(140,11,0,(select updated_at from public.repair_orders where id='00000000-0000-4000-8000-000000007730'),7701,
 '00000000-0000-4000-8000-000000007700','update','{"warranty_months":12,"warranty_text":"12个月","device_snapshot":{"brand":"Test","model":"Device","serial_or_imei":"SYNTHETIC_PRIVATE_IMEI"},"device_unlock_value":"SYNTHETIC_PRIVATE_UNLOCK","device_unlock_method":"text"}',
 '{"name":"Changed","phone_raw":"390000007720","phone_e164":"+390000007720"}')->>'ok','true','failed transaction can retry and preserve warranty event');
select is((select count(*) from public.order_events where order_id='00000000-0000-4000-8000-000000007730' and payload->>'action'='warranty_changed'),1::bigint,'warranty change has its own timeline event');
select ok(not exists(select 1 from public.audit_logs where entity_id='00000000-0000-4000-8000-000000007730' and
 (metadata::text like '%SYNTHETIC_PRIVATE%' or metadata::text like '%390000007720%')), 'audit stores no phone, IMEI or unlock plaintext');
reset role;
update public.repair_orders set record_state='active',quotation_amount=100,deposit_amount=0,balance_amount=100,is_paid=false,
 approval_status='approved',approval_flow_status='approved' where id='00000000-0000-4000-8000-000000007730';
set local role service_role;
select is(pg_temp.mutate(120,22,10,(select updated_at from public.repair_orders where id='00000000-0000-4000-8000-000000007730'))->>'code','deposit_correction_required','approval touched prevents deposit edits');
reset role;
update public.repair_orders set approval_status='pending',approval_flow_status='not_required' where id='00000000-0000-4000-8000-000000007730';
set local role service_role;
select is(pg_temp.mutate(120,23,10,(select updated_at from public.repair_orders where id='00000000-0000-4000-8000-000000007730'))->>'ok','true','untouched unpaid order allows bounded initial deposit edit');
select is((select balance_amount::numeric from public.repair_orders where id='00000000-0000-4000-8000-000000007730'),110::numeric,'initial deposit balance computed correctly');
-- A dedicated correction must remain the only route after the first reasoned correction.
select is(public.repairdesk_correct_initial_deposit_v2(
 '00000000-0000-4000-8000-000000007700','00000000-0000-4000-8000-000000007730','00000000-0000-4000-8000-000000007701',
 (select updated_at from public.repair_orders where id='00000000-0000-4000-8000-000000007730'),
 '00000000-0000-4000-8000-000000007790',15,'Synthetic correction',
 '{"schema_version":2,"kind":"other","context":"finance.initial_deposit_correction","primary_code":"other","note":"Synthetic correction","catalog_revision":"test-v1","internal_snapshot":{"locale":"zh-CN","text":"Synthetic correction"}}'
)->>'ok','true','dedicated reasoned deposit correction succeeds');
insert into mutation_results values ('after_correction',jsonb_build_object(
 'order',(select to_jsonb(ro) from public.repair_orders ro where id='00000000-0000-4000-8000-000000007730'),
 'events',(select count(*) from public.order_events where order_id='00000000-0000-4000-8000-000000007730'),
 'audits',(select count(*) from public.audit_logs where entity_id='00000000-0000-4000-8000-000000007730'),
 'receipts',(select count(*) from public.repairdesk_order_mutation_operations where order_id='00000000-0000-4000-8000-000000007730')));
select is(pg_temp.mutate(120,30,20,(select updated_at from public.repair_orders where id='00000000-0000-4000-8000-000000007730'))->>'code',
 'deposit_correction_required','generic finance cannot bypass correction history');
select is(pg_temp.mutate(120,31,20,(select updated_at from public.repair_orders where id='00000000-0000-4000-8000-000000007730'),7701,
 '00000000-0000-4000-8000-000000007700','update','{}','{"name":"Must not change"}')->>'code',
 'deposit_correction_required','mixed update cannot bypass correction history');
select is(jsonb_build_object(
 'order',(select to_jsonb(ro) from public.repair_orders ro where id='00000000-0000-4000-8000-000000007730'),
 'events',(select count(*) from public.order_events where order_id='00000000-0000-4000-8000-000000007730'),
 'audits',(select count(*) from public.audit_logs where entity_id='00000000-0000-4000-8000-000000007730'),
 'receipts',(select count(*) from public.repairdesk_order_mutation_operations where order_id='00000000-0000-4000-8000-000000007730')),
 (select value from mutation_results where label='after_correction'),'history rejection makes zero order/event/audit/receipt writes');
select is(public.repairdesk_correct_initial_deposit_v2(
 '00000000-0000-4000-8000-000000007700','00000000-0000-4000-8000-000000007730','00000000-0000-4000-8000-000000007701',
 (select updated_at from public.repair_orders where id='00000000-0000-4000-8000-000000007730'),
 '00000000-0000-4000-8000-000000007791',10,'Synthetic correction',
 '{"schema_version":2,"kind":"other","context":"finance.initial_deposit_correction","primary_code":"other","note":"Synthetic correction","catalog_revision":"test-v1","internal_snapshot":{"locale":"zh-CN","text":"Synthetic correction"}}'
)->>'ok','true','subsequent dedicated correction remains available');
reset role;
-- Synthetic legacy projection drift: the immutable payment ledger is larger than derived paid.
insert into public.order_payment_ledger(store_id,order_id,idempotency_key,actor_id,actor_name_snapshot,amount,payment_method,currency_code,
 balance_before,balance_after,order_updated_at_before,order_updated_at_after) values (
 '00000000-0000-4000-8000-000000007700','00000000-0000-4000-8000-000000007730','00000000-0000-4000-8000-000000007799',
 '00000000-0000-4000-8000-000000007701','Owner',40,'cash','EUR',110,70,'2026-09-07T10:00:00Z','2026-09-07T10:00:01Z');
set local role service_role;
select is(pg_temp.mutate(20,24,10,(select updated_at from public.repair_orders where id='00000000-0000-4000-8000-000000007730'))->>'code',
 'quote_below_received_amount','ledger paid protects quote despite stale legacy balance');
select is(pg_temp.mutate(140,25,20,(select updated_at from public.repair_orders where id='00000000-0000-4000-8000-000000007730'))->>'code',
 'deposit_correction_required','any ledger history blocks generic deposit edit');
select is(pg_temp.mutate(140,26,10,(select updated_at from public.repair_orders where id='00000000-0000-4000-8000-000000007730'))->>'ok',
 'true','quote amendment uses larger ledger sum');
select is((select balance_amount::numeric from public.repair_orders where id='00000000-0000-4000-8000-000000007730'),90::numeric,
 'quote140 minus deposit10 minus ledger40 yields balance90');
reset role;
-- Terminal/void fixtures are final; never weaken the immutable-order trigger.
update public.repair_orders set status='completed',workflow_status='closed' where id='00000000-0000-4000-8000-000000007730';
set local role service_role;
select is(pg_temp.mutate(150,20,0,(select updated_at from public.repair_orders where id='00000000-0000-4000-8000-000000007730'))->>'code','order_terminal','terminal order rejects routine edit');
set local repairdesk.terminal_operation = 'void';
update public.repair_orders set record_state='voided',voided_at=now(),deleted_at=now(),
 voided_by='00000000-0000-4000-8000-000000007701',void_reason='Synthetic void fixture'
 where id='00000000-0000-4000-8000-000000007730';
set local repairdesk.terminal_operation = '';
select is(pg_temp.mutate(150,21,0,(select updated_at from public.repair_orders where id='00000000-0000-4000-8000-000000007730'))->>'code','order_voided','void order rejects routine edit');
reset role;
select * from finish();
rollback;
