-- Equivalent customer association execution; original migration10 SHA256 0687fff65447ad71618ee7ccf234e8e51e96c1e74d70548325b2548f6d76485a.
-- ASCII U+0020 (CCC0, not Case_Ignorable) separates each raw field exactly as
-- array_to_string(...,' ') did. NULL fields are skipped; empty fields remain.
-- Full Unicode boundary/fact and actual canonical-trigger oracles are required.
-- No canonical rows, model format/rules/generation, RLS, trigger mode or grants
-- change. New helpers are private invoker functions; old entry points remain.
create function chinatech_v2_private.customer_record_search(raw_values text[],folded jsonb)returns text
language plpgsql immutable strict set search_path=''as $$
declare value text;parts text[]:='{}';
begin
 foreach value in array raw_values loop
  if value is null then continue;end if;
  parts:=array_append(parts,case when folded?value then folded->>value else chinatech_v2_private.unicode17_lower(chinatech_v2_private.unicode17_nfkc(value))end);
 end loop;
 return array_to_string(parts,' ');
end $$;
revoke all on function chinatech_v2_private.customer_record_search(text[],jsonb)from public,anon,authenticated,chinatech_runtime;

create function chinatech_v2_private.customer_record_sale_prepared(document jsonb)returns jsonb
language plpgsql immutable strict set search_path=''as $$
declare fallback_name text:=chinatech_v2_private.directory_trim(coalesce(document->>'brand','')||' '||coalesce(document->>'model',''));folded jsonb;
begin
 select coalesce(jsonb_object_agg(value,chinatech_v2_private.unicode17_lower(chinatech_v2_private.unicode17_nfkc(value))),'{}')into folded from(
  select distinct value collate "C" as value from(
   select document->>'code'value union all select fallback_name
   union all select case when sale?'product'then chinatech_v2_private.directory_trim(coalesce(sale->'product'->>'brand','')||' '||coalesce(sale->'product'->>'model',''))else fallback_name end from jsonb_array_elements(coalesce(document->'sales','[]'))sale
   union all select nullif(sale->'product'->>'code','')from jsonb_array_elements(coalesce(document->'sales','[]'))sale
  )values_to_prepare where value is not null
 )distinct_values;
 return folded;
end $$;
revoke all on function chinatech_v2_private.customer_record_sale_prepared(jsonb)from public,anon,authenticated,chinatech_runtime;


create function chinatech_v2_private.customer_record_fact_prepared(kind text,document jsonb,event_position integer,prepared jsonb)returns jsonb
language plpgsql immutable strict set search_path=''as $$
declare phone text;event_at text;summary jsonb;search text;item jsonb;field text;field_value text;previews jsonb:='[]';faults jsonb;raw_values text[];refunded bigint;device_name text;
begin
 if kind='repairs'then
  phone:=chinatech_v2_private.directory_phone(document->>'phone');event_at:=document->>'createdAt';
  select coalesce(jsonb_agg(left(value,200)order by ordinal),'[]')into faults from jsonb_array_elements_text(coalesce(document->'faults','[]'))with ordinality a(value,ordinal);
  summary:=jsonb_build_object('kind',kind,'id',document->>'id','brand',document->>'brand','model',document->>'model','createdAt',event_at,'issue',document->>'issue','rework',document?'repairOrigin');
  if document?'faults'then summary:=summary||jsonb_build_object('faults',faults);end if;
  if document?'issueNote'then summary:=summary||jsonb_build_object('issueNote',document->>'issueNote');end if;
  if exists(select 1 from jsonb_array_elements_text(coalesce(document->'faults','[]'))v where length(v)>200)then previews:=previews||'"faults"'::jsonb;end if;
  raw_values:=array[document->>'id',document->>'brand',document->>'model',document->>'issue',document->>'issueNote',(select string_agg(a.value,' 'order by a.ordinal)from jsonb_array_elements_text(coalesce(document->'faults','[]'))with ordinality a(value,ordinal)),event_at];
 elsif kind='sales'then
  item:=document->'sale';phone:=chinatech_v2_private.directory_phone(item->>'customerPhone');event_at:=item->>'time';
  device_name:=case when item?'product'then chinatech_v2_private.directory_trim(coalesce(item->'product'->>'brand','')||' '||coalesce(item->'product'->>'model',''))else chinatech_v2_private.directory_trim(coalesce(document->>'brand','')||' '||coalesce(document->>'model',''))end;
  select coalesce(sum((value->>'amountCents')::bigint)filter(where (coalesce(value->'void','null')='null'::jsonb or value->'void'='false'::jsonb)),0)into refunded from jsonb_array_elements(coalesce(item->'refunds','[]'));
  summary:=jsonb_build_object('kind',kind,'id',item->>'id','unitId',document->>'id','unitCode',coalesce(nullif(item->'product'->>'code',''),document->>'code'),'deviceName',device_name,'time',event_at,'priceCents',item->'priceCents','paidCents',item->'paidCents','delivered',item->'delivered','customerName',coalesce(item->>'customerName',''),'customerEmail',coalesce(item->>'customerEmail',''),'customerAddress',coalesce(item->>'customerAddress',''),'customerNote',coalesce(item->>'customerNote',''),'refundedCents',refunded,'returned',case jsonb_typeof(item->'returned')when 'boolean'then(item->>'returned')::boolean when 'null'then false else item?'returned'end,'afterSaleCount',jsonb_array_length(coalesce(item->'afterSales','[]')));
  if item?'deliveryDate'then summary:=summary||jsonb_build_object('deliveryDate',item->>'deliveryDate');end if;
  raw_values:=array[document->>'code',summary->>'unitCode',device_name,item->>'id',item->>'customerName',item->>'customerEmail',item->>'customerAddress',item->>'customerNote',event_at,item->>'deliveryDate'];
 elsif kind='history'then
  phone:=chinatech_v2_private.directory_phone(document->>'customerPhone');event_at:=document->>'intakeAt';
  summary:=jsonb_build_object('kind',kind,'id',document->>'id','sourceRow',document->'sourceRow','sourceStatus',document->'sourceStatus','brand',document->'brand','model',document->'model','intakeAt',event_at,'pickupDate',document->'pickupDate','salePriceCents',document->'salePriceCents','reviewCount',jsonb_array_length(coalesce(document->'reviewReasons','[]')));
  raw_values:=array['ST-'||lpad(((document->>'sourceRow')::integer-1)::text,greatest(4,length(((document->>'sourceRow')::integer-1)::text)),'0'),document->>'brand',document->>'model',document->>'sourceStatus',document->>'customerName',document->>'customerPhone',document->>'intakeAt',document->>'pickupDate'];
 else raise exception'unsupported customer record source';end if;
 if phone is null then return null;end if;
 foreach field in array array['brand','model','issue','issueNote','unitCode','deviceName','customerName','customerEmail','customerNote','sourceStatus']loop
  field_value:=summary->>field;if field_value is not null and length(field_value)>200 then summary:=summary||jsonb_build_object(field,left(field_value,200));previews:=previews||to_jsonb(field);end if;
 end loop;
 search:=chinatech_v2_private.customer_record_search(raw_values,prepared);
 return jsonb_build_object('phone',phone,'eventAt',event_at,'search',search,'summary',summary||jsonb_build_object('previews',previews));
end $$;

revoke all on function chinatech_v2_private.customer_record_fact_prepared(text,jsonb,integer,jsonb)from public,anon,authenticated,chinatech_runtime;
create or replace function chinatech_v2_private.customer_record_fact(kind text,document jsonb,event_position integer)returns jsonb
language sql immutable strict set search_path=''as $$select chinatech_v2_private.customer_record_fact_prepared(kind,document,event_position,'{}'::jsonb)$$;
revoke all on function chinatech_v2_private.customer_record_fact(text,jsonb,integer)from public,anon,authenticated,chinatech_runtime;

create function chinatech_v2_private.project_customer_record_fact(target_store uuid,kind text,target_id text,event_id text,event_position integer,document jsonb,prepared jsonb)returns void
language plpgsql set search_path=''as $$
declare facts jsonb;key text:=jsonb_build_array(kind,target_id,event_id)::text;
begin
 facts:=chinatech_v2_private.customer_record_fact_prepared(kind,document,event_position,prepared);
 delete from chinatech_v2_private.customer_record_sources s where s.store_id=target_store and s.kind=project_customer_record_fact.kind and s.origin_id=target_id and s.event_id=project_customer_record_fact.event_id;
 if facts is null then return;end if;
 insert into chinatech_v2_private.customer_record_sources values(target_store,kind,target_id,event_id,event_position,key,facts->>'phone',facts->>'eventAt',facts->>'search',(facts->'summary')||jsonb_build_object('key',key));
end $$;

revoke all on function chinatech_v2_private.project_customer_record_fact(uuid,text,text,text,integer,jsonb,jsonb)from public,anon,authenticated,chinatech_runtime;
create or replace function chinatech_v2_private.project_customer_record_fact(target_store uuid,kind text,target_id text,event_id text,event_position integer,document jsonb)returns void
language sql set search_path=''as $$select chinatech_v2_private.project_customer_record_fact(target_store,kind,target_id,event_id,event_position,document,'{}'::jsonb)$$;
revoke all on function chinatech_v2_private.project_customer_record_fact(uuid,text,text,text,integer,jsonb)from public,anon,authenticated,chinatech_runtime;

create or replace function chinatech_v2_private.customer_record_sync()returns trigger
language plpgsql security definer set search_path=''as $$
declare source_kind text:=tg_argv[0];old_row jsonb;source_row jsonb;target_store uuid;target_id text;item jsonb;position integer;prepared jsonb;
begin
 if tg_op in('UPDATE','DELETE')then
  old_row:=to_jsonb(old);
  delete from chinatech_v2_private.customer_record_sources where store_id=(old_row->>'store_id')::uuid and customer_record_sources.kind=source_kind and origin_id=old_row->>'id';
  if tg_op='UPDATE'and old_row->>'store_id'<>to_jsonb(new)->>'store_id'then insert into chinatech_v2_private.customer_record_models(store_id,generation)values((old_row->>'store_id')::uuid,1)on conflict(store_id)do update set generation=customer_record_models.generation+1;end if;
 end if;
 source_row:=case when tg_op='DELETE'then old_row else to_jsonb(new)end;target_store:=(source_row->>'store_id')::uuid;target_id:=source_row->>'id';
 if tg_op<>'DELETE'and(source_kind<>'history'or coalesce((source_row->>'published')::boolean,false))then
  if source_kind='sales'then
   prepared:=chinatech_v2_private.customer_record_sale_prepared(source_row->'data');
   for item,position in select value,ordinality::integer from jsonb_array_elements(coalesce(source_row->'data'->'sales','[]'))with ordinality loop
    perform chinatech_v2_private.project_customer_record_fact(target_store,source_kind,target_id,item->>'id',position,jsonb_build_object('id',target_id,'code',source_row->'data'->'code','brand',source_row->'data'->'brand','model',source_row->'data'->'model','sale',item),prepared);
   end loop;
  else perform chinatech_v2_private.project_customer_record_fact(target_store,source_kind,target_id,target_id,case when source_kind='history'then(source_row->'data'->>'sourceRow')::integer else 0 end,source_row->'data');end if;
 end if;
 insert into chinatech_v2_private.customer_record_models(store_id,generation)values(target_store,1)on conflict(store_id)do update set generation=customer_record_models.generation+1;
 if tg_op='DELETE'then return old;end if;return new;
end $$;

revoke all on function chinatech_v2_private.customer_record_sync()from public,anon,authenticated,chinatech_runtime;
