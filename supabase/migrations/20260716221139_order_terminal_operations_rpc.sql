-- Additive terminal lifecycle operations layered on the current payment guard.
alter table public.order_terminal_operations
  drop constraint if exists order_terminal_operations_type_check;
alter table public.order_terminal_operations
  add constraint order_terminal_operations_type_check
  check (operation_type in ('correction', 'reopen', 'void', 'custody_return'));

create or replace function public.repairdesk_apply_terminal_operation(
  p_store_id uuid,
  p_order_id uuid,
  p_actor_id uuid,
  p_expected_updated_at timestamptz,
  p_idempotency_key uuid,
  p_operation text,
  p_reason text,
  p_changes jsonb default '{}'::jsonb,
  p_to_status text default null,
  p_confirm_public_no text default null
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
  v_target_bucket text;
  v_current_bucket text;
  v_operation_id uuid := gen_random_uuid();
  v_reason text := btrim(coalesce(p_reason, ''));
  v_request_hash text;
  v_before jsonb;
  v_after jsonb;
  v_changed_fields text[] := array[]::text[];
  v_warranty_months integer;
  v_warranty_text text;
  v_warranty_reason text;
  v_now timestamptz := clock_timestamp();
begin
  if p_store_id is null or p_order_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_target');
  end if;
  if p_actor_id is null then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;
  if p_idempotency_key is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_idempotency_key');
  end if;
  if p_expected_updated_at is null then
    return jsonb_build_object('ok', false, 'code', 'missing_expected_version');
  end if;
  if p_operation is null or p_operation not in ('correction', 'reopen', 'void') then
    return jsonb_build_object('ok', false, 'code', 'invalid_state');
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

  if v_actor_role is null
     or (p_operation in ('correction', 'reopen') and v_actor_role not in ('owner', 'manager'))
     or (p_operation = 'void' and v_actor_role <> 'owner') then
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
          'operation', p_operation,
          'reason', v_reason,
          'changes', coalesce(p_changes, '{}'::jsonb),
          'to_status', p_to_status,
          'confirm_public_no', p_confirm_public_no
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
      'order_id', v_existing.order_id,
      'status', v_existing.after_data ->> 'status',
      'record_state', v_existing.after_data ->> 'record_state',
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
    return jsonb_build_object('ok', false, 'code', 'invalid_state');
  end if;
  select status_row.bucket::text
    into v_current_bucket
    from public.order_workflow_statuses as status_row
   where status_row.store_id = p_store_id
     and status_row.code::text = v_order.status::text
   limit 1;
  if v_order.status::text not in ('completed', 'cancelled')
     and coalesce(v_order.exception_status::text, '') <> 'cancelled'
     and (
       (v_current_bucket is not null and v_current_bucket not in ('done', 'cancelled'))
       or (
         v_current_bucket is null
         and coalesce(v_order.workflow_status::text, '') <> 'closed'
       )
     ) then
    return jsonb_build_object('ok', false, 'code', 'invalid_state');
  end if;

  if p_operation = 'correction' then
    if p_changes is null
       or jsonb_typeof(p_changes) <> 'object'
       or p_changes = '{}'::jsonb
       or exists (
         select 1
         from jsonb_object_keys(p_changes) as requested(field)
         where requested.field not in (
           'issue_description',
           'diagnosis_result',
           'internal_tag',
           'accessory_notes',
           'warranty_text',
           'warranty_months',
           'warranty_change_reason'
         )
       ) then
      return jsonb_build_object('ok', false, 'code', 'invalid_changes');
    end if;
    if p_changes ? 'issue_description'
       and char_length(btrim(coalesce(p_changes ->> 'issue_description', ''))) = 0 then
      return jsonb_build_object('ok', false, 'code', 'invalid_changes');
    end if;
    if (p_changes ? 'issue_description' and char_length(p_changes ->> 'issue_description') > 4000)
       or (p_changes ? 'diagnosis_result' and char_length(p_changes ->> 'diagnosis_result') > 8000)
       or (p_changes ? 'internal_tag' and char_length(p_changes ->> 'internal_tag') > 120)
       or (p_changes ? 'accessory_notes' and char_length(p_changes ->> 'accessory_notes') > 1000)
       or (p_changes ? 'warranty_text' and char_length(p_changes ->> 'warranty_text') > 120)
       or (p_changes ? 'warranty_change_reason' and char_length(p_changes ->> 'warranty_change_reason') > 1000) then
      return jsonb_build_object('ok', false, 'code', 'invalid_changes');
    end if;
    if (
      p_changes ? 'warranty_text'
      or p_changes ? 'warranty_months'
      or p_changes ? 'warranty_change_reason'
    ) and not (p_changes ? 'warranty_months') then
      return jsonb_build_object('ok', false, 'code', 'invalid_changes');
    end if;
    if p_changes ? 'warranty_months' then
      if coalesce(p_changes ->> 'warranty_months', '') !~ '^[0-9]+$' then
        return jsonb_build_object('ok', false, 'code', 'invalid_changes');
      end if;
      if (p_changes ->> 'warranty_months')::integer not in (0, 3, 6, 12, 24) then
        return jsonb_build_object('ok', false, 'code', 'invalid_changes');
      end if;
      v_warranty_months := (p_changes ->> 'warranty_months')::integer;
      v_warranty_text := case v_warranty_months
        when 0 then '无保修'
        when 24 then '两年'
        else v_warranty_months::text || '个月'
      end;
      if p_changes ? 'warranty_text'
         and btrim(coalesce(p_changes ->> 'warranty_text', '')) <> v_warranty_text then
        return jsonb_build_object('ok', false, 'code', 'invalid_changes');
      end if;
      v_warranty_reason := coalesce(
        nullif(btrim(coalesce(p_changes ->> 'warranty_change_reason', '')), ''),
        v_reason
      );
    end if;

    v_before := jsonb_build_object(
      'status', v_order.status,
      'record_state', v_order.record_state,
      'issue_description', v_order.issue_description,
      'diagnosis_result', v_order.diagnosis_result,
      'internal_tag', v_order.internal_tag,
      'accessory_notes', v_order.accessory_notes,
      'warranty_text', v_order.warranty_text,
      'warranty_months', v_order.warranty_months,
      'warranty_change_reason', v_order.warranty_change_reason,
      'warranty_changed_by', v_order.warranty_changed_by,
      'warranty_changed_at', v_order.warranty_changed_at
    );
    v_after := v_before;

    if p_changes ? 'issue_description' then
      v_after := v_after || jsonb_build_object('issue_description', btrim(p_changes ->> 'issue_description'));
      v_changed_fields := array_append(v_changed_fields, 'issue_description');
    end if;
    if p_changes ? 'diagnosis_result' then
      v_after := v_after || jsonb_build_object('diagnosis_result', nullif(btrim(coalesce(p_changes ->> 'diagnosis_result', '')), ''));
      v_changed_fields := array_append(v_changed_fields, 'diagnosis_result');
    end if;
    if p_changes ? 'internal_tag' then
      v_after := v_after || jsonb_build_object('internal_tag', nullif(btrim(coalesce(p_changes ->> 'internal_tag', '')), ''));
      v_changed_fields := array_append(v_changed_fields, 'internal_tag');
    end if;
    if p_changes ? 'accessory_notes' then
      v_after := v_after || jsonb_build_object('accessory_notes', nullif(btrim(coalesce(p_changes ->> 'accessory_notes', '')), ''));
      v_changed_fields := array_append(v_changed_fields, 'accessory_notes');
    end if;
    if p_changes ? 'warranty_months' then
      v_after := v_after || jsonb_build_object(
        'warranty_text', v_warranty_text,
        'warranty_months', v_warranty_months,
        'warranty_change_reason', v_warranty_reason,
        'warranty_changed_by', p_actor_id,
        'warranty_changed_at', v_now
      );
      v_changed_fields := v_changed_fields || array[
        'warranty_text',
        'warranty_months',
        'warranty_change_reason',
        'warranty_changed_by',
        'warranty_changed_at'
      ];
    end if;

    if v_after = v_before then
      return jsonb_build_object('ok', false, 'code', 'invalid_changes');
    end if;

    perform pg_catalog.set_config('repairdesk.terminal_operation', 'correction', true);

    update public.repair_orders
       set issue_description = v_after ->> 'issue_description',
           diagnosis_result = v_after ->> 'diagnosis_result',
           internal_tag = v_after ->> 'internal_tag',
           accessory_notes = v_after ->> 'accessory_notes',
           warranty_text = v_after ->> 'warranty_text',
           warranty_months = case
             when v_after -> 'warranty_months' = 'null'::jsonb then null
             else (v_after ->> 'warranty_months')::integer
           end,
           warranty_change_reason = v_after ->> 'warranty_change_reason',
           warranty_changed_by = case
             when p_changes ? 'warranty_months'
             then p_actor_id
             else warranty_changed_by
           end,
           warranty_changed_at = case
             when p_changes ? 'warranty_months'
             then v_now
             else warranty_changed_at
           end,
           updated_at = v_now
     where store_id = p_store_id and id = p_order_id;

    perform pg_catalog.set_config('repairdesk.terminal_operation', '', true);

  elsif p_operation = 'reopen' then
    select status_row.bucket::text
      into v_target_bucket
      from public.order_workflow_statuses as status_row
     where status_row.store_id = p_store_id
       and status_row.code::text = p_to_status
       and status_row.enabled
     limit 1;

    if v_target_bucket is null
       or v_target_bucket not in ('intake', 'diagnosing', 'quote', 'parts', 'repair', 'pickup') then
      return jsonb_build_object('ok', false, 'code', 'invalid_reopen_target');
    end if;

    v_before := jsonb_build_object(
      'status', v_order.status,
      'record_state', v_order.record_state,
      'workflow_status', v_order.workflow_status,
      'exception_status', v_order.exception_status,
      'approval_flow_status', v_order.approval_flow_status,
      'parts_status', v_order.parts_status,
      'notify_status', v_order.notify_status,
      'cancel_reason', v_order.cancel_reason,
      'pause_reason', v_order.pause_reason,
      'completed_at', v_order.completed_at,
      'delivered_at', v_order.delivered_at
    );

    perform pg_catalog.set_config('repairdesk.terminal_operation', 'reopen', true);

    update public.repair_orders
       set status = p_to_status,
           workflow_status = case v_target_bucket
             when 'intake' then 'intake'
             when 'diagnosing' then 'diagnosis'
             when 'quote' then 'quote'
             when 'parts' then 'parts'
             when 'repair' then 'repair'
             when 'pickup' then 'pickup'
           end,
           exception_status = case p_to_status
             when 'rework' then 'rework'
             when 'unfixed_pickup' then 'returned_unfixed'
             else null
           end,
           approval_flow_status = case when p_to_status = 'waiting_approval' then 'waiting_customer' else 'not_required' end,
           parts_status = case when p_to_status = 'parts_ordered' then 'ordered' when p_to_status = 'parts_arrived' then 'arrived' else 'not_required' end,
           notify_status = case when p_to_status in ('notified', 'waiting_pickup') then 'sent' else 'not_sent' end,
           completed_at = null,
           delivered_at = null,
           cancel_reason = null,
           pause_reason = null,
           updated_at = v_now
     where store_id = p_store_id and id = p_order_id;

    perform pg_catalog.set_config('repairdesk.terminal_operation', '', true);

    v_after := jsonb_build_object(
      'status', p_to_status,
      'record_state', 'active',
      'workflow_status', case v_target_bucket
        when 'intake' then 'intake'
        when 'diagnosing' then 'diagnosis'
        when 'quote' then 'quote'
        when 'parts' then 'parts'
        when 'repair' then 'repair'
        when 'pickup' then 'pickup'
      end,
      'exception_status', case p_to_status
        when 'rework' then 'rework'
        when 'unfixed_pickup' then 'returned_unfixed'
        else null
      end,
      'approval_flow_status', case when p_to_status = 'waiting_approval' then 'waiting_customer' else 'not_required' end,
      'parts_status', case when p_to_status = 'parts_ordered' then 'ordered' when p_to_status = 'parts_arrived' then 'arrived' else 'not_required' end,
      'notify_status', case when p_to_status in ('notified', 'waiting_pickup') then 'sent' else 'not_sent' end,
      'cancel_reason', null,
      'pause_reason', null,
      'completed_at', null,
      'delivered_at', null
    );
    v_changed_fields := array[
      'status',
      'workflow_status',
      'exception_status',
      'approval_flow_status',
      'parts_status',
      'notify_status',
      'cancel_reason',
      'pause_reason',
      'completed_at',
      'delivered_at'
    ];

  else
    if btrim(coalesce(p_confirm_public_no, '')) <> v_order.public_no then
      return jsonb_build_object('ok', false, 'code', 'invalid_confirmation');
    end if;
    if v_order.is_paid
       or coalesce(v_order.deposit_amount, 0) <> 0
       or coalesce(v_order.quotation_amount, 0) < 0
       or coalesce(v_order.balance_amount, 0) < 0
       or coalesce(v_order.quotation_amount, 0) <> coalesce(v_order.balance_amount, 0)
       or coalesce(v_order.payment_status, 'unpaid') <> 'unpaid'
       or exists (
         select 1 from public.order_payment_ledger ledger
         where ledger.store_id = p_store_id and ledger.order_id = p_order_id
       ) then
      return jsonb_build_object('ok', false, 'code', 'financial_history_requires_resolution');
    end if;

    v_before := jsonb_build_object(
      'status', v_order.status,
      'record_state', v_order.record_state,
      'deleted_at', v_order.deleted_at,
      'voided_at', v_order.voided_at,
      'voided_by', v_order.voided_by,
      'void_reason', v_order.void_reason
    );

    perform pg_catalog.set_config('repairdesk.terminal_operation', 'void', true);

    update public.repair_orders
       set record_state = 'voided',
           voided_at = v_now,
           voided_by = p_actor_id,
           void_reason = v_reason,
           deleted_at = v_now,
           updated_at = v_now
     where store_id = p_store_id and id = p_order_id;

    perform pg_catalog.set_config('repairdesk.terminal_operation', '', true);

    v_after := jsonb_build_object(
      'status', v_order.status,
      'record_state', 'voided',
      'deleted_at', v_now,
      'voided_at', v_now,
      'voided_by', p_actor_id,
      'void_reason', v_reason
    );
    v_changed_fields := array[
      'record_state',
      'deleted_at',
      'voided_at',
      'voided_by',
      'void_reason'
    ];
  end if;

  insert into public.order_terminal_operations (
    id,
    store_id,
    order_id,
    idempotency_key,
    operation_type,
    request_hash,
    actor_id,
    actor_name_snapshot,
    actor_role_snapshot,
    reason,
    before_data,
    after_data,
    order_updated_at_before,
    order_updated_at_after,
    created_at
  ) values (
    v_operation_id,
    p_store_id,
    p_order_id,
    p_idempotency_key,
    p_operation,
    v_request_hash,
    p_actor_id,
    v_actor_name,
    v_actor_role,
    v_reason,
    v_before,
    v_after,
    v_order.updated_at,
    v_now,
    v_now
  );

  insert into public.order_events (
    id, store_id, order_id, event_type, payload, operator_name, created_at
  ) values (
    gen_random_uuid(),
    p_store_id,
    p_order_id,
    case when p_operation = 'reopen' then 'status_changed' else 'note' end,
    jsonb_build_object(
      'action', 'terminal_' || p_operation,
      'operation_id', v_operation_id,
      'reason', v_reason,
      'changed_fields', to_jsonb(v_changed_fields),
      'from_status', v_before ->> 'status',
      'to_status', v_after ->> 'status'
    ),
    v_actor_name,
    v_now
  );

  insert into public.audit_logs (
    id,
    actor_id,
    actor_email,
    actor_name,
    store_id,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data,
    metadata,
    created_at
  ) values (
    gen_random_uuid()::text,
    p_actor_id,
    v_actor_email,
    v_actor_name,
    p_store_id,
    'order_terminal_' || p_operation,
    'repair_order',
    p_order_id::text,
    v_before,
    v_after,
    jsonb_build_object('operation_id', v_operation_id, 'reason', v_reason),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'code', 'recorded',
    'operation_id', v_operation_id,
    'order_id', p_order_id,
    'status', v_after ->> 'status',
    'record_state', v_after ->> 'record_state',
    'updated_at', v_now
  );
end;
$$;

create or replace function public.repairdesk_correct_terminal_order(
  p_store_id uuid,
  p_order_id uuid,
  p_actor_id uuid,
  p_expected_updated_at timestamptz,
  p_idempotency_key uuid,
  p_changes jsonb,
  p_reason text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select public.repairdesk_apply_terminal_operation(
    p_store_id,
    p_order_id,
    p_actor_id,
    p_expected_updated_at,
    p_idempotency_key,
    'correction',
    p_reason,
    p_changes,
    null,
    null
  );
$$;

create or replace function public.repairdesk_reopen_terminal_order(
  p_store_id uuid,
  p_order_id uuid,
  p_actor_id uuid,
  p_expected_updated_at timestamptz,
  p_idempotency_key uuid,
  p_to_status text,
  p_reason text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select public.repairdesk_apply_terminal_operation(
    p_store_id,
    p_order_id,
    p_actor_id,
    p_expected_updated_at,
    p_idempotency_key,
    'reopen',
    p_reason,
    '{}'::jsonb,
    p_to_status,
    null
  );
$$;

create or replace function public.repairdesk_void_order(
  p_store_id uuid,
  p_order_id uuid,
  p_actor_id uuid,
  p_expected_updated_at timestamptz,
  p_idempotency_key uuid,
  p_reason text,
  p_confirm_public_no text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select public.repairdesk_apply_terminal_operation(
    p_store_id,
    p_order_id,
    p_actor_id,
    p_expected_updated_at,
    p_idempotency_key,
    'void',
    p_reason,
    '{}'::jsonb,
    null,
    p_confirm_public_no
  );
$$;

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
  v_request_hash text;
  v_before jsonb;
  v_after jsonb;
  v_now timestamptz := clock_timestamp();
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

  select order_row.*
    into v_order
    from public.repair_orders as order_row
   where order_row.store_id = p_store_id
     and order_row.id = p_order_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'order_not_found');
  end if;
  if v_actor_role is null
     or (
       v_actor_role not in ('owner', 'manager', 'sales')
       and not (
         v_actor_role = 'technician'
         and v_order.assignee_membership_id = v_membership_id
       )
     ) then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;
  if v_order.record_state <> 'active'
     or v_order.deleted_at is not null
     or v_order.status::text <> 'cancelled' then
    return jsonb_build_object('ok', false, 'code', 'invalid_state');
  end if;
  if v_order.delivered_at is not null then
    return jsonb_build_object(
      'ok', true,
      'code', 'idempotent_replay',
      'already_confirmed', true,
      'delivered_at', v_order.delivered_at,
      'updated_at', v_order.updated_at
    );
  end if;
  if v_order.updated_at <> p_expected_updated_at then
    return jsonb_build_object('ok', false, 'code', 'stale_version');
  end if;

  v_before := jsonb_build_object(
    'status', v_order.status,
    'record_state', v_order.record_state,
    'completed_at', v_order.completed_at,
    'delivered_at', v_order.delivered_at
  );
  v_after := v_before || jsonb_build_object(
    'completed_at', coalesce(v_order.completed_at, v_now),
    'delivered_at', v_now
  );

  perform pg_catalog.set_config('repairdesk.terminal_operation', 'custody_return', true);

  update public.repair_orders
     set completed_at = coalesce(completed_at, v_now),
         delivered_at = v_now,
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
    'status_changed',
    jsonb_build_object(
      'from', 'cancelled',
      'to', 'cancelled',
      'action', 'custody_return_confirmed',
      'handover_confirmed', true,
      'custody_outcome', 'returned',
      'idempotency_key', p_idempotency_key
    ),
    v_actor_name,
    v_now
  );

  insert into public.order_terminal_operations (
    id,
    store_id,
    order_id,
    idempotency_key,
    operation_type,
    request_hash,
    actor_id,
    actor_name_snapshot,
    actor_role_snapshot,
    reason,
    before_data,
    after_data,
    order_updated_at_before,
    order_updated_at_after,
    created_at
  ) values (
    v_operation_id,
    p_store_id,
    p_order_id,
    p_idempotency_key,
    'custody_return',
    v_request_hash,
    p_actor_id,
    v_actor_name,
    v_actor_role,
    '确认取消工单设备已退还',
    v_before,
    v_after,
    v_order.updated_at,
    v_now,
    v_now
  );

  insert into public.audit_logs (
    id,
    actor_id,
    actor_email,
    actor_name,
    store_id,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data,
    metadata,
    created_at
  ) values (
    gen_random_uuid()::text,
    p_actor_id,
    v_actor_email,
    v_actor_name,
    p_store_id,
    'order_custody_return_confirmed',
    'repair_order',
    p_order_id::text,
    v_before,
    v_after,
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

create or replace function public.repairdesk_protect_voided_order()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (
    old.record_state = 'active'
    and old.deleted_at is null
    and (
      old.status::text in ('completed', 'cancelled')
      or coalesce(old.exception_status::text, '') = 'cancelled'
      or exists (
        select 1
        from public.order_workflow_statuses as status_row
        where status_row.store_id = old.store_id
          and status_row.code::text = old.status::text
          and status_row.bucket::text in ('done', 'cancelled')
      )
      or (
        coalesce(old.workflow_status::text, '') = 'closed'
        and not exists (
          select 1
          from public.order_workflow_statuses as status_row
          where status_row.store_id = old.store_id
            and status_row.code::text = old.status::text
        )
      )
    )
    and not (
      current_user = 'service_role'
      and coalesce(pg_catalog.current_setting('repairdesk.terminal_operation', true), '')
        in ('correction', 'reopen', 'void', 'custody_return')
    )
    and (
      new.issue_description is distinct from old.issue_description
      or new.diagnosis_result is distinct from old.diagnosis_result
      or new.internal_tag is distinct from old.internal_tag
      or new.accessory_notes is distinct from old.accessory_notes
      or new.warranty_text is distinct from old.warranty_text
      or new.warranty_months is distinct from old.warranty_months
      or new.warranty_change_reason is distinct from old.warranty_change_reason
      or new.status is distinct from old.status
      or new.workflow_status is distinct from old.workflow_status
      or new.exception_status is distinct from old.exception_status
      or new.completed_at is distinct from old.completed_at
      or new.delivered_at is distinct from old.delivered_at
    )
  ) then
    raise exception using
      message = 'terminal orders require audited correction or reopen operations',
      errcode = 'P0001';
  end if;
  if old.record_state = 'active'
     and new.record_state = 'voided'
     and not (
       current_user = 'service_role'
       and coalesce(pg_catalog.current_setting('repairdesk.terminal_operation', true), '') = 'void'
     ) then
    raise exception using
      message = 'voiding an order requires the audited terminal operation',
      errcode = 'P0001';
  end if;
  if old.record_state = 'voided'
     and to_jsonb(new) is distinct from to_jsonb(old) then
    raise exception using
      message = 'voided order records are immutable',
      errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function public.repairdesk_protect_terminal_order_data_batch()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'applying'
     and old.status is distinct from new.status
     and exists (
       select 1
       from public.order_data_batch_rows as batch_row
       join public.repair_orders as order_row
         on order_row.id = batch_row.order_id
        and order_row.store_id = new.store_id
       where batch_row.batch_id = new.id
         and batch_row.action = 'update'
         and batch_row.status = 'ready'
         and (
           order_row.record_state = 'voided'
           or order_row.deleted_at is not null
           or order_row.status::text in ('completed', 'cancelled')
           or order_row.exception_status = 'cancelled'
           or exists (
             select 1
             from public.order_workflow_statuses as status_row
             where status_row.store_id = order_row.store_id
               and status_row.code::text = order_row.status::text
               and status_row.bucket::text in ('done', 'cancelled')
           )
           or (
             order_row.workflow_status = 'closed'
             and not exists (
               select 1
               from public.order_workflow_statuses as status_row
               where status_row.store_id = order_row.store_id
                 and status_row.code::text = order_row.status::text
             )
           )
         )
     ) then
    raise exception using
      message = 'terminal orders require audited correction or reopen operations',
      errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists repairdesk_protect_voided_order_trigger on public.repair_orders;
create trigger repairdesk_protect_voided_order_trigger
before update on public.repair_orders
for each row execute function public.repairdesk_protect_voided_order();

drop trigger if exists repairdesk_protect_terminal_order_data_batch_trigger
  on public.order_data_batches;
create trigger repairdesk_protect_terminal_order_data_batch_trigger
before update of status on public.order_data_batches
for each row execute function public.repairdesk_protect_terminal_order_data_batch();

revoke all on function public.repairdesk_apply_terminal_operation(
  uuid, uuid, uuid, timestamptz, uuid, text, text, jsonb, text, text
) from public, anon, authenticated;
revoke all on function public.repairdesk_correct_terminal_order(
  uuid, uuid, uuid, timestamptz, uuid, jsonb, text
) from public, anon, authenticated;
revoke all on function public.repairdesk_reopen_terminal_order(
  uuid, uuid, uuid, timestamptz, uuid, text, text
) from public, anon, authenticated;
revoke all on function public.repairdesk_void_order(
  uuid, uuid, uuid, timestamptz, uuid, text, text
) from public, anon, authenticated;

grant execute on function public.repairdesk_apply_terminal_operation(
  uuid, uuid, uuid, timestamptz, uuid, text, text, jsonb, text, text
) to service_role;
grant execute on function public.repairdesk_correct_terminal_order(
  uuid, uuid, uuid, timestamptz, uuid, jsonb, text
) to service_role;
grant execute on function public.repairdesk_reopen_terminal_order(
  uuid, uuid, uuid, timestamptz, uuid, text, text
) to service_role;
grant execute on function public.repairdesk_void_order(
  uuid, uuid, uuid, timestamptz, uuid, text, text
) to service_role;
revoke all on function public.repairdesk_confirm_cancelled_order_return(
  uuid, uuid, uuid, timestamptz, uuid
) from public, anon, authenticated;
grant execute on function public.repairdesk_confirm_cancelled_order_return(
  uuid, uuid, uuid, timestamptz, uuid
) to service_role;

revoke all on function public.repairdesk_protect_voided_order() from public, anon, authenticated;
revoke all on function public.repairdesk_protect_terminal_order_data_batch()
  from public, anon, authenticated;
