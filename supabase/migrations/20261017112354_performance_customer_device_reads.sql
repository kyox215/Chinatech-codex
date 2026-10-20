-- Independent physical-device summaries. No canonical facts are rewritten.
create table chinatech_v2_private.customer_device_facts(
 store_id uuid not null references chinatech_v2.stores(id)on delete cascade,
 kind text not null check(kind in('repair','sale')),origin_id text not null,
 device_id text not null check(length(device_id)=64),category text not null,model text not null,serial text not null,search text not null,
 primary key(store_id,kind,origin_id)
);
create index customer_device_identity on chinatech_v2_private.customer_device_facts(store_id,device_id,kind,origin_id);
create table chinatech_v2_private.customer_device_records(
 store_id uuid not null,kind text not null,origin_id text not null,event_id text not null,event_order integer not null,
 display_id text not null,phone text not null,event_at text not null,event_lex bytea not null,search text not null,
 primary key(store_id,kind,origin_id,event_id),
 foreign key(store_id,kind,origin_id)references chinatech_v2_private.customer_device_facts(store_id,kind,origin_id)on delete cascade
);
create index customer_device_record_order on chinatech_v2_private.customer_device_records(store_id,kind,origin_id,event_order);
create table chinatech_v2_private.customer_device_models(
 store_id uuid primary key references chinatech_v2.stores(id)on delete cascade,
 format_version integer not null default 1 check(format_version=1),
 rules_hash text not null default '597d101fc55f9e21357a3b810a04a2b9a59a814523a4ad52c5e0b1dec953ea98',ready boolean not null default false,generation bigint not null default 0,
 backfill_cursor text,verified_at timestamptz
);
alter table chinatech_v2_private.customer_device_facts enable row level security;
alter table chinatech_v2_private.customer_device_facts force row level security;
alter table chinatech_v2_private.customer_device_records enable row level security;
alter table chinatech_v2_private.customer_device_records force row level security;
alter table chinatech_v2_private.customer_device_models enable row level security;
alter table chinatech_v2_private.customer_device_models force row level security;
revoke all on chinatech_v2_private.customer_device_facts,chinatech_v2_private.customer_device_records,chinatech_v2_private.customer_device_models from public,anon,authenticated,chinatech_runtime;
grant select on chinatech_v2_private.customer_device_facts,chinatech_v2_private.customer_device_records,chinatech_v2_private.customer_device_models to chinatech_runtime;
create policy customer_device_facts_read on chinatech_v2_private.customer_device_facts for select to chinatech_runtime using(
 store_id::text=(select current_setting('app.store_id',true))and
 (kind='repair'and(select chinatech_v2_private.member_access(nullif(current_setting('app.store_id',true),'')::uuid,'repairs.view'))or
 kind='sale'and(select chinatech_v2_private.member_access(nullif(current_setting('app.store_id',true),'')::uuid,'retail.view')))
);
create policy customer_device_records_read on chinatech_v2_private.customer_device_records for select to chinatech_runtime using(
 store_id::text=(select current_setting('app.store_id',true))and
 (kind='repair'and(select chinatech_v2_private.member_access(nullif(current_setting('app.store_id',true),'')::uuid,'repairs.view'))or
 kind='sale'and(select chinatech_v2_private.member_access(nullif(current_setting('app.store_id',true),'')::uuid,'retail.view')))
);
create policy customer_device_models_read on chinatech_v2_private.customer_device_models for select to chinatech_runtime using(
 store_id::text=(select current_setting('app.store_id',true))and(select chinatech_v2_private.member_access(nullif(current_setting('app.store_id',true),'')::uuid))
);
-- JS relational string comparison uses UTF-16 code units. Valid legacy sale
-- times can contain non-ASCII suffixes, so a UTF-8 max() is not equivalent.
create function chinatech_v2_private.customer_device_utf16(value text)returns bytea language plpgsql immutable strict set search_path=''as $$
declare c text;point integer;result bytea:=''::bytea;
begin
 for c in select v from regexp_split_to_table(value,'')v where v<>''loop
  point:=ascii(c);
  if point<65536 then result:=result||decode(lpad(to_hex(point),4,'0'),'hex');
  else point:=point-65536;result:=result||decode(lpad(to_hex(55296+(point/1024)),4,'0')||lpad(to_hex(56320+(point%1024)),4,'0'),'hex');end if;
 end loop;return result;
end $$;
revoke all on function chinatech_v2_private.customer_device_utf16(text)from public,anon,authenticated,chinatech_runtime;
create function chinatech_v2_private.customer_device_document(kind text,document jsonb)returns jsonb language plpgsql immutable strict set search_path=''as $$
declare serial text;identity text;records jsonb;model text:=coalesce(document->>'brand','')||' '||coalesce(document->>'model','');
begin
 if kind='repair'then
  serial:=translate(chinatech_v2_private.unicode17_upper(chinatech_v2_private.directory_trim(coalesce(document->>'serial',''))),U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF','');
  identity:=case when serial=''then'repair:'||(document->>'id')when serial~'^[0-9]{15}$'then'IMEI:'||serial else chinatech_v2_private.unicode17_upper(chinatech_v2_private.directory_trim(coalesce(document->>'brand','')))||':'||serial end;
  records:=jsonb_build_array(jsonb_build_object('eventId',document->>'id','position',0,'id',document->>'id','phone',document->>'phone','time',document->>'createdAt'));
 elsif kind='sale'then
  identity:='retail:'||(document->>'id');serial:=coalesce(nullif(document->>'imei1',''),nullif(document->>'serial',''),document->>'code','');
  select coalesce(jsonb_agg(jsonb_build_object('eventId',v->>'id','position',n,'id',document->>'code','phone',v->>'customerPhone','time',v->>'time')order by n),'[]')into records from jsonb_array_elements(coalesce(document->'sales','[]'))with ordinality t(v,n)where coalesce(v->>'customerPhone','')<>'';
 else raise exception'unsupported physical device source';end if;
 return jsonb_build_object('id',encode(sha256(convert_to(identity,'UTF8')),'hex'),'category',document->>'category','model',model,'serial',serial,'records',records);
end $$;
revoke all on function chinatech_v2_private.customer_device_document(text,jsonb)from public,anon,authenticated,chinatech_runtime;
create function chinatech_v2_private.project_customer_device(target_store uuid,kind text,target_id text,document jsonb)returns void language plpgsql set search_path=''as $$
declare fact jsonb;record jsonb;
begin
 fact:=chinatech_v2_private.customer_device_document(kind,document);
 delete from chinatech_v2_private.customer_device_facts f where f.store_id=target_store and f.kind=project_customer_device.kind and f.origin_id=target_id;
 if jsonb_array_length(fact->'records')=0 then return;end if;
 insert into chinatech_v2_private.customer_device_facts values(target_store,kind,target_id,fact->>'id',fact->>'category',fact->>'model',fact->>'serial',chinatech_v2_private.unicode17_lower((fact->>'model')||' '||(fact->>'serial')));
 for record in select v from jsonb_array_elements(fact->'records')v loop
  insert into chinatech_v2_private.customer_device_records values(target_store,kind,target_id,record->>'eventId',(record->>'position')::integer,record->>'id',record->>'phone',record->>'time',chinatech_v2_private.customer_device_utf16(record->>'time'),chinatech_v2_private.unicode17_lower((record->>'phone')||' '||(record->>'id')));
 end loop;
end $$;
revoke all on function chinatech_v2_private.project_customer_device(uuid,text,text,jsonb)from public,anon,authenticated,chinatech_runtime;
create function chinatech_v2_private.customer_device_sync()returns trigger language plpgsql security definer set search_path=''as $$
declare source_kind text:=tg_argv[0];old_row jsonb;source_row jsonb;old_fact jsonb;new_fact jsonb;target_store uuid;old_store uuid;target_id text;
begin
 if tg_op in('UPDATE','DELETE')then old_row:=to_jsonb(old);old_store:=(old_row->>'store_id')::uuid;old_fact:=chinatech_v2_private.customer_device_document(source_kind,old_row->'data');end if;
 if tg_op in('INSERT','UPDATE')then source_row:=to_jsonb(new);new_fact:=chinatech_v2_private.customer_device_document(source_kind,source_row->'data');else source_row:=old_row;end if;
 target_store:=(source_row->>'store_id')::uuid;target_id:=source_row->>'id';
 -- A quote, workflow, photo or cost-only update must not invalidate device data.
 if tg_op='UPDATE'and target_store=old_store and target_id=old_row->>'id'and old_fact=new_fact then return new;end if;
 if tg_op in('UPDATE','DELETE')then
  delete from chinatech_v2_private.customer_device_facts where store_id=old_store and customer_device_facts.kind=source_kind and origin_id=old_row->>'id';
  if tg_op='UPDATE'and old_store<>target_store then insert into chinatech_v2_private.customer_device_models(store_id,generation)values(old_store,1)on conflict(store_id)do update set generation=customer_device_models.generation+1;end if;
 end if;
 if tg_op<>'DELETE'then perform chinatech_v2_private.project_customer_device(target_store,source_kind,target_id,source_row->'data');end if;
 insert into chinatech_v2_private.customer_device_models(store_id,generation)values(target_store,1)on conflict(store_id)do update set generation=customer_device_models.generation+1;
 if tg_op='DELETE'then return old;end if;return new;
end $$;
revoke all on function chinatech_v2_private.customer_device_sync()from public,anon,authenticated,chinatech_runtime;
create trigger customer_device_repair after insert or update or delete on chinatech_v2_private.repair_intakes for each row execute function chinatech_v2_private.customer_device_sync('repair');
create trigger customer_device_sale after insert or update or delete on chinatech_v2_private.retail_units for each row execute function chinatech_v2_private.customer_device_sync('sale');
insert into chinatech_v2_private.customer_device_models(store_id)select id from chinatech_v2.stores;
create function chinatech_v2_private.customer_device_store_init()returns trigger language plpgsql security definer set search_path=''as $$begin insert into chinatech_v2_private.customer_device_models(store_id,ready)values(new.id,true);return new;end $$;
revoke all on function chinatech_v2_private.customer_device_store_init()from public,anon,authenticated,chinatech_runtime;
create trigger customer_device_store_init after insert on chinatech_v2.stores for each row execute function chinatech_v2_private.customer_device_store_init();
