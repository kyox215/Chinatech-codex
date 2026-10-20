-- Derived customer-directory facts only. Canonical JSON, identities, money,
-- signatures and immutable sale/import history retain their existing ownership.
create table chinatech_v2_private.customer_directory_sources (
  store_id uuid not null references chinatech_v2.stores(id) on delete cascade,
  origin_kind text not null check(origin_kind in ('profile','repair','sale','history')),
  origin_id text not null,
  event_id text not null,
  phone text not null,
  name text not null,
  email text not null,
  event_at text not null,
  event_order integer not null,
  activity_at text not null,
  primary key(store_id,origin_kind,origin_id,event_id)
);
create index customer_directory_sources_phone on chinatech_v2_private.customer_directory_sources(store_id,phone,origin_kind,event_at,origin_id,event_id);
create table chinatech_v2_private.customer_directory_models (
  store_id uuid primary key references chinatech_v2.stores(id) on delete cascade,
  format_version integer not null default 1 check(format_version=1),
  ready boolean not null default false,
  generation bigint not null default 0,
  backfill_cursor text,
  verified_at timestamptz
);
alter table chinatech_v2_private.customer_directory_sources enable row level security;
alter table chinatech_v2_private.customer_directory_sources force row level security;
alter table chinatech_v2_private.customer_directory_models enable row level security;
alter table chinatech_v2_private.customer_directory_models force row level security;
revoke all on chinatech_v2_private.customer_directory_sources,chinatech_v2_private.customer_directory_models from public,anon,authenticated,chinatech_runtime;
grant select on chinatech_v2_private.customer_directory_sources,chinatech_v2_private.customer_directory_models to chinatech_runtime;
-- Only transaction constants are InitPlans. The row's store equality and domain
-- visibility remain row predicates; no helper with a row argument is hoisted.
create policy customer_directory_scope on chinatech_v2_private.customer_directory_sources for select to chinatech_runtime using (
 store_id::text=(select current_setting('app.store_id',true))
 and (select chinatech_v2_private.member_access(nullif(current_setting('app.store_id',true),'')::uuid,'customers.view'))
 and (origin_kind='profile'
  or origin_kind='repair' and (select chinatech_v2_private.member_access(nullif(current_setting('app.store_id',true),'')::uuid,'repairs.view'))
  or origin_kind in ('sale','history') and (select chinatech_v2_private.member_access(nullif(current_setting('app.store_id',true),'')::uuid,'retail.view')))
);
create policy customer_directory_model_scope on chinatech_v2_private.customer_directory_models for select to chinatech_runtime using (
 store_id::text=(select current_setting('app.store_id',true))
 and (select chinatech_v2_private.member_access(nullif(current_setting('app.store_id',true),'')::uuid,'customers.view'))
);

-- Match ECMAScript trim/\s exactly for display/identity projection. Free source
-- text is never normalized or rewritten by this derived model.
create function chinatech_v2_private.directory_trim(raw text) returns text
language sql immutable set search_path='' as $$ select btrim(coalesce(raw,''),U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') $$;
create function chinatech_v2_private.directory_phone_query(raw text) returns boolean
language sql immutable set search_path='' as $$ select coalesce(raw,'') ~ ('^([+]|00)?[0-9'||U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'||'().-]+$') $$;
revoke all on function chinatech_v2_private.directory_trim(text),chinatech_v2_private.directory_phone_query(text) from public,anon,authenticated;
grant execute on function chinatech_v2_private.directory_trim(text),chinatech_v2_private.directory_phone_query(text) to chinatech_runtime;

create function chinatech_v2_private.directory_phone(raw text) returns text
language plpgsql immutable set search_path='' as $$
declare value text:=chinatech_v2_private.directory_trim(normalize(coalesce(raw,''),NFKC)); digits text; international text;
begin
 if value='' or length(value)>40 or not chinatech_v2_private.directory_phone_query(value) then return null; end if;
 digits:=regexp_replace(value,'[^0-9]','','g');
 international:=case when left(value,1)='+' then digits when left(value,2)='00' then substr(digits,3) else '39'||digits end;
 if international !~ '^[1-9][0-9]{6,14}$' or (left(value,1)<>'+' and left(value,2)<>'00' and length(digits)<7) then return null; end if;
 return '+'||international;
end $$;
revoke all on function chinatech_v2_private.directory_phone(text) from public,anon,authenticated;
grant execute on function chinatech_v2_private.directory_phone(text) to chinatech_runtime;

-- The invoker-only projector is shared by owner-run bounded backfill and the
-- trigger. The web role cannot call it or mutate the derived tables directly.
create function chinatech_v2_private.project_customer_directory(target_store uuid,kind text,target_id text,document jsonb,published boolean default true) returns void
language plpgsql set search_path='' as $$
declare item jsonb; normalized text; display_name text; event_key text; event_position integer;
begin
 if kind not in ('profile','repair','sale','history') then raise exception 'unsupported directory source'; end if;
 delete from chinatech_v2_private.customer_directory_sources where store_id=target_store and origin_kind=kind and origin_id=target_id;
 if document is null or not published then return; end if;
 if kind='sale' then
  for item,event_position in select value,ordinality::integer from jsonb_array_elements(coalesce(document->'sales','[]')) with ordinality loop
   normalized:=chinatech_v2_private.directory_phone(item->>'customerPhone');
   if normalized is null then continue; end if;
   display_name:=chinatech_v2_private.directory_trim(item->>'customerName'); if display_name in ('未填写姓名','未填写称呼','未记录') then display_name:=''; end if;
   event_key:=item->>'id';
   insert into chinatech_v2_private.customer_directory_sources values(target_store,kind,target_id,event_key,normalized,display_name,coalesce(item->>'customerEmail',''),coalesce(item->>'time',''),event_position,coalesce(item->>'time',''));
  end loop;
 else
  normalized:=chinatech_v2_private.directory_phone(case when kind='history' then document->>'customerPhone' else document->>'phone' end);
  if normalized is null then return; end if;
  display_name:=chinatech_v2_private.directory_trim(case when kind='profile' then document->>'name' else document->>'customerName' end);
  if display_name in ('未填写姓名','未填写称呼','未记录') then display_name:=''; end if;
  insert into chinatech_v2_private.customer_directory_sources values(target_store,kind,target_id,target_id,normalized,display_name,
   case when kind='history' then '' else coalesce(document->>'email','') end,
   case when kind='repair' then coalesce(document->>'createdAt','') when kind='history' then coalesce(document->>'intakeAt','') else '' end,
   case when kind='history' then coalesce((document->>'sourceRow')::integer,0) else 0 end,
   case when kind='repair' then coalesce(nullif(document->>'updatedAt',''),document->>'createdAt','') when kind='history' then coalesce(nullif(document->>'pickupDate',''),left(document->>'intakeAt',10),'') else '' end);
 end if;
end $$;
revoke all on function chinatech_v2_private.project_customer_directory(uuid,text,text,jsonb,boolean) from public,anon,authenticated,chinatech_runtime;

-- This trigger has no callable arguments and projects only NEW/OLD from a
-- canonical row whose existing RLS and command transaction already succeeded.
-- Definer ownership is used solely for derived DML; no new client write grant.
create function chinatech_v2_private.customer_directory_sync() returns trigger
language plpgsql security definer set search_path='' as $$
declare kind text:=tg_argv[0]; target_store uuid; target_id text; source_row jsonb; old_row jsonb; old_id text;
begin
 if tg_op in ('UPDATE','DELETE') then
  old_row:=to_jsonb(old);
  old_id:=case when kind='profile' then old_row->>'normalized_phone' else old_row->>'id' end;
 end if;
 if tg_op='DELETE' then
  target_store:=(old_row->>'store_id')::uuid; target_id:=old_id;
  perform chinatech_v2_private.project_customer_directory(target_store,kind,target_id,null);
 else
  source_row:=to_jsonb(new);
  target_store:=(source_row->>'store_id')::uuid;
  target_id:=case when kind='profile' then source_row->>'normalized_phone' else source_row->>'id' end;
  if tg_op='UPDATE' and (target_store::text<>old_row->>'store_id' or target_id<>old_id) then
   perform chinatech_v2_private.project_customer_directory((old_row->>'store_id')::uuid,kind,old_id,null);
   if target_store::text<>old_row->>'store_id' then
    insert into chinatech_v2_private.customer_directory_models(store_id,generation) values((old_row->>'store_id')::uuid,1) on conflict(store_id) do update set generation=customer_directory_models.generation+1;
   end if;
  end if;
  perform chinatech_v2_private.project_customer_directory(target_store,kind,target_id,source_row->'data',case when kind='history' then (source_row->>'published')::boolean else true end);
 end if;
 insert into chinatech_v2_private.customer_directory_models(store_id,generation) values(target_store,1) on conflict(store_id) do update set generation=customer_directory_models.generation+1;
 return null;
end $$;
revoke all on function chinatech_v2_private.customer_directory_sync() from public,anon,authenticated,chinatech_runtime;
create trigger customer_directory_profile after insert or update or delete on chinatech_v2_private.customers for each row execute function chinatech_v2_private.customer_directory_sync('profile');
create trigger customer_directory_repair after insert or update or delete on chinatech_v2_private.repair_intakes for each row execute function chinatech_v2_private.customer_directory_sync('repair');
create trigger customer_directory_sale after insert or update or delete on chinatech_v2_private.retail_units for each row execute function chinatech_v2_private.customer_directory_sync('sale');
create trigger customer_directory_history after insert or update or delete on chinatech_v2_private.retail_history_records for each row execute function chinatech_v2_private.customer_directory_sync('history');
-- No automatic unbounded backfill or activation. The owner-run script processes
-- at most 200 canonical records per transaction and verifies before ready=true.

-- A newly inserted store cannot already have canonical rows because of the
-- existing foreign keys. Its empty model is complete; subsequent source writes
-- are maintained by the four triggers above. Existing stores still need backfill.
create function chinatech_v2_private.customer_directory_store_init() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into chinatech_v2_private.customer_directory_models(store_id,ready) values(new.id,true);
 return null;
end $$;
revoke all on function chinatech_v2_private.customer_directory_store_init() from public,anon,authenticated,chinatech_runtime;
create trigger customer_directory_store_init after insert on chinatech_v2.stores for each row execute function chinatech_v2_private.customer_directory_store_init();
