begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select ok(not has_function_privilege('anon', 'public.repairdesk_replace_customer_tags(uuid,uuid,uuid,timestamptz,text[])', 'execute'), 'anon cannot replace customer tags');
select ok(not has_function_privilege('authenticated', 'public.repairdesk_replace_customer_tags(uuid,uuid,uuid,timestamptz,text[])', 'execute'), 'authenticated cannot replace customer tags');
select ok(has_function_privilege('service_role', 'public.repairdesk_replace_customer_tags(uuid,uuid,uuid,timestamptz,text[])', 'execute'), 'service role can replace customer tags');

insert into auth.users(id,email,created_at,updated_at) values
('00000000-0000-4000-8000-000000009101','customer-cas-owner@example.test',now(),now()),
('00000000-0000-4000-8000-000000009102','customer-cas-tech@example.test',now(),now()),
('00000000-0000-4000-8000-000000009201','customer-cas-other@example.test',now(),now());
insert into public.stores(id,store_code,name,slug,status) values
('00000000-0000-4000-8000-000000009100','CCAS_A','Customer CAS A','00000000-0000-4000-8000-000000009120','active'),
('00000000-0000-4000-8000-000000009200','CCAS_B','Customer CAS B','00000000-0000-4000-8000-000000009220','active');
insert into public.staff_profiles(id,email,display_name,role,status) values
('00000000-0000-4000-8000-000000009101','customer-cas-owner@example.test','CAS Owner','owner','active'),
('00000000-0000-4000-8000-000000009102','customer-cas-tech@example.test','CAS Tech','technician','active'),
('00000000-0000-4000-8000-000000009201','customer-cas-other@example.test','CAS Other','owner','active');
insert into public.store_memberships(id,store_id,user_id,email,display_name,role,status) values
('00000000-0000-4000-8000-000000009111','00000000-0000-4000-8000-000000009100','00000000-0000-4000-8000-000000009101','customer-cas-owner@example.test','CAS Owner','owner','active'),
('00000000-0000-4000-8000-000000009112','00000000-0000-4000-8000-000000009100','00000000-0000-4000-8000-000000009102','customer-cas-tech@example.test','CAS Tech','technician','active'),
('00000000-0000-4000-8000-000000009211','00000000-0000-4000-8000-000000009200','00000000-0000-4000-8000-000000009201','customer-cas-other@example.test','CAS Other','owner','active');
insert into public.customers(id,store_id,name,phone_e164,phone_raw,updated_at) values
('00000000-0000-4000-8000-000000009120','00000000-0000-4000-8000-000000009100','Synthetic A','+390000009120','390000009120','2099-01-01T00:00:00Z'),
('00000000-0000-4000-8000-000000009122','00000000-0000-4000-8000-000000009100','Synthetic A2','+390000009121','390000009121','2099-01-01T00:00:00Z'),
('00000000-0000-4000-8000-000000009220','00000000-0000-4000-8000-000000009200','Synthetic B','+390000009220','390000009220','2099-01-01T00:00:00Z');
insert into public.devices(id,store_id,customer_id,brand,model,updated_at) values
('00000000-0000-4000-8000-000000009130','00000000-0000-4000-8000-000000009100','00000000-0000-4000-8000-000000009120','Test','Device','2099-01-01T00:00:00Z');
insert into public.customer_tags(id,store_id,name,color) values
('tag-cas-a','00000000-0000-4000-8000-000000009100','A','#123456'),
('tag-cas-a2','00000000-0000-4000-8000-000000009100','A2','#123456'),
('tag-cas-fail','00000000-0000-4000-8000-000000009100','Failure','#123456'),
('tag-cas-b','00000000-0000-4000-8000-000000009200','B','#123456');

create temp table activity_revision_snapshot as select domain, version from public.repairdesk_store_domain_versions where store_id='00000000-0000-4000-8000-000000009100';
insert into public.customer_followups(id,store_id,customer_id,title,due_at) values ('00000000-0000-4000-8000-000000009141','00000000-0000-4000-8000-000000009100','00000000-0000-4000-8000-000000009120','Synthetic followup',now());
select is((select version from public.repairdesk_store_domain_versions where store_id='00000000-0000-4000-8000-000000009100' and domain='customers'),(select version+1 from activity_revision_snapshot where domain='customers'),'followup insert advances customer revision');
insert into public.customer_interactions(id,store_id,customer_id,channel,message_body) values ('00000000-0000-4000-8000-000000009142','00000000-0000-4000-8000-000000009100','00000000-0000-4000-8000-000000009120','whatsapp','Synthetic local record only');
select is((select version from public.repairdesk_store_domain_versions where store_id='00000000-0000-4000-8000-000000009100' and domain='customers'),(select version+2 from activity_revision_snapshot where domain='customers'),'interaction insert advances customer revision');
select is((select version from public.repairdesk_store_domain_versions where store_id='00000000-0000-4000-8000-000000009100' and domain='orders'),(select version from activity_revision_snapshot where domain='orders'),'activity changes do not broaden order invalidation');
savepoint activity_rollback;
update public.customer_followups set title='Rolled back' where id='00000000-0000-4000-8000-000000009141';
delete from public.customer_interactions where id='00000000-0000-4000-8000-000000009142';
rollback to activity_rollback;
select is((select version from public.repairdesk_store_domain_versions where store_id='00000000-0000-4000-8000-000000009100' and domain='customers'),(select version+2 from activity_revision_snapshot where domain='customers'),'rolled back activity mutations do not advance revisions');
update public.customers set name='Updated identity' where id='00000000-0000-4000-8000-000000009120';
update public.devices set model='Updated model' where id='00000000-0000-4000-8000-000000009130';
select is((select version from public.repairdesk_store_domain_versions where store_id='00000000-0000-4000-8000-000000009100' and domain='orders'),(select version+2 from activity_revision_snapshot where domain='orders'),'customer and device changes advance order read-model revisions');
select * from finish();
rollback;
