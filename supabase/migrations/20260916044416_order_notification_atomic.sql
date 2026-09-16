-- Manual notification recording is atomic; opening a chat is not delivery proof.
set lock_timeout = '5s';
set statement_timeout = '60s';

alter table public.repairdesk_order_mutation_operations
  drop constraint repairdesk_order_mutation_operations_mode_check;
alter table public.repairdesk_order_mutation_operations
  add constraint repairdesk_order_mutation_operations_mode_check
  check (mode in ('update', 'patch', 'finance', 'notification'));

create or replace function public.repairdesk_record_order_notification(
  p_store_id uuid, p_actor_id uuid, p_order_id uuid,
  p_expected_updated_at text, p_operation_id uuid,
  p_body text, p_channel text, p_template_kind text default null,
  p_recipient_phone text default null, p_transition_to text default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_order public.repair_orders%rowtype;
  v_next public.repair_orders%rowtype;
  v_receipt public.repairdesk_order_mutation_operations%rowtype;
  v_actor_name text;
  v_actor_email text;
  v_expected timestamptz;
  v_message text := btrim(p_body, E' \t\n\r');
  v_phone text := nullif(btrim(p_recipient_phone), '');
  v_template text := nullif(btrim(p_template_kind), '');
  v_target text := nullif(btrim(p_transition_to), '');
  v_hash text;
  v_bucket text;
  v_from_bucket text;
  v_now timestamptz;
  v_message_id uuid := gen_random_uuid();
  v_event_id uuid := gen_random_uuid();
  v_payload jsonb;
  v_result jsonb;
begin
  if p_store_id is null or p_actor_id is null or p_order_id is null or p_operation_id is null
     or nullif(p_expected_updated_at, '') is null or coalesce(v_message, '') = ''
     or length(v_message) > 10000 or p_channel is null or p_channel not in ('whatsapp','sms')
     or (v_template is not null and v_template not in ('pickup_ready','unfixed_pickup','parts_update','repair_status','cancelled','completed'))
     or (v_phone is not null and v_phone !~ '^\+[1-9][0-9]{6,14}$') then
    return jsonb_build_object('ok',false,'code','invalid_request');
  end if;
  begin v_expected := p_expected_updated_at::timestamptz;
  exception when invalid_datetime_format or datetime_field_overflow then
    return jsonb_build_object('ok',false,'code','invalid_request');
  end;
  if not isfinite(v_expected) then return jsonb_build_object('ok',false,'code','invalid_request'); end if;

  -- Same lifecycle lock namespace as lifecycle transitions and business fences.
  perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended(p_store_id::text,0));
  select coalesce(nullif(sm.display_name,''),sp.display_name),sp.email
    into v_actor_name,v_actor_email
    from public.store_memberships sm
    join public.staff_profiles sp on sp.id=sm.user_id and sp.status::text='active'
    join public.stores s on s.id=sm.store_id and s.status::text='active'
    join public.store_lifecycles sl on sl.store_id=s.id and sl.phase::text='active'
   where sm.store_id=p_store_id and sm.user_id=p_actor_id and sm.status::text='active'
     and sm.role::text in ('owner','manager','sales');
  if not found then return jsonb_build_object('ok',false,'code','actor_forbidden'); end if;

  -- Hash the actual normalized arguments in the database, never a caller-supplied digest.
  v_hash := encode(extensions.digest(pg_catalog.convert_to(jsonb_build_object(
    'store_id',p_store_id,'actor_id',p_actor_id,'order_id',p_order_id,'mode','notification',
    'expected_updated_at',p_expected_updated_at,'body',v_message,'channel',p_channel,
    'template_kind',v_template,'recipient_phone',v_phone,'transition_to',v_target
  )::text,'UTF8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_store_id::text||':order-mutation:'||p_operation_id::text,0));
  select * into v_receipt from public.repairdesk_order_mutation_operations
    where store_id=p_store_id and operation_id=p_operation_id;
  if found then
    if v_receipt.actor_id<>p_actor_id or v_receipt.order_id<>p_order_id
       or v_receipt.mode<>'notification' or v_receipt.request_hash<>v_hash then
      return jsonb_build_object('ok',false,'code','idempotency_conflict');
    end if;
    return v_receipt.response_summary || jsonb_build_object('replayed',true,'body',v_message,'recipient_phone',v_phone);
  end if;

  select * into v_order from public.repair_orders
    where store_id=p_store_id and id=p_order_id for update;
  if not found then return jsonb_build_object('ok',false,'code','order_not_found'); end if;
  if coalesce(v_order.record_state,'active')<>'active' or v_order.deleted_at is not null then
    return jsonb_build_object('ok',false,'code','order_voided');
  end if;
  if v_order.updated_at is distinct from v_expected then
    return jsonb_build_object('ok',false,'code','stale_version');
  end if;
  if v_template in ('pickup_ready','unfixed_pickup') and v_order.device_custody_status is distinct from 'with_shop' then
    return jsonb_build_object('ok',false,'code','custody_required');
  end if;
  v_next := v_order;
  if v_target is not null then
    select bucket into v_from_bucket from public.order_workflow_statuses
      where store_id=p_store_id and code=v_order.status::text;
    select bucket into v_bucket from public.order_workflow_statuses
      where store_id=p_store_id and code=v_target and enabled;
    if v_target in ('quoted','waiting_approval','completed','cancelled')
       or v_bucket in ('quote','done','cancelled','custom') or v_bucket is null
       or v_order.status::text in ('completed','cancelled','waiting_approval')
       or (v_order.status::text='quoted' and v_order.approval_status::text='pending')
       or v_order.exception_status='cancelled' or v_from_bucket in ('done','cancelled')
       or v_order.status::text=v_target
       or not exists(select 1 from public.order_workflow_transitions
          where store_id=p_store_id and from_status_code=v_order.status::text
            and to_status_code=v_target and enabled) then
      return jsonb_build_object('ok',false,'code','invalid_transition');
    end if;
    if (v_target in ('diagnosing','mail_in_progress','repairing','repaired','notified','waiting_pickup','unfixed_pickup')
        or v_bucket in ('diagnosing','repair','pickup'))
       and v_order.device_custody_status is distinct from 'with_shop' then
      return jsonb_build_object('ok',false,'code','custody_required');
    end if;
    v_next := jsonb_populate_record(v_order,jsonb_build_object(
      'status',v_target,'legacy_status',v_target,
      'workflow_status',case v_bucket when 'diagnosing' then 'diagnosis' when 'repair' then 'repair'
        when 'pickup' then 'pickup' when 'parts' then 'parts' else 'intake' end,
      'exception_status',case v_target when 'rework' then 'rework' when 'unfixed_pickup' then 'returned_unfixed' else null end,
      'parts_status',case v_target when 'parts_ordered' then 'ordered' when 'parts_arrived' then 'arrived' else 'not_required' end,
      'completed_at',null,'delivered_at',null
    ));
  end if;
  v_now := greatest(clock_timestamp(),v_order.updated_at+interval '1 microsecond');
  update public.repair_orders set notify_status='sent',updated_at=v_now,
    status=v_next.status,legacy_status=v_next.legacy_status,workflow_status=v_next.workflow_status,
    exception_status=v_next.exception_status,parts_status=v_next.parts_status,
    completed_at=v_next.completed_at,delivered_at=v_next.delivered_at
    where store_id=p_store_id and id=p_order_id;
  insert into public.message_logs(id,store_id,order_id,channel,message_body,status,sent_at)
    values(v_message_id,p_store_id,p_order_id,p_channel::public.message_channel,v_message,'sent',v_now);
  v_payload := jsonb_build_object('channel',p_channel,'message_id',v_message_id,'template_kind',v_template,
    'status_changed',v_target is not null,'from',v_order.status,'to',coalesce(v_target,v_order.status::text),
    'operation_id',p_operation_id,'confirmation_kind','manual_record','delivery_verified',false);
  insert into public.order_events(id,store_id,order_id,event_type,payload,operator_name,created_at)
    values(v_event_id,p_store_id,p_order_id,'message_sent',v_payload,v_actor_name,v_now);
  insert into public.audit_logs(id,actor_id,actor_email,actor_name,store_id,action,entity_type,entity_id,metadata,created_at)
    values(gen_random_uuid()::text,p_actor_id,v_actor_email,v_actor_name,p_store_id,'update','repair_order',p_order_id::text,
      v_payload||jsonb_build_object('action','notification_recorded','request_hash',v_hash),v_now);
  v_result := jsonb_build_object('ok',true,'id',v_message_id,'event_id',v_event_id,'updated_at',v_now,'replayed',false,
    'channel',p_channel,'body',v_message,'template_kind',v_template,'recipient_phone',v_phone,
    'statusChanged',v_target is not null,'from',v_order.status,'to',v_target,'delivery_verified',false);
  insert into public.repairdesk_order_mutation_operations(store_id,actor_id,operation_id,order_id,request_hash,mode,response_summary,created_at)
    values(p_store_id,p_actor_id,p_operation_id,p_order_id,v_hash,'notification',v_result-'body'-'recipient_phone',v_now);
  return v_result;
end;
$$;
revoke all on function public.repairdesk_record_order_notification(uuid,uuid,uuid,text,uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.repairdesk_record_order_notification(uuid,uuid,uuid,text,uuid,text,text,text,text,text) to service_role;
notify pgrst,'reload schema';
