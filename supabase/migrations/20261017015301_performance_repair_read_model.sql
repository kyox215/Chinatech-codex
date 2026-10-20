-- List facts are a disposable, transactional projection. Canonical intake,
-- workflow, procurement and append-only history remain the write authority.
-- JSON.stringify-compatible arrays are needed only for existing fingerprints
-- and notice signatures. This helper never serializes a business object.
create function chinatech_v2_private.repair_array_json(value jsonb) returns text
language plpgsql immutable set search_path='' as $$
declare result text;
begin
 if value is null then return 'null'; end if;
 if jsonb_typeof(value)<>'array' then return value::text; end if;
 select '['||coalesce(string_agg(chinatech_v2_private.repair_array_json(item),',' order by ordinal),'')||']'
 into result from jsonb_array_elements(value) with ordinality a(item,ordinal);
 return result;
end $$;
revoke all on function chinatech_v2_private.repair_array_json(jsonb) from public,anon,authenticated,chinatech_runtime;

-- rows contains only real procurement identity/quantity/status/revision/link
-- facts (no costs, references, or event bodies). Called by the owner projector
-- and the bounded oracle verifier, never by a web client.
create function chinatech_v2_private.repair_list_facts(document jsonb,saved_workflow jsonb,rows jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare
 wf jsonb; sources jsonb:='[]'; requirements jsonb:='[]'; titles text[]:='{}'; title text; service jsonb; request text;
 source jsonb; existing jsonb; item jsonb; part jsonb; fingerprint text; source_fingerprint text; quality text; detail text;
 stage text; custody text; ready boolean; handed boolean:=false; history boolean; handover_index bigint; stage_index bigint;
 total integer:=0; ordered integer:=0; arrived integer:=0; in_cart integer:=0; required_count integer:=0; unresolved integer:=0;
 all_ready boolean; parts_group text; workflow_group text; pickup text; arrival text; signature text:=''; legacy_signature text;
 progress_label text; progress_tone text; progress_note text:=''; pending_parts boolean:=false; any_arrival boolean:=false;
 chips jsonb:='[]'; chip_count integer:=0; suppliers text; parts_followup text; contact jsonb;
 labels jsonb:='{"diagnosis":"待检测","awaiting_quote":"待确认","awaiting_parts":"待配件","repairing":"维修中","testing":"待测试","ready":"待取机","completed":"维修结束","cancelled":"作废","outsourced":"寄修"}';
 tones jsonb:='{"diagnosis":"warning","awaiting_quote":"warning","awaiting_parts":"info","repairing":"progress","testing":"info","ready":"success","completed":"success","cancelled":"warning","outsourced":"info"}';
 recovery_labels text[]:=array['维修阶段：待检测','维修阶段：待确认','维修阶段：待配件','维修阶段：维修中','维修阶段：待测试','维修阶段：寄修'];
begin
 rows:=coalesce(rows,'[]');
 wf:=coalesce(saved_workflow,jsonb_build_object('revision',0,'status','diagnosis','custody',coalesce(document->>'custody',case when document->>'id' like 'LOCAL-%' then 'unknown' else 'store' end),'notice',null,'events','[]'::jsonb,'updatedAt',document->>'updatedAt'));
 fingerprint:=chinatech_v2_private.repair_array_json(jsonb_build_array(document->>'category',document->>'brand',document->>'model'));
 -- Preserve the intake's stable first-occurrence title order, including empty
 -- historical fault prefixes. Do not normalize free customer text.
 for title in select split_part(value,'：',1) from jsonb_array_elements_text(coalesce(document->'faults','[]')) loop
  if not(title=any(titles)) then titles:=array_append(titles,title); end if;
 end loop;
 foreach title in array array['屏幕','电池','尾插'] loop
  service:=document->'services'->case title when '屏幕' then 'screen' when '电池' then 'battery' else 'port' end;
  if coalesce(service->>'quality','')<>'' and not(title=any(titles)) then titles:=array_append(titles,title); end if;
 end loop;
 foreach title in array titles loop
  service:=case title when '屏幕' then document->'services'->'screen' when '电池' then document->'services'->'battery' when '尾插' then document->'services'->'port' else null end;
  quality:=case service->>'quality' when 'original' then '原装' when 'assembled' then '组装' else '' end;
  detail:=case title when '屏幕' then upper(coalesce(document->'services'->'screen'->>'technology','')) when '电池' then case document->'services'->'battery'->>'appleService' when 'capacity' then '扩容' when 'diagnostics' then '跑诊断' when 'both' then '扩容跑诊断' else '' end else '' end;
  request:=concat_ws(' · ',nullif(quality,''),nullif(detail,''));
  source_fingerprint:=chinatech_v2_private.repair_array_json(jsonb_build_array(document->>'category',document->>'brand',document->>'model',title,request));
  source:=jsonb_build_object('id','intake:'||title,'title',title,'request',request,'revision',1,'mode','pending','confirmed',false,'deviceFingerprint',fingerprint,'sourceFingerprint',source_fingerprint);
  sources:=sources||jsonb_build_array(source);
  select value into existing from jsonb_array_elements(coalesce(wf->'requirements','[]')) where value->>'id'=source->>'id' limit 1;
  if existing is null then item:=source;
  elsif existing->>'sourceFingerprint'=source_fingerprint then item:=existing;
  else item:=source||jsonb_build_object('revision',(existing->>'revision')::integer+1); end if;
  requirements:=requirements||jsonb_build_array(item);
 end loop;
 for item in select value from jsonb_array_elements(coalesce(wf->'requirements','[]')) loop
  if exists(select 1 from jsonb_array_elements(sources) s where s->>'id'=item->>'id') then continue; end if;
  if coalesce(item->>'sourceFingerprint','')<>'' or item->>'deviceFingerprint' is distinct from fingerprint then
   item:=item||jsonb_build_object('revision',(item->>'revision')::integer+1,'mode','pending','confirmed',false,'deviceFingerprint',fingerprint);
  end if;
  requirements:=requirements||jsonb_build_array(item);
 end loop;
 for part in select value from jsonb_array_elements(rows) loop
  if coalesce((part->>'required')::boolean,true) then
   required_count:=required_count+1;total:=total+(part->>'quantity')::integer;arrived:=arrived+(part->>'arrived')::integer;
   if part->>'status' not in ('draft','cart') then ordered:=ordered+(part->>'quantity')::integer; end if;
   if part->>'status'='cart' then in_cart:=in_cart+(part->>'quantity')::integer;end if;
   pending_parts:=pending_parts or part->>'status' in ('ordered','partial');any_arrival:=any_arrival or (part->>'arrived')::integer>0;
  end if;
 end loop;
 for item in select value from jsonb_array_elements(requirements) loop
  if item->>'mode'='pending' or not(item->>'confirmed')::boolean or item->>'mode'='parts' and (
   not exists(select 1 from jsonb_array_elements(rows) p where p->>'requirementId'=item->>'id' and p->>'requirementRevision'=item->>'revision')
   or exists(select 1 from jsonb_array_elements(rows) p where coalesce((p->>'required')::boolean,true) and p->>'requirementId'=item->>'id' and p->>'requirementRevision' is distinct from item->>'revision')
  ) then unresolved:=unresolved+1;end if;
 end loop;
 all_ready:=unresolved=0 and (required_count>0 or jsonb_array_length(requirements)>0) and arrived=total;
 parts_group:=case when unresolved>0 then case when ordered>0 then 'mixed' else 'draft' end when required_count=0 then 'unrecorded' when arrived=total then 'complete' when ordered=total then 'ordered' when ordered>0 then 'mixed' else 'draft' end;
 stage:=case when wf->>'status'='ready_notified' then 'ready' when wf->>'status' in ('awaiting_reply','collected_unpaid') then case when coalesce(wf->>'readyCycle','')<>'' then 'ready' else 'awaiting_quote' end else wf->>'status' end;
 ready:=wf->>'status' in ('ready','ready_notified') or wf->>'status' in ('awaiting_reply','collected_unpaid') and coalesce(wf->>'readyCycle','')<>'';
 custody:=wf->>'custody';
 if wf->'handedOver' is not null and wf->'handedOver'<>'null'::jsonb then
  select max(ordinal) filter(where event->>'type'='followup' and event->>'time'=wf->'handedOver'->>'time' and event->>'label'='欠款已拿走：已记录'),
   max(ordinal) filter(where event->>'type'='stage' and event->>'label'=any(recovery_labels))
   into handover_index,stage_index from jsonb_array_elements(wf->'events') with ordinality a(event,ordinal);
  handed:=case when handover_index is not null then coalesce(stage_index,0)<=handover_index else not exists(select 1 from jsonb_array_elements(wf->'events') e where e->>'type'='stage' and e->>'label'=any(recovery_labels) and e->>'time'>wf->'handedOver'->>'time') end;
 end if;
 history:=stage in ('completed','cancelled') or handed;
 workflow_group:=case when stage='cancelled' then 'cancelled' when history then 'complete' when ready then 'ready' when pending_parts then 'purchase' when document?'repairOrigin' then 'rework' else 'processing' end;
 pickup:=case when not ready then '尚未修好' when wf->'pickupNotice'->>'cycle'=coalesce(wf->>'readyCycle','legacy') and wf->'pickupNotice'->>'outcome'='notified' then '已通知取机' when wf->>'status'='ready_notified' and not(wf?'pickupNotice') then '已通知取机（旧记录）' else '未通知取机' end;
 if all_ready and total>0 then
  signature:=chinatech_v2_private.repair_array_json(jsonb_build_array(
   (select coalesce(jsonb_agg(jsonb_build_array(r->>'id',(r->>'revision')::integer,r->>'mode',(r->>'confirmed')::boolean,r->'sourceFingerprint',r->'deviceFingerprint') order by r->>'id'),'[]') from jsonb_array_elements(requirements) r),
   (select coalesce(jsonb_agg(jsonb_build_array(r->>'id',(r->>'quantity')::integer,(r->>'ledgerRevision')::integer,r->'requirementId',r->'requirementRevision') order by r->>'id'),'[]') from jsonb_array_elements(rows) r where coalesce((r->>'required')::boolean,true))
  ));
 end if;
 select coalesce(string_agg((r->>'id')||':'||(r->>'quantity')||':'||(r->>'ledgerRevision'),'|' order by ((r->>'id')||':'||(r->>'quantity')||':'||(r->>'ledgerRevision')) collate "C"),'') into legacy_signature from jsonb_array_elements(rows) r where coalesce((r->>'required')::boolean,true);
 arrival:=case when custody='store' then '无需到货通知' when custody='unknown' then '先核对设备保管' when signature='' then case when exists(select 1 from jsonb_array_elements(requirements) r where r->>'mode'='pending' or not(r->>'confirmed')::boolean) then '需求待核对／配件未到齐' else '配件未到齐' end when wf->'notice'->>'outcome'='notified' and (wf->'notice'->>'signature'=signature or jsonb_array_length(requirements)=0 and wf->'notice'->>'signature'=legacy_signature) then '已通知送机' else '未通知送机' end;
 if workflow_group='cancelled' then progress_label:='作废';progress_tone:='warning';progress_note:=case when custody='store' then '设备待交还' else '' end;
 elsif workflow_group='complete' then progress_label:=case when stage='completed' then '维修结束' else '已取机 · 待收尾' end;progress_tone:='success';progress_note:=case when coalesce((wf->'followUp'->>'collectedUnpaid')::boolean,false) then '欠款待收尾' when not handed and custody<>'customer' then '交还待核对' else '' end;
 elsif workflow_group='ready' then progress_label:=case when pickup like '已通知%' then '已通知' else '未通知' end;progress_tone:='success';progress_note:=case when unresolved>0 or total>0 and not all_ready then '配件待核对' else '' end;
 elsif workflow_group='purchase' then progress_label:=case when any_arrival then '部分到货' else '已下单' end;progress_tone:='info';progress_note:=case when unresolved>0 then '需求待核对' when ordered<total then '其余待下单' else '' end;
 elsif stage in ('awaiting_quote','repairing','testing','outsourced') then progress_label:=labels->>stage;progress_tone:=tones->>stage;progress_note:=case when unresolved>0 and jsonb_array_length(rows)>0 then '需求待核对' else '' end;
 elsif all_ready and total>0 then progress_label:=case when custody='customer' then '待送机' else '已到货' end;progress_tone:='info';progress_note:=case when custody='unknown' then '保管待核对' else '' end;
 elsif total>0 and ordered=0 then progress_label:='待采购';progress_tone:='info';progress_note:=case when unresolved>0 then '需求待核对' else '' end;
 else progress_label:=case when stage='awaiting_parts' then '待选配件' else '待检测' end;progress_tone:=tones->>stage;progress_note:=case when ordered>0 or arrived>0 then '其余配件待核对' else '' end; end if;
 -- The original list shows three chips. Keep previews explicit, with full
 -- requirements/specifications still available in the target parts dialog.
 for item in select value from jsonb_array_elements(requirements) loop
  chip_count:=chip_count+1;
  if chip_count<=3 then chips:=chips||jsonb_build_array(jsonb_build_object('id',item->>'id','title',item->>'title','request',left(item->>'request',160),'preview',(length(item->>'request')>160),'preset',exists(select 1 from jsonb_array_elements(sources) s where s->>'id'=item->>'id' and s->>'title'=item->>'title' and s->>'request'=item->>'request' and s->>'sourceFingerprint'=item->>'sourceFingerprint'),'mode',item->>'mode'));end if;
 end loop;
 for part in select value from jsonb_array_elements(rows) loop
  if not exists(select 1 from jsonb_array_elements(requirements) r where r->>'id'=part->>'requirementId') then
   chip_count:=chip_count+1;
   if chip_count<=3 then chips:=chips||jsonb_build_array(jsonb_build_object('id','legacy:'||(part->>'id'),'title',part->>'item','request',left(coalesce(part->>'specification',''),160),'preview',length(coalesce(part->>'specification',''))>160,'preset',false,'mode','parts'));end if;
  end if;
 end loop;
 select string_agg(name,'、' order by first_ordinal) into suppliers from (select p->>'supplier' name,min(ordinal) first_ordinal from jsonb_array_elements(rows) with ordinality a(p,ordinal) group by p->>'supplier') s;
 parts_followup:=case when history or ready then null when all_ready and total>0 then 'arrival' when pending_parts then 'purchase' else null end;
 contact:=jsonb_build_object('ready',ready and not history,'partsFollowup',parts_followup,'legacy',wf->>'status' in ('awaiting_reply','collected_unpaid') and not ready,'pickupNotice',pickup,'arrivalNotice',arrival,'awaitingReply',coalesce((wf->'followUp'->>'awaitingReply')::boolean,false),'collectedUnpaid',coalesce((wf->'followUp'->>'collectedUnpaid')::boolean,false),'handedOver',wf?'handedOver','handoverUnpaid',coalesce((wf->'handedOver'->>'unpaid')::boolean,false),'quoteOutcome',wf->'quoteContact'->>'outcome','quoteTime',wf->'quoteContact'->>'time');
 return jsonb_build_object('requirements',requirements,'parts',jsonb_build_object('group',parts_group,'total',total,'ordered',ordered,'arrived',arrived,'inCart',in_cart,'unresolvedRequirements',unresolved,'allRequiredReady',all_ready),'stage',stage,'history',history,'currentHandover',handed,'workflowGroup',workflow_group,'pickupNotice',pickup,'arrivalNotice',arrival,'partsSignature',signature,'progress',jsonb_build_object('label',progress_label,'tone',progress_tone,'note',progress_note),'contact',contact,'chips',chips,'chipCount',chip_count,'suppliers',left(coalesce(suppliers,''),160),'suppliersPreview',length(coalesce(suppliers,''))>160);
end $$;
revoke all on function chinatech_v2_private.repair_list_facts(jsonb,jsonb,jsonb) from public,anon,authenticated,chinatech_runtime;

create table chinatech_v2_private.repair_list_sources (
 store_id uuid not null references chinatech_v2.stores(id) on delete cascade,
 id text not null, created_at text not null, updated_at text not null,
 priority integer not null, stage text not null, history boolean not null,
 current_handover boolean not null, collected_unpaid boolean not null,
 workflow_group text not null, parts_group text not null, notified boolean not null,
 search text not null, summary jsonb not null, primary key(store_id,id)
);
create index repair_list_order_updated on chinatech_v2_private.repair_list_sources(store_id,updated_at,created_at,id);
create index repair_list_order_created on chinatech_v2_private.repair_list_sources(store_id,created_at,id);
create index repair_list_order_priority on chinatech_v2_private.repair_list_sources(store_id,priority,updated_at,created_at,id);
create index repair_list_workflow on chinatech_v2_private.repair_list_sources(store_id,workflow_group,updated_at,created_at,id);
create index repair_list_parts on chinatech_v2_private.repair_list_sources(store_id,parts_group,updated_at,created_at,id);
create table chinatech_v2_private.repair_list_models (
 store_id uuid primary key references chinatech_v2.stores(id) on delete cascade,
 format_version integer not null default 1 check(format_version=1),
 ready boolean not null default false,generation bigint not null default 0,backfill_cursor text,verified_at timestamptz
);
alter table chinatech_v2_private.repair_list_sources enable row level security;
alter table chinatech_v2_private.repair_list_sources force row level security;
alter table chinatech_v2_private.repair_list_models enable row level security;
alter table chinatech_v2_private.repair_list_models force row level security;
revoke all on chinatech_v2_private.repair_list_sources,chinatech_v2_private.repair_list_models from public,anon,authenticated,chinatech_runtime;
grant select on chinatech_v2_private.repair_list_sources,chinatech_v2_private.repair_list_models to chinatech_runtime;
create policy repair_list_scope on chinatech_v2_private.repair_list_sources for select to chinatech_runtime using (
 store_id::text=(select current_setting('app.store_id',true)) and (select chinatech_v2_private.member_access(nullif(current_setting('app.store_id',true),'')::uuid,'repairs.view'))
);
create policy repair_list_model_scope on chinatech_v2_private.repair_list_models for select to chinatech_runtime using (
 store_id::text=(select current_setting('app.store_id',true)) and (select chinatech_v2_private.member_access(nullif(current_setting('app.store_id',true),'')::uuid,'repairs.view'))
);
create function chinatech_v2_private.project_repair_list(target_store uuid,target_id text) returns void
language plpgsql set search_path='' as $$
declare document jsonb;wf jsonb;rows jsonb;facts jsonb;summary jsonb;
begin
 select data,workflow into document,wf from chinatech_v2_private.repair_intakes where store_id=target_store and id=target_id;
 if document is null then delete from chinatech_v2_private.repair_list_sources where store_id=target_store and id=target_id;
 else
  -- Only the target's real dependency set. No whole-store canonical snapshot,
  -- costs, event bodies, photos or signatures enter the list projection.
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'item',s.item,'supplier',s.supplier,'specification',s.specification,'quantity',s.quantity,'arrived',s.arrived,'status',s.status,'ledgerRevision',s.ledger_revision,'required',p.data->'required','requirementId',p.data->'requirementId','requirementRevision',p.data->'requirementRevision') order by p.id),'[]') into rows
  from chinatech_v2_private.procurement_records p join chinatech_v2_private.procurement_list_sources s on s.store_id=p.store_id and s.id=p.id where p.store_id=target_store and p.repair_id=target_id;
  facts:=chinatech_v2_private.repair_list_facts(document,wf,rows);
  summary:=jsonb_build_object('id',target_id,'category',document->>'category','model',document->>'model','customerName',coalesce(nullif(document->>'customerName',''),'未填写姓名'),'customerNameMissing',chinatech_v2_private.directory_trim(document->>'customerName')='','phone',document->>'phone','priority',document->>'priority','rework',document?'repairOrigin','createdAt',document->>'createdAt','updatedAt',greatest(document->>'updatedAt',coalesce(wf->>'updatedAt',document->>'updatedAt')),'stage',facts->'stage','history',facts->'history','workflowGroup',facts->'workflowGroup','partsGroup',facts->'parts'->'group','progress',facts->'progress','contact',facts->'contact','chips',facts->'chips','chipCount',facts->'chipCount','suppliers',facts->'suppliers','suppliersPreview',facts->'suppliersPreview');
  insert into chinatech_v2_private.repair_list_sources(store_id,id,created_at,updated_at,priority,stage,history,current_handover,collected_unpaid,workflow_group,parts_group,notified,search,summary)
  values(target_store,target_id,document->>'createdAt',summary->>'updatedAt',case document->>'priority' when '紧急' then 0 when '优先' then 1 else 2 end,facts->>'stage',(facts->>'history')::boolean,(facts->>'currentHandover')::boolean,(facts->'contact'->>'collectedUnpaid')::boolean,facts->>'workflowGroup',facts->'parts'->>'group',(facts->>'pickupNotice') like '已通知%',lower(concat_ws(' ',target_id,summary->>'customerName',document->>'phone',document->>'brand',document->>'model',document->>'serial',document->>'issue')),summary)
  on conflict(store_id,id) do update set created_at=excluded.created_at,updated_at=excluded.updated_at,priority=excluded.priority,stage=excluded.stage,history=excluded.history,current_handover=excluded.current_handover,collected_unpaid=excluded.collected_unpaid,workflow_group=excluded.workflow_group,parts_group=excluded.parts_group,notified=excluded.notified,search=excluded.search,summary=excluded.summary;
 end if;
 insert into chinatech_v2_private.repair_list_models(store_id,generation) values(target_store,1) on conflict(store_id) do update set generation=chinatech_v2_private.repair_list_models.generation+1;
end $$;
revoke all on function chinatech_v2_private.project_repair_list(uuid,text) from public,anon,authenticated,chinatech_runtime;
create function chinatech_v2_private.repair_list_sync() returns trigger
language plpgsql security definer set search_path='' as $$
declare prior_store uuid;prior_id text;target_store uuid;target_id text;
begin
 -- to_jsonb safely reads the actual trigger row across the two source tables.
 if tg_op<>'INSERT' then prior_store:=old.store_id;prior_id:=case when tg_table_name='repair_intakes' then old.id else to_jsonb(old)->>'repair_id' end;end if;
 if tg_op<>'DELETE' then target_store:=new.store_id;target_id:=case when tg_table_name='repair_intakes' then new.id else to_jsonb(new)->>'repair_id' end;end if;
 if prior_id is not null and (tg_op='DELETE' or prior_store is distinct from target_store or prior_id is distinct from target_id) then perform chinatech_v2_private.project_repair_list(prior_store,prior_id);end if;
 if target_id is not null then perform chinatech_v2_private.project_repair_list(target_store,target_id);end if;
 return null;
end $$;
revoke all on function chinatech_v2_private.repair_list_sync() from public,anon,authenticated,chinatech_runtime;
-- PostgreSQL fires same-kind row triggers alphabetically: these run after the
-- existing procurement list sources have been updated in the same transaction.
create trigger zz_repair_list_intake_sync after insert or update or delete on chinatech_v2_private.repair_intakes for each row execute function chinatech_v2_private.repair_list_sync();
create trigger zz_repair_list_procurement_sync after insert or update or delete on chinatech_v2_private.procurement_records for each row execute function chinatech_v2_private.repair_list_sync();
create function chinatech_v2_private.repair_list_store_init() returns trigger
language plpgsql security definer set search_path='' as $$
begin insert into chinatech_v2_private.repair_list_models(store_id,ready) values(new.id,true);return null;end $$;
revoke all on function chinatech_v2_private.repair_list_store_init() from public,anon,authenticated,chinatech_runtime;
create trigger repair_list_store_init after insert on chinatech_v2.stores for each row execute function chinatech_v2_private.repair_list_store_init();
-- Existing stores stay unready. Apply the <=200 canonical/oracle backfill after
-- procurement sources are ready, then explicitly enable the module read flag.
