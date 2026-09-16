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
create temp table customer_cas_snapshot as select updated_at, (select version from public.repairdesk_store_domain_versions where store_id='00000000-0000-4000-8000-000000009100' and domain='customers') revision from public.customers where id='00000000-0000-4000-8000-000000009120';

with changed as (update public.customers set name='First editor', updated_at='2099-01-01T00:00:00.001Z' where store_id='00000000-0000-4000-8000-000000009100' and id='00000000-0000-4000-8000-000000009120' and updated_at=(select updated_at from customer_cas_snapshot) returning id) select is((select count(*) from changed),1::bigint,'first same-version editor succeeds');
select ok((select updated_at from public.customers where id='00000000-0000-4000-8000-000000009120')>(select updated_at from customer_cas_snapshot),'version advances beyond a future timestamp');
with changed as (update public.customers set name='Stale editor', updated_at='2099-01-01T00:00:00.001Z' where store_id='00000000-0000-4000-8000-000000009100' and id='00000000-0000-4000-8000-000000009120' and updated_at=(select updated_at from customer_cas_snapshot) returning id) select is((select count(*) from changed),0::bigint,'second same-version editor cannot overwrite');
select is((select name from public.customers where id='00000000-0000-4000-8000-000000009120'),'First editor','stale edit leaves content unchanged');
select is((select version from public.repairdesk_store_domain_versions where store_id='00000000-0000-4000-8000-000000009100' and domain='customers'),(select revision+1 from customer_cas_snapshot),'only successful update advances revision');
with changed as (update public.devices set model='First device editor', updated_at='2099-01-01T00:00:00.001Z' where store_id='00000000-0000-4000-8000-000000009100' and customer_id='00000000-0000-4000-8000-000000009120' and id='00000000-0000-4000-8000-000000009130' and updated_at='2099-01-01T00:00:00Z' returning id) select is((select count(*) from changed),1::bigint,'device CAS succeeds');
with changed as (delete from public.devices where store_id='00000000-0000-4000-8000-000000009100' and customer_id='00000000-0000-4000-8000-000000009120' and id='00000000-0000-4000-8000-000000009130' and updated_at='2099-01-01T00:00:00Z' returning id) select is((select count(*) from changed),0::bigint,'stale device deletion has no effect');
with changed as (update public.devices set model='Wrong customer' where store_id='00000000-0000-4000-8000-000000009100' and customer_id='00000000-0000-4000-8000-000000009122' and id='00000000-0000-4000-8000-000000009130' and updated_at=(select updated_at from public.devices where id='00000000-0000-4000-8000-000000009130') returning id) select is((select count(*) from changed),0::bigint,'device cannot be changed through a different customer');
with changed as (update public.customers set name='Wrong store' where store_id='00000000-0000-4000-8000-000000009200' and id='00000000-0000-4000-8000-000000009120' and updated_at=(select updated_at from public.customers where id='00000000-0000-4000-8000-000000009120') returning id) select is((select count(*) from changed),0::bigint,'customer CAS remains store scoped');

select lives_ok($q$select public.repairdesk_replace_customer_tags('00000000-0000-4000-8000-000000009100','00000000-0000-4000-8000-000000009101','00000000-0000-4000-8000-000000009120',(select updated_at from public.customers where id='00000000-0000-4000-8000-000000009120'),array['tag-cas-a','tag-cas-a'])$q$,'tag replacement accepts current version and deduplicates');
select is((select count(*) from public.customer_tag_assignments where customer_id='00000000-0000-4000-8000-000000009120'),1::bigint,'duplicate tag IDs create one assignment');
select throws_ok($q$select public.repairdesk_replace_customer_tags('00000000-0000-4000-8000-000000009100','00000000-0000-4000-8000-000000009101','00000000-0000-4000-8000-000000009120','2099-01-01T00:00:00Z',array['tag-cas-a2'])$q$,'P0001','CUSTOMER_STALE_VERSION','stale tag replacement is rejected');
select throws_ok($q$select public.repairdesk_replace_customer_tags('00000000-0000-4000-8000-000000009100','00000000-0000-4000-8000-000000009102','00000000-0000-4000-8000-000000009120',(select updated_at from public.customers where id='00000000-0000-4000-8000-000000009120'),array['tag-cas-a2'])$q$,'P0001','CUSTOMER_FORBIDDEN','unscoped technician remains denied');
select throws_ok($q$select public.repairdesk_replace_customer_tags('00000000-0000-4000-8000-000000009100','00000000-0000-4000-8000-000000009201','00000000-0000-4000-8000-000000009120',(select updated_at from public.customers where id='00000000-0000-4000-8000-000000009120'),array['tag-cas-a2'])$q$,'P0001','CUSTOMER_FORBIDDEN','foreign actor remains denied');
select throws_ok($q$select public.repairdesk_replace_customer_tags('00000000-0000-4000-8000-000000009100','00000000-0000-4000-8000-000000009101','00000000-0000-4000-8000-000000009220',(select updated_at from public.customers where id='00000000-0000-4000-8000-000000009220'),array['tag-cas-a2'])$q$,'P0001','CUSTOMER_NOT_FOUND','foreign customer is not disclosed');
select throws_ok($q$select public.repairdesk_replace_customer_tags('00000000-0000-4000-8000-000000009100','00000000-0000-4000-8000-000000009101','00000000-0000-4000-8000-000000009120',(select updated_at from public.customers where id='00000000-0000-4000-8000-000000009120'),array['tag-cas-b'])$q$,'P0001','CUSTOMER_TAGS_INVALID','foreign tag is rejected before removal');
select throws_ok($q$select public.repairdesk_replace_customer_tags('00000000-0000-4000-8000-000000009100','00000000-0000-4000-8000-000000009101','00000000-0000-4000-8000-000000009120',(select updated_at from public.customers where id='00000000-0000-4000-8000-000000009120'),array_fill('tag-cas-a'::text,array[65]))$q$,'P0001','CUSTOMER_TAGS_INVALID','tag input is bounded to 64');

create function pg_temp.customer_tag_insert_failure() returns trigger language plpgsql as $$begin if new.tag_id='tag-cas-fail' then raise exception 'SYNTHETIC_INSERT_FAILURE'; end if; return new; end;$$;
create trigger customer_cas_test_failure before insert on public.customer_tag_assignments for each row execute function pg_temp.customer_tag_insert_failure();
truncate customer_cas_snapshot;
insert into customer_cas_snapshot select updated_at,(select version from public.repairdesk_store_domain_versions where store_id='00000000-0000-4000-8000-000000009100' and domain='customers') from public.customers where id='00000000-0000-4000-8000-000000009120';
select throws_ok($q$select public.repairdesk_replace_customer_tags('00000000-0000-4000-8000-000000009100','00000000-0000-4000-8000-000000009101','00000000-0000-4000-8000-000000009120',(select updated_at from public.customers where id='00000000-0000-4000-8000-000000009120'),array['tag-cas-a2','tag-cas-fail'])$q$,'P0001','SYNTHETIC_INSERT_FAILURE','insert failure aborts the complete tag replacement');
select is((select array_agg(tag_id order by tag_id) from public.customer_tag_assignments where customer_id='00000000-0000-4000-8000-000000009120'),array['tag-cas-a'],'failure preserves original tags');
select is((select updated_at from public.customers where id='00000000-0000-4000-8000-000000009120'),(select updated_at from customer_cas_snapshot),'failure preserves customer version');
select is((select version from public.repairdesk_store_domain_versions where store_id='00000000-0000-4000-8000-000000009100' and domain='customers'),(select revision from customer_cas_snapshot),'failure preserves durable revision');
drop trigger customer_cas_test_failure on public.customer_tag_assignments;
select lives_ok($q$select public.repairdesk_replace_customer_tags('00000000-0000-4000-8000-000000009100','00000000-0000-4000-8000-000000009101','00000000-0000-4000-8000-000000009120',(select updated_at from public.customers where id='00000000-0000-4000-8000-000000009120'),'{}')$q$,'empty tag list clears tags');
select is((select count(*) from public.customer_tag_assignments where customer_id='00000000-0000-4000-8000-000000009120'),0::bigint,'empty replacement leaves no assignment');
select ok((select updated_at from public.customers where id='00000000-0000-4000-8000-000000009120')>(select updated_at from customer_cas_snapshot),'successful clear returns a new customer version');
select ok((select version from public.repairdesk_store_domain_versions where store_id='00000000-0000-4000-8000-000000009100' and domain='customers')>(select revision from customer_cas_snapshot),'successful clear advances revision');
select is((select count(*) from pg_trigger where not tgisinternal and tgname in ('repairdesk_realtime_customers_revision','repairdesk_realtime_devices_revision','repairdesk_realtime_customer_tags_revision','repairdesk_realtime_customer_tag_assignments_revision')),4::bigint,'all customer-domain tables advance revisions');
select ok((select updated_at from public.devices where id='00000000-0000-4000-8000-000000009130') > '2099-01-01T00:00:00Z'::timestamptz, 'device version strictly advances beyond future input');
create temp table bulk_version_snapshot as select '2099-01-02T12:34:56.123456Z'::timestamptz v_now;
update public.customers set name='Bulk-compatible payload', updated_at=(select v_now from bulk_version_snapshot) where id='00000000-0000-4000-8000-000000009120';
update public.devices set model='Bulk-compatible payload', updated_at=(select v_now from bulk_version_snapshot) where id='00000000-0000-4000-8000-000000009130';
select is((select updated_at from public.customers where id='00000000-0000-4000-8000-000000009120'),(select v_now from bulk_version_snapshot),'bulk customer timestamp remains the exact supplied v_now');
select is((select updated_at from public.devices where id='00000000-0000-4000-8000-000000009130'),(select v_now from bulk_version_snapshot),'bulk device timestamp remains the exact supplied v_now');
select * from finish();
rollback;
