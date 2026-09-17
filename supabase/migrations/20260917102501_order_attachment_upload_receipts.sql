-- Storage and Postgres are separate systems. The server uploads immutable,
-- content-addressed bytes first. This transaction commits metadata/event/audit/
-- receipt together; uncertain/unassociated private objects are retained for review.
set lock_timeout = '5s';
set statement_timeout = '60s';
create table public.repairdesk_order_attachment_operations (
  store_id uuid not null references public.stores(id) on delete cascade,
  operation_id uuid not null,
  actor_id uuid not null,
  order_id uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  response_summary jsonb not null,
  created_at timestamptz not null default now(),
  primary key(store_id,operation_id),
  foreign key(order_id,store_id) references public.repair_orders(id,store_id) on delete cascade
);
alter table public.repairdesk_order_attachment_operations enable row level security;
revoke all on table public.repairdesk_order_attachment_operations from public,anon,authenticated;
grant select,insert,update,delete on table public.repairdesk_order_attachment_operations to service_role;

create or replace function public.repairdesk_finalize_order_attachment_v1(
  p_store_id uuid, p_actor_id uuid, p_order_id uuid, p_operation_id uuid,
  p_request_hash text, p_attachment jsonb, p_check_only boolean default false
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_receipt public.repairdesk_order_attachment_operations%rowtype;
  v_order public.repair_orders%rowtype;
  v_attachment public.order_attachments%rowtype;
  v_role text;
  v_member uuid;
  v_name text;
  v_email text;
  v_now timestamptz;
  v_summary jsonb;
  v_result jsonb;
begin
  if p_store_id is null or p_actor_id is null or p_order_id is null or p_operation_id is null
     or p_check_only is null or coalesce(p_request_hash,'') !~ '^[0-9a-f]{64}$'
     or jsonb_typeof(p_attachment) is distinct from 'object' then
    return jsonb_build_object('ok',false,'code','invalid_request');
  end if;
  select sm.id,sm.role::text,coalesce(nullif(sm.display_name,''),sp.display_name),sp.email
    into v_member,v_role,v_name,v_email
    from public.store_memberships sm
    join public.staff_profiles sp on sp.id=sm.user_id and sp.status='active'
    join public.stores s on s.id=sm.store_id and s.status='active'
    join public.store_lifecycles sl on sl.store_id=s.id and sl.phase='active'
    where sm.store_id=p_store_id and sm.user_id=p_actor_id and sm.status='active';
  if v_role is null or v_role not in ('owner','manager','sales','technician') then
    return jsonb_build_object('ok',false,'code','actor_forbidden');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_store_id::text||':order-attachment:'||p_operation_id::text,0));
  select * into v_order from public.repair_orders where store_id=p_store_id and id=p_order_id for update;
  if not found then return jsonb_build_object('ok',false,'code','order_not_found'); end if;
  if v_role='technician' and v_order.assignee_membership_id is distinct from v_member then
    return jsonb_build_object('ok',false,'code','actor_forbidden');
  end if;
  -- Recheck present authorization before replay, but no mutable order-state
  -- predicate may turn an already committed operation into a second upload.
  select * into v_receipt from public.repairdesk_order_attachment_operations
    where store_id=p_store_id and operation_id=p_operation_id;
  if found then
    if v_receipt.actor_id<>p_actor_id or v_receipt.order_id<>p_order_id or v_receipt.request_hash<>p_request_hash then
      return jsonb_build_object('ok',false,'code','idempotency_conflict');
    end if;
    return v_receipt.response_summary || jsonb_build_object('replayed',true);
  end if;
  if coalesce(v_order.record_state,'active')<>'active' or v_order.deleted_at is not null then
    return jsonb_build_object('ok',false,'code','order_voided');
  end if;
  if exists (select 1 from jsonb_object_keys(p_attachment) k where k not in (
      'kind','file_name','mime_type','file_size','storage_bucket','storage_path','note','content_sha256'
    )) or coalesce(p_attachment->>'kind','') not in ('device_front','device_back','screen_on','fault_photo','signature','other')
    or nullif(btrim(p_attachment->>'file_name'),'') is null or length(p_attachment->>'file_name')>180
    or coalesce(p_attachment->>'mime_type','') not in ('image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf')
    or jsonb_typeof(p_attachment->'file_size') is distinct from 'number'
    or coalesce(p_attachment->>'content_sha256','') !~ '^[0-9a-f]{64}$'
    or p_attachment->>'storage_bucket' is distinct from 'repairdesk-order-attachments'
    or length(coalesce(p_attachment->>'note',''))>200 then
    return jsonb_build_object('ok',false,'code','invalid_attachment');
  end if;
  if (p_attachment->>'file_size')::numeric<1 or (p_attachment->>'file_size')::numeric>8388608
     or (p_attachment->>'file_size')::numeric<>trunc((p_attachment->>'file_size')::numeric)
     or coalesce(p_attachment->>'storage_path','') !~ (
       '^'||p_store_id::text||'/'||p_order_id::text||'/'||p_operation_id::text||'-'||(p_attachment->>'content_sha256')||'\.[a-z0-9]{2,8}$'
     ) then return jsonb_build_object('ok',false,'code','invalid_attachment'); end if;
  if p_check_only then return jsonb_build_object('ok',true,'code','pending'); end if;
  v_now:=clock_timestamp();
  insert into public.order_attachments(id,store_id,order_id,kind,file_name,mime_type,file_size,
    storage_bucket,storage_path,note,uploaded_by,created_at,updated_at)
  values(p_operation_id::text,p_store_id,p_order_id,p_attachment->>'kind',p_attachment->>'file_name',
    p_attachment->>'mime_type',(p_attachment->>'file_size')::integer,p_attachment->>'storage_bucket',
    p_attachment->>'storage_path',nullif(p_attachment->>'note',''),v_name,v_now,v_now)
    returning * into v_attachment;
  v_summary:=jsonb_build_object('action','attachment_uploaded','attachment_id',p_operation_id,
    'operation_id',p_operation_id,'request_hash',p_request_hash,'content_sha256',p_attachment->>'content_sha256',
    'kind',v_attachment.kind,'file_name',v_attachment.file_name,'mime_type',v_attachment.mime_type,'file_size',v_attachment.file_size);
  insert into public.order_events(id,store_id,order_id,event_type,payload,operator_name,created_at)
    values(gen_random_uuid(),p_store_id,p_order_id,'note',v_summary,v_name,v_now);
  insert into public.audit_logs(id,actor_id,actor_email,actor_name,store_id,action,entity_type,entity_id,metadata,created_at)
    values(gen_random_uuid()::text,p_actor_id,v_email,v_name,p_store_id,'upload','order_attachment',p_operation_id::text,v_summary-'file_name',v_now);
  v_result:=jsonb_build_object('ok',true,'code','created','attachment',to_jsonb(v_attachment),'replayed',false);
  insert into public.repairdesk_order_attachment_operations(store_id,operation_id,actor_id,order_id,request_hash,response_summary,created_at)
    values(p_store_id,p_operation_id,p_actor_id,p_order_id,p_request_hash,v_result,v_now);
  return v_result;
end;
$$;
revoke all on function public.repairdesk_finalize_order_attachment_v1(uuid,uuid,uuid,uuid,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.repairdesk_finalize_order_attachment_v1(uuid,uuid,uuid,uuid,text,jsonb,boolean) to service_role;
notify pgrst,'reload schema';
