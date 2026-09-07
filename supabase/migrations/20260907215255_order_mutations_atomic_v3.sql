-- All routine order/customer/finance edits commit with their timeline, audit and receipt.
set lock_timeout = '5s';
set statement_timeout = '60s';

create table public.repairdesk_order_mutation_operations (
  store_id uuid not null references public.stores(id),
  actor_id uuid not null,
  operation_id uuid not null,
  order_id uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  mode text not null check (mode in ('update', 'patch', 'finance')),
  response_summary jsonb not null check (jsonb_typeof(response_summary) = 'object'),
  created_at timestamptz not null default now(),
  primary key (store_id, operation_id),
  foreign key (order_id, store_id) references public.repair_orders(id, store_id)
);
alter table public.repairdesk_order_mutation_operations enable row level security;
revoke all on public.repairdesk_order_mutation_operations from public, anon, authenticated, service_role;
grant select, insert on public.repairdesk_order_mutation_operations to service_role;

create or replace function public.repairdesk_mutate_order_v3(
  p_store_id uuid, p_actor_id uuid, p_order_id uuid,
  p_expected_updated_at timestamptz, p_operation_id uuid, p_request_hash text,
  p_mode text, p_order_changes jsonb, p_customer_changes jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_order public.repair_orders%rowtype;
  v_next public.repair_orders%rowtype;
  v_customer public.customers%rowtype;
  v_receipt public.repairdesk_order_mutation_operations%rowtype;
  v_actor_role text;
  v_actor_name text;
  v_actor_email text;
  v_membership_id uuid;
  v_bucket text;
  v_now timestamptz := clock_timestamp();
  v_item jsonb;
  v_quotation numeric := 0;
  v_deposit numeric;
  v_ledger_paid numeric := 0;
  v_ledger_count bigint := 0;
  v_derived_paid numeric := 0;
  v_paid numeric := 0;
  v_received numeric := 0;
  v_approval_touched boolean;
  v_approval_reset boolean := false;
  v_warranty_changed boolean;
  v_fields jsonb;
  v_summary jsonb;
  v_result jsonb;
begin
  if p_store_id is null or p_actor_id is null or p_order_id is null
     or p_expected_updated_at is null or p_operation_id is null
     or coalesce(p_request_hash, '') !~ '^[0-9a-f]{64}$'
     or p_mode is null or p_mode not in ('update', 'patch', 'finance')
     or jsonb_typeof(p_order_changes) is distinct from 'object'
     or jsonb_typeof(p_customer_changes) is distinct from 'object' then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;

  select sm.id, sm.role::text, coalesce(nullif(sm.display_name, ''), sp.display_name), sp.email
    into v_membership_id, v_actor_role, v_actor_name, v_actor_email
    from public.store_memberships sm
    join public.stores s on s.id = sm.store_id and s.status = 'active'
    join public.staff_profiles sp on sp.id = sm.user_id and sp.status = 'active'
   where sm.store_id = p_store_id and sm.user_id = p_actor_id and sm.status = 'active';
  if v_actor_role is null or v_actor_role not in ('owner', 'manager', 'sales', 'technician')
     or (p_mode in ('finance', 'update') and v_actor_role not in ('owner', 'manager')) then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;

  -- The receipt is only replayable by the original actor and exact target/request.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_store_id::text || ':order-mutation:' || p_operation_id::text, 0));
  select * into v_receipt from public.repairdesk_order_mutation_operations
   where store_id = p_store_id and operation_id = p_operation_id;
  if found then
    if v_receipt.actor_id <> p_actor_id or v_receipt.order_id <> p_order_id
       or v_receipt.request_hash <> p_request_hash or v_receipt.mode <> p_mode then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return v_receipt.response_summary || jsonb_build_object('replayed', true);
  end if;

  if exists (select 1 from jsonb_object_keys(p_order_changes) k where k not in (
    'issue_description', 'diagnosis_result', 'internal_tag', 'accessory_notes',
    'device_unlock_method', 'device_unlock_value', 'device_unlock_pattern', 'device_snapshot',
    'warranty_text', 'warranty_months', 'warranty_change_reason', 'contact_phones',
    'fault_prices', 'quotation_amount', 'deposit_amount', 'parts_supplier_id', 'assignee_membership_id'
  )) or exists (select 1 from jsonb_object_keys(p_customer_changes) k
    where k not in ('name', 'phone_e164', 'phone_raw', 'contact_phones'))
    or (p_mode = 'patch' and p_order_changes ?| array['fault_prices', 'quotation_amount', 'deposit_amount'])
    or (p_mode = 'finance' and (p_customer_changes <> '{}'::jsonb or exists (
      select 1 from jsonb_object_keys(p_order_changes) k where k not in ('fault_prices', 'quotation_amount', 'deposit_amount')
    ))) then
    return jsonb_build_object('ok', false, 'code', 'invalid_fields');
  end if;
  if p_order_changes ? 'assignee_membership_id' and v_actor_role not in ('owner', 'manager') then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;

  -- Match the create-order lock namespace and take phone locks before row locks.
  -- Sorted contact keys avoid opposite-order acquisition for multi-number edits.
  if p_customer_changes ? 'phone_raw' then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(p_store_id::text || ':phone:' || phone_key, 0)
    ) from (
      select distinct value as phone_key from jsonb_array_elements_text(
        coalesce(p_customer_changes -> 'contact_phones', '[]'::jsonb)
        || jsonb_build_array(p_customer_changes ->> 'phone_raw')
      ) order by phone_key
    ) phone_keys;
  end if;

  select * into v_order from public.repair_orders
   where store_id = p_store_id and id = p_order_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'order_not_found'); end if;
  if v_actor_role = 'technician' and v_order.assignee_membership_id is distinct from v_membership_id then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;
  if coalesce(v_order.record_state, 'active') <> 'active' or v_order.deleted_at is not null then
    return jsonb_build_object('ok', false, 'code', 'order_voided');
  end if;
  select bucket into v_bucket from public.order_workflow_statuses
   where store_id = p_store_id and code = v_order.status::text;
  if v_order.status::text in ('completed', 'cancelled') or v_order.exception_status = 'cancelled'
     or v_bucket in ('done', 'cancelled') or (v_bucket is null and v_order.workflow_status = 'closed') then
    return jsonb_build_object('ok', false, 'code', 'order_terminal');
  end if;
  if v_order.updated_at <> p_expected_updated_at then
    return jsonb_build_object('ok', false, 'code', 'stale_version');
  end if;
  if p_order_changes ?| array['device_unlock_method', 'device_unlock_value', 'device_unlock_pattern']
     and v_order.device_custody_status is null then
    return jsonb_build_object('ok', false, 'code', 'custody_required');
  end if;

  select * into v_customer from public.customers
   where store_id = p_store_id and id = v_order.customer_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'customer_not_found'); end if;
  if p_customer_changes ? 'phone_raw' and exists (
    select 1 from public.customers c where c.store_id = p_store_id and c.id <> v_customer.id
      and c.phone_raw = any(array(select jsonb_array_elements_text(
        coalesce(p_customer_changes -> 'contact_phones', '[]'::jsonb) || jsonb_build_array(p_customer_changes ->> 'phone_raw')
      )))
  ) then return jsonb_build_object('ok', false, 'code', 'customer_phone_conflict'); end if;
  v_next := jsonb_populate_record(v_order, p_order_changes);
  if v_next.assignee_membership_id is not null and p_order_changes ? 'assignee_membership_id' then
    select coalesce(nullif(sm.display_name, ''), sp.display_name) into v_next.technician_name
      from public.store_memberships sm join public.staff_profiles sp on sp.id = sm.user_id and sp.status = 'active'
     where sm.id = v_next.assignee_membership_id and sm.store_id = p_store_id
       and sm.status = 'active' and sm.role in ('owner', 'manager', 'sales', 'technician');
    if not found then return jsonb_build_object('ok', false, 'code', 'invalid_assignee'); end if;
  elsif p_order_changes ? 'assignee_membership_id' then v_next.technician_name := '未分配';
  end if;
  if v_next.parts_supplier_id is not null and p_order_changes ? 'parts_supplier_id' and not exists (
    select 1 from public.suppliers where store_id = p_store_id and id = v_next.parts_supplier_id
  ) then return jsonb_build_object('ok', false, 'code', 'invalid_supplier'); end if;

  if p_mode in ('update', 'finance') then
    if jsonb_typeof(p_order_changes -> 'fault_prices') is distinct from 'array'
       or jsonb_array_length(p_order_changes -> 'fault_prices') > 100 then
      return jsonb_build_object('ok', false, 'code', 'invalid_quote_items');
    end if;
    for v_item in select value from jsonb_array_elements(p_order_changes -> 'fault_prices') loop
      if jsonb_typeof(v_item -> 'price') is distinct from 'number'
         or nullif(btrim(v_item ->> 'name'), '') is null
         or (v_item ->> 'price')::numeric < 0 or (v_item ->> 'price')::numeric > 999999.99
         or (v_item ->> 'price')::numeric <> round((v_item ->> 'price')::numeric, 2)
         or coalesce(v_item ->> 'currency_code', 'EUR') <> 'EUR' then
        return jsonb_build_object('ok', false, 'code', 'invalid_quote_items');
      end if;
      v_quotation := v_quotation + (v_item ->> 'price')::numeric;
    end loop;
    v_deposit := coalesce(v_next.deposit_amount, 0);
    if v_deposit < 0 or v_deposit > v_quotation or v_deposit <> round(v_deposit, 2) then
      return jsonb_build_object('ok', false, 'code', 'invalid_deposit');
    end if;
    select coalesce(sum(amount), 0), count(*) into v_ledger_paid, v_ledger_count
      from public.order_payment_ledger where store_id = p_store_id and order_id = p_order_id;
    v_derived_paid := greatest(v_order.quotation_amount - v_order.deposit_amount - v_order.balance_amount, 0);
    v_paid := greatest(v_ledger_paid, v_derived_paid, 0);
    v_received := v_order.deposit_amount + v_paid;
    if v_quotation < v_received then
      return jsonb_build_object('ok', false, 'code', 'quote_below_received_amount');
    end if;
    v_approval_touched := v_order.approval_status::text in ('approved', 'rejected')
      or v_order.approval_flow_status = 'waiting_customer'
      or v_order.approval_sent_at is not null or v_order.approval_confirmed_at is not null;
    if v_deposit <> v_order.deposit_amount and (
      v_ledger_count > 0 or v_derived_paid > 0 or v_approval_touched
      or v_order.balance_amount <> v_order.quotation_amount - v_order.deposit_amount
      or exists (
        select 1 from public.order_initial_deposit_corrections
         where store_id = p_store_id and order_id = p_order_id
      )
    ) then
      return jsonb_build_object('ok', false, 'code', 'deposit_correction_required');
    end if;
    v_next.quotation_amount := v_quotation;
    v_next.balance_amount := v_quotation - v_deposit - v_paid;
    v_next.is_paid := v_next.balance_amount = 0;
    v_next.payment_status := case when v_next.is_paid then 'paid' when v_deposit + v_paid > 0 then 'partial' else 'unpaid' end;
    v_approval_reset := v_approval_touched and (
      v_order.quotation_amount <> v_quotation or v_order.deposit_amount <> v_deposit or v_order.fault_prices <> v_next.fault_prices
    );
    if v_approval_reset then
      v_next.approval_status := 'pending';
      v_next.approval_flow_status := case when v_order.status::text = 'waiting_approval' then 'waiting_customer' else 'not_required' end;
      v_next.approval_sent_at := null;
      v_next.approval_confirmed_at := null;
      if v_order.status::text in ('parts_ordered', 'parts_arrived', 'repairing', 'repaired', 'notified', 'waiting_pickup') then
        v_next.status := 'quoted'; v_next.legacy_status := 'quoted'; v_next.workflow_status := 'quote';
        v_next.exception_status := null; v_next.approval_flow_status := 'not_required';
        v_next.parts_status := 'not_required'; v_next.notify_status := 'not_sent';
        v_next.completed_at := null; v_next.delivered_at := null;
      end if;
    end if;
  end if;
  v_warranty_changed := v_next.warranty_months is distinct from v_order.warranty_months
    or v_next.warranty_text is distinct from v_order.warranty_text
    or v_next.warranty_change_reason is distinct from v_order.warranty_change_reason;

  update public.repair_orders set
    issue_description = v_next.issue_description, diagnosis_result = v_next.diagnosis_result,
    internal_tag = v_next.internal_tag, accessory_notes = v_next.accessory_notes,
    device_unlock_method = v_next.device_unlock_method, device_unlock_value = v_next.device_unlock_value,
    device_unlock_pattern = v_next.device_unlock_pattern, device_snapshot = v_next.device_snapshot,
    warranty_text = v_next.warranty_text, warranty_months = v_next.warranty_months,
    warranty_change_reason = v_next.warranty_change_reason,
    warranty_changed_by = case when v_warranty_changed then p_actor_id else v_order.warranty_changed_by end,
    warranty_changed_at = case when v_warranty_changed then v_now else v_order.warranty_changed_at end,
    contact_phones = v_next.contact_phones, parts_supplier_id = v_next.parts_supplier_id,
    assignee_membership_id = v_next.assignee_membership_id, technician_name = v_next.technician_name,
    fault_prices = v_next.fault_prices, quotation_amount = v_next.quotation_amount,
    deposit_amount = v_next.deposit_amount, balance_amount = v_next.balance_amount,
    is_paid = v_next.is_paid, payment_status = v_next.payment_status,
    approval_status = v_next.approval_status, approval_flow_status = v_next.approval_flow_status,
    approval_sent_at = v_next.approval_sent_at, approval_confirmed_at = v_next.approval_confirmed_at,
    status = v_next.status, legacy_status = v_next.legacy_status, workflow_status = v_next.workflow_status,
    exception_status = v_next.exception_status, parts_status = v_next.parts_status,
    notify_status = v_next.notify_status, completed_at = v_next.completed_at, delivered_at = v_next.delivered_at,
    currency_code = 'EUR', updated_at = v_now
   where store_id = p_store_id and id = p_order_id;
  if p_customer_changes <> '{}'::jsonb then
    v_customer := jsonb_populate_record(v_customer, p_customer_changes);
    update public.customers set name = v_customer.name, phone_e164 = v_customer.phone_e164,
      phone_raw = v_customer.phone_raw, contact_phones = v_customer.contact_phones, updated_at = v_now
      where store_id = p_store_id and id = v_order.customer_id;
  end if;

  select coalesce(jsonb_agg(k order by k), '[]'::jsonb) into v_fields
    from (select jsonb_object_keys(p_order_changes) k union select jsonb_object_keys(p_customer_changes) k) fields;
  v_summary := jsonb_build_object(
    'action', case p_mode when 'update' then 'order_updated' when 'finance' then 'order_finance_updated' else 'order_patched' end,
    'changed_fields', v_fields, 'operation_id', p_operation_id, 'request_hash', p_request_hash,
    'quotation_amount', v_next.quotation_amount, 'deposit_amount', v_next.deposit_amount,
    'balance_amount', v_next.balance_amount, 'approval_reset', v_approval_reset, 'currency_code', 'EUR'
  );
  insert into public.order_events(id, store_id, order_id, event_type, payload, operator_name, created_at)
    values(gen_random_uuid(), p_store_id, p_order_id, 'note', v_summary, v_actor_name, v_now);
  if v_warranty_changed then
    insert into public.order_events(id, store_id, order_id, event_type, payload, operator_name, created_at)
      values(gen_random_uuid(), p_store_id, p_order_id, 'note', jsonb_build_object(
        'action', 'warranty_changed', 'from_months', v_order.warranty_months,
        'to_months', v_next.warranty_months, 'operation_id', p_operation_id
      ), v_actor_name, v_now);
  end if;
  insert into public.audit_logs(id, actor_id, actor_email, actor_name, store_id, action, entity_type, entity_id, metadata, created_at)
    values(gen_random_uuid()::text, p_actor_id, v_actor_email, v_actor_name, p_store_id,
      case when p_mode = 'finance' then 'payment' else 'update' end, 'repair_order', p_order_id::text, v_summary, v_now);
  v_result := jsonb_build_object('ok', true, 'updated_at', v_now, 'replayed', false);
  insert into public.repairdesk_order_mutation_operations(store_id, actor_id, operation_id, order_id, request_hash, mode, response_summary, created_at)
    values(p_store_id, p_actor_id, p_operation_id, p_order_id, p_request_hash, p_mode, v_result, v_now);
  return v_result;
end;
$$;
revoke all on function public.repairdesk_mutate_order_v3(uuid,uuid,uuid,timestamptz,uuid,text,text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.repairdesk_mutate_order_v3(uuid,uuid,uuid,timestamptz,uuid,text,text,jsonb,jsonb) to service_role;

notify pgrst, 'reload schema';
