-- Read-only list projection. Canonical procurement JSON and append-only events
-- remain authoritative; no cost, references or event bodies are copied here.
create table chinatech_v2_private.procurement_list_sources (
 store_id uuid not null references chinatech_v2.stores(id) on delete cascade,
 id text not null,
 repair_id text not null,
 repair_model text,
 item text not null,
 supplier text not null,
 quantity integer not null,
 arrived integer not null,
 status text not null check(status in ('draft','cart','ordered','partial','complete')),
 expected_at text not null,
 ledger_revision integer not null,
 has_supplier_id boolean not null default false,
 supplier_id text,
 specification text,
 repair_cancelled boolean not null default false,
 supplier_key text generated always as (case when has_supplier_id then 'ID:'||coalesce(supplier_id,'') else 'NAME:'||chinatech_v2_private.directory_trim(supplier) end) stored,
 search text generated always as (lower(id||' '||item||' '||supplier||' '||repair_id||' '||coalesce(repair_model,''))) stored,
 primary key(store_id,id)
);
create index procurement_list_sources_repair on chinatech_v2_private.procurement_list_sources(store_id,repair_id,id);
create index procurement_list_sources_status on chinatech_v2_private.procurement_list_sources(store_id,status,id);
create index procurement_list_sources_batch on chinatech_v2_private.procurement_list_sources(store_id,supplier_key,id) where status in ('ordered','partial');
create table chinatech_v2_private.procurement_list_models (
 store_id uuid primary key references chinatech_v2.stores(id) on delete cascade,
 format_version integer not null default 1 check(format_version=1),
 ready boolean not null default false,
 generation bigint not null default 0,
 backfill_cursor text,
 verified_at timestamptz
);
alter table chinatech_v2_private.procurement_list_sources enable row level security;
alter table chinatech_v2_private.procurement_list_sources force row level security;
alter table chinatech_v2_private.procurement_list_models enable row level security;
alter table chinatech_v2_private.procurement_list_models force row level security;
revoke all on chinatech_v2_private.procurement_list_sources,chinatech_v2_private.procurement_list_models from public,anon,authenticated,chinatech_runtime;
grant select on chinatech_v2_private.procurement_list_sources,chinatech_v2_private.procurement_list_models to chinatech_runtime;
create policy procurement_list_scope on chinatech_v2_private.procurement_list_sources for select to chinatech_runtime using (
 store_id::text=(select current_setting('app.store_id',true))
 and (select chinatech_v2_private.member_access(nullif(current_setting('app.store_id',true),'')::uuid,'repairs.view'))
);
create policy procurement_list_model_scope on chinatech_v2_private.procurement_list_models for select to chinatech_runtime using (
 store_id::text=(select current_setting('app.store_id',true))
 and (select chinatech_v2_private.member_access(nullif(current_setting('app.store_id',true),'')::uuid,'repairs.view'))
);

-- Shared by bounded owner backfill and the trigger. Not callable by the web
-- role, and never accepts a client-supplied summary in place of canonical JSON.
create function chinatech_v2_private.project_procurement_list(target_store uuid,target_id text,document jsonb,model text,cancelled boolean) returns void
language plpgsql set search_path='' as $$
declare events jsonb:=coalesce(document->'events','[]'::jsonb); arrived_count integer; ordered boolean; last_cart text; phase text;
begin
 if document is null then
  delete from chinatech_v2_private.procurement_list_sources where store_id=target_store and id=target_id;
  return;
 end if;
 select coalesce(sum(case when value->>'type' in ('arrival','correction') then (value->>'quantity')::integer else 0 end),0)::integer,
  coalesce(bool_or(value->>'type'='ordered'),false)
 into arrived_count,ordered from jsonb_array_elements(events);
 select value->>'type' into last_cart from jsonb_array_elements(events) with ordinality where value->>'type' in ('cart_added','cart_removed') order by ordinality desc limit 1;
 phase:=case when not ordered then case when last_cart='cart_added' then 'cart' else 'draft' end
  when arrived_count=(document->>'quantity')::integer then 'complete' when arrived_count>0 then 'partial' else 'ordered' end;
 insert into chinatech_v2_private.procurement_list_sources(store_id,id,repair_id,repair_model,item,supplier,quantity,arrived,status,expected_at,ledger_revision,has_supplier_id,supplier_id,specification,repair_cancelled)
 values(target_store,target_id,document->>'repairId',model,document->>'item',document->>'supplier',(document->>'quantity')::integer,arrived_count,phase,coalesce(document->>'expectedAt',''),jsonb_array_length(events),document?'supplierId',document->>'supplierId',document->>'specification',cancelled)
 on conflict(store_id,id) do update set repair_id=excluded.repair_id,repair_model=excluded.repair_model,item=excluded.item,supplier=excluded.supplier,
 quantity=excluded.quantity,arrived=excluded.arrived,status=excluded.status,expected_at=excluded.expected_at,ledger_revision=excluded.ledger_revision,
 has_supplier_id=excluded.has_supplier_id,supplier_id=excluded.supplier_id,specification=excluded.specification,repair_cancelled=excluded.repair_cancelled;
end $$;
revoke all on function chinatech_v2_private.project_procurement_list(uuid,text,jsonb,text,boolean) from public,anon,authenticated,chinatech_runtime;

create function chinatech_v2_private.procurement_list_sync() returns trigger
language plpgsql security definer set search_path='' as $$
declare target_store uuid; target_id text; document jsonb; model text; cancelled boolean;
begin
 if tg_op<>'INSERT' and (tg_op='DELETE' or old.store_id is distinct from new.store_id or old.id is distinct from new.id) then
  delete from chinatech_v2_private.procurement_list_sources where store_id=old.store_id and id=old.id;
  update chinatech_v2_private.procurement_list_models set generation=generation+1 where store_id=old.store_id;
 end if;
 if tg_op='DELETE' then return null; end if;
 target_store:=new.store_id;target_id:=new.id;document:=new.data;
 select data->>'model',coalesce(workflow->>'status'='cancelled',false) into model,cancelled from chinatech_v2_private.repair_intakes where store_id=target_store and id=new.repair_id;
 perform chinatech_v2_private.project_procurement_list(target_store,target_id,document,model,coalesce(cancelled,false));
 insert into chinatech_v2_private.procurement_list_models(store_id,generation) values(target_store,1)
 on conflict(store_id) do update set generation=chinatech_v2_private.procurement_list_models.generation+1;
 return null;
end $$;
revoke all on function chinatech_v2_private.procurement_list_sync() from public,anon,authenticated,chinatech_runtime;
create trigger procurement_list_sync after insert or update or delete on chinatech_v2_private.procurement_records for each row execute function chinatech_v2_private.procurement_list_sync();

-- A model rename updates the related list facts in the same transaction. No
-- unrelated repair/workflow/quote history is read or copied to the list table.
create function chinatech_v2_private.procurement_list_repair_sync() returns trigger
language plpgsql security definer set search_path='' as $$
declare changed bigint; model text; cancelled boolean;
begin
 if tg_op<>'INSERT' and (tg_op='DELETE' or old.store_id is distinct from new.store_id or old.id is distinct from new.id) then
  update chinatech_v2_private.procurement_list_sources set repair_model=null,repair_cancelled=false where store_id=old.store_id and repair_id=old.id and (repair_model is not null or repair_cancelled);
  get diagnostics changed=row_count;
  if changed>0 then update chinatech_v2_private.procurement_list_models set generation=generation+1 where store_id=old.store_id;end if;
 end if;
 if tg_op='DELETE' then return null;end if;
 model:=new.data->>'model';cancelled:=coalesce(new.workflow->>'status'='cancelled',false);
 update chinatech_v2_private.procurement_list_sources set repair_model=model,repair_cancelled=cancelled where store_id=new.store_id and repair_id=new.id and (repair_model is distinct from model or repair_cancelled is distinct from cancelled);
 get diagnostics changed=row_count;
 if changed>0 then update chinatech_v2_private.procurement_list_models set generation=generation+1 where store_id=new.store_id;end if;
 return null;
end $$;
revoke all on function chinatech_v2_private.procurement_list_repair_sync() from public,anon,authenticated,chinatech_runtime;
create trigger procurement_list_repair_sync after insert or update or delete on chinatech_v2_private.repair_intakes for each row execute function chinatech_v2_private.procurement_list_repair_sync();

create function chinatech_v2_private.procurement_list_store_init() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into chinatech_v2_private.procurement_list_models(store_id,ready) values(new.id,true);
 return null;
end $$;
revoke all on function chinatech_v2_private.procurement_list_store_init() from public,anon,authenticated,chinatech_runtime;
create trigger procurement_list_store_init after insert on chinatech_v2.stores for each row execute function chinatech_v2_private.procurement_list_store_init();
-- Existing stores remain unready until the owner performs batch<=200 backfill
-- and canonical-oracle verification. No automatic production data scan occurs.
