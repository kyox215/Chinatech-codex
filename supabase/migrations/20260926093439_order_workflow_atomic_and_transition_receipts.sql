-- Additive RPCs. Apply before the application release. No data backfill or table rewrite.
-- Keep these RPCs when rolling application code back; dropping them requires all new callers stopped.
set lock_timeout = '5s';
set statement_timeout = '5min';

-- Read a committed transition receipt only after checking CURRENT tenant/actor/order access.
-- Uses the same operation lock as repairdesk_apply_order_atomic_mutation, so an in-flight
-- commit cannot be mistaken for a missing receipt. A request hash binds actor/version/intent.
create function public.repairdesk_order_transition_receipt(
  p_store_id uuid, p_actor_id uuid, p_order_id uuid, p_idempotency_key uuid, p_request_hash text
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_role text;
  v_membership_id uuid;
  v_order public.repair_orders%rowtype;
  v_event public.order_events%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended(p_store_id::text, 0));
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_store_id::text || ':' || p_idempotency_key::text, 0)
  );
  select membership.role::text, membership.id into v_role, v_membership_id
  from public.store_memberships membership
  join public.staff_profiles profile on profile.id = membership.user_id and profile.status::text = 'active'
  join public.stores store_row on store_row.id = membership.store_id and store_row.status::text = 'active'
  where membership.store_id = p_store_id and membership.user_id = p_actor_id
    and membership.status::text = 'active' limit 1 for share of membership, profile, store_row;
  if v_role is null or v_role not in ('owner','manager','sales','technician') then
    return jsonb_build_object('ok',false,'code','actor_forbidden');
  end if;
  if p_idempotency_key is null or p_request_hash is null or p_request_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('ok',false,'code','invalid_request');
  end if;
  select * into v_order from public.repair_orders where store_id=p_store_id and id=p_order_id for update;
  if not found then return jsonb_build_object('ok',false,'code','order_not_found'); end if;
  if v_role='technician' and v_order.assignee_membership_id is distinct from v_membership_id then
    return jsonb_build_object('ok',false,'code','actor_forbidden');
  end if;
  select * into v_event from public.order_events
  where store_id=p_store_id and payload->>'idempotency_key'=p_idempotency_key::text
  order by created_at desc limit 1;
  if not found then return jsonb_build_object('ok',true,'found',false); end if;
  if v_event.order_id is distinct from p_order_id or v_event.event_type::text <> 'status_changed'
    or v_event.payload->>'transition_request_hash' is distinct from p_request_hash then
    return jsonb_build_object('ok',false,'code','idempotency_conflict');
  end if;
  return jsonb_build_object('ok',true,'found',true,'updated_at',v_event.created_at,'receipt',jsonb_build_object(
    'ok',true,'from',v_event.payload->>'from','to',v_event.payload->>'to'));
end;
$$;

-- One transaction serializes configuration edits within a store, including the
-- default switch and transition replacement. Do not catch write exceptions: a late
-- constraint/trigger/storage failure must roll back every earlier write unchanged.
create function public.repairdesk_save_order_workflow(
  p_store_id uuid, p_actor_id uuid, p_mode text, p_input jsonb
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_role text;
  v_status public.order_workflow_statuses%rowtype;
  v_current public.order_workflow_statuses%rowtype;
  v_now timestamptz := clock_timestamp();
  v_from text;
  v_primary text;
  v_target record;
  v_allowed text[] := array['label','short_label','tone','bucket','sort_order','enabled',
    'show_in_order_filters','allowed_for_create','is_default_create_status'];
begin
  perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended(p_store_id::text, 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_store_id::text || ':order-workflow',0));
  select membership.role::text into v_role
  from public.store_memberships membership
  join public.staff_profiles profile on profile.id=membership.user_id and profile.status::text='active'
  join public.stores store_row on store_row.id=membership.store_id and store_row.status::text='active'
  where membership.store_id=p_store_id and membership.user_id=p_actor_id
    and membership.status::text='active' limit 1 for share of membership, profile, store_row;
  if v_role is null or v_role not in ('owner','manager') then
    raise exception 'actor_forbidden' using errcode='42501';
  end if;
  if p_input is null or jsonb_typeof(p_input)<>'object' then
    raise exception 'invalid_workflow_input' using errcode='22023';
  end if;

  if p_mode in ('create_status','update_status') then
    if exists (select 1 from jsonb_object_keys(p_input) k where not(k=any(v_allowed ||
      case when p_mode='create_status' then array['code'] else array['id'] end))) then
      raise exception 'invalid_workflow_field' using errcode='22023';
    end if;
    if p_mode='create_status' then
      v_status := jsonb_populate_record(null::public.order_workflow_statuses,
        jsonb_build_object('id',gen_random_uuid(),'store_id',p_store_id,'short_label','',
          'tone','neutral','bucket','custom','sort_order',(select coalesce(max(sort_order),0)+10 from public.order_workflow_statuses where store_id=p_store_id),
          'enabled',true,'show_in_order_filters',true,'allowed_for_create',false,'is_default_create_status',false,
          'is_system',false,'created_by',p_actor_id,'created_at',v_now) || p_input ||
        jsonb_build_object('updated_by',p_actor_id,'updated_at',v_now));
    else
      select * into v_current from public.order_workflow_statuses
      where store_id=p_store_id and id=(p_input->>'id')::uuid for update;
      if not found then raise exception 'workflow_status_not_found' using errcode='P0002'; end if;
      if v_current.is_default_create_status and p_input->>'enabled'='false' then
        raise exception '默认新建状态不能停用' using errcode='22023';
      end if;
      if v_current.is_default_create_status and p_input->>'is_default_create_status'='false' then
        raise exception '请先把另一个状态设为默认新建状态' using errcode='22023';
      end if;
      v_status := jsonb_populate_record(v_current,p_input-'id' || jsonb_build_object('updated_by',p_actor_id,'updated_at',v_now));
    end if;
    v_status.label := btrim(v_status.label);
    v_status.short_label := btrim(v_status.short_label);
    if v_status.label is null or v_status.label='' then raise exception '状态名称不能为空' using errcode='22023'; end if;
    if v_status.is_default_create_status then
      v_status.enabled := true;
      v_status.allowed_for_create := true;
      update public.order_workflow_statuses set is_default_create_status=false, updated_at=v_now, updated_by=p_actor_id
      where store_id=p_store_id and id<>v_status.id and is_default_create_status;
    end if;
    if p_mode='create_status' then
      insert into public.order_workflow_statuses select v_status.*;
    else
      update public.order_workflow_statuses set
        label=v_status.label,short_label=v_status.short_label,tone=v_status.tone,bucket=v_status.bucket,
        sort_order=v_status.sort_order,enabled=v_status.enabled,show_in_order_filters=v_status.show_in_order_filters,
        allowed_for_create=v_status.allowed_for_create,is_default_create_status=v_status.is_default_create_status,
        updated_at=v_now,updated_by=p_actor_id
      where store_id=p_store_id and id=v_status.id;
    end if;
    return to_jsonb(v_status);
  elsif p_mode='transitions' then
    if exists(select 1 from jsonb_object_keys(p_input) k where k not in ('from_status_code','transitions'))
      or jsonb_typeof(p_input->'transitions') is distinct from 'array' then
      raise exception 'invalid_workflow_transitions' using errcode='22023';
    end if;
    v_from := p_input->>'from_status_code';
    if not exists(select 1 from public.order_workflow_statuses where store_id=p_store_id and code=v_from) then
      raise exception '来源状态不存在' using errcode='22023';
    end if;
    if exists(select 1 from jsonb_array_elements(p_input->'transitions') item
      where jsonb_typeof(item)<>'object' or jsonb_typeof(item->'enabled') is distinct from 'boolean'
        or item->>'to_status_code'=v_from
        or not exists(select 1 from public.order_workflow_statuses where store_id=p_store_id and code=item->>'to_status_code'))
      or (select count(*) from jsonb_array_elements(p_input->'transitions')) <>
         (select count(distinct item->>'to_status_code') from jsonb_array_elements(p_input->'transitions') item) then
      raise exception 'invalid_workflow_target' using errcode='22023';
    end if;
    -- Preserve previous normalization: first configured primary, otherwise first enabled target in status order.
    select status_row.code into v_primary
    from public.order_workflow_statuses status_row
    join jsonb_array_elements(p_input->'transitions') item on item->>'to_status_code'=status_row.code
    where status_row.store_id=p_store_id and (item->>'enabled')::boolean
    order by coalesce((item->>'is_primary')::boolean,false) desc,status_row.sort_order,status_row.label,status_row.id limit 1;
    update public.order_workflow_transitions set enabled=false,is_primary=false,updated_at=v_now,updated_by=p_actor_id
    where store_id=p_store_id and from_status_code=v_from;
    for v_target in
      select status_row.code,coalesce((item->>'enabled')::boolean,false) enabled,
        coalesce((item->>'sort_order')::integer,(row_number() over(order by status_row.sort_order,status_row.label,status_row.id)*10)::integer) sort_order
      from public.order_workflow_statuses status_row
      left join jsonb_array_elements(p_input->'transitions') item on item->>'to_status_code'=status_row.code
      where status_row.store_id=p_store_id and status_row.code<>v_from
    loop
      insert into public.order_workflow_transitions(store_id,from_status_code,to_status_code,enabled,is_primary,sort_order,created_by,updated_by,created_at,updated_at)
      values(p_store_id,v_from,v_target.code,v_target.enabled,v_target.enabled and v_target.code is not distinct from v_primary,
        v_target.sort_order,p_actor_id,p_actor_id,v_now,v_now)
      on conflict(store_id,from_status_code,to_status_code) do update set
        enabled=excluded.enabled,is_primary=excluded.is_primary,sort_order=excluded.sort_order,updated_by=p_actor_id,updated_at=v_now;
    end loop;
    return jsonb_build_object('ok',true);
  end if;
  raise exception 'invalid_workflow_mode' using errcode='22023';
end;
$$;
revoke all on function public.repairdesk_order_transition_receipt(uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.repairdesk_save_order_workflow(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.repairdesk_order_transition_receipt(uuid,uuid,uuid,uuid,text) to service_role;
grant execute on function public.repairdesk_save_order_workflow(uuid,uuid,text,jsonb) to service_role;

-- Hold the current authorization and order locks through the actual transition write.
-- The read-only preflight RPC is still needed to replay before mutable application validation.
create function public.repairdesk_apply_order_transition(
  p_store_id uuid, p_order_id uuid, p_actor_id uuid, p_expected_updated_at timestamptz,
  p_update jsonb, p_event_type text, p_event_payload jsonb, p_idempotency_key uuid
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_receipt jsonb;
begin
  if p_event_type is distinct from 'status_changed' then
    return jsonb_build_object('ok',false,'code','invalid_request');
  end if;
  v_receipt := public.repairdesk_order_transition_receipt(
    p_store_id,p_actor_id,p_order_id,p_idempotency_key,p_event_payload->>'transition_request_hash');
  if v_receipt->>'ok' is distinct from 'true' then return v_receipt; end if;
  if v_receipt->>'found' = 'true' then
    return jsonb_build_object('ok',true,'code','idempotent_replay','updated_at',v_receipt->>'updated_at');
  end if;
  return public.repairdesk_apply_order_atomic_mutation(
    p_store_id,p_order_id,p_actor_id,p_expected_updated_at,p_update,p_event_type,p_event_payload,p_idempotency_key);
end;
$$;
revoke all on function public.repairdesk_apply_order_transition(uuid,uuid,uuid,timestamptz,jsonb,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.repairdesk_apply_order_transition(uuid,uuid,uuid,timestamptz,jsonb,text,jsonb,uuid) to service_role;
