-- SQL verifies only the transaction boundary; the Lead separately exercises real Storage.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
create extension if not exists pgtap with schema extensions;
select no_plan();
select ok(not has_function_privilege('anon','public.repairdesk_finalize_order_attachment_v1(uuid,uuid,uuid,uuid,text,jsonb,boolean)','execute'),'anon cannot finalize');
select ok(not has_function_privilege('authenticated','public.repairdesk_finalize_order_attachment_v1(uuid,uuid,uuid,uuid,text,jsonb,boolean)','execute'),'authenticated cannot finalize');
select ok(has_function_privilege('service_role','public.repairdesk_finalize_order_attachment_v1(uuid,uuid,uuid,uuid,text,jsonb,boolean)','execute'),'service role may finalize');
select ok(not (select prosecdef from pg_proc where oid='public.repairdesk_finalize_order_attachment_v1(uuid,uuid,uuid,uuid,text,jsonb,boolean)'::regprocedure),'finalize is invoker');
select ok(not has_table_privilege('authenticated','public.repairdesk_order_attachment_operations','select'),'receipt not directly readable');
insert into auth.users(id,email,created_at,updated_at) values
 ('00000000-0000-4000-8000-000000037701','attachment-receipt-owner@example.test',now(),now()),
 ('00000000-0000-4000-8000-000000037702','attachment-receipt-other@example.test',now(),now()),
 ('00000000-0000-4000-8000-000000037703','attachment-receipt-tech@example.test',now(),now()),
 ('00000000-0000-4000-8000-000000037704','attachment-receipt-sales@example.test',now(),now());
insert into public.staff_profiles(id,email,display_name,role,status) values
 ('00000000-0000-4000-8000-000000037701','attachment-receipt-owner@example.test','Owner','owner','active'),
 ('00000000-0000-4000-8000-000000037702','attachment-receipt-other@example.test','Other','owner','active'),
 ('00000000-0000-4000-8000-000000037703','attachment-receipt-tech@example.test','Tech','technician','active'),
 ('00000000-0000-4000-8000-000000037704','attachment-receipt-sales@example.test','Sales','sales','active');
insert into public.stores(id,store_code,name,slug,status) values
 ('00000000-0000-4000-8000-000000037700','ATTACHMENT_RECEIPT','Mutation Test','attachment-receipt-v3-test','active'),
 ('00000000-0000-4000-8000-000000037710','ATTACHMENT_OTHER','Mutation Other','attachment-receipt-v3-other','active');
insert into public.store_memberships(id,store_id,user_id,email,display_name,role,status) values
 ('00000000-0000-4000-8000-000000037711','00000000-0000-4000-8000-000000037700','00000000-0000-4000-8000-000000037701','attachment-receipt-owner@example.test','Owner','owner','active'),
 ('00000000-0000-4000-8000-000000037712','00000000-0000-4000-8000-000000037700','00000000-0000-4000-8000-000000037702','attachment-receipt-other@example.test','Other','owner','active'),
 ('00000000-0000-4000-8000-000000037713','00000000-0000-4000-8000-000000037700','00000000-0000-4000-8000-000000037703','attachment-receipt-tech@example.test','Tech','technician','active'),
 ('00000000-0000-4000-8000-000000037714','00000000-0000-4000-8000-000000037700','00000000-0000-4000-8000-000000037704','attachment-receipt-sales@example.test','Sales','sales','active'),
 ('00000000-0000-4000-8000-000000037715','00000000-0000-4000-8000-000000037710','00000000-0000-4000-8000-000000037701','attachment-receipt-owner@example.test','Owner','owner','active');
insert into public.order_workflow_statuses(store_id,code,label,short_label,bucket,enabled,allowed_for_create) values
 ('00000000-0000-4000-8000-000000037700','new','New','New','intake',true,true),
 ('00000000-0000-4000-8000-000000037700','completed','Completed','Completed','done',true,false);
insert into public.customers(id,store_id,name,phone_e164,phone_raw) values
 ('00000000-0000-4000-8000-000000037720','00000000-0000-4000-8000-000000037700','Synthetic Customer','+390000037720','390000037720');
insert into public.devices(id,store_id,customer_id,brand,model,serial_or_imei) values
 ('00000000-0000-4000-8000-000000037721','00000000-0000-4000-8000-000000037700','00000000-0000-4000-8000-000000037720','Test','Device','');
insert into public.repair_orders(id,store_id,customer_id,device_id,order_type,status,workflow_status,issue_description,
 quotation_amount,deposit_amount,balance_amount,is_paid,payment_status,approval_status,approval_flow_status,
 device_custody_status,record_state,technician_name,assignee_membership_id,fault_prices,warranty_months,warranty_text,updated_at) values
 ('00000000-0000-4000-8000-000000037730','00000000-0000-4000-8000-000000037700','00000000-0000-4000-8000-000000037720','00000000-0000-4000-8000-000000037721',
 'quick_repair','new','intake','Synthetic issue',100,0,100,false,'unpaid','pending','not_required','with_customer','active','Owner','00000000-0000-4000-8000-000000037711',
 '[{"name":"Repair","price":100,"currency_code":"EUR"}]',6,'6个月','2026-09-07T10:00:00Z');


create function pg_temp.attachment_metadata(op integer) returns jsonb language sql as $$
 select jsonb_build_object('kind','fault_photo','file_name','synthetic-private-name.jpg','mime_type','image/jpeg','file_size',4,
 'storage_bucket','repairdesk-order-attachments','storage_path','00000000-0000-4000-8000-000000037700/00000000-0000-4000-8000-000000037730/'||
 '00000000-0000-4000-8000-'||lpad((37900+op)::text,12,'0')||'-'||repeat('a',64)||'.jpg','content_sha256',repeat('a',64),'note','synthetic private note');
$$;
create function pg_temp.finalize_attachment(op integer,check_only boolean default false,actor integer default 37701,hash text default repeat('b',64),extra jsonb default '{}') returns jsonb language sql as $$
 select public.repairdesk_finalize_order_attachment_v1('00000000-0000-4000-8000-000000037700',
 ('00000000-0000-4000-8000-'||lpad(actor::text,12,'0'))::uuid,'00000000-0000-4000-8000-000000037730',
 ('00000000-0000-4000-8000-'||lpad((37900+op)::text,12,'0'))::uuid,hash,pg_temp.attachment_metadata(op)||extra,check_only);
$$;
create temporary table attachment_results(label text primary key,value jsonb);
grant all on attachment_results to service_role;
grant execute on all functions in schema pg_temp to service_role;
set local role service_role;
select is(pg_temp.finalize_attachment(1,true)->>'code','pending','preflight pending creates no metadata');
select is((select count(*) from public.order_attachments where store_id='00000000-0000-4000-8000-000000037700'),0::bigint,'preflight has no attachment side effects');
select is(pg_temp.finalize_attachment(1,false,37703)->>'code','actor_forbidden','unassigned technician cannot finalize');
select is(pg_temp.finalize_attachment(1,false,37705)->>'code','actor_forbidden','nonmember cannot finalize');
select is(pg_temp.finalize_attachment(1,false,37701,repeat('b',64),'{"storage_path":"foreign/path.jpg"}')->>'code','invalid_attachment','foreign storage path rejected');
select is(pg_temp.finalize_attachment(1,false,37701,repeat('b',64),'{"public_url":"https://example.test/private"}')->>'code','invalid_attachment','arbitrary metadata cannot create public URL');
insert into attachment_results values('first',pg_temp.finalize_attachment(1));
select is((select value->>'ok' from attachment_results where label='first'),'true','atomic attachment creation succeeds');
select is((select count(*) from public.order_attachments where store_id='00000000-0000-4000-8000-000000037700'),1::bigint,'one metadata record');
select is((select count(*) from public.order_events where store_id='00000000-0000-4000-8000-000000037700'),1::bigint,'one event');
select is((select count(*) from public.audit_logs where store_id='00000000-0000-4000-8000-000000037700'),1::bigint,'one audit');
select is((select count(*) from public.repairdesk_order_attachment_operations where store_id='00000000-0000-4000-8000-000000037700'),1::bigint,'one receipt');
select ok(not exists(select 1 from public.audit_logs where store_id='00000000-0000-4000-8000-000000037700' and (metadata ?| array['file_name','note','storage_path','data_base64','signed_url'])),'audit retains no private filename/path/note/bytes');
select is(pg_temp.finalize_attachment(1,true)->>'replayed','true','preflight recovers a committed response');
select is(pg_temp.finalize_attachment(1)->'attachment',(select value->'attachment' from attachment_results where label='first'),'retry returns exact first metadata');
select is(pg_temp.finalize_attachment(1,false,37702)->>'code','idempotency_conflict','another authorized actor cannot replay original intent');
select is(pg_temp.finalize_attachment(1,false,37701,repeat('c',64))->>'code','idempotency_conflict','changed hash cannot reuse ID');
select is((select count(*) from public.order_events where store_id='00000000-0000-4000-8000-000000037700'),1::bigint,'replay adds no events');
reset role;
-- Fail each late transaction boundary; neither early metadata nor event survives.
create function pg_temp.fail_attachment_write() returns trigger language plpgsql as $$
begin raise exception 'synthetic attachment failure'; end $$;
create trigger attachment_test_fail before insert on public.audit_logs for each row execute function pg_temp.fail_attachment_write();
set local role service_role;
select throws_ok('select pg_temp.finalize_attachment(2)','P0001','synthetic attachment failure','audit failure propagates and rolls back');
reset role;
drop trigger attachment_test_fail on public.audit_logs;
create trigger attachment_test_fail before insert on public.order_events for each row execute function pg_temp.fail_attachment_write();
set local role service_role;
select throws_ok('select pg_temp.finalize_attachment(3)','P0001','synthetic attachment failure','event failure rolls back metadata');
reset role;
drop trigger attachment_test_fail on public.order_events;
create trigger attachment_test_fail before insert on public.repairdesk_order_attachment_operations for each row execute function pg_temp.fail_attachment_write();
set local role service_role;
select throws_ok('select pg_temp.finalize_attachment(4)','P0001','synthetic attachment failure','receipt failure rolls back all earlier writes');
select is((select count(*) from public.order_attachments where store_id='00000000-0000-4000-8000-000000037700'),1::bigint,'failed finalizes leave no metadata');
select is((select count(*) from public.order_events where store_id='00000000-0000-4000-8000-000000037700'),1::bigint,'failed finalizes leave no events');
select is((select count(*) from public.audit_logs where store_id='00000000-0000-4000-8000-000000037700'),1::bigint,'failed finalizes leave no audits');
select is((select count(*) from public.repairdesk_order_attachment_operations where store_id='00000000-0000-4000-8000-000000037700'),1::bigint,'failed finalizes leave no receipts');
reset role;
drop trigger attachment_test_fail on public.repairdesk_order_attachment_operations;
-- The current technician assignment is checked on both first write and replay.
update public.repair_orders set assignee_membership_id='00000000-0000-4000-8000-000000037713'
 where id='00000000-0000-4000-8000-000000037730';
set local role service_role;
select is(pg_temp.finalize_attachment(6,false,37703)->>'ok','true','assigned technician may finalize');
reset role;
update public.repair_orders set assignee_membership_id='00000000-0000-4000-8000-000000037711'
 where id='00000000-0000-4000-8000-000000037730';
set local role service_role;
select is(pg_temp.finalize_attachment(6,true,37703)->>'code','actor_forbidden','reassignment blocks old technician receipt replay');
select is(public.repairdesk_finalize_order_attachment_v1('00000000-0000-4000-8000-000000037710',
 '00000000-0000-4000-8000-000000037701','00000000-0000-4000-8000-000000037730',
 '00000000-0000-4000-8000-000000037901',repeat('b',64),pg_temp.attachment_metadata(1),true)->>'code',
 'order_not_found','cross-store target fails closed');
reset role;
-- Prepare the terminal fixture, then use the audited public void operation.
update public.repair_orders set status='completed',workflow_status='closed' where id='00000000-0000-4000-8000-000000037730';
set local role service_role;
select is(public.repairdesk_void_order('00000000-0000-4000-8000-000000037700',
 '00000000-0000-4000-8000-000000037730','00000000-0000-4000-8000-000000037701',
 (select updated_at from public.repair_orders where id='00000000-0000-4000-8000-000000037730'),
 '00000000-0000-4000-8000-000000037999','Synthetic audited void fixture',
 (select public_no from public.repair_orders where id='00000000-0000-4000-8000-000000037730'))->>'ok','true','fixture void uses the audited operation');
select is(pg_temp.finalize_attachment(1,true)->>'replayed','true','later void state does not turn committed intent into a new upload');
select is(pg_temp.finalize_attachment(5,true)->>'code','order_voided','voided order rejects new upload before Storage');
reset role;
update public.store_memberships set role='viewer' where store_id='00000000-0000-4000-8000-000000037700' and user_id='00000000-0000-4000-8000-000000037701';
set local role service_role;
select is(pg_temp.finalize_attachment(1,true)->>'code','actor_forbidden','revocation blocks even committed-receipt replay');
select * from finish();
rollback;
