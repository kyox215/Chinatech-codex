-- Synthetic, rollback-only tests. Run only in the project's isolated candidate DB.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';
create extension if not exists pgtap with schema extensions;
select no_plan();
select ok(not has_function_privilege('anon', 'public.repairdesk_mutate_order_v4(uuid,uuid,uuid,timestamptz,uuid,text,text,jsonb,jsonb,timestamptz)', 'execute'), 'anon cannot call v4');
select ok(not has_function_privilege('authenticated', 'public.repairdesk_mutate_order_v4(uuid,uuid,uuid,timestamptz,uuid,text,text,jsonb,jsonb,timestamptz)', 'execute'), 'authenticated cannot call v4');
select ok(has_function_privilege('service_role', 'public.repairdesk_mutate_order_v4(uuid,uuid,uuid,timestamptz,uuid,text,text,jsonb,jsonb,timestamptz)', 'execute'), 'service can call v4');
select ok(not (select prosecdef from pg_proc where oid = 'public.repairdesk_mutate_order_v4(uuid,uuid,uuid,timestamptz,uuid,text,text,jsonb,jsonb,timestamptz)'::regprocedure), 'v4 is invoker');
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

update public.customers set updated_at='2026-09-17T08:00:00Z',contact_phones=array['+390000007750','+390000007751']
 where id='00000000-0000-4000-8000-000000007720';
update public.repair_orders set customer_name_snapshot='Historical name',customer_phone_snapshot='+390000007749'
 where id='00000000-0000-4000-8000-000000007730';
insert into public.repair_orders(id,store_id,customer_id,device_id,order_type,status,workflow_status,issue_description,
 quotation_amount,deposit_amount,balance_amount,is_paid,payment_status,approval_status,approval_flow_status,
 device_custody_status,record_state,technician_name,assignee_membership_id,fault_prices,warranty_months,warranty_text,updated_at)
select '00000000-0000-4000-8000-000000007731',store_id,customer_id,device_id,order_type,status,workflow_status,issue_description,
 quotation_amount,deposit_amount,balance_amount,is_paid,payment_status,approval_status,approval_flow_status,
 device_custody_status,record_state,technician_name,assignee_membership_id,fault_prices,warranty_months,warranty_text,updated_at
 from public.repair_orders where id='00000000-0000-4000-8000-000000007730';
insert into public.customers(id,store_id,name,phone_e164,phone_raw,contact_phones) values
 ('00000000-0000-4000-8000-000000007722','00000000-0000-4000-8000-000000007700','Other profile','+390000007760','390000007760',array['+390000007761']);

create function pg_temp.contact_mutate(
 changes jsonb, op integer, customer_version timestamptz default '2026-09-17T08:00:00Z',
 order_version timestamptz default '2026-09-07T10:00:00Z', target integer default 7730,
 extra jsonb default '{}'::jsonb, mode text default 'patch', actor integer default 7701
) returns jsonb language sql as $f$
 select public.repairdesk_mutate_order_v4('00000000-0000-4000-8000-000000007700',
 ('00000000-0000-4000-8000-'||lpad(actor::text,12,'0'))::uuid,
 ('00000000-0000-4000-8000-'||lpad(target::text,12,'0'))::uuid,
 order_version, ('00000000-0000-4000-8000-'||lpad((7900+op)::text,12,'0'))::uuid,
 repeat(md5(jsonb_build_object('changes',changes,'cv',customer_version,'ov',order_version,'extra',extra)::text),2),
 mode, extra, changes, customer_version);
$f$;
grant execute on function pg_temp.contact_mutate(jsonb,integer,timestamptz,timestamptz,integer,jsonb,text,integer) to service_role;
create temporary table contact_results(label text primary key, value jsonb);
grant all on contact_results to service_role;
set local role service_role;
select is(pg_temp.contact_mutate('{"name":"Changed"}',1,null)->>'code','customer_version_required','new customer write requires client CAS');
select is(pg_temp.contact_mutate('{"name":"Changed"}',2,'2026-09-17T07:00:00Z')->>'code','customer_stale_version','stale customer rejected independently from order version');
select is(pg_temp.contact_mutate('{"contact_phones":["+390000007760"]}',3)->>'code','customer_phone_conflict','backup-only conflicts with another primary');
select is(pg_temp.contact_mutate('{"contact_phones":["+390000007761"]}',4)->>'code','customer_phone_conflict','backup-only conflicts with another backup');
select is(pg_temp.contact_mutate('{"contact_phones":["invalid"]}',5)->>'code','invalid_customer_phone','invalid backup fails before writes');
select is(pg_temp.contact_mutate('{"name":"Changed"}',6,'2026-09-17T08:00:00Z','2026-09-07T10:00:00Z',7730,'{}','patch',7703)->>'code','actor_forbidden','unassigned technician cannot edit identity');
select is((select count(*) from public.order_events where order_id='00000000-0000-4000-8000-000000007730'),0::bigint,'all rejected changes create no events');
insert into contact_results values ('first',pg_temp.contact_mutate('{"name":"","phone_e164":"+390000007752","phone_raw":"390000007752","contact_phones":["+390000007753","+39 0000007753","+390000007752"]}',7));
select is((select value->>'ok' from contact_results where label='first'),'true','anonymous identity and separate primary/backups succeed');
select is((select name from public.customers where id='00000000-0000-4000-8000-000000007720'),'','blank name remains supported');
select is((select contact_phones from public.customers where id='00000000-0000-4000-8000-000000007720'),array['+390000007753'],'backups replace old values, deduplicate and exclude primary');
select is((select customer_name_snapshot from public.repair_orders where id='00000000-0000-4000-8000-000000007730'),'Historical name','historical name snapshot unchanged');
select is((select customer_phone_snapshot from public.repair_orders where id='00000000-0000-4000-8000-000000007730'),'+390000007749','historical phone snapshot unchanged');
select is(pg_temp.contact_mutate('{"name":"Other order draft"}',8,'2026-09-17T08:00:00Z','2026-09-07T10:00:00Z',7731)->>'code','customer_stale_version','same customer on a second unchanged order cannot overwrite first edit');
select is((select (value->>'customer_updated_at')::timestamptz from contact_results where label='first'),(select updated_at from public.customers where id='00000000-0000-4000-8000-000000007720'),'receipt returns committed customer version');
insert into contact_results values ('clear',pg_temp.contact_mutate('{"contact_phones":[]}',9,
 (select (value->>'customer_updated_at')::timestamptz from contact_results where label='first'),
 (select (value->>'updated_at')::timestamptz from contact_results where label='first')));
select is((select value->>'ok' from contact_results where label='clear'),'true','[] clears backups');
select is((select contact_phones from public.customers where id='00000000-0000-4000-8000-000000007720'),'{}'::text[],'no deleted backups reappear');
select is(pg_temp.contact_mutate('{"name":"","phone_e164":"+390000007752","phone_raw":"390000007752","contact_phones":["+390000007753","+39 0000007753","+390000007752"]}',7)->>'customer_updated_at',
 (select value->>'customer_updated_at' from contact_results where label='first'),'replay returns first customer version after later changes');
select is(pg_temp.contact_mutate('{"name":"","phone_e164":"+390000007752","phone_raw":"390000007752","contact_phones":["+390000007753","+39 0000007753","+390000007752"]}',7)->>'updated_at',
 (select value->>'updated_at' from contact_results where label='first'),'replay returns first order version');
select is(pg_temp.contact_mutate('{"name":"different intent"}',7)->>'code','idempotency_conflict','same operation changed input cannot replay');
select is((select count(*) from public.order_events where order_id='00000000-0000-4000-8000-000000007730'),2::bigint,'replays do not append events');
select is((select count(*) from public.audit_logs where entity_id='00000000-0000-4000-8000-000000007730'),2::bigint,'replays do not append audits');

-- A late failure must roll back the customer, order, audit, events and receipt.
reset role;
create function pg_temp.fail_contact_receipt() returns trigger language plpgsql as $$
begin raise exception 'synthetic receipt failure'; end $$;
create trigger contact_receipt_failure before insert on public.repairdesk_order_mutation_operations for each row execute function pg_temp.fail_contact_receipt();
insert into contact_results values
 ('before_order',(select to_jsonb(o) from public.repair_orders o where id='00000000-0000-4000-8000-000000007730')),
 ('before_customer',(select to_jsonb(c) from public.customers c where id='00000000-0000-4000-8000-000000007720'));
set local role service_role;
select throws_ok($q$select pg_temp.contact_mutate('{"name":"Must roll back"}',10,
 (select (value->>'customer_updated_at')::timestamptz from contact_results where label='clear'),
 (select (value->>'updated_at')::timestamptz from contact_results where label='clear'),7730,
 '{"fault_prices":[{"name":"Repair","price":120}],"quotation_amount":120,"deposit_amount":0}', 'update')$q$,
 'P0001','synthetic receipt failure','combined finance and identity rolls back on receipt failure');
select is((select to_jsonb(o) from public.repair_orders o where id='00000000-0000-4000-8000-000000007730'),(select value from contact_results where label='before_order'),'failure preserves full order');
select is((select to_jsonb(c) from public.customers c where id='00000000-0000-4000-8000-000000007720'),(select value from contact_results where label='before_customer'),'failure preserves full customer');
select is((select count(*) from public.order_events where order_id='00000000-0000-4000-8000-000000007730'),2::bigint,'failure rolls back events');
reset role;
drop trigger contact_receipt_failure on public.repairdesk_order_mutation_operations;

-- Seed an old receipt, then verify v3 replay and its current actor authorization.
insert into public.repairdesk_order_mutation_operations(store_id,actor_id,operation_id,order_id,request_hash,mode,response_summary)
 values('00000000-0000-4000-8000-000000007700','00000000-0000-4000-8000-000000007701','00000000-0000-4000-8000-000000007999','00000000-0000-4000-8000-000000007730',repeat('a',64),'patch','{"ok":true,"updated_at":"2026-09-01T00:00:00Z"}');
set local role service_role;
select is(public.repairdesk_mutate_order_v3('00000000-0000-4000-8000-000000007700','00000000-0000-4000-8000-000000007701','00000000-0000-4000-8000-000000007730','2026-09-01T00:00:00Z','00000000-0000-4000-8000-000000007999',repeat('a',64),'patch','{}','{"name":"old"}')->>'replayed','true','old v3 customer receipt remains replayable');
select is(public.repairdesk_mutate_order_v3('00000000-0000-4000-8000-000000007700','00000000-0000-4000-8000-000000007702','00000000-0000-4000-8000-000000007730','2026-09-01T00:00:00Z','00000000-0000-4000-8000-000000007999',repeat('a',64),'patch','{}','{"name":"old"}')->>'code','idempotency_conflict','another actor cannot replay historical receipt');
select is(public.repairdesk_mutate_order_v3('00000000-0000-4000-8000-000000007700','00000000-0000-4000-8000-000000007701','00000000-0000-4000-8000-000000007730','2026-09-01T00:00:00Z','00000000-0000-4000-8000-000000007998',repeat('a',64),'patch','{}','{"name":"new"}')->>'code','customer_version_required','v3 cannot start a new customer write');
select * from finish();
rollback;
