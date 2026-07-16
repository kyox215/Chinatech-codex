alter table public.repair_orders
  add column if not exists device_custody_status text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'repair_orders_device_custody_status_check'
      and conrelid = 'public.repair_orders'::regclass
  ) then
    alter table public.repair_orders
      add constraint repair_orders_device_custody_status_check
      check (
        device_custody_status is null
        or device_custody_status in ('with_shop', 'with_customer')
      ) not valid;
  end if;
end
$$;

alter table public.repair_orders
  validate constraint repair_orders_device_custody_status_check;

alter table public.repair_orders
  alter column device_custody_status set default 'with_shop';

comment on column public.repair_orders.device_custody_status is
  'Physical device custody: with_shop, with_customer, or null for legacy rows awaiting confirmation.';

create or replace function public.repairdesk_apply_order_atomic_mutation(
  p_store_id uuid,
  p_order_id text,
  p_actor_id uuid,
  p_expected_updated_at timestamptz,
  p_update jsonb,
  p_event_type text,
  p_event_payload jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor_name text;
  v_actor_role text;
  v_membership_id uuid;
  v_order public.repair_orders%rowtype;
  v_existing_event public.order_events%rowtype;
  v_now timestamptz := clock_timestamp();
  v_fingerprint text;
  v_event_payload jsonb := coalesce(p_event_payload, '{}'::jsonb);
  v_unlock_pattern integer[];
  v_allowed_keys constant text[] := array[
    'status',
    'workflow_status',
    'exception_status',
    'approval_status',
    'approval_flow_status',
    'approval_confirmed_at',
    'parts_status',
    'notify_status',
    'approval_sent_at',
    'completed_at',
    'delivered_at',
    'cancel_reason',
    'diagnosis_result',
    'device_custody_status',
    'device_unlock_method',
    'device_unlock_value',
    'device_unlock_pattern'
  ];
begin
  if p_store_id is null or p_order_id is null or btrim(p_order_id) = '' then
    return jsonb_build_object('ok', false, 'code', 'invalid_target');
  end if;
  if p_actor_id is null then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;
  if p_expected_updated_at is null then
    return jsonb_build_object('ok', false, 'code', 'missing_expected_version');
  end if;
  if p_idempotency_key is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_idempotency_key');
  end if;
  if p_update is null or jsonb_typeof(p_update) <> 'object' or p_update = '{}'::jsonb then
    return jsonb_build_object('ok', false, 'code', 'invalid_update');
  end if;
  if exists (
    select 1
    from jsonb_object_keys(p_update) as key_name
    where not (key_name = any(v_allowed_keys))
  ) then
    return jsonb_build_object('ok', false, 'code', 'invalid_update');
  end if;
  if p_event_type not in ('status_changed', 'approval_result', 'note') then
    return jsonb_build_object('ok', false, 'code', 'invalid_event');
  end if;
  if p_event_payload is not null and jsonb_typeof(p_event_payload) <> 'object' then
    return jsonb_build_object('ok', false, 'code', 'invalid_event');
  end if;
  if exists (
    select 1
    from jsonb_object_keys(coalesce(p_event_payload, '{}'::jsonb)) as key_name
    where key_name in (
      'device_unlock_value',
      'device_unlock_pattern',
      'customer_signature',
      'password',
      'secret'
    )
  ) then
    return jsonb_build_object('ok', false, 'code', 'sensitive_event_payload');
  end if;

  select
      coalesce(nullif(btrim(membership.display_name), ''), profile.display_name, profile.email),
      membership.role::text,
      membership.id
    into v_actor_name, v_actor_role, v_membership_id
    from public.staff_profiles as profile
    join public.store_memberships as membership
      on membership.user_id = profile.id
     and membership.store_id = p_store_id
     and membership.status::text = 'active'
    join public.stores as store_row
      on store_row.id = membership.store_id
     and store_row.status::text = 'active'
   where profile.id = p_actor_id
     and profile.status::text = 'active'
   limit 1;

  if v_actor_name is null or v_actor_role not in ('owner', 'manager', 'sales', 'technician') then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_store_id::text || ':' || p_idempotency_key::text, 0)
  );

  v_fingerprint := md5(
    p_order_id
    || ':' || (
      p_update
      - 'completed_at'
      - 'delivered_at'
      - 'approval_confirmed_at'
      - 'approval_sent_at'
    )::text
    || ':' || p_event_type
    || ':' || coalesce(p_event_payload, '{}'::jsonb)::text
  );

  select event_row.*
    into v_existing_event
    from public.order_events as event_row
   where event_row.store_id = p_store_id
     and event_row.payload ->> 'idempotency_key' = p_idempotency_key::text
   order by event_row.created_at desc
   limit 1;

  if found then
    if v_existing_event.order_id <> p_order_id
       or v_existing_event.event_type::text <> p_event_type
       or v_existing_event.payload ->> 'mutation_fingerprint' <> v_fingerprint then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return jsonb_build_object(
      'ok', true,
      'code', 'idempotent_replay',
      'updated_at', v_existing_event.created_at
    );
  end if;

  select order_row.*
    into v_order
    from public.repair_orders as order_row
   where order_row.store_id = p_store_id
     and order_row.id = p_order_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'order_not_found');
  end if;
  if v_actor_role = 'technician'
     and v_order.assignee_membership_id is distinct from v_membership_id then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;
  if v_order.updated_at <> p_expected_updated_at then
    return jsonb_build_object('ok', false, 'code', 'stale_version');
  end if;

  if v_event_payload ->> 'action' = 'device_custody_changed' then
    if p_update ->> 'device_custody_status' not in ('with_shop', 'with_customer') then
      return jsonb_build_object('ok', false, 'code', 'invalid_custody_status');
    end if;
    if v_order.device_custody_status is null
       and nullif(btrim(v_event_payload ->> 'reason'), '') is null then
      return jsonb_build_object('ok', false, 'code', 'reason_required');
    end if;
    if v_order.status in ('completed', 'cancelled')
       and (
         v_actor_role not in ('owner', 'manager')
         or nullif(btrim(v_event_payload ->> 'reason'), '') is null
       ) then
      return jsonb_build_object('ok', false, 'code', 'terminal_correction_forbidden');
    end if;
    if v_order.status = 'cancelled'
       and v_order.device_custody_status = 'with_shop'
       and p_update ->> 'device_custody_status' = 'with_customer' then
      return jsonb_build_object('ok', false, 'code', 'use_cancelled_return');
    end if;
    if v_order.status = 'completed'
       and p_update ->> 'device_custody_status' = 'with_shop' then
      return jsonb_build_object('ok', false, 'code', 'completed_reopen_required');
    end if;
    if v_order.device_custody_status = p_update ->> 'device_custody_status' then
      return jsonb_build_object('ok', true, 'code', 'no_change', 'updated_at', v_order.updated_at);
    end if;
    if p_update ->> 'device_custody_status' = 'with_customer' then
      if not (
        p_update ? 'device_unlock_method'
        and p_update -> 'device_unlock_method' = 'null'::jsonb
        and p_update ? 'device_unlock_value'
        and p_update -> 'device_unlock_value' = 'null'::jsonb
        and p_update ? 'device_unlock_pattern'
        and p_update -> 'device_unlock_pattern' = 'null'::jsonb
      ) then
        return jsonb_build_object('ok', false, 'code', 'custody_credentials_must_clear');
      end if;
      if v_order.device_custody_status = 'with_shop'
         and (not (p_update ? 'delivered_at') or p_update ->> 'delivered_at' is null) then
        return jsonb_build_object('ok', false, 'code', 'custody_handover_time_required');
      end if;
    elsif not (p_update ? 'delivered_at')
       or p_update -> 'delivered_at' <> 'null'::jsonb then
      return jsonb_build_object('ok', false, 'code', 'custody_receive_resets_delivery');
    end if;
    v_event_payload := v_event_payload || jsonb_build_object(
      'from', v_order.device_custody_status,
      'to', p_update ->> 'device_custody_status'
    );
  end if;

  if v_event_payload ->> 'action' = 'custody_return_confirmed' then
    if v_order.status <> 'cancelled' then
      return jsonb_build_object('ok', false, 'code', 'invalid_return_state');
    end if;
    if v_order.device_custody_status is null then
      return jsonb_build_object('ok', false, 'code', 'custody_unknown');
    end if;
    if v_order.device_custody_status = 'with_customer' then
      return jsonb_build_object('ok', false, 'code', 'return_not_required');
    end if;
    if p_update ->> 'device_custody_status' <> 'with_customer'
       or not (p_update ? 'delivered_at')
       or p_update ->> 'delivered_at' is null
       or not (
         p_update ? 'device_unlock_method'
         and p_update -> 'device_unlock_method' = 'null'::jsonb
         and p_update ? 'device_unlock_value'
         and p_update -> 'device_unlock_value' = 'null'::jsonb
         and p_update ? 'device_unlock_pattern'
         and p_update -> 'device_unlock_pattern' = 'null'::jsonb
       ) then
      return jsonb_build_object('ok', false, 'code', 'invalid_return_update');
    end if;
  end if;

  if p_update ? 'device_custody_status'
     and coalesce(v_event_payload ->> 'action', '') not in (
       'device_custody_changed',
       'custody_return_confirmed'
     )
     and not (
       p_event_type = 'status_changed'
       and p_update ->> 'status' = 'completed'
       and p_update ->> 'device_custody_status' = 'with_customer'
     ) then
    return jsonb_build_object('ok', false, 'code', 'invalid_custody_action');
  end if;

  if p_update ->> 'status' in (
    'diagnosing',
    'mail_in_progress',
    'repairing',
    'repaired',
    'notified',
    'waiting_pickup',
    'unfixed_pickup'
  ) and v_order.device_custody_status is distinct from 'with_shop' then
    return jsonb_build_object('ok', false, 'code', 'custody_required');
  end if;

  if p_update ->> 'status' = 'completed' then
    if v_order.device_custody_status is null then
      return jsonb_build_object('ok', false, 'code', 'custody_unknown');
    end if;
    if p_update ->> 'device_custody_status' <> 'with_customer'
       or not (
         p_update ? 'device_unlock_method'
         and p_update -> 'device_unlock_method' = 'null'::jsonb
         and p_update ? 'device_unlock_value'
         and p_update -> 'device_unlock_value' = 'null'::jsonb
         and p_update ? 'device_unlock_pattern'
         and p_update -> 'device_unlock_pattern' = 'null'::jsonb
       ) then
      return jsonb_build_object('ok', false, 'code', 'invalid_completion_update');
    end if;
    if v_order.device_custody_status = 'with_shop'
       and (not (p_update ? 'delivered_at') or p_update ->> 'delivered_at' is null) then
      return jsonb_build_object('ok', false, 'code', 'completion_handover_time_required');
    end if;
    if v_order.device_custody_status = 'with_customer'
       and p_update ? 'delivered_at'
       and p_update ->> 'delivered_at' is distinct from v_order.delivered_at::text then
      return jsonb_build_object('ok', false, 'code', 'completion_preserves_delivery');
    end if;
  end if;

  if p_update ? 'device_unlock_pattern' then
    if jsonb_typeof(p_update -> 'device_unlock_pattern') = 'null' then
      v_unlock_pattern := null;
    elsif jsonb_typeof(p_update -> 'device_unlock_pattern') = 'array' then
      select array_agg(value::integer order by ordinal)
        into v_unlock_pattern
        from jsonb_array_elements_text(p_update -> 'device_unlock_pattern')
          with ordinality as points(value, ordinal);
    else
      return jsonb_build_object('ok', false, 'code', 'invalid_update');
    end if;
  else
    v_unlock_pattern := v_order.device_unlock_pattern;
  end if;

  update public.repair_orders
     set status = (
           case when p_update ? 'status' then p_update ->> 'status' else v_order.status::text end
         )::public.repair_order_status,
         workflow_status = case when p_update ? 'workflow_status' then p_update ->> 'workflow_status' else v_order.workflow_status end,
         exception_status = case when p_update ? 'exception_status' then p_update ->> 'exception_status' else v_order.exception_status end,
         approval_status = case when p_update ? 'approval_status' then p_update ->> 'approval_status' else v_order.approval_status::text end::public.approval_status,
         approval_flow_status = case when p_update ? 'approval_flow_status' then p_update ->> 'approval_flow_status' else v_order.approval_flow_status end,
         approval_confirmed_at = case when p_update ? 'approval_confirmed_at' then (p_update ->> 'approval_confirmed_at')::timestamptz else v_order.approval_confirmed_at end,
         parts_status = case when p_update ? 'parts_status' then p_update ->> 'parts_status' else v_order.parts_status end,
         notify_status = case when p_update ? 'notify_status' then p_update ->> 'notify_status' else v_order.notify_status end,
         approval_sent_at = case when p_update ? 'approval_sent_at' then (p_update ->> 'approval_sent_at')::timestamptz else v_order.approval_sent_at end,
         completed_at = case when p_update ? 'completed_at' then (p_update ->> 'completed_at')::timestamptz else v_order.completed_at end,
         delivered_at = case when p_update ? 'delivered_at' then (p_update ->> 'delivered_at')::timestamptz else v_order.delivered_at end,
         cancel_reason = case when p_update ? 'cancel_reason' then p_update ->> 'cancel_reason' else v_order.cancel_reason end,
         diagnosis_result = case when p_update ? 'diagnosis_result' then p_update ->> 'diagnosis_result' else v_order.diagnosis_result end,
         device_custody_status = case when p_update ? 'device_custody_status' then p_update ->> 'device_custody_status' else v_order.device_custody_status end,
         device_unlock_method = case when p_update ? 'device_unlock_method' then p_update ->> 'device_unlock_method' else v_order.device_unlock_method end,
         device_unlock_value = case when p_update ? 'device_unlock_value' then p_update ->> 'device_unlock_value' else v_order.device_unlock_value end,
         device_unlock_pattern = v_unlock_pattern,
         updated_at = v_now
   where store_id = p_store_id
     and id = p_order_id;

  insert into public.order_events (
    id,
    store_id,
    order_id,
    event_type,
    payload,
    operator_name,
    created_at
  ) values (
    gen_random_uuid()::text,
    p_store_id,
    p_order_id,
    p_event_type::public.order_event_type,
    v_event_payload || jsonb_build_object(
      'idempotency_key', p_idempotency_key,
      'mutation_fingerprint', v_fingerprint
    ),
    v_actor_name,
    v_now
  );

  return jsonb_build_object('ok', true, 'code', 'updated', 'updated_at', v_now);
end;
$$;

revoke all on function public.repairdesk_apply_order_atomic_mutation(
  uuid,
  text,
  uuid,
  timestamptz,
  jsonb,
  text,
  jsonb,
  uuid
) from public, anon, authenticated;

grant execute on function public.repairdesk_apply_order_atomic_mutation(
  uuid,
  text,
  uuid,
  timestamptz,
  jsonb,
  text,
  jsonb,
  uuid
) to service_role;

comment on function public.repairdesk_apply_order_atomic_mutation(
  uuid,
  text,
  uuid,
  timestamptz,
  jsonb,
  text,
  jsonb,
  uuid
) is 'Atomically version-locks a store-scoped order mutation and its custody-safe timeline event. Service role only.';

-- Keep the offline-create contract explicit. The legacy implementation is retained behind a
-- service-role-inaccessible name so the wrapper can reuse its existing idempotency transaction.
alter function public.repairdesk_offline_sync_order_create_rpc(uuid, uuid, text, text, jsonb)
  rename to repairdesk_offline_sync_order_create_rpc_v1;

revoke all on function public.repairdesk_offline_sync_order_create_rpc_v1(
  uuid,
  uuid,
  text,
  text,
  jsonb
) from public, anon, authenticated, service_role;

create function public.repairdesk_offline_sync_order_create_rpc(
  p_store_id uuid,
  p_actor_id uuid,
  p_operation_id text,
  p_request_hash text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_custody text := p_payload #>> '{payload,order,device_custody_status}';
  v_deposit numeric(12, 2) := coalesce(
    nullif(p_payload #>> '{payload,order,deposit_amount}', '')::numeric,
    0
  );
  v_quotation numeric(12, 2) := 0;
  v_result jsonb;
  v_response jsonb;
  v_order_id text;
  v_now timestamptz;
begin
  if v_custody not in ('with_shop', 'with_customer') then
    return jsonb_build_object('resultCode', 'blocked_operation');
  end if;

  select coalesce(sum((item ->> 'price')::numeric), 0)
    into v_quotation
    from jsonb_array_elements(
      coalesce(p_payload #> '{payload,order,fault_prices}', '[]'::jsonb)
    ) as item;

  if v_deposit < 0 or v_deposit > v_quotation then
    return jsonb_build_object('resultCode', 'blocked_operation');
  end if;

  v_result := public.repairdesk_offline_sync_order_create_rpc_v1(
    p_store_id,
    p_actor_id,
    p_operation_id,
    p_request_hash,
    p_payload
  );

  if v_result ->> 'resultCode' <> 'synced' then
    return v_result;
  end if;

  -- The legacy core returns the stored response on an idempotent replay. The wrapper adds this
  -- marker after its first successful custody write so replay cannot advance updated_at again.
  if v_result #>> '{responseSummary,deviceCustodyStatus}' = v_custody then
    return v_result;
  end if;

  v_order_id := v_result #>> '{responseSummary,serverOrderId}';
  if v_order_id is null then
    raise exception 'offline_sync_missing_order_id' using errcode = 'P0001';
  end if;

  v_now := clock_timestamp();
  update public.repair_orders as order_row
     set device_custody_status = v_custody,
         deposit_amount = v_deposit,
         balance_amount = greatest(0, order_row.quotation_amount - v_deposit),
         is_paid = greatest(0, order_row.quotation_amount - v_deposit) = 0,
         payment_status = case
           when greatest(0, order_row.quotation_amount - v_deposit) = 0 then 'paid'
           when v_deposit > 0 then 'partial'
           else 'unpaid'
         end,
         device_unlock_method = case
           when v_custody = 'with_customer' then null
           else order_row.device_unlock_method
         end,
         device_unlock_value = case
           when v_custody = 'with_customer' then null
           else order_row.device_unlock_value
         end,
         device_unlock_pattern = case
           when v_custody = 'with_customer' then null
           else order_row.device_unlock_pattern
         end,
         updated_at = v_now
   where order_row.store_id = p_store_id
     and order_row.id::text = v_order_id;

  if not found then
    raise exception 'offline_sync_order_not_found' using errcode = 'P0002';
  end if;

  update public.order_events as event_row
     set payload = event_row.payload || jsonb_build_object(
       'device_custody_status', v_custody
     )
   where event_row.store_id = p_store_id
     and event_row.order_id::text = v_order_id
     and event_row.event_type::text = 'created'
     and event_row.payload ->> 'source' = 'offline_sync';

  v_response := coalesce(v_result -> 'responseSummary', '{}'::jsonb)
    || jsonb_build_object(
      'updatedAt', v_now,
      'deviceCustodyStatus', v_custody
    );

  update public.repairdesk_offline_operations
     set response_summary = v_response,
         updated_at = v_now
   where store_id = p_store_id
     and actor_id = p_actor_id
     and operation_type = 'order_create'
     and operation_id = p_operation_id
     and request_hash = p_request_hash;

  return jsonb_build_object('resultCode', 'synced', 'responseSummary', v_response);
end;
$$;

revoke all on function public.repairdesk_offline_sync_order_create_rpc(
  uuid,
  uuid,
  text,
  text,
  jsonb
) from public, anon, authenticated;

grant execute on function public.repairdesk_offline_sync_order_create_rpc(
  uuid,
  uuid,
  text,
  text,
  jsonb
) to service_role;

comment on function public.repairdesk_offline_sync_order_create_rpc(
  uuid,
  uuid,
  text,
  text,
  jsonb
) is 'Atomically extends offline order creation with an explicit device custody fact. Service role only.';

-- Order-data imports remain backward-compatible with v1 workbooks. Creates without the new
-- column are explicitly written as NULL (historical unknown); blank updates remain unchanged.
alter function public.repairdesk_apply_order_data_batch(uuid, uuid, uuid, text, text)
  rename to repairdesk_apply_order_data_batch_v1;

revoke all on function public.repairdesk_apply_order_data_batch_v1(
  uuid,
  uuid,
  uuid,
  text,
  text
) from public, anon, authenticated, service_role;

create function public.repairdesk_apply_order_data_batch(
  p_batch_id uuid,
  p_store_id uuid,
  p_actor_id uuid,
  p_actor_email text,
  p_actor_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_row record;
  v_target text;
  v_from text;
  v_from_delivery timestamptz;
  v_order_id text;
  v_now timestamptz;
  v_changed integer := 0;
begin
  v_result := public.repairdesk_apply_order_data_batch_v1(
    p_batch_id,
    p_store_id,
    p_actor_id,
    p_actor_email,
    p_actor_name
  );

  for v_row in
    select
      batch_row.id,
      batch_row.action,
      batch_row.normalized_data,
      batch_row.result_order_id,
      batch_row.before_data
    from public.order_data_batch_rows as batch_row
    where batch_row.batch_id = p_batch_id
      and batch_row.store_id = p_store_id
      and batch_row.status = 'applied'
      and not (batch_row.before_data ? 'device_custody_applied')
      and (
        batch_row.action = 'create'
        or batch_row.normalized_data ? 'device_custody_status'
      )
    order by batch_row.row_number
    for update
  loop
    v_target := v_row.normalized_data ->> 'device_custody_status';
    if v_row.action = 'update' and v_target not in ('with_shop', 'with_customer') then
      raise exception 'invalid_device_custody_import' using errcode = '22023';
    end if;
    if v_row.action = 'create'
       and v_target is not null
       and v_target not in ('with_shop', 'with_customer') then
      raise exception 'invalid_device_custody_import' using errcode = '22023';
    end if;

    v_order_id := v_row.result_order_id::text;
    select order_row.device_custody_status, order_row.delivered_at
      into v_from, v_from_delivery
      from public.repair_orders as order_row
     where order_row.store_id = p_store_id
       and order_row.id::text = v_order_id
     for update;

    if not found then
      raise exception 'order_data_custody_order_not_found' using errcode = 'P0002';
    end if;

    v_now := clock_timestamp();
    update public.repair_orders as order_row
       set device_custody_status = v_target,
           device_unlock_method = case
             when v_target = 'with_customer' then null
             else order_row.device_unlock_method
           end,
           device_unlock_value = case
             when v_target = 'with_customer' then null
             else order_row.device_unlock_value
           end,
           device_unlock_pattern = case
             when v_target = 'with_customer' then null
             else order_row.device_unlock_pattern
           end,
           updated_at = v_now
     where order_row.store_id = p_store_id
       and order_row.id::text = v_order_id;

    update public.order_data_batch_rows as batch_row
       set before_data = case
             when v_row.action = 'update' then
               batch_row.before_data
               || jsonb_build_object(
                 'order',
                 coalesce(batch_row.before_data -> 'order', '{}'::jsonb)
                 || jsonb_build_object(
                   'device_custody_status', v_from,
                   'delivered_at', v_from_delivery
                 )
               )
               || jsonb_build_object('device_custody_applied', true)
             else batch_row.before_data || jsonb_build_object('device_custody_applied', true)
           end,
           after_updated_at = v_now
     where batch_row.id = v_row.id;

    if v_row.action = 'create' then
      update public.order_events as event_row
         set payload = event_row.payload || jsonb_build_object(
           'device_custody_status', v_target
         )
       where event_row.store_id = p_store_id
         and event_row.order_id::text = v_order_id
         and event_row.event_type::text = 'created'
         and event_row.payload ->> 'source' = 'order_data_import'
         and event_row.payload ->> 'batch_id' = p_batch_id::text;
    else
      insert into public.order_events (
        id,
        store_id,
        order_id,
        event_type,
        payload,
        operator_name,
        created_at
      )
      select
        gen_random_uuid(),
        p_store_id,
        order_row.id,
        'note',
        jsonb_build_object(
          'source', 'order_data_import',
          'batch_id', p_batch_id,
          'action', 'device_custody_corrected',
          'from', v_from,
          'to', v_target,
          'credentials_cleared', v_target = 'with_customer'
        ),
        coalesce(nullif(p_actor_name, ''), '店主'),
        v_now
      from public.repair_orders as order_row
      where order_row.store_id = p_store_id
        and order_row.id::text = v_order_id;
    end if;

    v_changed := v_changed + 1;
  end loop;

  if v_changed > 0 then
    update public.audit_logs as audit_row
       set metadata = audit_row.metadata || jsonb_build_object(
         'device_custody_rows', v_changed
       )
     where audit_row.store_id = p_store_id
       and audit_row.action = 'import_apply'
       and audit_row.entity_type = 'order_data_batch'
       and audit_row.entity_id = p_batch_id::text;
  end if;

  return v_result;
end;
$$;

revoke all on function public.repairdesk_apply_order_data_batch(
  uuid,
  uuid,
  uuid,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.repairdesk_apply_order_data_batch(
  uuid,
  uuid,
  uuid,
  text,
  text
) to service_role;

alter function public.repairdesk_rollback_order_data_batch(uuid, uuid, uuid, text, text)
  rename to repairdesk_rollback_order_data_batch_v1;

revoke all on function public.repairdesk_rollback_order_data_batch_v1(
  uuid,
  uuid,
  uuid,
  text,
  text
) from public, anon, authenticated, service_role;

create function public.repairdesk_rollback_order_data_batch(
  p_batch_id uuid,
  p_store_id uuid,
  p_actor_id uuid,
  p_actor_email text,
  p_actor_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_row record;
  v_target text;
  v_target_delivery timestamptz;
  v_order_id text;
  v_now timestamptz;
  v_changed integer := 0;
begin
  v_result := public.repairdesk_rollback_order_data_batch_v1(
    p_batch_id,
    p_store_id,
    p_actor_id,
    p_actor_email,
    p_actor_name
  );

  for v_row in
    select
      batch_row.id,
      batch_row.result_order_id,
      batch_row.before_data
    from public.order_data_batch_rows as batch_row
    where batch_row.batch_id = p_batch_id
      and batch_row.store_id = p_store_id
      and batch_row.action = 'update'
      and batch_row.status = 'rolled_back'
      and batch_row.before_data ? 'device_custody_applied'
      and not (batch_row.before_data ? 'device_custody_rolled_back')
    order by batch_row.row_number
    for update
  loop
    v_target := v_row.before_data #>> '{order,device_custody_status}';
    v_target_delivery := nullif(v_row.before_data #>> '{order,delivered_at}', '')::timestamptz;
    v_order_id := v_row.result_order_id::text;
    v_now := clock_timestamp();

    update public.repair_orders as order_row
       set device_custody_status = v_target,
           delivered_at = v_target_delivery,
           device_unlock_method = case
             when v_target = 'with_customer' then null
             else order_row.device_unlock_method
           end,
           device_unlock_value = case
             when v_target = 'with_customer' then null
             else order_row.device_unlock_value
           end,
           device_unlock_pattern = case
             when v_target = 'with_customer' then null
             else order_row.device_unlock_pattern
           end,
           updated_at = v_now
     where order_row.store_id = p_store_id
       and order_row.id::text = v_order_id;

    if not found then
      raise exception 'order_data_custody_rollback_order_not_found' using errcode = 'P0002';
    end if;

    update public.order_data_batch_rows
       set before_data = before_data || jsonb_build_object(
         'device_custody_rolled_back', true
       )
     where id = v_row.id;

    insert into public.order_events (
      id,
      store_id,
      order_id,
      event_type,
      payload,
      operator_name,
      created_at
    )
    select
      gen_random_uuid(),
      p_store_id,
      order_row.id,
      'note',
      jsonb_build_object(
        'source', 'order_data_rollback',
        'batch_id', p_batch_id,
        'action', 'device_custody_import_rolled_back',
        'to', v_target,
        'credentials_restored', false
      ),
      coalesce(nullif(p_actor_name, ''), '店主'),
      v_now
    from public.repair_orders as order_row
    where order_row.store_id = p_store_id
      and order_row.id::text = v_order_id;

    v_changed := v_changed + 1;
  end loop;

  if v_changed > 0 then
    update public.audit_logs as audit_row
       set metadata = audit_row.metadata || jsonb_build_object(
         'device_custody_rows', v_changed,
         'device_custody_credentials_restored', false
       )
     where audit_row.store_id = p_store_id
       and audit_row.action = 'import_rollback'
       and audit_row.entity_type = 'order_data_batch'
       and audit_row.entity_id = p_batch_id::text;
  end if;

  return v_result;
end;
$$;

revoke all on function public.repairdesk_rollback_order_data_batch(
  uuid,
  uuid,
  uuid,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.repairdesk_rollback_order_data_batch(
  uuid,
  uuid,
  uuid,
  text,
  text
) to service_role;

comment on function public.repairdesk_apply_order_data_batch(
  uuid,
  uuid,
  uuid,
  text,
  text
) is 'Applies order-data batches and device custody corrections atomically. Owner-only through the legacy core; service role only.';

comment on function public.repairdesk_rollback_order_data_batch(
  uuid,
  uuid,
  uuid,
  text,
  text
) is 'Rolls back order-data batches and restores the prior custody fact without restoring secrets. Service role only.';
