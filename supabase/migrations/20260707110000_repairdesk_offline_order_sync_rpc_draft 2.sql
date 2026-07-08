-- RepairDesk offline order sync RPC transaction draft.
--
-- Local approval draft only. Do not apply to any linked or production
-- Supabase project until the Owner approves the database implementation,
-- HMAC secret source, dry-run plan, backup/restore drill, release window,
-- and rollback procedure.
--
-- Purpose:
-- - keep offline replay claim, business writes, order event, and operation
--   finalization in one database transaction boundary;
-- - keep raw offline payloads out of repairdesk_offline_operations and audit;
-- - keep browser clients unable to execute the RPC directly.
--
-- This draft intentionally supports only the first safe subset:
-- - order create with explicit existing/new customer and existing/new device;
-- - order update for order text/warranty fields only;
-- - no unlock values, attachments, payment collection, messages, status/workflow,
--   inventory, supplier mutation, merge/delete, or async invalidation.

create or replace function public.repairdesk_offline_sync_order_create_rpc(
  p_store_id uuid,
  p_actor_id uuid,
  p_operation_id text,
  p_request_hash text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_operation public.repairdesk_offline_operations%rowtype;
  v_relationship jsonb := p_payload #> '{payload,relationshipPlan}';
  v_customer_plan jsonb := p_payload #> '{payload,relationshipPlan,customer}';
  v_device_plan jsonb := p_payload #> '{payload,relationshipPlan,device}';
  v_order jsonb := p_payload #> '{payload,order}';
  v_customer_id text;
  v_device_id text;
  v_order_id text := gen_random_uuid()::text;
  v_customer_phone text;
  v_customer_name text;
  v_device_brand text;
  v_device_model text;
  v_device_serial text := '';
  v_device_notes text;
  v_fault_prices jsonb := coalesce(p_payload #> '{payload,order,fault_prices}', '[]'::jsonb);
  v_quotation numeric(12, 2) := 0;
  v_balance numeric(12, 2) := 0;
  v_contact_phones text[] := '{}'::text[];
  v_public_no text;
  v_response jsonb;
  v_claimed boolean := false;
begin
  if not exists (
    select 1
    from public.store_memberships sm
    join public.staff_profiles sp on sp.id = sm.user_id
    join public.stores st on st.id = sm.store_id
    where sm.store_id = p_store_id
      and sm.user_id = p_actor_id
      and sm.status = 'active'
      and sm.role <> 'viewer'
      and sp.status = 'active'
      and st.status = 'active'
  ) then
    return jsonb_build_object('resultCode', 'forbidden');
  end if;

  insert into public.repairdesk_offline_operations (
    store_id,
    actor_id,
    operation_type,
    operation_id,
    request_hash,
    status,
    created_at,
    updated_at
  )
  values (
    p_store_id,
    p_actor_id,
    'order_create',
    p_operation_id,
    p_request_hash,
    'started',
    v_now,
    v_now
  )
  on conflict (store_id, actor_id, operation_type, operation_id) do nothing
  returning true into v_claimed;

  v_claimed := coalesce(v_claimed, false);

  select *
  into v_operation
  from public.repairdesk_offline_operations
  where store_id = p_store_id
    and actor_id = p_actor_id
    and operation_type = 'order_create'
    and operation_id = p_operation_id
  for update;

  if v_operation.request_hash <> p_request_hash then
    return jsonb_build_object('resultCode', 'idempotency_conflict');
  end if;

  if v_operation.status = 'succeeded' then
    return jsonb_build_object(
      'resultCode',
      'idempotent_replay',
      'responseSummary',
      v_operation.response_summary
    );
  end if;

  if v_operation.status in ('conflict', 'blocked') then
    return jsonb_build_object(
      'resultCode',
      coalesce(v_operation.result_code, 'blocked_operation')
    );
  end if;

  if v_operation.status = 'failed' then
    return jsonb_build_object('resultCode', 'retryable_error');
  end if;

  if not v_claimed
     and v_operation.status = 'started'
     and v_operation.updated_at > v_now - interval '5 minutes' then
    return jsonb_build_object('resultCode', 'retryable_error');
  end if;

  begin
    if v_relationship is null or v_customer_plan is null or v_device_plan is null or v_order is null then
      update public.repairdesk_offline_operations
      set status = 'blocked',
          result_code = 'blocked_operation',
          error_code = 'invalid_payload',
          updated_at = v_now
      where id = v_operation.id;
      return jsonb_build_object('resultCode', 'blocked_operation');
    end if;

    if v_customer_plan->>'mode' = 'existing_customer' then
      select c.id, c.contact_phones
      into v_customer_id, v_contact_phones
      from public.customers c
      where c.store_id = p_store_id
        and c.id = v_customer_plan->>'customerId'
      for update;

      if v_customer_id is null then
        update public.repairdesk_offline_operations
        set status = 'blocked',
            result_code = 'forbidden',
            error_code = 'customer_not_found',
            updated_at = v_now
        where id = v_operation.id;
        return jsonb_build_object('resultCode', 'forbidden');
      end if;
    elsif v_customer_plan->>'mode' = 'new_customer_local' then
      v_customer_name := nullif(v_customer_plan #>> '{snapshot,name}', '');
      v_customer_phone := nullif(v_customer_plan #>> '{snapshot,phoneRaw}', '');

      if v_customer_name is null or v_customer_phone is null then
        update public.repairdesk_offline_operations
        set status = 'blocked',
            result_code = 'blocked_operation',
            error_code = 'invalid_customer_snapshot',
            updated_at = v_now
        where id = v_operation.id;
        return jsonb_build_object('resultCode', 'blocked_operation');
      end if;

      if exists (
        select 1
        from public.customers c
        where c.store_id = p_store_id
          and c.phone_raw = v_customer_phone
      ) then
        update public.repairdesk_offline_operations
        set status = 'blocked',
            result_code = 'needs_review',
            error_code = 'duplicate_customer',
            updated_at = v_now
        where id = v_operation.id;
        return jsonb_build_object('resultCode', 'needs_review');
      end if;

      v_customer_id := gen_random_uuid()::text;
      v_contact_phones := array[v_customer_phone];

      insert into public.customers (
        id,
        store_id,
        name,
        phone_e164,
        phone_raw,
        contact_phones,
        consent_marketing,
        consent_sms,
        language,
        created_at,
        updated_at
      )
      values (
        v_customer_id,
        p_store_id,
        v_customer_name,
        coalesce(nullif(v_customer_plan #>> '{snapshot,phoneE164}', ''), v_customer_phone),
        v_customer_phone,
        v_contact_phones,
        false,
        false,
        coalesce(nullif(v_customer_plan #>> '{snapshot,language}', ''), 'it'),
        v_now,
        v_now
      );
    else
      update public.repairdesk_offline_operations
      set status = 'blocked',
          result_code = 'needs_review',
          error_code = 'unsupported_customer_relationship',
          updated_at = v_now
      where id = v_operation.id;
      return jsonb_build_object('resultCode', 'needs_review');
    end if;

    if v_device_plan->>'mode' = 'existing_customer_device' then
      select d.id, d.brand, d.model, d.serial_or_imei, d.device_notes
      into v_device_id, v_device_brand, v_device_model, v_device_serial, v_device_notes
      from public.devices d
      where d.store_id = p_store_id
        and d.id = v_device_plan->>'deviceId'
        and d.customer_id = v_customer_id
      for update;

      if v_device_id is null then
        update public.repairdesk_offline_operations
        set status = 'blocked',
            result_code = 'forbidden',
            error_code = 'device_not_found_for_customer',
            updated_at = v_now
        where id = v_operation.id;
        return jsonb_build_object('resultCode', 'forbidden');
      end if;
    elsif v_device_plan->>'mode' = 'new_customer_device_local' then
      v_device_brand := nullif(v_device_plan #>> '{snapshot,brand}', '');
      v_device_model := nullif(v_device_plan #>> '{snapshot,model}', '');
      v_device_serial := coalesce(nullif(v_device_plan #>> '{snapshot,serialOrImei}', ''), '');
      v_device_notes := nullif(v_device_plan #>> '{snapshot,deviceNotes}', '');

      if v_device_brand is null or v_device_model is null then
        update public.repairdesk_offline_operations
        set status = 'blocked',
            result_code = 'blocked_operation',
            error_code = 'invalid_device_snapshot',
            updated_at = v_now
        where id = v_operation.id;
        return jsonb_build_object('resultCode', 'blocked_operation');
      end if;

      v_device_id := gen_random_uuid()::text;

      insert into public.devices (
        id,
        store_id,
        customer_id,
        brand,
        model,
        serial_or_imei,
        device_notes,
        created_at,
        updated_at
      )
      values (
        v_device_id,
        p_store_id,
        v_customer_id,
        v_device_brand,
        v_device_model,
        v_device_serial,
        v_device_notes,
        v_now,
        v_now
      );
    else
      update public.repairdesk_offline_operations
      set status = 'blocked',
          result_code = 'needs_review',
          error_code = 'unsupported_device_relationship',
          updated_at = v_now
      where id = v_operation.id;
      return jsonb_build_object('resultCode', 'needs_review');
    end if;

    select coalesce(sum((item->>'price')::numeric), 0)
    into v_quotation
    from jsonb_array_elements(v_fault_prices) item;

    v_balance := v_quotation;

    insert into public.repair_orders (
      id,
      store_id,
      order_type,
      status,
      workflow_status,
      payment_status,
      approval_flow_status,
      parts_status,
      notify_status,
      customer_id,
      device_id,
      issue_description,
      quotation_amount,
      deposit_amount,
      balance_amount,
      currency_code,
      is_paid,
      approval_status,
      technician_name,
      internal_tag,
      accessory_notes,
      warranty_text,
      warranty_months,
      warranty_change_reason,
      contact_phones,
      fault_prices,
      device_snapshot,
      created_at,
      updated_at
    )
    values (
      v_order_id,
      p_store_id,
      (v_order->>'order_type')::public.repair_order_type,
      'new'::public.repair_order_status,
      'intake',
      'unpaid',
      'not_required',
      'not_required',
      'not_sent',
      v_customer_id,
      v_device_id,
      v_order->>'issue_description',
      v_quotation,
      0,
      v_balance,
      'EUR',
      false,
      'pending'::public.approval_status,
      'offline_sync',
      nullif(v_order->>'internal_tag', ''),
      nullif(v_order->>'accessory_notes', ''),
      nullif(v_order->>'warranty_text', ''),
      nullif(v_order->>'warranty_months', '')::integer,
      nullif(v_order->>'warranty_change_reason', ''),
      v_contact_phones,
      v_fault_prices,
      jsonb_build_object(
        'brand', v_device_brand,
        'model', v_device_model,
        'serial_or_imei', coalesce(v_device_serial, ''),
        'device_notes', v_device_notes
      ),
      v_now,
      v_now
    )
    returning public_no into v_public_no;

    insert into public.order_events (
      id,
      store_id,
      order_id,
      event_type,
      payload,
      operator_name,
      created_at
    )
    values (
      gen_random_uuid()::text,
      p_store_id,
      v_order_id,
      'created'::public.order_event_type,
      jsonb_build_object('source', 'offline_sync'),
      'offline_sync',
      v_now
    );

    v_response := jsonb_build_object(
      'serverOrderId', v_order_id,
      'publicNo', v_public_no,
      'updatedAt', v_now,
      'resultCode', 'synced'
    );

    update public.repairdesk_offline_operations
    set status = 'succeeded',
        result_code = 'synced',
        target_entity_type = 'repair_order',
        target_entity_id = v_order_id,
        response_summary = v_response,
        error_code = null,
        updated_at = v_now
    where id = v_operation.id;

    return jsonb_build_object('resultCode', 'synced', 'responseSummary', v_response);
  exception when others then
    update public.repairdesk_offline_operations
    set status = 'failed',
        result_code = 'retryable_error',
        error_code = 'transaction_failed',
        response_summary = '{}'::jsonb,
        updated_at = v_now
    where id = v_operation.id;
    return jsonb_build_object('resultCode', 'retryable_error');
  end;
end;
$$;

create or replace function public.repairdesk_offline_sync_order_update_rpc(
  p_store_id uuid,
  p_actor_id uuid,
  p_operation_id text,
  p_request_hash text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_operation public.repairdesk_offline_operations%rowtype;
  v_changes jsonb := p_payload #> '{payload,changes}';
  v_order_id text := p_payload #>> '{payload,serverOrderId}';
  v_base_updated_at_text text := nullif(p_payload #>> '{payload,baseUpdatedAt}', '');
  v_base_updated_at timestamptz;
  v_existing_updated_at timestamptz;
  v_public_no text;
  v_response jsonb;
  v_claimed boolean := false;
begin
  if not exists (
    select 1
    from public.store_memberships sm
    join public.staff_profiles sp on sp.id = sm.user_id
    join public.stores st on st.id = sm.store_id
    where sm.store_id = p_store_id
      and sm.user_id = p_actor_id
      and sm.status = 'active'
      and sm.role <> 'viewer'
      and sp.status = 'active'
      and st.status = 'active'
  ) then
    return jsonb_build_object('resultCode', 'forbidden');
  end if;

  insert into public.repairdesk_offline_operations (
    store_id,
    actor_id,
    operation_type,
    operation_id,
    request_hash,
    status,
    created_at,
    updated_at
  )
  values (
    p_store_id,
    p_actor_id,
    'order_update',
    p_operation_id,
    p_request_hash,
    'started',
    v_now,
    v_now
  )
  on conflict (store_id, actor_id, operation_type, operation_id) do nothing
  returning true into v_claimed;

  v_claimed := coalesce(v_claimed, false);

  select *
  into v_operation
  from public.repairdesk_offline_operations
  where store_id = p_store_id
    and actor_id = p_actor_id
    and operation_type = 'order_update'
    and operation_id = p_operation_id
  for update;

  if v_operation.request_hash <> p_request_hash then
    return jsonb_build_object('resultCode', 'idempotency_conflict');
  end if;

  if v_operation.status = 'succeeded' then
    return jsonb_build_object(
      'resultCode',
      'idempotent_replay',
      'responseSummary',
      v_operation.response_summary
    );
  end if;

  if v_operation.status in ('conflict', 'blocked') then
    return jsonb_build_object(
      'resultCode',
      coalesce(v_operation.result_code, 'blocked_operation')
    );
  end if;

  if v_operation.status = 'failed' then
    return jsonb_build_object('resultCode', 'retryable_error');
  end if;

  if not v_claimed
     and v_operation.status = 'started'
     and v_operation.updated_at > v_now - interval '5 minutes' then
    return jsonb_build_object('resultCode', 'retryable_error');
  end if;

  begin
    if v_changes is null or v_order_id is null or v_base_updated_at_text is null then
      update public.repairdesk_offline_operations
      set status = 'blocked',
          result_code = 'blocked_operation',
          error_code = 'invalid_payload',
          updated_at = v_now
      where id = v_operation.id;
      return jsonb_build_object('resultCode', 'blocked_operation');
    end if;

    begin
      v_base_updated_at := v_base_updated_at_text::timestamptz;
    exception when others then
      update public.repairdesk_offline_operations
      set status = 'blocked',
          result_code = 'blocked_operation',
          error_code = 'invalid_payload',
          updated_at = v_now
      where id = v_operation.id;
      return jsonb_build_object('resultCode', 'blocked_operation');
    end;

    if v_changes ?| array['device_brand', 'device_model', 'device_imei', 'device_notes'] then
      update public.repairdesk_offline_operations
      set status = 'blocked',
          result_code = 'blocked_operation',
          error_code = 'device_master_update_deferred',
          updated_at = v_now
      where id = v_operation.id;
      return jsonb_build_object('resultCode', 'blocked_operation');
    end if;

    select ro.updated_at, ro.public_no
    into v_existing_updated_at, v_public_no
    from public.repair_orders ro
    where ro.store_id = p_store_id
      and ro.id = v_order_id
    for update;

    if v_existing_updated_at is null then
      update public.repairdesk_offline_operations
      set status = 'blocked',
          result_code = 'forbidden',
          error_code = 'order_not_found',
          updated_at = v_now
      where id = v_operation.id;
      return jsonb_build_object('resultCode', 'forbidden');
    end if;

    if v_existing_updated_at is distinct from v_base_updated_at then
      update public.repairdesk_offline_operations
      set status = 'conflict',
          result_code = 'stale_version',
          error_code = 'base_updated_at_stale',
          updated_at = v_now
      where id = v_operation.id;
      return jsonb_build_object('resultCode', 'stale_version');
    end if;

    update public.repair_orders
    set issue_description = case
          when v_changes ? 'issue_description' then v_changes->>'issue_description'
          else issue_description
        end,
        diagnosis_result = case
          when v_changes ? 'diagnosis_result' then nullif(v_changes->>'diagnosis_result', '')
          else diagnosis_result
        end,
        internal_tag = case
          when v_changes ? 'internal_tag' then nullif(v_changes->>'internal_tag', '')
          else internal_tag
        end,
        accessory_notes = case
          when v_changes ? 'accessory_notes' then nullif(v_changes->>'accessory_notes', '')
          else accessory_notes
        end,
        warranty_text = case
          when v_changes ? 'warranty_text' then nullif(v_changes->>'warranty_text', '')
          else warranty_text
        end,
        warranty_months = case
          when v_changes ? 'warranty_months' then nullif(v_changes->>'warranty_months', '')::integer
          else warranty_months
        end,
        warranty_change_reason = case
          when v_changes ? 'warranty_change_reason' then nullif(v_changes->>'warranty_change_reason', '')
          else warranty_change_reason
        end,
        updated_at = v_now
    where store_id = p_store_id
      and id = v_order_id;

    insert into public.order_events (
      id,
      store_id,
      order_id,
      event_type,
      payload,
      operator_name,
      created_at
    )
    values (
      gen_random_uuid()::text,
      p_store_id,
      v_order_id,
      'note'::public.order_event_type,
      jsonb_build_object('source', 'offline_sync'),
      'offline_sync',
      v_now
    );

    v_response := jsonb_build_object(
      'serverOrderId', v_order_id,
      'publicNo', v_public_no,
      'updatedAt', v_now,
      'resultCode', 'synced'
    );

    update public.repairdesk_offline_operations
    set status = 'succeeded',
        result_code = 'synced',
        target_entity_type = 'repair_order',
        target_entity_id = v_order_id,
        response_summary = v_response,
        error_code = null,
        updated_at = v_now
    where id = v_operation.id;

    return jsonb_build_object('resultCode', 'synced', 'responseSummary', v_response);
  exception when others then
    update public.repairdesk_offline_operations
    set status = 'failed',
        result_code = 'retryable_error',
        error_code = 'transaction_failed',
        response_summary = '{}'::jsonb,
        updated_at = v_now
    where id = v_operation.id;
    return jsonb_build_object('resultCode', 'retryable_error');
  end;
end;
$$;

revoke all on function public.repairdesk_offline_sync_order_create_rpc(uuid, uuid, text, text, jsonb)
  from public;
revoke all on function public.repairdesk_offline_sync_order_create_rpc(uuid, uuid, text, text, jsonb)
  from anon;
revoke all on function public.repairdesk_offline_sync_order_create_rpc(uuid, uuid, text, text, jsonb)
  from authenticated;
grant execute on function public.repairdesk_offline_sync_order_create_rpc(uuid, uuid, text, text, jsonb)
  to service_role;

revoke all on function public.repairdesk_offline_sync_order_update_rpc(uuid, uuid, text, text, jsonb)
  from public;
revoke all on function public.repairdesk_offline_sync_order_update_rpc(uuid, uuid, text, text, jsonb)
  from anon;
revoke all on function public.repairdesk_offline_sync_order_update_rpc(uuid, uuid, text, text, jsonb)
  from authenticated;
grant execute on function public.repairdesk_offline_sync_order_update_rpc(uuid, uuid, text, text, jsonb)
  to service_role;

comment on function public.repairdesk_offline_sync_order_create_rpc(uuid, uuid, text, text, jsonb) is
  'Local approval draft for atomic offline order create replay. Service-role only. Does not persist raw offline payloads.';
comment on function public.repairdesk_offline_sync_order_update_rpc(uuid, uuid, text, text, jsonb) is
  'Local approval draft for atomic offline order update replay. Service-role only. Does not persist raw offline payloads.';
