begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
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


create function pg_temp.notify(
 op integer default 1, expected text default '2026-09-07T10:00:00Z', message text default 'Manual message',
 channel text default 'whatsapp', template text default 'repair_status', phone text default '+390000007720',
 target text default null, actor_suffix integer default 7701,
 target_store uuid default '00000000-0000-4000-8000-000000007700'
) returns jsonb language sql as $f$
 select public.repairdesk_record_order_notification(target_store,
 ('00000000-0000-4000-8000-'||lpad(actor_suffix::text,12,'0'))::uuid,
 '00000000-0000-4000-8000-000000007730',expected,
 ('00000000-0000-4000-8000-'||lpad((7900+op)::text,12,'0'))::uuid,
 message,channel,template,phone,target);
$f$;
create function pg_temp.notification_state() returns jsonb language sql as $f$
 select jsonb_build_object(
 'order',(select to_jsonb(r) from public.repair_orders r where id='00000000-0000-4000-8000-000000007730'),
 'messages',(select count(*) from public.message_logs where order_id='00000000-0000-4000-8000-000000007730'),
 'events',(select count(*) from public.order_events where order_id='00000000-0000-4000-8000-000000007730'),
 'audits',(select count(*) from public.audit_logs where entity_id='00000000-0000-4000-8000-000000007730'),
 'receipts',(select count(*) from public.repairdesk_order_mutation_operations where order_id='00000000-0000-4000-8000-000000007730'),
 'revisions',(select jsonb_agg(to_jsonb(r) order by r.domain) from public.repairdesk_store_domain_versions r where store_id='00000000-0000-4000-8000-000000007700'));
$f$;
grant execute on function pg_temp.notify(integer,text,text,text,text,text,text,integer,uuid) to service_role;
grant execute on function pg_temp.notification_state() to service_role;
create temporary table notification_results(label text primary key,value jsonb);
grant all on notification_results to service_role;
select ok(not has_function_privilege('anon','public.repairdesk_record_order_notification(uuid,uuid,uuid,text,uuid,text,text,text,text,text)','execute'),'anon denied');
select ok(not has_function_privilege('authenticated','public.repairdesk_record_order_notification(uuid,uuid,uuid,text,uuid,text,text,text,text,text)','execute'),'authenticated denied');
select ok(has_function_privilege('service_role','public.repairdesk_record_order_notification(uuid,uuid,uuid,text,uuid,text,text,text,text,text)','execute'),'service executes');
select ok(not (select prosecdef from pg_proc where oid='public.repairdesk_record_order_notification(uuid,uuid,uuid,text,uuid,text,text,text,text,text)'::regprocedure),'invoker rights');
set local role service_role;
insert into notification_results values ('initial',pg_temp.notification_state());
select is(pg_temp.notify(10,'2000-01-01T00:00:00Z')->>'code','stale_version','stale version rejected');
select is(pg_temp.notify(11,'2026-09-07T10:00:00Z','Message','whatsapp','pickup_ready')->>'code','custody_required','pickup requires shop custody');
select is(pg_temp.notify(12,'2026-09-07T10:00:00Z','Message','whatsapp','approval_request')->>'code','invalid_request','approval cannot use ordinary notification');
select is(pg_temp.notify(13,'2026-09-07T10:00:00Z','Message','whatsapp','repair_status',null,'completed')->>'code','invalid_transition','completion cannot piggyback');
select is(pg_temp.notify(14,'2026-09-07T10:00:00Z','Message','whatsapp','repair_status',null,null,7703)->>'code','actor_forbidden','technician denied');
select is(pg_temp.notify(15,'2026-09-07T10:00:00Z','Message','whatsapp','repair_status',null,null,7701,'00000000-0000-4000-8000-000000007710')->>'code','order_not_found','other store cannot access order');
select is(pg_temp.notification_state(),(select value from notification_results where label='initial'),'all rejected writes preserve entire state and revisions');
insert into notification_results values ('success',pg_temp.notify());
select is((select value->>'ok' from notification_results where label='success'),'true','current snapshot records notification');
select is((select value->>'delivery_verified' from notification_results where label='success'),'false','manual recording is not delivery proof');
select ok((select (value->>'updated_at')::timestamptz>'2026-09-07T10:00:00Z'::timestamptz from notification_results where label='success'),'actual version strictly increases');
insert into notification_results values ('committed',pg_temp.notification_state());
select is(pg_temp.notify()->>'replayed','true','exact replay is resolved before stale CAS');
select is(pg_temp.notification_state(),(select value from notification_results where label='committed'),'replay adds no message event audit receipt or revision');
select is(pg_temp.notify(1,'2026-09-07T10:00:00Z','Changed')->>'code','idempotency_conflict','changed body cannot reuse key');
select is(pg_temp.notify(1,'2026-09-07T10:00:00Z','Manual message','sms')->>'code','idempotency_conflict','changed channel cannot reuse key');
select is(pg_temp.notify(1,'2026-09-07T10:00:00Z','Manual message','whatsapp','parts_update')->>'code','idempotency_conflict','changed template cannot reuse key');
select is(pg_temp.notify(1,'2026-09-07T10:00:00Z','Manual message','whatsapp','repair_status','+390000007721')->>'code','idempotency_conflict','changed phone cannot reuse key');
select is(pg_temp.notify(1,'2026-09-07T10:00:00Z','Manual message','whatsapp','repair_status','+390000007720','notified')->>'code','idempotency_conflict','changed transition cannot reuse key');
select is(pg_temp.notify(1,'2026-09-07T10:00:00+00:00')->>'code','idempotency_conflict','original version string belongs to the intent');
select is(pg_temp.notify(1,'2026-09-07T10:00:00Z','Manual message','whatsapp','repair_status','+390000007720',null,7702)->>'code','idempotency_conflict','another actor cannot replay');
select is(pg_temp.notification_state(),(select value from notification_results where label='committed'),'intent conflicts have zero writes');
reset role;
-- Each possible late failure must restore the order and every derived record/revision.
create function pg_temp.fail_notification_write() returns trigger language plpgsql as $$
begin
 if current_setting('repairdesk.notification_fail',true)=tg_table_name then raise exception 'synthetic notification failure'; end if;
 return new;
end $$;
create trigger notification_fail_message before insert on public.message_logs for each row execute function pg_temp.fail_notification_write();
create trigger notification_fail_event before insert on public.order_events for each row execute function pg_temp.fail_notification_write();
create trigger notification_fail_audit before insert on public.audit_logs for each row execute function pg_temp.fail_notification_write();
create trigger notification_fail_receipt before insert on public.repairdesk_order_mutation_operations for each row execute function pg_temp.fail_notification_write();
set local role service_role;
set local repairdesk.notification_fail='message_logs';
select throws_ok($q$select pg_temp.notify(30,(select updated_at::text from public.repair_orders where id='00000000-0000-4000-8000-000000007730'))$q$,'P0001','synthetic notification failure','message_logs failure rolls back transaction');
select is(pg_temp.notification_state(),(select value from notification_results where label='committed'),'message_logs failure preserves full state');
set local repairdesk.notification_fail='order_events';
select throws_ok($q$select pg_temp.notify(31,(select updated_at::text from public.repair_orders where id='00000000-0000-4000-8000-000000007730'))$q$,'P0001','synthetic notification failure','order_events failure rolls back transaction');
select is(pg_temp.notification_state(),(select value from notification_results where label='committed'),'order_events failure preserves full state');
set local repairdesk.notification_fail='audit_logs';
select throws_ok($q$select pg_temp.notify(32,(select updated_at::text from public.repair_orders where id='00000000-0000-4000-8000-000000007730'))$q$,'P0001','synthetic notification failure','audit_logs failure rolls back transaction');
select is(pg_temp.notification_state(),(select value from notification_results where label='committed'),'audit_logs failure preserves full state');
set local repairdesk.notification_fail='repairdesk_order_mutation_operations';
select throws_ok($q$select pg_temp.notify(33,(select updated_at::text from public.repair_orders where id='00000000-0000-4000-8000-000000007730'))$q$,'P0001','synthetic notification failure','repairdesk_order_mutation_operations failure rolls back transaction');
select is(pg_temp.notification_state(),(select value from notification_results where label='committed'),'repairdesk_order_mutation_operations failure preserves full state');
set local repairdesk.notification_fail='';
select is(pg_temp.notify(33,(select updated_at::text from public.repair_orders where id='00000000-0000-4000-8000-000000007730'))->>'ok','true','failed transaction same-key retry succeeds');
reset role;
update public.store_memberships set status='inactive' where id='00000000-0000-4000-8000-000000007711';
set local role service_role;
select is(pg_temp.notify()->>'code','actor_forbidden','revoked actor cannot replay receipt');
reset role;
update public.store_memberships set status='active' where id='00000000-0000-4000-8000-000000007711';
-- A configured edge never authorizes bypassing a pending quote decision.
insert into public.order_workflow_statuses(store_id,code,label,short_label,bucket,enabled,allowed_for_create) values
 ('00000000-0000-4000-8000-000000007700','quoted','Quoted','Quoted','quote',true,false),
 ('00000000-0000-4000-8000-000000007700','repairing','Repairing','Repairing','repair',true,false);
insert into public.order_workflow_transitions(store_id,from_status_code,to_status_code,enabled) values
 ('00000000-0000-4000-8000-000000007700','quoted','repairing',true);
update public.repair_orders set status='quoted',workflow_status='quote',approval_status='pending',device_custody_status='with_shop'
 where id='00000000-0000-4000-8000-000000007730';
set local role service_role;
select is(pg_temp.notify(39,(select updated_at::text from public.repair_orders where id='00000000-0000-4000-8000-000000007730'),'Message','whatsapp','repair_status',null,'repairing')->>'code','invalid_transition','configured edge cannot bypass pending quote approval');
reset role;
-- Future timestamps still advance rather than collapse to wall clock.
update public.repair_orders set updated_at='2099-01-01T00:00:00.123456Z' where id='00000000-0000-4000-8000-000000007730';
set local role service_role;
select ok((pg_temp.notify(40,'2099-01-01T00:00:00.123456Z')->>'updated_at')::timestamptz>'2099-01-01T00:00:00.123456Z'::timestamptz,'future version advances by at least one microsecond');
reset role;
-- The body is freely editable: keep the selected recipient in scoped history, not audit/receipts.
create temporary table recipient_history_probe(version text,result jsonb);
grant all on recipient_history_probe to service_role;
set local role service_role;
insert into recipient_history_probe(version) select updated_at::text from public.repair_orders where id='00000000-0000-4000-8000-000000007730';
update recipient_history_probe set result=pg_temp.notify(50,version,'No phone appears in this message','whatsapp','repair_status','+390000007799');
select is((select result->>'ok' from recipient_history_probe),'true','alternate recipient records independently of message body');
reset role;
update public.customers set phone_e164='+390000007788',phone_raw='390000007788' where id='00000000-0000-4000-8000-000000007720';
set local role service_role;
select is((select payload->>'recipient_phone' from public.order_events where id=(select (result->>'event_id')::uuid from recipient_history_probe)),'+390000007799','history retains selected alternate number after customer phone changes');
select ok(not (select metadata ? 'recipient_phone' or metadata::text like '%+390000007799%' from public.audit_logs where metadata->>'operation_id'='00000000-0000-4000-8000-000000007950'),'audit metadata excludes recipient phone');
select ok(not (select response_summary ? 'recipient_phone' or response_summary ? 'body' or response_summary::text like '%+390000007799%' from public.repairdesk_order_mutation_operations where store_id='00000000-0000-4000-8000-000000007700' and operation_id='00000000-0000-4000-8000-000000007950'),'receipt excludes body and recipient phone');
insert into notification_results values ('recipient-committed',pg_temp.notification_state());
select is((select pg_temp.notify(50,version,'No phone appears in this message','whatsapp','repair_status','+390000007799')->>'replayed' from recipient_history_probe),'true','recipient intent replays exactly after customer changes');
select is(pg_temp.notification_state(),(select value from notification_results where label='recipient-committed'),'recipient replay creates no duplicate event or other writes');
reset role;
select * from finish();
rollback;
