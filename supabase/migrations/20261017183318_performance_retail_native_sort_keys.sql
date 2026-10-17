-- Additive exact Node Intl keys. Original fields, collations and UTF16 facets
-- are unchanged. No wide bytea B-tree: valid original titles can be very long.
begin;
alter table chinatech_v2_private.retail_list_sources
 add column sort_source_hash text not null default '',
 add column sort_input_hash text,
 add column sort_rules_hash text,
 add column sort_name bytea,
 add column sort_tie bytea,
 add column sort_intake bytea,
 add column sort_sale bytea;
alter table chinatech_v2_private.retail_list_models
 add column sort_rules_hash text not null default '7cc5f8a20676644266f5f9f3e896e954cae151a167e331c051bc6d016540ea80',
 add column sort_resume_ready boolean not null default false,
 add column sort_resume_xid xid8;

create function chinatech_v2_private.retail_sort_source_v1() returns trigger
language plpgsql security definer set search_path='' as $$
declare fingerprint text;
begin
 fingerprint:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.jsonb_build_array(new.title,new.key,new.intake_date,new.sale_sort_date)::text,'UTF8')),'hex');
 new.sort_source_hash:=fingerprint;
 if tg_op='INSERT' then
  new.sort_input_hash:=null;new.sort_rules_hash:=null;new.sort_name:=null;new.sort_tie:=null;new.sort_intake:=null;new.sort_sale:=null;
 elsif old.sort_source_hash is distinct from fingerprint then
  new.sort_input_hash:=null;new.sort_rules_hash:=null;new.sort_name:=null;new.sort_tie:=null;new.sort_intake:=null;new.sort_sale:=null;
 end if;
 return new;
end $$;
create function chinatech_v2_private.retail_sort_dirty_v1() returns trigger
language plpgsql security definer set search_path='' as $$begin
 if tg_op='INSERT' then
  update chinatech_v2_private.retail_list_models set ready=false,generation=generation+1 where store_id=new.store_id and ready;
 elsif old.sort_source_hash is distinct from new.sort_source_hash then
  update chinatech_v2_private.retail_list_models set ready=false,generation=generation+1 where store_id=new.store_id and ready;
 end if;
 return null;
end $$;
create trigger retail_sort_source before insert or update on chinatech_v2_private.retail_list_sources for each row execute function chinatech_v2_private.retail_sort_source_v1();
create trigger retail_sort_dirty after insert or update on chinatech_v2_private.retail_list_sources for each row execute function chinatech_v2_private.retail_sort_dirty_v1();
create index retail_sort_pending_v1 on chinatech_v2_private.retail_list_sources(store_id,key)
 where sort_input_hash is distinct from sort_source_hash or sort_rules_hash is distinct from '7cc5f8a20676644266f5f9f3e896e954cae151a167e331c051bc6d016540ea80';

-- Same order as rollback; RowExclusive permits ordinary concurrent DML in other
-- stores while conflicting with ENABLE/DISABLE TRIGGER's ShareRowExclusive.
create function chinatech_v2_private.retail_sort_producers_v1() returns void
language plpgsql security definer set search_path='' as $$
begin
 lock table chinatech_v2.stores,chinatech_v2_private.retail_units,chinatech_v2_private.retail_history_records,chinatech_v2_private.retail_list_sources in row exclusive mode;
 if (select count(*) from pg_catalog.pg_trigger where not tgisinternal and tgenabled='O' and
  (tgrelid='chinatech_v2.stores'::pg_catalog.regclass and tgname='retail_list_store_init'
   or tgrelid='chinatech_v2_private.retail_units'::pg_catalog.regclass and tgname='retail_list_unit_sync'
   or tgrelid='chinatech_v2_private.retail_history_records'::pg_catalog.regclass and tgname='retail_list_history_sync'
   or tgrelid='chinatech_v2_private.retail_list_sources'::pg_catalog.regclass and tgname in('retail_sort_source','retail_sort_dirty')))<>5 then
  raise exception using errcode='55000',message='Retail sort producer unavailable';
 end if;
end $$;
create function chinatech_v2_private.retail_sort_begin_v1(target_store uuid) returns void
language plpgsql security definer set search_path='' as $$begin
 perform chinatech_v2_private.command_retail_access_v1(target_store);
 perform chinatech_v2_private.retail_sort_producers_v1();
 update chinatech_v2_private.retail_list_models set sort_resume_ready=ready,sort_resume_xid=pg_catalog.pg_current_xact_id() where store_id=target_store;
 if not found then raise exception using errcode='55000',message='Retail model unavailable';end if;
end $$;
create function chinatech_v2_private.retail_sort_put_v1(target_store uuid,target_key text,input_hash text,rules_hash text,name_key bytea,tie_key bytea,intake_key bytea,sale_key bytea) returns void
language plpgsql security definer set search_path='' as $$
declare facts chinatech_v2_private.retail_list_sources%rowtype; value bytea;
begin
 perform chinatech_v2_private.command_retail_access_v1(target_store);
 perform chinatech_v2_private.retail_sort_producers_v1();
 if rules_hash is distinct from '7cc5f8a20676644266f5f9f3e896e954cae151a167e331c051bc6d016540ea80' then raise exception using errcode='22023',message='Sort rules changed';end if;
 select * into facts from chinatech_v2_private.retail_list_sources where store_id=target_store and key=target_key for update;
 if not found or input_hash is distinct from facts.sort_source_hash or input_hash !~ '^[a-f0-9]{64}$' then raise exception using errcode='40001',message='Sort facts changed';end if;
 if name_key is null or tie_key is null or intake_key is null or ((facts.sale_sort_date is null or facts.sale_sort_date='')<>(sale_key is null)) then raise exception using errcode='22023',message='Invalid sort keys';end if;
 foreach value in array array[name_key,tie_key,intake_key,sale_key] loop
  if value is not null and (pg_catalog.octet_length(value)<1 or pg_catalog.octet_length(value)>4000000 or pg_catalog.get_byte(value,pg_catalog.octet_length(value)-1)<>0) then raise exception using errcode='22023',message='Invalid sort keys';end if;
 end loop;
 update chinatech_v2_private.retail_list_sources set sort_input_hash=input_hash,sort_rules_hash=rules_hash,sort_name=name_key,sort_tie=tie_key,sort_intake=intake_key,sort_sale=sale_key where store_id=target_store and key=target_key;
end $$;
create function chinatech_v2_private.retail_sort_finish_v1(target_store uuid) returns void
language plpgsql security definer set search_path='' as $$begin
 perform chinatech_v2_private.command_retail_access_v1(target_store);
 perform chinatech_v2_private.retail_sort_producers_v1();
 update chinatech_v2_private.retail_list_models set
  ready=sort_resume_ready and sort_resume_xid=pg_catalog.pg_current_xact_id() and format_version=1 and vocabulary_hash='f9fc2615c696573fa72d2bb99d8bc291cd1935762d91852a9c7333807b067baf' and query_rules_hash='fb12beb5c40803d691d89338c41efc1ab672310336c64dccc1a9a7b6a31ab36e'
   and sort_rules_hash='7cc5f8a20676644266f5f9f3e896e954cae151a167e331c051bc6d016540ea80'
   and not exists(select 1 from chinatech_v2_private.retail_list_sources where store_id=target_store and (sort_input_hash is distinct from sort_source_hash or sort_rules_hash is distinct from '7cc5f8a20676644266f5f9f3e896e954cae151a167e331c051bc6d016540ea80')),
  sort_resume_ready=false,sort_resume_xid=null where store_id=target_store;
end $$;
revoke all on function chinatech_v2_private.retail_sort_source_v1(),chinatech_v2_private.retail_sort_dirty_v1(),chinatech_v2_private.retail_sort_producers_v1(),chinatech_v2_private.retail_sort_begin_v1(uuid),chinatech_v2_private.retail_sort_put_v1(uuid,text,text,text,bytea,bytea,bytea,bytea),chinatech_v2_private.retail_sort_finish_v1(uuid) from public,anon,authenticated,chinatech_runtime,service_role;
grant execute on function chinatech_v2_private.retail_sort_begin_v1(uuid),chinatech_v2_private.retail_sort_put_v1(uuid,text,text,text,bytea,bytea,bytea,bytea),chinatech_v2_private.retail_sort_finish_v1(uuid) to chinatech_runtime;
-- Explicit operator required. Historical keys and canonical facts are untouched.
update chinatech_v2_private.retail_list_models set ready=false,sort_resume_ready=false,sort_resume_xid=null,verified_at=null,backfill_cursor=null,generation=generation+1;
commit;
