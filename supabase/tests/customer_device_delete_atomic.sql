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

create temp table device_delete_version as select updated_at from public.devices where id='00000000-0000-4000-8000-000000007721';
select is((select count(*) from public.repair_orders where device_id='00000000-0000-4000-8000-000000007721'),0::bigint,'precheck initially sees no order');
insert into public.repair_orders(id,store_id,customer_id,device_id,order_type,status,workflow_status,issue_description,
 quotation_amount,deposit_amount,balance_amount,is_paid,payment_status,approval_status,approval_flow_status,
 device_custody_status,record_state,technician_name,assignee_membership_id,fault_prices,warranty_months,warranty_text,updated_at) values
 ('00000000-0000-4000-8000-000000007730','00000000-0000-4000-8000-000000007700','00000000-0000-4000-8000-000000007720','00000000-0000-4000-8000-000000007721',
 'quick_repair','new','intake','Synthetic issue',100,0,50,false,'partial','pending','not_required','with_customer','active','Owner','00000000-0000-4000-8000-000000007711',
 '[{"name":"Repair","price":100,"currency_code":"EUR"}]',6,'6个月','2026-09-07T10:00:00Z');

select throws_ok($q$select public.repairdesk_delete_customer_device('00000000-0000-4000-8000-000000007700','00000000-0000-4000-8000-000000007701','00000000-0000-4000-8000-000000007720','00000000-0000-4000-8000-000000007721',(select updated_at from device_delete_version))$q$,'P0001','CUSTOMER_DEVICE_HAS_ORDERS','linked order prevents atomic deletion');
select is((select device_id from public.repair_orders where id='00000000-0000-4000-8000-000000007730'),'00000000-0000-4000-8000-000000007721'::uuid,'order retains device after refused deletion');
select throws_ok($q$select public.repairdesk_delete_customer_device('00000000-0000-4000-8000-000000007700','00000000-0000-4000-8000-000000007701','00000000-0000-4000-8000-000000007720','00000000-0000-4000-8000-000000007721','2000-01-01T00:00:00Z')$q$,'P0001','CUSTOMER_STALE_VERSION','stale version is rejected');
select throws_ok($q$select public.repairdesk_delete_customer_device('00000000-0000-4000-8000-000000007700','00000000-0000-4000-8000-000000007701','00000000-0000-4000-8000-000000007799','00000000-0000-4000-8000-000000007721',(select updated_at from device_delete_version))$q$,'P0001','CUSTOMER_DEVICE_NOT_FOUND','wrong customer is not disclosed');
select throws_ok($q$select public.repairdesk_delete_customer_device('00000000-0000-4000-8000-000000007710','00000000-0000-4000-8000-000000007701','00000000-0000-4000-8000-000000007720','00000000-0000-4000-8000-000000007721',(select updated_at from device_delete_version))$q$,'P0001','CUSTOMER_DEVICE_NOT_FOUND','wrong store is not disclosed');
select throws_ok($q$select public.repairdesk_delete_customer_device('00000000-0000-4000-8000-000000007700','00000000-0000-4000-8000-000000007703','00000000-0000-4000-8000-000000007720','00000000-0000-4000-8000-000000007721',(select updated_at from device_delete_version))$q$,'P0001','CUSTOMER_FORBIDDEN','unscoped technician cannot delete devices');
select ok(not has_function_privilege('anon','public.repairdesk_delete_customer_device(uuid,uuid,uuid,uuid,timestamptz)','execute'),'anon cannot execute device delete');
select ok(not has_function_privilege('authenticated','public.repairdesk_delete_customer_device(uuid,uuid,uuid,uuid,timestamptz)','execute'),'authenticated cannot execute device delete');
select ok(has_function_privilege('service_role','public.repairdesk_delete_customer_device(uuid,uuid,uuid,uuid,timestamptz)','execute'),'service role can execute device delete');
insert into public.devices(id,store_id,customer_id,brand,model,serial_or_imei) values
 ('00000000-0000-4000-8000-000000007722','00000000-0000-4000-8000-000000007700','00000000-0000-4000-8000-000000007720','Test','Unlinked Device','');
select lives_ok($q$select public.repairdesk_delete_customer_device('00000000-0000-4000-8000-000000007700','00000000-0000-4000-8000-000000007701','00000000-0000-4000-8000-000000007720','00000000-0000-4000-8000-000000007722',(select updated_at from public.devices where id='00000000-0000-4000-8000-000000007722'))$q$,'unlinked device deletes successfully');
select is((select count(*) from public.devices where id='00000000-0000-4000-8000-000000007722'),0::bigint,'successful atomic delete removes the device');
select * from finish();
rollback;
