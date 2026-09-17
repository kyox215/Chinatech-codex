-- Synthetic fixtures only; all writes and temporary helpers are rolled back.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';
create extension if not exists pgtap with schema extensions;
select no_plan();
select ok(not has_function_privilege(role_name, signature, 'execute'), role_name || ' cannot execute ' || signature)
from unnest(array['anon','authenticated']) role_name cross join unnest(array[
 'public.repairdesk_create_order_v2(uuid,uuid,uuid,text,jsonb)',
 'public.repairdesk_create_customer_v1(uuid,uuid,uuid,jsonb)',
 'public.repairdesk_update_customer_v1(uuid,uuid,uuid,timestamptz,jsonb)'
]) signature;
select ok(not p.prosecdef and has_function_privilege('service_role',p.oid,'execute'),p.proname || ' is service-only invoker')
from pg_proc p where p.oid in (
 'public.repairdesk_create_order_v2(uuid,uuid,uuid,text,jsonb)'::regprocedure,
 'public.repairdesk_create_customer_v1(uuid,uuid,uuid,jsonb)'::regprocedure,
 'public.repairdesk_update_customer_v1(uuid,uuid,uuid,timestamptz,jsonb)'::regprocedure
);
insert into auth.users(id,email,created_at,updated_at) values
 ('00000000-0000-4000-8000-000000020701','phone-owner@example.test',now(),now()),
 ('00000000-0000-4000-8000-000000020702','phone-viewer@example.test',now(),now());
insert into public.staff_profiles(id,email,display_name,role,status) values
 ('00000000-0000-4000-8000-000000020701','phone-owner@example.test','Synthetic Owner','owner','active'),
 ('00000000-0000-4000-8000-000000020702','phone-viewer@example.test','Synthetic Viewer','viewer','active');
insert into public.stores(id,store_code,name,slug,status) values
 ('00000000-0000-4000-8000-000000020700','PHONE_OWNERSHIP','Phone Ownership','phone-ownership-test','active'),
 ('00000000-0000-4000-8000-000000020710','PHONE_OTHER','Phone Other','phone-ownership-other','active');
insert into public.store_memberships(store_id,user_id,email,display_name,role,status) values
 ('00000000-0000-4000-8000-000000020700','00000000-0000-4000-8000-000000020701','phone-owner@example.test','Synthetic Owner','owner','active'),
 ('00000000-0000-4000-8000-000000020700','00000000-0000-4000-8000-000000020702','phone-viewer@example.test','Synthetic Viewer','viewer','active'),
 ('00000000-0000-4000-8000-000000020710','00000000-0000-4000-8000-000000020701','phone-owner@example.test','Synthetic Owner','owner','active');
insert into public.order_workflow_statuses(store_id,code,label,short_label,bucket,allowed_for_create,is_default_create_status)
values('00000000-0000-4000-8000-000000020700','new','New','New','intake',true,true);
insert into public.customers(id,store_id,name,phone_e164,phone_raw,contact_phones,updated_at) values
 ('00000000-0000-4000-8000-000000020720','00000000-0000-4000-8000-000000020700','Original','+390000020720','390000020720',array['+390000020721'],'2026-09-17T10:00:00Z'),
 ('00000000-0000-4000-8000-000000020722','00000000-0000-4000-8000-000000020700','Other','+390000020722','390000020722',array['+390000020723'],'2026-09-17T10:00:00Z'),
 ('00000000-0000-4000-8000-000000020724','00000000-0000-4000-8000-000000020710','Foreign','+390000020724','390000020724',array['+390000020725'],'2026-09-17T10:00:00Z');
create function pg_temp.profile(primary_phone text, backups jsonb default '[]', name text default 'Synthetic') returns jsonb language sql as $$
 select jsonb_build_object('name',name,'phone_e164',primary_phone,'phone_raw',regexp_replace(primary_phone,'[^0-9]','','g'),'contact_phones',backups);
$$;
create function pg_temp.order_payload(primary_phone text, backups jsonb default '[]', customer uuid default null, customer_name text default 'Synthetic') returns jsonb language sql as $$
 select jsonb_build_object('customer_id',customer,'customer_name',customer_name,'customer_phone',primary_phone,
  'phone_e164',primary_phone,'phone_raw',regexp_replace(primary_phone,'[^0-9]','','g'),'contact_phones',backups,
  'customer_identity_resolution',jsonb_build_object('mode','auto'),'device_brand','Test','device_model','Synthetic',
  'order',jsonb_build_object('order_type','quick_repair','status','new','workflow_status','intake','payment_status','unpaid',
   'approval_flow_status','not_required','parts_status','not_required','notify_status','not_sent','issue_description','Synthetic',
   'quotation_amount',50,'deposit_amount',0,'balance_amount',50,'is_paid',false,'technician_name','Synthetic Owner',
   'device_custody_status','with_shop','warranty_text','6 months','warranty_months',6,'fault_prices','[]'::jsonb,'operator_name','Synthetic Owner'));
$$;
create function pg_temp.create_order(payload jsonb, op integer) returns jsonb language sql as $$
 select public.repairdesk_create_order_v2('00000000-0000-4000-8000-000000020700','00000000-0000-4000-8000-000000020701',
  ('00000000-0000-4000-8000-'||lpad((20900+op)::text,12,'0'))::uuid,repeat(md5((payload-'customer_identity_resolution')::text),2),payload);
$$;
create function pg_temp.create_profile(payload jsonb, target integer, store integer default 20700, actor integer default 20701) returns jsonb language sql as $$
 select public.repairdesk_create_customer_v1(
 ('00000000-0000-4000-8000-'||lpad(store::text,12,'0'))::uuid,
 ('00000000-0000-4000-8000-'||lpad(actor::text,12,'0'))::uuid,
 ('00000000-0000-4000-8000-'||lpad(target::text,12,'0'))::uuid,payload);
$$;
create function pg_temp.update_profile(payload jsonb, version timestamptz default '2026-09-17T10:00:00Z', target integer default 20720) returns jsonb language sql as $$
 select public.repairdesk_update_customer_v1('00000000-0000-4000-8000-000000020700','00000000-0000-4000-8000-000000020701',
 ('00000000-0000-4000-8000-'||lpad(target::text,12,'0'))::uuid,version,payload);
$$;
create temporary table phone_results(label text primary key,value jsonb);
grant all on phone_results to service_role;
grant execute on all functions in schema pg_temp to service_role;
set local role service_role;
select is(pg_temp.create_order(pg_temp.order_payload('+390000020800','["+390000020721"]'),1)->>'code','customer_phone_conflict','new order backup cannot take existing backup');
select is(pg_temp.create_order(pg_temp.order_payload('+390000020800','["+390000020720"]'),2)->>'code','customer_phone_conflict','new order backup cannot take existing primary');
select is(pg_temp.create_order(pg_temp.order_payload('+390000020721'),3)->>'code','customer_phone_conflict','new order primary cannot take existing backup');
select is(pg_temp.create_order(pg_temp.order_payload('+390000020720','["+390000020723"]','00000000-0000-4000-8000-000000020720'),4)->>'code','customer_phone_conflict','selected-customer path checks foreign backup');
select is(pg_temp.create_order(pg_temp.order_payload('+390000020720','["+390000020723"]',null,'Original'),5)->>'code','customer_phone_conflict','auto-reuse path checks foreign backup');
select is(pg_temp.create_order(pg_temp.order_payload('+390000020800','["bad"]'),6)->>'code','invalid_customer_phone','invalid backup rejected');
select is(pg_temp.create_profile(pg_temp.profile('+390000020800','["+390000020721"]'),20800)->>'code','customer_phone_conflict','customer creation backup cannot take existing backup');
select is(pg_temp.create_profile(pg_temp.profile('+390000020721'),20800)->>'code','customer_phone_conflict','customer creation primary cannot take existing backup');
select is(pg_temp.create_profile(pg_temp.profile('+390000020800','["+390000020720"]'),20800)->>'code','customer_phone_conflict','customer creation backup cannot take existing primary');
select is(pg_temp.create_profile(pg_temp.profile('+390000020800'),20800,20700,20702)->>'code','actor_forbidden','viewer cannot create profile through RPC');
select is(pg_temp.update_profile(pg_temp.profile('+390000020720','["+390000020723"]'))->>'code','customer_phone_conflict','profile update backup cannot take other backup');
select is(pg_temp.update_profile(pg_temp.profile('+390000020723'))->>'code','customer_phone_conflict','profile promotion cannot take other backup');
select is(pg_temp.update_profile(pg_temp.profile('+390000020720','["+390000020799"]'),'2026-09-17T09:00:00Z')->>'code','customer_stale_version','CAS precedes every profile write');
select is(pg_temp.update_profile(pg_temp.profile('+390000020720'),null)->>'code','customer_version_required','missing profile CAS rejected');
select is(pg_temp.update_profile(pg_temp.profile('+390000020724'),'2026-09-17T10:00:00Z',20724)->>'code','customer_not_found','foreign customer is safely missing');
select is((select count(*) from public.customers where store_id='00000000-0000-4000-8000-000000020700'),2::bigint,'all rejected writes leave customer count unchanged');
select is((select count(*) from public.devices where store_id='00000000-0000-4000-8000-000000020700'),0::bigint,'rejections create no orphan device');
select is((select count(*) from public.repair_orders where store_id='00000000-0000-4000-8000-000000020700'),0::bigint,'rejections create no order');
select is((select count(*) from public.order_events where store_id='00000000-0000-4000-8000-000000020700'),0::bigint,'rejections create no event');
select is((select updated_at from public.customers where id='00000000-0000-4000-8000-000000020720'),'2026-09-17T10:00:00Z'::timestamptz,'rejections preserve exact customer version');
insert into phone_results values('created',pg_temp.create_order(pg_temp.order_payload('+390000020800','["+390000020801","+39 0000020801","+390000020800"]'),7));
select is((select value->>'ok' from phone_results where label='created'),'true','fresh numbers create order');
select is((select contact_phones from public.customers where store_id='00000000-0000-4000-8000-000000020700' and phone_raw='390000020800'),array['+390000020801'],'deduplicates backup formatting and removes primary');
select is(pg_temp.create_order(pg_temp.order_payload('+390000020800','["+390000020801","+39 0000020801","+390000020800"]'),7)->>'replayed','true','creation replay remains before validation');
select is((select count(*) from public.order_events where store_id='00000000-0000-4000-8000-000000020700'),1::bigint,'replay appends no event');
insert into phone_results values('conflict',pg_temp.create_order(pg_temp.order_payload('+390000020720','[]',null,'Family Member'),8));
select is((select value->>'code' from phone_results where label='conflict'),'customer_identity_conflict','different name still requires identity challenge');
insert into phone_results values('shared',pg_temp.create_order(pg_temp.order_payload('+390000020720','[]',null,'Family Member') || jsonb_build_object('customer_identity_resolution',jsonb_build_object('mode','create_distinct_shared_phone','reason','family','conflict_token',(select value->>'conflictToken' from phone_results where label='conflict'))),8));
select is((select value->>'ok' from phone_results where label='shared'),'true','confirmed audited shared primary remains supported');
select is((select count(*) from public.customers where store_id='00000000-0000-4000-8000-000000020700' and phone_raw='390000020720'),2::bigint,'explicit sharing creates distinct identity');
insert into phone_results values('updated',pg_temp.update_profile(pg_temp.profile('+390000020720','["+390000020721"]','Original renamed')));
select is((select value->>'ok' from phone_results where label='updated'),'true','unchanged shared-primary profile may update other fields');
select is(pg_temp.update_profile(pg_temp.profile('+390000020802','["+390000020720"]'),(select (value->>'updated_at')::timestamptz from phone_results where label='updated'))->>'code','customer_phone_conflict','shared primary exception cannot become shared backup');
select is(pg_temp.create_profile(pg_temp.profile('+390000020721'),20810,20710)->>'ok','true','same number in another store is independent');
insert into phone_results values('clear',pg_temp.update_profile(pg_temp.profile('+390000020720','[]','Original renamed'),(select (value->>'updated_at')::timestamptz from phone_results where label='updated')));
select is((select value->>'ok' from phone_results where label='clear'),'true','[] clears current backups');
select is((select contact_phones from public.customers where id='00000000-0000-4000-8000-000000020720'),'{}'::text[],'removed numbers are not merged back');
select is(pg_temp.create_profile(pg_temp.profile('+390000020721'),20811)->>'ok','true','released backup may belong to a newly created profile');
select * from finish();
rollback;
