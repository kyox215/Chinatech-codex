-- Forward-only change: device custody changes must retain stored unlock credentials.
-- The previous custody reconciliation required customer-held devices to have null
-- unlock fields. The business rule changed on 2026-07-17: credentials remain
-- stored until an authorized user manually clears them.
set lock_timeout = '5s';
set statement_timeout = '5min';

alter table public.repair_orders
  drop constraint if exists repair_orders_customer_custody_unlock_clear_check;

comment on column public.repair_orders.device_custody_status is
  'Physical device custody: with_shop, with_customer, or null for legacy rows awaiting confirmation. Custody changes do not clear stored unlock credentials.';

create or replace function public.repairdesk_apply_order_atomic_mutation(
  p_store_id uuid,
  p_order_id uuid,
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
  v_current_bucket text;
  v_target_bucket text;
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
  if p_store_id is null or p_order_id is null then
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
  if p_event_type is null
     or p_event_type not in ('status_changed', 'approval_result', 'note') then
    return jsonb_build_object('ok', false, 'code', 'invalid_event');
  end if;
  if p_event_payload is not null and jsonb_typeof(p_event_payload) <> 'object' then
    return jsonb_build_object('ok', false, 'code', 'invalid_event');
  end if;
  if exists (
    with recursive payload_nodes(value) as (
      select coalesce(p_event_payload, '{}'::jsonb)
      union all
      select child.value
      from payload_nodes as node
      cross join lateral (
        select object_value as value
        from jsonb_each(
          case
            when jsonb_typeof(node.value) = 'object' then node.value
            else '{}'::jsonb
          end
        ) as object_entry(object_key, object_value)

        union all

        select array_value as value
        from jsonb_array_elements(
          case
            when jsonb_typeof(node.value) = 'array' then node.value
            else '[]'::jsonb
          end
        ) as array_entry(array_value)
      ) as child
    )
    select 1
    from payload_nodes as node
    cross join lateral jsonb_object_keys(
      case
        when jsonb_typeof(node.value) = 'object' then node.value
        else '{}'::jsonb
      end
    ) as sensitive_key(key_name)
    where key_name in (
      'device_unlock_value',
      'device_unlock_method',
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
    p_order_id::text
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
       or v_existing_event.payload ->> 'mutation_fingerprint' is distinct from v_fingerprint then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return jsonb_build_object(
      'ok', true,
      'code', 'idempotent_replay',
      'updated_at', v_existing_event.created_at
    );
  end if;

  if v_order.record_state <> 'active' or v_order.deleted_at is not null then
    return jsonb_build_object('ok', false, 'code', 'order_voided');
  end if;
  if v_order.updated_at <> p_expected_updated_at then
    return jsonb_build_object('ok', false, 'code', 'stale_version');
  end if;

  select status_row.bucket::text
    into v_current_bucket
    from public.order_workflow_statuses as status_row
   where status_row.store_id = p_store_id
     and status_row.code::text = v_order.status::text
   limit 1;

  if v_order.status::text in ('completed', 'cancelled')
     or coalesce(v_order.exception_status::text, '') = 'cancelled'
     or coalesce(v_current_bucket, '') in ('done', 'cancelled')
     or (v_current_bucket is null and coalesce(v_order.workflow_status::text, '') = 'closed') then
    return jsonb_build_object('ok', false, 'code', 'terminal_operation_required');
  end if;

  if p_update ? 'status' and not exists (
    select 1
      from public.order_workflow_statuses as target_status
     where target_status.store_id = p_store_id
       and target_status.code = p_update ->> 'status'
       and target_status.enabled
  ) then
    return jsonb_build_object('ok', false, 'code', 'invalid_status');
  end if;
  if p_update ? 'status' then
    select target_status.bucket::text
      into v_target_bucket
      from public.order_workflow_statuses as target_status
     where target_status.store_id = p_store_id
       and target_status.code::text = p_update ->> 'status'
       and target_status.enabled
     limit 1;
  end if;
  if p_update ? 'device_custody_status'
     and coalesce(p_update ->> 'device_custody_status', '') not in (
       'with_shop',
       'with_customer'
     ) then
    return jsonb_build_object('ok', false, 'code', 'invalid_custody_status');
  end if;
  if (
    p_update ->> 'status' = 'cancelled'
    or coalesce(v_target_bucket, '') = 'cancelled'
    or (
      p_update ? 'exception_status'
      and p_update ->> 'exception_status' = 'cancelled'
    )
  ) and v_order.device_custody_status is null then
    return jsonb_build_object('ok', false, 'code', 'custody_unknown');
  end if;

  if v_event_payload ->> 'action' = 'device_custody_changed' then
    if v_order.device_custody_status is null
       and nullif(btrim(v_event_payload ->> 'reason'), '') is null then
      return jsonb_build_object('ok', false, 'code', 'reason_required');
    end if;
    if v_order.device_custody_status = p_update ->> 'device_custody_status' then
      return jsonb_build_object('ok', true, 'code', 'no_change', 'updated_at', v_order.updated_at);
    end if;
    if v_order.device_custody_status = 'with_shop'
       and p_update ->> 'device_custody_status' = 'with_customer'
       and (
         v_order.status in (
           'diagnosing',
           'mail_in_progress',
           'repairing',
           'repaired',
           'notified',
           'waiting_pickup',
           'unfixed_pickup'
         )
         or coalesce(v_current_bucket, '') in ('diagnosing', 'repair', 'pickup')
       ) then
      return jsonb_build_object('ok', false, 'code', 'custody_handover_requires_flow_change');
    end if;
    if p_update ->> 'device_custody_status' = 'with_customer' then
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
      'to', p_update ->> 'device_custody_status',
      'credentials_cleared', false
    );
  end if;

  if p_update ? 'device_custody_status'
     and coalesce(v_event_payload ->> 'action', '') <> 'device_custody_changed'
     and not (
       p_event_type = 'status_changed'
       and coalesce(v_target_bucket, '') = 'done'
       and p_update ->> 'device_custody_status' = 'with_customer'
     ) then
    return jsonb_build_object('ok', false, 'code', 'invalid_custody_action');
  end if;

  if (
    p_update ->> 'status' in (
      'diagnosing',
      'mail_in_progress',
      'repairing',
      'repaired',
      'notified',
      'waiting_pickup',
      'unfixed_pickup'
    )
    or coalesce(v_target_bucket, '') in ('diagnosing', 'repair', 'pickup')
  ) and v_order.device_custody_status is distinct from 'with_shop' then
    return jsonb_build_object('ok', false, 'code', 'custody_required');
  end if;

  if p_update ->> 'status' = 'completed' or coalesce(v_target_bucket, '') = 'done' then
    if v_order.device_custody_status is null then
      return jsonb_build_object('ok', false, 'code', 'custody_unknown');
    end if;
    if not (p_update ? 'device_custody_status')
       or jsonb_typeof(p_update -> 'device_custody_status') is distinct from 'string'
       or p_update ->> 'device_custody_status' is distinct from 'with_customer' then
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
     set status = case when p_update ? 'status' then p_update ->> 'status' else v_order.status end,
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
    gen_random_uuid(),
    p_store_id,
    p_order_id,
    p_event_type,
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
  uuid,
  uuid,
  timestamptz,
  jsonb,
  text,
  jsonb,
  uuid
) from public, anon, authenticated;

grant execute on function public.repairdesk_apply_order_atomic_mutation(
  uuid,
  uuid,
  uuid,
  timestamptz,
  jsonb,
  text,
  jsonb,
  uuid
) to service_role;

comment on function public.repairdesk_apply_order_atomic_mutation(
  uuid,
  uuid,
  uuid,
  timestamptz,
  jsonb,
  text,
  jsonb,
  uuid
) is 'Atomically version-locks a store-scoped order mutation and its custody-safe timeline event. Custody changes retain stored unlock credentials. Service role only.';


create or replace function public.repairdesk_confirm_cancelled_order_return(
  p_store_id uuid,
  p_order_id uuid,
  p_actor_id uuid,
  p_expected_updated_at timestamptz,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_operation_id uuid := gen_random_uuid();
  v_existing public.order_terminal_operations%rowtype;
  v_membership_id uuid;
  v_actor_role text;
  v_actor_name text;
  v_actor_email text;
  v_order public.repair_orders%rowtype;
  v_current_bucket text;
  v_request_hash text;
  v_before jsonb;
  v_after jsonb;
  v_now timestamptz := clock_timestamp();
  v_credentials_present boolean;
begin
  if p_store_id is null or p_order_id is null or p_actor_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_target');
  end if;
  if p_expected_updated_at is null then
    return jsonb_build_object('ok', false, 'code', 'missing_expected_version');
  end if;
  if p_idempotency_key is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_idempotency_key');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_store_id::text || ':' || p_idempotency_key::text, 0)
  );

  v_request_hash := encode(
    extensions.digest(
      pg_catalog.convert_to(
        jsonb_build_object(
          'store_id', p_store_id,
          'order_id', p_order_id,
          'actor_id', p_actor_id,
          'expected_updated_at', p_expected_updated_at,
          'operation', 'custody_return'
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  select membership.id,
         membership.role::text,
         coalesce(membership.display_name, profile.display_name, profile.email),
         profile.email
    into v_membership_id, v_actor_role, v_actor_name, v_actor_email
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

  if v_actor_role is null
     or v_actor_role not in ('owner', 'manager', 'sales', 'technician') then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
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

  select operation.*
    into v_existing
    from public.order_terminal_operations as operation
   where operation.store_id = p_store_id
     and operation.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_hash <> v_request_hash then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return jsonb_build_object(
      'ok', true,
      'code', 'idempotent_replay',
      'already_confirmed', true,
      'delivered_at', v_existing.after_data ->> 'delivered_at',
      'updated_at', v_existing.order_updated_at_after
    );
  end if;

  if v_order.record_state <> 'active' or v_order.deleted_at is not null then
    return jsonb_build_object('ok', false, 'code', 'invalid_state');
  end if;

  select status_row.bucket::text
    into v_current_bucket
    from public.order_workflow_statuses as status_row
   where status_row.store_id = p_store_id
     and status_row.code::text = v_order.status::text
   limit 1;

  if v_order.status::text <> 'cancelled'
     and coalesce(v_order.exception_status::text, '') <> 'cancelled'
     and coalesce(v_current_bucket, '') <> 'cancelled' then
    return jsonb_build_object('ok', false, 'code', 'invalid_state');
  end if;
  if v_order.device_custody_status is null then
    return jsonb_build_object('ok', false, 'code', 'custody_unknown');
  end if;
  if v_order.device_custody_status = 'with_customer' then
    if v_order.delivered_at is not null then
      return jsonb_build_object(
        'ok', true,
        'code', 'idempotent_replay',
        'already_confirmed', true,
        'delivered_at', v_order.delivered_at,
        'updated_at', v_order.updated_at
      );
    end if;
    return jsonb_build_object('ok', false, 'code', 'return_not_required');
  end if;
  if v_order.delivered_at is not null then
    return jsonb_build_object('ok', false, 'code', 'custody_conflict');
  end if;
  if v_order.updated_at <> p_expected_updated_at then
    return jsonb_build_object('ok', false, 'code', 'stale_version');
  end if;

  v_credentials_present := (
    v_order.device_unlock_method is not null
    or v_order.device_unlock_value is not null
    or v_order.device_unlock_pattern is not null
  );
  v_before := jsonb_build_object(
    'status', v_order.status,
    'record_state', v_order.record_state,
    'completed_at', v_order.completed_at,
    'delivered_at', v_order.delivered_at,
    'device_custody_status', v_order.device_custody_status,
    'credentials_present', v_credentials_present
  );
  v_after := v_before || jsonb_build_object(
    'completed_at', coalesce(v_order.completed_at, v_now),
    'delivered_at', v_now,
    'device_custody_status', 'with_customer',
    'credentials_present', v_credentials_present
  );

  perform pg_catalog.set_config('repairdesk.terminal_operation', 'custody_return', true);

  update public.repair_orders
     set completed_at = coalesce(completed_at, v_now),
         delivered_at = v_now,
         device_custody_status = 'with_customer',
         updated_at = v_now
   where store_id = p_store_id
     and id = p_order_id;

  perform pg_catalog.set_config('repairdesk.terminal_operation', '', true);

  insert into public.order_events (
    id, store_id, order_id, event_type, payload, operator_name, created_at
  ) values (
    gen_random_uuid(), p_store_id, p_order_id, 'status_changed',
    jsonb_build_object(
      'from', v_order.status,
      'to', v_order.status,
      'action', 'custody_return_confirmed',
      'handover_confirmed', true,
      'custody_from', 'with_shop',
      'custody_to', 'with_customer',
      'custody_outcome', 'returned',
      'credentials_cleared', false,
      'idempotency_key', p_idempotency_key
    ),
    v_actor_name, v_now
  );

  insert into public.order_terminal_operations (
    id, store_id, order_id, idempotency_key, operation_type, request_hash,
    actor_id, actor_name_snapshot, actor_role_snapshot, reason,
    before_data, after_data, order_updated_at_before, order_updated_at_after, created_at
  ) values (
    v_operation_id, p_store_id, p_order_id, p_idempotency_key, 'custody_return',
    v_request_hash, p_actor_id, v_actor_name, v_actor_role,
    '确认取消工单设备已退还', v_before, v_after, v_order.updated_at, v_now, v_now
  );

  insert into public.audit_logs (
    id, actor_id, actor_email, actor_name, store_id, action,
    entity_type, entity_id, before_data, after_data, metadata, created_at
  ) values (
    gen_random_uuid()::text, p_actor_id, v_actor_email, v_actor_name, p_store_id,
    'order_custody_return_confirmed', 'repair_order', p_order_id::text,
    v_before, v_after,
    jsonb_build_object('operation_id', v_operation_id, 'idempotency_key', p_idempotency_key),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'code', 'recorded',
    'already_confirmed', false,
    'delivered_at', v_now,
    'updated_at', v_now
  );
end;
$$;

revoke all on function public.repairdesk_confirm_cancelled_order_return(
  uuid, uuid, uuid, timestamptz, uuid
) from public, anon, authenticated;
grant execute on function public.repairdesk_confirm_cancelled_order_return(
  uuid, uuid, uuid, timestamptz, uuid
) to service_role;


create or replace function public.repairdesk_correct_terminal_order_custody(
  p_store_id uuid,
  p_order_id uuid,
  p_actor_id uuid,
  p_expected_updated_at timestamptz,
  p_idempotency_key uuid,
  p_device_custody_status text,
  p_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor_email text;
  v_actor_name text;
  v_actor_role text;
  v_existing public.order_terminal_operations%rowtype;
  v_order public.repair_orders%rowtype;
  v_current_bucket text;
  v_operation_id uuid := gen_random_uuid();
  v_reason text := btrim(coalesce(p_reason, ''));
  v_request_hash text;
  v_before jsonb;
  v_after jsonb;
  v_now timestamptz := clock_timestamp();
  v_delivered_at timestamptz;
  v_credentials_present boolean;
begin
  if p_store_id is null or p_order_id is null then
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
  if p_device_custody_status is null
     or p_device_custody_status not in ('with_shop', 'with_customer') then
    return jsonb_build_object('ok', false, 'code', 'invalid_custody_status');
  end if;
  if char_length(v_reason) < 5 or char_length(v_reason) > 1000 then
    return jsonb_build_object('ok', false, 'code', 'invalid_reason');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_store_id::text || ':' || p_idempotency_key::text, 0)
  );

  select profile.email,
         coalesce(membership.display_name, profile.display_name, profile.email),
         membership.role::text
    into v_actor_email, v_actor_name, v_actor_role
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

  if v_actor_role is null or v_actor_role not in ('owner', 'manager') then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;

  v_request_hash := encode(
    extensions.digest(
      pg_catalog.convert_to(
        jsonb_build_object(
          'store_id', p_store_id,
          'order_id', p_order_id,
          'actor_id', p_actor_id,
          'expected_updated_at', p_expected_updated_at,
          'operation', 'custody_correction',
          'device_custody_status', p_device_custody_status,
          'reason', v_reason
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  select operation.*
    into v_existing
    from public.order_terminal_operations as operation
   where operation.store_id = p_store_id
     and operation.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_hash <> v_request_hash then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return jsonb_build_object(
      'ok', true,
      'code', 'idempotent_replay',
      'operation_id', v_existing.id,
      'updated_at', v_existing.order_updated_at_after
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
  if v_order.updated_at <> p_expected_updated_at then
    return jsonb_build_object('ok', false, 'code', 'stale_version');
  end if;
  if v_order.record_state <> 'active' or v_order.deleted_at is not null then
    return jsonb_build_object('ok', false, 'code', 'order_voided');
  end if;

  select status_row.bucket::text
    into v_current_bucket
    from public.order_workflow_statuses as status_row
   where status_row.store_id = p_store_id
     and status_row.code::text = v_order.status::text
   limit 1;

  if v_order.status::text not in ('completed', 'cancelled')
     and coalesce(v_order.exception_status::text, '') <> 'cancelled'
     and coalesce(v_current_bucket, '') not in ('done', 'cancelled')
     and not (v_current_bucket is null and coalesce(v_order.workflow_status::text, '') = 'closed') then
    return jsonb_build_object('ok', false, 'code', 'invalid_state');
  end if;
  if v_order.device_custody_status = p_device_custody_status then
    return jsonb_build_object(
      'ok', true,
      'code', 'no_change',
      'updated_at', v_order.updated_at
    );
  end if;
  if p_device_custody_status = 'with_shop'
     and (
       v_order.device_custody_status is not null
       or v_order.status::text = 'completed'
       or coalesce(v_current_bucket, '') = 'done'
     ) then
    return jsonb_build_object('ok', false, 'code', 'terminal_reopen_required');
  end if;
  if p_device_custody_status = 'with_shop' and v_order.delivered_at is not null then
    return jsonb_build_object('ok', false, 'code', 'custody_conflict');
  end if;
  if p_device_custody_status = 'with_customer'
     and v_order.device_custody_status = 'with_shop'
     and (
       v_order.status::text = 'cancelled'
       or coalesce(v_order.exception_status::text, '') = 'cancelled'
       or coalesce(v_current_bucket, '') = 'cancelled'
     ) then
    return jsonb_build_object('ok', false, 'code', 'use_cancelled_return');
  end if;

  v_delivered_at := case
    when p_device_custody_status = 'with_shop' then null
    when v_order.device_custody_status = 'with_shop' then coalesce(v_order.delivered_at, v_now)
    else v_order.delivered_at
  end;
  v_credentials_present := (
    v_order.device_unlock_method is not null
    or v_order.device_unlock_value is not null
    or v_order.device_unlock_pattern is not null
  );

  v_before := jsonb_build_object(
    'status', v_order.status,
    'record_state', v_order.record_state,
    'device_custody_status', v_order.device_custody_status,
    'delivered_at', v_order.delivered_at,
    'credentials_present', v_credentials_present
  );
  v_after := jsonb_build_object(
    'status', v_order.status,
    'record_state', v_order.record_state,
    'device_custody_status', p_device_custody_status,
    'delivered_at', v_delivered_at,
    'credentials_present', v_credentials_present
  );

  perform pg_catalog.set_config('repairdesk.terminal_operation', 'custody_correction', true);

  update public.repair_orders
     set device_custody_status = p_device_custody_status,
         delivered_at = v_delivered_at,
         updated_at = v_now
   where store_id = p_store_id
     and id = p_order_id;

  perform pg_catalog.set_config('repairdesk.terminal_operation', '', true);

  insert into public.order_events (
    id, store_id, order_id, event_type, payload, operator_name, created_at
  ) values (
    gen_random_uuid(),
    p_store_id,
    p_order_id,
    'note',
    jsonb_build_object(
      'action', 'terminal_custody_correction',
      'operation_id', v_operation_id,
      'from', v_order.device_custody_status,
      'to', p_device_custody_status,
      'reason', v_reason,
      'credentials_cleared', false
    ),
    v_actor_name,
    v_now
  );

  insert into public.order_terminal_operations (
    id, store_id, order_id, idempotency_key, operation_type, request_hash,
    actor_id, actor_name_snapshot, actor_role_snapshot, reason,
    before_data, after_data, order_updated_at_before, order_updated_at_after, created_at
  ) values (
    v_operation_id, p_store_id, p_order_id, p_idempotency_key, 'custody_correction',
    v_request_hash, p_actor_id, v_actor_name, v_actor_role, v_reason,
    v_before, v_after, v_order.updated_at, v_now, v_now
  );

  insert into public.audit_logs (
    id, actor_id, actor_email, actor_name, store_id, action,
    entity_type, entity_id, before_data, after_data, metadata, created_at
  ) values (
    gen_random_uuid()::text, p_actor_id, v_actor_email, v_actor_name, p_store_id,
    'order_terminal_custody_correction', 'repair_order', p_order_id::text,
    v_before, v_after,
    jsonb_build_object('operation_id', v_operation_id, 'reason', v_reason),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'code', 'recorded',
    'operation_id', v_operation_id,
    'updated_at', v_now
  );
end;
$$;

revoke all on function public.repairdesk_correct_terminal_order_custody(
  uuid, uuid, uuid, timestamptz, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.repairdesk_correct_terminal_order_custody(
  uuid, uuid, uuid, timestamptz, uuid, text, text
) to service_role;


create or replace function public.repairdesk_apply_order_data_batch(
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
    if v_row.action = 'update'
       and (v_target is null or v_target not in ('with_shop', 'with_customer')) then
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
          'credentials_cleared', false
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

reset statement_timeout;
reset lock_timeout;
