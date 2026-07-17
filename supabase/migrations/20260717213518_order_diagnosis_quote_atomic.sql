-- Atomic unknown-intake diagnosis, quote publication, and confirmed-send workflow.
set lock_timeout = '5s';
set statement_timeout = '60s';

alter table public.message_logs
  add column if not exists channel text not null default 'whatsapp';

create unique index if not exists order_events_quote_idempotency_idx
  on public.order_events (
    store_id,
    event_type,
    ((payload ->> 'idempotency_key'))
  )
  where event_type in ('quoted', 'approval_sent')
    and payload ? 'idempotency_key';

create or replace function public.repairdesk_publish_order_quote(
  p_store_id uuid,
  p_order_id text,
  p_actor_id uuid,
  p_expected_updated_at timestamptz,
  p_idempotency_key uuid,
  p_diagnosis_result text,
  p_fault_prices jsonb,
  p_price_exception_kind text default null,
  p_price_exception_reason text default null
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
  v_order public.repair_orders%rowtype;
  v_existing public.order_events%rowtype;
  v_latest_quote public.order_events%rowtype;
  v_item jsonb;
  v_name text;
  v_note text;
  v_price numeric(12, 2);
  v_fault_prices jsonb := '[]'::jsonb;
  v_diagnosis text := btrim(coalesce(p_diagnosis_result, ''));
  v_exception_kind text := nullif(btrim(coalesce(p_price_exception_kind, '')), '');
  v_exception_reason text := nullif(btrim(coalesce(p_price_exception_reason, '')), '');
  v_has_zero boolean := false;
  v_quotation numeric(12, 2) := 0;
  v_ledger_paid numeric(12, 2) := 0;
  v_derived_paid numeric(12, 2) := 0;
  v_paid_amount numeric(12, 2) := 0;
  v_received numeric(12, 2) := 0;
  v_balance numeric(12, 2) := 0;
  v_payment_status text;
  v_approval_reset boolean := false;
  v_current_bucket text;
  v_quote_event_id uuid := gen_random_uuid();
  v_now timestamptz := clock_timestamp();
  v_quote_fingerprint text;
  v_request_fingerprint text;
begin
  if p_store_id is null or nullif(btrim(coalesce(p_order_id, '')), '') is null then
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
  if char_length(v_diagnosis) < 1 or char_length(v_diagnosis) > 8000 then
    return jsonb_build_object('ok', false, 'code', 'invalid_diagnosis');
  end if;
  if jsonb_typeof(p_fault_prices) is distinct from 'array'
     or jsonb_array_length(p_fault_prices) < 1
     or jsonb_array_length(p_fault_prices) > 50 then
    return jsonb_build_object('ok', false, 'code', 'invalid_quote_items');
  end if;

  for v_item in select value from jsonb_array_elements(p_fault_prices)
  loop
    if jsonb_typeof(v_item) is distinct from 'object'
       or exists (
         select 1
           from jsonb_object_keys(v_item) as item_key(key_name)
          where key_name not in ('name', 'price', 'currency_code', 'note')
       )
       or jsonb_typeof(v_item -> 'name') is distinct from 'string'
       or jsonb_typeof(v_item -> 'price') is distinct from 'number'
       or (
         v_item ? 'currency_code'
         and jsonb_typeof(v_item -> 'currency_code') is distinct from 'string'
       )
       or (
         v_item ? 'note'
         and jsonb_typeof(v_item -> 'note') not in ('string', 'null')
       ) then
      return jsonb_build_object('ok', false, 'code', 'invalid_quote_items');
    end if;

    v_name := btrim(v_item ->> 'name');
    v_note := nullif(btrim(coalesce(v_item ->> 'note', '')), '');
    v_price := (v_item ->> 'price')::numeric;
    if char_length(v_name) < 1
       or char_length(v_name) > 120
       or coalesce(char_length(v_note), 0) > 500
       or coalesce(v_item ->> 'currency_code', 'EUR') <> 'EUR'
       or v_price < 0
       or v_price > 999999.99
       or v_price <> round(v_price, 2) then
      return jsonb_build_object('ok', false, 'code', 'invalid_quote_items');
    end if;

    v_fault_prices := v_fault_prices || jsonb_build_array(
      jsonb_strip_nulls(
        jsonb_build_object(
          'name', v_name,
          'price', v_price,
          'currency_code', 'EUR',
          'note', v_note
        )
      )
    );
    v_quotation := v_quotation + v_price;
    v_has_zero := v_has_zero or v_price = 0;
  end loop;

  if v_has_zero then
    if v_exception_kind not in ('free', 'warranty', 'diagnostic_only')
       or coalesce(char_length(v_exception_reason), 0) < 4
       or char_length(v_exception_reason) > 1000 then
      return jsonb_build_object('ok', false, 'code', 'invalid_price_exception');
    end if;
  elsif v_exception_kind is not null or v_exception_reason is not null then
    return jsonb_build_object('ok', false, 'code', 'unexpected_price_exception');
  end if;

  select profile.email,
         coalesce(membership.display_name, profile.display_name),
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

  if v_actor_role is null or v_actor_role not in ('owner', 'manager', 'sales') then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;

  v_quote_fingerprint := pg_catalog.md5(
    jsonb_build_object(
      'diagnosis_result', v_diagnosis,
      'fault_prices', v_fault_prices,
      'price_exception_kind', v_exception_kind,
      'price_exception_reason', v_exception_reason
    )::text
  );
  v_request_fingerprint := pg_catalog.md5(
    jsonb_build_object(
      'actor_id', p_actor_id,
      'order_id', p_order_id,
      'expected_updated_at', p_expected_updated_at,
      'quote_fingerprint', v_quote_fingerprint
    )::text
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_store_id::text || ':quote:' || p_idempotency_key::text, 0)
  );

  select event_row.*
   into v_existing
    from public.order_events as event_row
   where event_row.store_id = p_store_id
     and event_row.event_type::text = 'quoted'
     and event_row.payload ->> 'idempotency_key' = p_idempotency_key::text
   order by event_row.created_at desc
   limit 1;

  if found then
    if v_existing.payload ->> 'request_fingerprint' is distinct from v_request_fingerprint then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return jsonb_build_object(
      'ok', true,
      'code', 'idempotent_replay',
      'quote_event_id', v_existing.id,
      'updated_at', v_existing.payload ->> 'updated_at_after',
      'quotation_amount', (v_existing.payload ->> 'quotation_amount')::numeric,
      'deposit_amount', (v_existing.payload ->> 'deposit_amount')::numeric,
      'paid_amount', (v_existing.payload ->> 'paid_amount')::numeric,
      'balance_amount', (v_existing.payload ->> 'balance_amount')::numeric,
      'is_paid', (v_existing.payload ->> 'is_paid')::boolean,
      'payment_status', v_existing.payload ->> 'payment_status',
      'status', v_existing.payload ->> 'to',
      'approval_status', 'pending',
      'approval_flow_status', 'not_required',
      'approval_reset', coalesce((v_existing.payload ->> 'approval_reset')::boolean, false)
    );
  end if;

  select order_row.*
    into v_order
    from public.repair_orders as order_row
   where order_row.store_id = p_store_id
     and order_row.id::text = p_order_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'order_not_found');
  end if;
  if v_order.updated_at <> p_expected_updated_at then
    return jsonb_build_object('ok', false, 'code', 'stale_version');
  end if;
  if coalesce(v_order.record_state::text, 'active') = 'voided' or v_order.deleted_at is not null then
    return jsonb_build_object('ok', false, 'code', 'order_voided');
  end if;

  select status_row.bucket
    into v_current_bucket
    from public.order_workflow_statuses as status_row
   where status_row.store_id = p_store_id
     and status_row.code = v_order.status::text
     and status_row.enabled = true
   limit 1;

  if v_current_bucket is null or v_current_bucket in ('done', 'cancelled') then
    return jsonb_build_object('ok', false, 'code', 'invalid_state');
  end if;
  if not exists (
    select 1
      from public.order_workflow_statuses as target_status
     where target_status.store_id = p_store_id
       and target_status.code = 'quoted'
       and target_status.enabled = true
       and target_status.bucket = 'quote'
  ) then
    return jsonb_build_object('ok', false, 'code', 'invalid_transition');
  end if;
  if v_current_bucket <> 'quote' and not exists (
    select 1
      from public.order_workflow_transitions as transition_row
     where transition_row.store_id = p_store_id
       and transition_row.from_status_code = v_order.status::text
       and transition_row.to_status_code = 'quoted'
       and transition_row.enabled = true
  ) then
    return jsonb_build_object('ok', false, 'code', 'invalid_transition');
  end if;

  select event_row.*
    into v_latest_quote
    from public.order_events as event_row
   where event_row.store_id = p_store_id
     and event_row.order_id::text = p_order_id
     and event_row.event_type::text = 'quoted'
     and event_row.payload ->> 'action' = 'quote_published'
   order by event_row.created_at desc
   limit 1;

  if found
     and v_current_bucket = 'quote'
     and v_latest_quote.payload ->> 'quote_fingerprint' = v_quote_fingerprint
     and btrim(coalesce(v_order.diagnosis_result, '')) = v_diagnosis
     and v_order.fault_prices = v_fault_prices
     and v_order.quotation_amount = v_quotation then
    return jsonb_build_object(
      'ok', true,
      'code', 'already_published',
      'quote_event_id', v_latest_quote.id,
      'updated_at', v_order.updated_at,
      'quotation_amount', v_order.quotation_amount,
      'deposit_amount', v_order.deposit_amount,
      'paid_amount', greatest(0, v_order.quotation_amount - v_order.deposit_amount - v_order.balance_amount),
      'balance_amount', v_order.balance_amount,
      'is_paid', v_order.is_paid,
      'payment_status', v_order.payment_status,
      'status', v_order.status,
      'approval_status', v_order.approval_status,
      'approval_flow_status', v_order.approval_flow_status,
      'approval_reset', false
    );
  end if;

  select coalesce(sum(ledger.amount), 0)
    into v_ledger_paid
    from public.order_payment_ledger as ledger
   where ledger.store_id = p_store_id
     and ledger.order_id::text = p_order_id;

  v_derived_paid := greatest(
    0,
    v_order.quotation_amount - v_order.deposit_amount - v_order.balance_amount
  );
  v_paid_amount := greatest(v_ledger_paid, v_derived_paid);
  v_received := v_order.deposit_amount + v_paid_amount;
  if v_quotation < v_received then
    return jsonb_build_object(
      'ok', false,
      'code', 'quote_below_received_amount',
      'received_amount', v_received
    );
  end if;

  v_balance := v_quotation - v_received;
  v_payment_status := case
    when v_balance = 0 then 'paid'
    when v_received > 0 then 'partial'
    else 'unpaid'
  end;
  v_approval_reset :=
    v_order.approval_status::text <> 'pending'
    or coalesce(v_order.approval_flow_status, 'not_required') <> 'not_required'
    or v_order.approval_sent_at is not null
    or v_order.approval_confirmed_at is not null;

  update public.repair_orders
     set diagnosis_result = v_diagnosis,
         fault_prices = v_fault_prices,
         quotation_amount = v_quotation,
         balance_amount = v_balance,
         is_paid = v_balance = 0,
         payment_status = v_payment_status,
         currency_code = 'EUR',
         status = 'quoted',
         legacy_status = 'quoted',
         workflow_status = 'quote',
         approval_status = 'pending',
         approval_flow_status = 'not_required',
         approval_sent_at = null,
         approval_confirmed_at = null,
         notify_status = 'not_sent',
         updated_at = v_now
   where store_id = p_store_id
     and id::text = p_order_id;

  insert into public.order_events (
    id, store_id, order_id, event_type, payload, operator_name, created_at
  ) values (
    v_quote_event_id,
    p_store_id,
    p_order_id::uuid,
    'quoted',
    jsonb_build_object(
      'action', 'quote_published',
      'idempotency_key', p_idempotency_key,
      'request_fingerprint', v_request_fingerprint,
      'quote_fingerprint', v_quote_fingerprint,
      'diagnosis_hash', pg_catalog.md5(v_diagnosis),
      'fault_prices_hash', pg_catalog.md5(v_fault_prices::text),
      'updated_at_before', p_expected_updated_at,
      'updated_at_after', v_now,
      'quotation_amount', v_quotation,
      'deposit_amount', v_order.deposit_amount,
      'paid_amount', v_paid_amount,
      'balance_amount', v_balance,
      'is_paid', v_balance = 0,
      'payment_status', v_payment_status,
      'item_count', jsonb_array_length(v_fault_prices),
      'price_exception_kind', v_exception_kind,
      'approval_reset', v_approval_reset,
      'from', v_order.status,
      'to', 'quoted',
      'currency_code', 'EUR'
    ),
    v_actor_name,
    v_now
  );

  insert into public.audit_logs (
    id, actor_id, actor_email, actor_name, store_id,
    action, entity_type, entity_id, metadata, created_at
  ) values (
    gen_random_uuid()::text,
    p_actor_id,
    v_actor_email,
    v_actor_name,
    p_store_id,
    'quote_publish',
    'repair_order',
    p_order_id,
    jsonb_build_object(
      'quote_event_id', v_quote_event_id,
      'quotation_amount', v_quotation,
      'item_count', jsonb_array_length(v_fault_prices),
      'approval_reset', v_approval_reset
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'code', 'published',
    'quote_event_id', v_quote_event_id,
    'updated_at', v_now,
    'quotation_amount', v_quotation,
    'deposit_amount', v_order.deposit_amount,
    'paid_amount', v_paid_amount,
    'balance_amount', v_balance,
    'is_paid', v_balance = 0,
    'payment_status', v_payment_status,
    'status', 'quoted',
    'approval_status', 'pending',
    'approval_flow_status', 'not_required',
    'approval_reset', v_approval_reset
  );
end;
$$;

create or replace function public.repairdesk_confirm_order_quote_sent(
  p_store_id uuid,
  p_order_id text,
  p_actor_id uuid,
  p_quote_event_id text,
  p_expected_updated_at timestamptz,
  p_idempotency_key uuid,
  p_message_body text
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
  v_order public.repair_orders%rowtype;
  v_existing public.order_events%rowtype;
  v_quote public.order_events%rowtype;
  v_message text := btrim(coalesce(p_message_body, ''));
  v_message_id uuid := gen_random_uuid();
  v_event_id uuid := gen_random_uuid();
  v_now timestamptz := clock_timestamp();
  v_request_fingerprint text;
begin
  if p_store_id is null
     or nullif(btrim(coalesce(p_order_id, '')), '') is null
     or nullif(btrim(coalesce(p_quote_event_id, '')), '') is null then
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
  if char_length(v_message) < 1 or char_length(v_message) > 8000 then
    return jsonb_build_object('ok', false, 'code', 'invalid_message');
  end if;

  select profile.email,
         coalesce(membership.display_name, profile.display_name),
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

  if v_actor_role is null or v_actor_role not in ('owner', 'manager', 'sales') then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;

  v_request_fingerprint := pg_catalog.md5(
    jsonb_build_object(
      'actor_id', p_actor_id,
      'order_id', p_order_id,
      'quote_event_id', p_quote_event_id,
      'expected_updated_at', p_expected_updated_at,
      'message_hash', pg_catalog.md5(v_message)
    )::text
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_store_id::text || ':quote-send:' || p_idempotency_key::text, 0)
  );

  select event_row.*
   into v_existing
    from public.order_events as event_row
   where event_row.store_id = p_store_id
     and event_row.event_type::text = 'approval_sent'
     and event_row.payload ->> 'idempotency_key' = p_idempotency_key::text
   order by event_row.created_at desc
   limit 1;

  if found then
    if v_existing.payload ->> 'request_fingerprint' is distinct from v_request_fingerprint then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return jsonb_build_object(
      'ok', true,
      'code', 'idempotent_replay',
      'message_id', v_existing.payload ->> 'message_id',
      'quote_event_id', v_existing.payload ->> 'quote_event_id',
      'updated_at', v_existing.payload ->> 'updated_at_after',
      'from', v_existing.payload ->> 'from',
      'to', v_existing.payload ->> 'to'
    );
  end if;

  select order_row.*
    into v_order
    from public.repair_orders as order_row
   where order_row.store_id = p_store_id
     and order_row.id::text = p_order_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'order_not_found');
  end if;
  if v_order.updated_at <> p_expected_updated_at then
    return jsonb_build_object('ok', false, 'code', 'stale_version');
  end if;
  if coalesce(v_order.record_state::text, 'active') = 'voided' or v_order.deleted_at is not null then
    return jsonb_build_object('ok', false, 'code', 'order_voided');
  end if;
  if v_order.status::text <> 'quoted' then
    return jsonb_build_object('ok', false, 'code', 'invalid_state');
  end if;

  select event_row.*
    into v_quote
    from public.order_events as event_row
   where event_row.store_id = p_store_id
     and event_row.order_id::text = p_order_id
     and event_row.event_type::text = 'quoted'
     and event_row.payload ->> 'action' = 'quote_published'
   order by event_row.created_at desc
   limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'quote_not_found');
  end if;
  if v_quote.id::text <> p_quote_event_id then
    return jsonb_build_object('ok', false, 'code', 'quote_outdated');
  end if;
  if v_quote.payload ->> 'diagnosis_hash' is distinct from pg_catalog.md5(
       btrim(coalesce(v_order.diagnosis_result, ''))
     )
     or v_quote.payload ->> 'fault_prices_hash' is distinct from pg_catalog.md5(v_order.fault_prices::text)
     or (v_quote.payload ->> 'quotation_amount')::numeric <> v_order.quotation_amount
     or (v_quote.payload ->> 'deposit_amount')::numeric <> v_order.deposit_amount
     or (v_quote.payload ->> 'balance_amount')::numeric <> v_order.balance_amount then
    return jsonb_build_object('ok', false, 'code', 'quote_changed');
  end if;
  if not exists (
    select 1
      from public.order_workflow_statuses as target_status
     where target_status.store_id = p_store_id
       and target_status.code = 'waiting_approval'
       and target_status.enabled = true
       and target_status.bucket = 'quote'
  ) or not exists (
    select 1
      from public.order_workflow_transitions as transition_row
     where transition_row.store_id = p_store_id
       and transition_row.from_status_code = 'quoted'
       and transition_row.to_status_code = 'waiting_approval'
       and transition_row.enabled = true
  ) then
    return jsonb_build_object('ok', false, 'code', 'invalid_transition');
  end if;

  insert into public.message_logs (
    id, store_id, order_id, channel, template_code,
    message_body, status, operator_name, sent_at
  ) values (
    v_message_id,
    p_store_id,
    p_order_id::uuid,
    'whatsapp',
    'approval_request',
    v_message,
    'sent',
    v_actor_name,
    v_now
  );

  update public.repair_orders
     set status = 'waiting_approval',
         legacy_status = 'waiting_approval',
         workflow_status = 'quote',
         approval_status = 'pending',
         approval_flow_status = 'waiting_customer',
         approval_sent_at = v_now,
         approval_confirmed_at = null,
         notify_status = 'sent',
         updated_at = v_now
   where store_id = p_store_id
     and id::text = p_order_id;

  insert into public.order_events (
    id, store_id, order_id, event_type, payload, operator_name, created_at
  ) values (
    v_event_id,
    p_store_id,
    p_order_id::uuid,
    'approval_sent',
    jsonb_build_object(
      'action', 'quote_sent_confirmed',
      'idempotency_key', p_idempotency_key,
      'request_fingerprint', v_request_fingerprint,
      'quote_event_id', p_quote_event_id,
      'message_id', v_message_id,
      'updated_at_before', p_expected_updated_at,
      'updated_at_after', v_now,
      'from', 'quoted',
      'to', 'waiting_approval',
      'channel', 'whatsapp'
    ),
    v_actor_name,
    v_now
  );

  insert into public.audit_logs (
    id, actor_id, actor_email, actor_name, store_id,
    action, entity_type, entity_id, metadata, created_at
  ) values (
    gen_random_uuid()::text,
    p_actor_id,
    v_actor_email,
    v_actor_name,
    p_store_id,
    'quote_sent_confirmed',
    'repair_order',
    p_order_id,
    jsonb_build_object(
      'quote_event_id', p_quote_event_id,
      'message_id', v_message_id,
      'channel', 'whatsapp'
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'code', 'confirmed',
    'message_id', v_message_id,
    'quote_event_id', p_quote_event_id,
    'updated_at', v_now,
    'from', 'quoted',
    'to', 'waiting_approval'
  );
end;
$$;

revoke all on function public.repairdesk_publish_order_quote(
  uuid, text, uuid, timestamptz, uuid, text, jsonb, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.repairdesk_publish_order_quote(
  uuid, text, uuid, timestamptz, uuid, text, jsonb, text, text
) to service_role;

revoke all on function public.repairdesk_confirm_order_quote_sent(
  uuid, text, uuid, text, timestamptz, uuid, text
) from public, anon, authenticated, service_role;
grant execute on function public.repairdesk_confirm_order_quote_sent(
  uuid, text, uuid, text, timestamptz, uuid, text
) to service_role;

reset statement_timeout;
reset lock_timeout;

notify pgrst, 'reload schema';
