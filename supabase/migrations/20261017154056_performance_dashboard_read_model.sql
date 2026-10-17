-- Read-only dashboard activity. Stable entity display metadata is stored once;
-- events contain no photographs, notes, money, payments, or private details.
-- Existing list models continue to own full counts and workflow/procurement facts.
create table chinatech_v2_private.dashboard_models (
 store_id uuid primary key references chinatech_v2.stores(id) on delete cascade,
 format_version integer not null default 1 check(format_version=1),
 rules_hash text not null default 'a2db597f25f22fc31846b8f28d646c819ddfbc255a1c01234d4e3319f217a671',
 query_rules_hash text not null default 'fb12beb5c40803d691d89338c41efc1ab672310336c64dccc1a9a7b6a31ab36e',
 ready boolean not null default false,generation bigint not null default 0,
 backfill_cursor jsonb,verified_at timestamptz
);
create table chinatech_v2_private.dashboard_activity_heads (
 store_id uuid not null references chinatech_v2.stores(id) on delete cascade,
 source text not null check(source in('repair','procurement','retail')),
 entity_id text not null,repair_id text not null,display text not null,
 primary key(store_id,source,entity_id)
);
create table chinatech_v2_private.dashboard_activity_events (
 store_id uuid not null,source text not null,entity_id text not null,
 key text not null,id text not null,position integer not null,kind text not null check((source='repair' and kind in('intake','repair'))or(source in('procurement','retail')and kind=source)),
 time text not null,type text not null,label text not null,quantity integer,
 primary key(store_id,key),
 foreign key(store_id,source,entity_id) references chinatech_v2_private.dashboard_activity_heads on delete cascade
);
-- Financial event titles are separate even though their details are never copied.
create table chinatech_v2_private.dashboard_activity_private (
 store_id uuid not null,key text not null,label text not null,
 primary key(store_id,key),foreign key(store_id,key) references chinatech_v2_private.dashboard_activity_events on delete cascade
);
create index dashboard_activity_recent on chinatech_v2_private.dashboard_activity_events(store_id,source,time collate chinatech_v2_private.retail_list_ties desc,id collate chinatech_v2_private.retail_list_ties,(case kind when'intake'then 0 when'repair'then 1 when'procurement'then 2 else 3 end),entity_id,position);
create index dashboard_activity_entity on chinatech_v2_private.dashboard_activity_events(store_id,source,entity_id);

alter table chinatech_v2_private.dashboard_models enable row level security;
alter table chinatech_v2_private.dashboard_models force row level security;
alter table chinatech_v2_private.dashboard_activity_heads enable row level security;
alter table chinatech_v2_private.dashboard_activity_heads force row level security;
alter table chinatech_v2_private.dashboard_activity_events enable row level security;
alter table chinatech_v2_private.dashboard_activity_events force row level security;
alter table chinatech_v2_private.dashboard_activity_private enable row level security;
alter table chinatech_v2_private.dashboard_activity_private force row level security;
revoke all on chinatech_v2_private.dashboard_models,chinatech_v2_private.dashboard_activity_heads,chinatech_v2_private.dashboard_activity_events,chinatech_v2_private.dashboard_activity_private from public,anon,authenticated,chinatech_runtime;
grant select on chinatech_v2_private.dashboard_models,chinatech_v2_private.dashboard_activity_heads,chinatech_v2_private.dashboard_activity_events,chinatech_v2_private.dashboard_activity_private to chinatech_runtime;
create policy dashboard_model_scope on chinatech_v2_private.dashboard_models for select to chinatech_runtime using(
 store_id::text=(select current_setting('app.store_id',true)) and (select chinatech_v2_private.member_access(nullif(current_setting('app.store_id',true),'')::uuid))
);
create policy dashboard_head_scope on chinatech_v2_private.dashboard_activity_heads for select to chinatech_runtime using(
 store_id::text=(select current_setting('app.store_id',true)) and case when source='retail' then (select chinatech_v2_private.member_access(nullif(current_setting('app.store_id',true),'')::uuid,'retail.view')) else (select chinatech_v2_private.member_access(nullif(current_setting('app.store_id',true),'')::uuid,'repairs.view')) end
);
create policy dashboard_event_scope on chinatech_v2_private.dashboard_activity_events for select to chinatech_runtime using(
 store_id::text=(select current_setting('app.store_id',true)) and case when source='retail' then (select chinatech_v2_private.member_access(nullif(current_setting('app.store_id',true),'')::uuid,'retail.view')) else (select chinatech_v2_private.member_access(nullif(current_setting('app.store_id',true),'')::uuid,'repairs.view')) end
);
create policy dashboard_private_scope on chinatech_v2_private.dashboard_activity_private for select to chinatech_runtime using(
 store_id::text=(select current_setting('app.store_id',true)) and (select chinatech_v2_private.member_access(nullif(current_setting('app.store_id',true),'')::uuid,'retail.view')) and (select chinatech_v2_private.member_access(nullif(current_setting('app.store_id',true),'')::uuid,'financial.read'))
);

-- Owner-only canonical oracle and trigger input. Display translations remain in JS.
create function chinatech_v2_private.dashboard_activity_facts(source text,document jsonb,saved_workflow jsonb default null) returns jsonb
language sql immutable set search_path='' as $$
 select coalesce(jsonb_agg(fact order by ordinal),'[]'::jsonb)from(
  select 0::bigint ordinal,jsonb_build_object('key',jsonb_build_array('intake',document->>'id','')::text,'position',0,'id','intake:'||(document->>'id'),'kind','intake','time',document->>'createdAt','type','intake','label','','privateLabel',null,'quantity',null)fact
  where source='repair' and coalesce(document->>'createdAt','')<>''
  union all
  select ordinal,jsonb_build_object('key',jsonb_build_array('repair',document->>'id',event->>'id')::text,'position',ordinal,'id','repair:'||(document->>'id')||':'||(event->>'id'),'kind','repair','time',event->>'time','type',event->>'type','label',event->>'label','privateLabel',null,'quantity',null)
  from jsonb_array_elements(case when source='repair' then coalesce(saved_workflow->'events','[]')else'[]'::jsonb end)with ordinality a(event,ordinal)where coalesce(event->>'time','')<>''
  union all
  select ordinal,jsonb_build_object('key',jsonb_build_array(source,document->>'id',event->>'id')::text,'position',ordinal,'id',source||':'||(document->>'id')||':'||(event->>'id'),'kind',source,'time',event->>'time','type',case when source='retail' then'retail'else event->>'type'end,'label',
   case when source<>'retail' then''when event->>'sensitive'='financial' or((event->>'title')||' '||(event->>'detail'))~*'成本|毛利|利润|costCents|refurbCents|grossProfit'then'财务资料更正'else event->>'title'end,
   'privateLabel',case when source='retail' and(event->>'sensitive'='financial' or((event->>'title')||' '||(event->>'detail'))~*'成本|毛利|利润|costCents|refurbCents|grossProfit')then event->>'title'else null end,
   'quantity',case when source='procurement'then event->'quantity'else null end)
  from jsonb_array_elements(case when source in('procurement','retail')then coalesce(document->'events','[]')else'[]'::jsonb end)with ordinality a(event,ordinal)where coalesce(event->>'time','')<>''
 )facts
$$;
revoke all on function chinatech_v2_private.dashboard_activity_facts(text,jsonb,jsonb) from public,anon,authenticated,chinatech_runtime;

create function chinatech_v2_private.project_dashboard_activity(target_store uuid,target_source text,target_id text) returns void
language plpgsql set search_path='' as $$
declare document jsonb;wf jsonb;display_value text;repair_value text;facts jsonb;affected bigint;changed boolean:=false;
begin
 if target_source='repair' then
  select data,workflow into document,wf from chinatech_v2_private.repair_intakes where store_id=target_store and id=target_id;
  display_value:=target_id;repair_value:=target_id;
 elsif target_source='procurement' then
  select data into document from chinatech_v2_private.procurement_records where store_id=target_store and id=target_id;
  display_value:=document->>'item';repair_value:=document->>'repairId';
 elsif target_source='retail' then
  select data into document from chinatech_v2_private.retail_units where store_id=target_store and id=target_id;
  display_value:=document->>'code';repair_value:='';
 else raise exception 'Unsupported dashboard source';end if;
 if document is null then
  delete from chinatech_v2_private.dashboard_activity_heads where store_id=target_store and source=target_source and entity_id=target_id;
  get diagnostics affected=row_count;changed:=affected>0;
 else
  facts:=chinatech_v2_private.dashboard_activity_facts(target_source,document,wf);
  insert into chinatech_v2_private.dashboard_activity_heads(store_id,source,entity_id,repair_id,display)values(target_store,target_source,target_id,repair_value,display_value)
  on conflict(store_id,source,entity_id)do update set repair_id=excluded.repair_id,display=excluded.display where(dashboard_activity_heads.repair_id,dashboard_activity_heads.display)is distinct from(excluded.repair_id,excluded.display);
  get diagnostics affected=row_count;changed:=affected>0;
  insert into chinatech_v2_private.dashboard_activity_events(store_id,source,entity_id,key,id,position,kind,time,type,label,quantity)
  select target_store,target_source,target_id,event->>'key',event->>'id',(event->>'position')::integer,event->>'kind',event->>'time',event->>'type',event->>'label',(event->>'quantity')::integer from jsonb_array_elements(facts)a(event)
  on conflict(store_id,key)do update set id=excluded.id,position=excluded.position,kind=excluded.kind,time=excluded.time,type=excluded.type,label=excluded.label,quantity=excluded.quantity
  where(dashboard_activity_events.id,dashboard_activity_events.position,dashboard_activity_events.kind,dashboard_activity_events.time,dashboard_activity_events.type,dashboard_activity_events.label,dashboard_activity_events.quantity)is distinct from(excluded.id,excluded.position,excluded.kind,excluded.time,excluded.type,excluded.label,excluded.quantity);
  get diagnostics affected=row_count;changed:=changed or affected>0;
  insert into chinatech_v2_private.dashboard_activity_private(store_id,key,label)
  select target_store,event->>'key',event->>'privateLabel' from jsonb_array_elements(facts)a(event)where event->>'privateLabel' is not null
  on conflict(store_id,key)do update set label=excluded.label where dashboard_activity_private.label is distinct from excluded.label;
  get diagnostics affected=row_count;changed:=changed or affected>0;
  delete from chinatech_v2_private.dashboard_activity_private p where p.store_id=target_store and exists(select 1 from chinatech_v2_private.dashboard_activity_events e where e.store_id=p.store_id and e.key=p.key and e.source=target_source and e.entity_id=target_id)and not exists(select 1 from jsonb_array_elements(facts)a(event)where event->>'key'=p.key and event->>'privateLabel' is not null);
  get diagnostics affected=row_count;changed:=changed or affected>0;
  delete from chinatech_v2_private.dashboard_activity_events e where e.store_id=target_store and e.source=target_source and e.entity_id=target_id and not exists(select 1 from jsonb_array_elements(facts)a(event)where event->>'key'=e.key);
  get diagnostics affected=row_count;changed:=changed or affected>0;
 end if;
 if changed then update chinatech_v2_private.dashboard_models set generation=generation+1 where store_id=target_store;end if;
end $$;
revoke all on function chinatech_v2_private.project_dashboard_activity(uuid,text,text) from public,anon,authenticated,chinatech_runtime;

create function chinatech_v2_private.dashboard_activity_sync()returns trigger
language plpgsql security definer set search_path='' as $$
declare source_kind text:=tg_argv[0];target_store uuid;target_id text;
begin
 if tg_op='DELETE' then target_store:=old.store_id;target_id:=old.id;
 else target_store:=new.store_id;target_id:=new.id;
  if tg_op='UPDATE' and(old.store_id,old.id)is not distinct from(new.store_id,new.id)then
   if source_kind='repair' then
    if(old.data->>'createdAt',old.workflow->'events')is not distinct from(new.data->>'createdAt',new.workflow->'events')then return new;end if;
   elsif source_kind='procurement' then
    if(old.data->>'item',old.data->>'repairId',old.data->'events')is not distinct from(new.data->>'item',new.data->>'repairId',new.data->'events')then return new;end if;
   elsif source_kind='retail' then
    if(old.data->>'code',old.data->'events')is not distinct from(new.data->>'code',new.data->'events')then return new;end if;
   end if;
  end if;
 end if;
 if tg_op='UPDATE' and(old.store_id,old.id)is distinct from(new.store_id,new.id)then
  perform chinatech_v2_private.project_dashboard_activity(old.store_id,source_kind,old.id);
 end if;
 perform chinatech_v2_private.project_dashboard_activity(target_store,source_kind,target_id);
 return case when tg_op='DELETE' then old else new end;
end $$;
revoke all on function chinatech_v2_private.dashboard_activity_sync()from public,anon,authenticated,chinatech_runtime;
create trigger dashboard_repair_sync after insert or update or delete on chinatech_v2_private.repair_intakes for each row execute function chinatech_v2_private.dashboard_activity_sync('repair');
create trigger dashboard_procurement_sync after insert or update or delete on chinatech_v2_private.procurement_records for each row execute function chinatech_v2_private.dashboard_activity_sync('procurement');
create trigger dashboard_retail_sync after insert or update or delete on chinatech_v2_private.retail_units for each row execute function chinatech_v2_private.dashboard_activity_sync('retail');

create function chinatech_v2_private.dashboard_store_init()returns trigger language plpgsql security definer set search_path='' as $$begin
 insert into chinatech_v2_private.dashboard_models(store_id,ready,verified_at)values(new.id,true,clock_timestamp());return new;
end $$;
revoke all on function chinatech_v2_private.dashboard_store_init()from public,anon,authenticated,chinatech_runtime;
create trigger dashboard_store_init after insert on chinatech_v2.stores for each row execute function chinatech_v2_private.dashboard_store_init();
-- Existing stores fail closed until a bounded, independently verified backfill.
insert into chinatech_v2_private.dashboard_models(store_id)select id from chinatech_v2.stores;
