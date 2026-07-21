alter table public.repair_orders
  add column if not exists customer_name_snapshot text,
  add column if not exists customer_phone_snapshot text,
  add column if not exists customer_identity_snapshot_source text;

do $$
begin
  alter table public.repair_orders
    add constraint repair_orders_customer_identity_snapshot_source_check
    check (
      customer_identity_snapshot_source is null
      or customer_identity_snapshot_source in (
        'created', 'selected', 'shared_phone', 'backfilled_current_profile'
      )
    );
exception when duplicate_object then null;
end $$;

update public.repair_orders ro
set
  customer_name_snapshot = c.name,
  customer_phone_snapshot = c.phone_e164,
  customer_identity_snapshot_source = 'backfilled_current_profile'
from public.customers c
where c.store_id = ro.store_id
  and c.id = ro.customer_id
  and ro.customer_name_snapshot is null;

create table if not exists public.repairdesk_order_create_operations (
  store_id uuid not null,
  actor_id uuid not null,
  operation_id uuid not null,
  request_hash text not null,
  status text not null,
  result_code text,
  order_id uuid,
  response_summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (store_id, actor_id, operation_id),
  constraint repairdesk_order_create_operations_status_check
    check (status in ('processing', 'conflict', 'created', 'failed')),
  constraint repairdesk_order_create_operations_summary_object
    check (response_summary is null or jsonb_typeof(response_summary) = 'object')
);

create table if not exists public.repairdesk_customer_identity_challenges (
  token uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  actor_id uuid not null,
  operation_id uuid not null,
  request_hash text not null,
  phone_key_hash text not null,
  candidate_ids uuid[] not null,
  candidate_versions jsonb not null,
  allowed_resolutions text[] not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint repairdesk_customer_identity_candidate_versions_object
    check (jsonb_typeof(candidate_versions) = 'object')
);

create index if not exists repairdesk_customer_identity_challenges_scope_idx
  on public.repairdesk_customer_identity_challenges (store_id, actor_id, operation_id, expires_at desc);

alter table public.repairdesk_order_create_operations enable row level security;
alter table public.repairdesk_customer_identity_challenges enable row level security;

revoke all on table public.repairdesk_order_create_operations from public, anon, authenticated;
revoke all on table public.repairdesk_customer_identity_challenges from public, anon, authenticated;
grant all on table public.repairdesk_order_create_operations to service_role;
grant all on table public.repairdesk_customer_identity_challenges to service_role;

create or replace function public.repairdesk_create_order_v2(
  p_store_id uuid,
  p_actor_id uuid,
  p_operation_id uuid,
  p_request_hash text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing_operation public.repairdesk_order_create_operations%rowtype;
  v_resolution jsonb := coalesce(p_payload -> 'customer_identity_resolution', '{"mode":"auto"}'::jsonb);
  v_resolution_mode text := coalesce(v_resolution ->> 'mode', 'auto');
  v_customer_id uuid := nullif(p_payload ->> 'customer_id', '')::uuid;
  v_customer_name text := btrim(coalesce(p_payload ->> 'customer_name', ''));
  v_customer_phone text := btrim(coalesce(p_payload ->> 'customer_phone', ''));
  v_phone_raw text := btrim(coalesce(p_payload ->> 'phone_raw', ''));
  v_phone_e164 text := btrim(coalesce(p_payload ->> 'phone_e164', ''));
  v_name_key text;
  v_candidates jsonb;
  v_candidate_ids uuid[];
  v_match_count integer := 0;
  v_exact_count integer := 0;
  v_challenge public.repairdesk_customer_identity_challenges%rowtype;
  v_customer public.customers%rowtype;
  v_device public.devices%rowtype;
  v_device_id uuid := nullif(p_payload ->> 'device_id', '')::uuid;
  v_order_id uuid := gen_random_uuid();
  v_now timestamptz := clock_timestamp();
  v_snapshot_source text;
  v_result jsonb;
  v_cost_result jsonb;
begin
  if p_store_id is null or p_actor_id is null or p_operation_id is null
     or coalesce(p_request_hash, '') !~ '^[0-9a-f]{64}$'
     or jsonb_typeof(p_payload) <> 'object' then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;

  if not exists (
    select 1
    from public.store_memberships sm
    join public.stores s on s.id = sm.store_id
    where sm.store_id = p_store_id
      and sm.user_id = p_actor_id
      and sm.status = 'active'
      and sm.role <> 'viewer'
      and s.status = 'active'
  ) then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_store_id::text || ':' || p_actor_id::text || ':' || p_operation_id::text, 0));
  select * into v_existing_operation
  from public.repairdesk_order_create_operations
  where store_id = p_store_id and actor_id = p_actor_id and operation_id = p_operation_id;

  if found then
    if v_existing_operation.request_hash <> p_request_hash then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    if v_existing_operation.status = 'created' then
      return coalesce(v_existing_operation.response_summary, jsonb_build_object('ok', false, 'code', 'operation_state_invalid'))
        || jsonb_build_object('replayed', true);
    end if;
    if v_existing_operation.status = 'conflict' and v_resolution_mode = 'auto' then
      select * into v_challenge
      from public.repairdesk_customer_identity_challenges
      where store_id = p_store_id and actor_id = p_actor_id and operation_id = p_operation_id
        and request_hash = p_request_hash and used_at is null and expires_at > v_now
      order by created_at desc limit 1;
      select coalesce(jsonb_agg(jsonb_build_object(
        'customerId', c.id, 'displayName', c.name, 'updatedAt', c.updated_at
      ) order by c.updated_at desc), '[]'::jsonb)
      into v_candidates
      from public.customers c
      where c.store_id = p_store_id and c.id = any(coalesce(v_challenge.candidate_ids, '{}'::uuid[]));
      return coalesce(v_existing_operation.response_summary, jsonb_build_object('ok', false, 'code', 'operation_state_invalid'))
        || jsonb_build_object('candidates', v_candidates, 'replayed', true);
    end if;
    update public.repairdesk_order_create_operations
    set status = 'processing', updated_at = v_now
    where store_id = p_store_id and actor_id = p_actor_id and operation_id = p_operation_id;
  else
    insert into public.repairdesk_order_create_operations (
      store_id, actor_id, operation_id, request_hash, status
    ) values (p_store_id, p_actor_id, p_operation_id, p_request_hash, 'processing');
  end if;

  if v_customer_id is null and v_phone_raw = '' then
    return jsonb_build_object('ok', false, 'code', 'invalid_customer_phone');
  end if;
  if v_device_id is null and (
    btrim(coalesce(p_payload ->> 'device_brand', '')) = ''
    or btrim(coalesce(p_payload ->> 'device_model', '')) = ''
  ) then
    return jsonb_build_object('ok', false, 'code', 'invalid_device');
  end if;

  if v_customer_id is null then
    perform pg_advisory_xact_lock(hashtextextended(p_store_id::text || ':phone:' || v_phone_raw, 0));
  end if;

  v_name_key := lower(regexp_replace(v_customer_name, '\s+', ' ', 'g'));

  if v_customer_id is not null then
    select * into v_customer
    from public.customers
    where store_id = p_store_id and id = v_customer_id
    for update;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'customer_not_found');
    end if;
    v_snapshot_source := 'selected';
  else
    select
      coalesce(jsonb_agg(jsonb_build_object(
        'customerId', c.id,
        'displayName', c.name,
        'updatedAt', c.updated_at
      ) order by c.updated_at desc), '[]'::jsonb),
      coalesce(array_agg(c.id order by c.updated_at desc), '{}'::uuid[]),
      count(*)::integer,
      count(*) filter (
        where lower(regexp_replace(btrim(c.name), '\s+', ' ', 'g')) = v_name_key
      )::integer
    into v_candidates, v_candidate_ids, v_match_count, v_exact_count
    from public.customers c
    where c.store_id = p_store_id and c.phone_raw = v_phone_raw;

    if v_match_count = 0 then
      if v_customer_name = '' then
        return jsonb_build_object('ok', false, 'code', 'customer_name_required');
      end if;
      v_customer_id := gen_random_uuid();
      insert into public.customers (
        id, store_id, name, phone_e164, phone_raw, contact_phones,
        consent_marketing, consent_sms, preferred_channel, language, created_at, updated_at
      ) values (
        v_customer_id, p_store_id, v_customer_name, v_phone_e164, v_phone_raw,
        coalesce(array(select jsonb_array_elements_text(coalesce(p_payload -> 'contact_phones', '[]'::jsonb))), '{}'::text[]),
        false, true, 'whatsapp', 'it', v_now, v_now
      ) returning * into v_customer;
      v_snapshot_source := 'created';
    elsif v_resolution_mode = 'auto'
      and v_match_count = 1
      and (v_customer_name = '' or v_exact_count = 1) then
      select * into v_customer
      from public.customers
      where store_id = p_store_id and id = v_candidate_ids[1]
      for update;
      v_customer_id := v_customer.id;
      v_snapshot_source := 'selected';
    elsif v_resolution_mode = 'auto' then
      insert into public.repairdesk_customer_identity_challenges (
        store_id, actor_id, operation_id, request_hash, phone_key_hash,
        candidate_ids, candidate_versions, allowed_resolutions, expires_at
      ) values (
        p_store_id, p_actor_id, p_operation_id, p_request_hash,
        encode(extensions.digest(p_store_id::text || ':' || v_phone_raw, 'sha256'), 'hex'),
        v_candidate_ids,
        (select coalesce(jsonb_object_agg(c.id::text, c.updated_at), '{}'::jsonb)
         from public.customers c where c.store_id = p_store_id and c.id = any(v_candidate_ids)),
        array['use_existing', 'create_distinct_shared_phone'],
        v_now + interval '10 minutes'
      ) returning * into v_challenge;
      v_result := jsonb_build_object(
        'ok', false,
        'code', 'customer_identity_conflict',
        'conflictToken', v_challenge.token,
        'allowedResolutions', v_challenge.allowed_resolutions,
        'candidates', v_candidates
      );
      update public.repairdesk_order_create_operations
      set status = 'conflict', result_code = 'customer_identity_conflict',
          response_summary = v_result - 'candidates', updated_at = v_now
      where store_id = p_store_id and actor_id = p_actor_id and operation_id = p_operation_id;
      return v_result;
    else
      select * into v_challenge
      from public.repairdesk_customer_identity_challenges
      where token = nullif(v_resolution ->> 'conflict_token', '')::uuid
        and store_id = p_store_id and actor_id = p_actor_id
        and operation_id = p_operation_id and request_hash = p_request_hash
        and used_at is null and expires_at > v_now
      for update;
      if not found then
        return jsonb_build_object('ok', false, 'code', 'identity_challenge_invalid');
      end if;
      if v_challenge.phone_key_hash <> encode(extensions.digest(p_store_id::text || ':' || v_phone_raw, 'sha256'), 'hex') then
        return jsonb_build_object('ok', false, 'code', 'identity_challenge_stale');
      end if;

      if v_resolution_mode = 'use_existing' then
        v_customer_id := nullif(v_resolution ->> 'customer_id', '')::uuid;
        if not (v_customer_id = any(v_challenge.candidate_ids)) then
          return jsonb_build_object('ok', false, 'code', 'identity_resolution_invalid');
        end if;
        select * into v_customer from public.customers
        where store_id = p_store_id and id = v_customer_id for update;
        if not found or (v_challenge.candidate_versions ->> v_customer_id::text)::timestamptz
          is distinct from v_customer.updated_at then
          return jsonb_build_object('ok', false, 'code', 'identity_challenge_stale');
        end if;
        v_snapshot_source := 'selected';
      elsif v_resolution_mode = 'create_distinct_shared_phone' then
        if v_customer_name = '' or v_exact_count > 0
           or coalesce(v_resolution ->> 'reason', '') not in ('family', 'business', 'other') then
          return jsonb_build_object('ok', false, 'code', 'identity_resolution_invalid');
        end if;
        v_customer_id := gen_random_uuid();
        insert into public.customers (
          id, store_id, name, phone_e164, phone_raw, contact_phones,
          consent_marketing, consent_sms, preferred_channel, language, created_at, updated_at
        ) values (
          v_customer_id, p_store_id, v_customer_name, v_phone_e164, v_phone_raw,
          coalesce(array(select jsonb_array_elements_text(coalesce(p_payload -> 'contact_phones', '[]'::jsonb))), '{}'::text[]),
          false, true, 'whatsapp', 'it', v_now, v_now
        ) returning * into v_customer;
        v_snapshot_source := 'shared_phone';
      else
        return jsonb_build_object('ok', false, 'code', 'identity_resolution_invalid');
      end if;
    end if;
  end if;

  if v_device_id is not null then
    select * into v_device from public.devices
    where store_id = p_store_id and id = v_device_id for update;
    if not found or v_device.customer_id <> v_customer_id then
      return jsonb_build_object('ok', false, 'code', 'device_customer_mismatch');
    end if;
  else
    v_device_id := gen_random_uuid();
    insert into public.devices (
      id, store_id, customer_id, brand, model, serial_or_imei, device_notes, created_at, updated_at
    ) values (
      v_device_id, p_store_id, v_customer_id,
      btrim(p_payload ->> 'device_brand'), btrim(p_payload ->> 'device_model'),
      btrim(coalesce(p_payload ->> 'device_imei', '')), nullif(btrim(coalesce(p_payload ->> 'device_notes', '')), ''),
      v_now, v_now
    ) returning * into v_device;
  end if;

  insert into public.repair_orders (
    id, store_id, order_type, status, workflow_status, exception_status, payment_status,
    approval_flow_status, parts_status, notify_status, customer_id, device_id,
    customer_name_snapshot, customer_phone_snapshot, customer_identity_snapshot_source,
    issue_description, quotation_amount, deposit_amount, balance_amount, currency_code,
    is_paid, approval_status, technician_name, assignee_membership_id, internal_tag,
    accessory_notes, device_custody_status, device_unlock_method, device_unlock_value,
    device_unlock_pattern, warranty_text, warranty_months, warranty_change_reason,
    warranty_changed_by, warranty_changed_at, contact_phones, fault_prices, device_snapshot,
    created_at, updated_at
  ) values (
    v_order_id, p_store_id,
    (p_payload #>> '{order,order_type}')::public.repair_order_type,
    (p_payload #>> '{order,status}')::public.repair_order_status,
    p_payload #>> '{order,workflow_status}', nullif(p_payload #>> '{order,exception_status}', ''),
    p_payload #>> '{order,payment_status}', p_payload #>> '{order,approval_flow_status}',
    p_payload #>> '{order,parts_status}', p_payload #>> '{order,notify_status}',
    v_customer_id, v_device_id, v_customer.name, v_customer.phone_e164, v_snapshot_source,
    btrim(p_payload #>> '{order,issue_description}'),
    (p_payload #>> '{order,quotation_amount}')::numeric,
    (p_payload #>> '{order,deposit_amount}')::numeric,
    (p_payload #>> '{order,balance_amount}')::numeric,
    'EUR', (p_payload #>> '{order,is_paid}')::boolean, 'pending',
    p_payload #>> '{order,technician_name}', nullif(p_payload #>> '{order,assignee_membership_id}', '')::uuid,
    nullif(p_payload #>> '{order,internal_tag}', ''), nullif(p_payload #>> '{order,accessory_notes}', ''),
    p_payload #>> '{order,device_custody_status}', nullif(p_payload #>> '{order,device_unlock_method}', ''),
    nullif(p_payload #>> '{order,device_unlock_value}', ''),
    case when jsonb_typeof(p_payload #> '{order,device_unlock_pattern}') = 'array'
      then array(select jsonb_array_elements_text(p_payload #> '{order,device_unlock_pattern}'))::integer[] else null end,
    p_payload #>> '{order,warranty_text}', (p_payload #>> '{order,warranty_months}')::integer,
    nullif(p_payload #>> '{order,warranty_change_reason}', ''),
    nullif(p_payload #>> '{order,warranty_changed_by}', '')::uuid,
    nullif(p_payload #>> '{order,warranty_changed_at}', '')::timestamptz,
    coalesce(array(select jsonb_array_elements_text(coalesce(p_payload -> 'contact_phones', '[]'::jsonb))), '{}'::text[]),
    coalesce(p_payload #> '{order,fault_prices}', '[]'::jsonb),
    jsonb_build_object('brand', v_device.brand, 'model', v_device.model, 'serial_or_imei', v_device.serial_or_imei)
      || case when v_device.device_notes is null then '{}'::jsonb else jsonb_build_object('device_notes', v_device.device_notes) end,
    v_now, v_now
  );

  if jsonb_array_length(coalesce(p_payload #> '{order,cost_inputs}', '[]'::jsonb)) > 0 then
    v_cost_result := public.repairdesk_apply_order_cost_inputs_rpc(
      p_store_id,
      v_order_id,
      p_actor_id,
      1,
      p_payload #> '{order,cost_inputs}'
    );
    if coalesce((v_cost_result ->> 'ok')::boolean, false) is not true then
      raise exception 'order_cost_input_failed:%', coalesce(v_cost_result ->> 'code', 'unknown');
    end if;
  end if;

  insert into public.order_events (
    id, store_id, order_id, event_type, payload, operator_name, created_at
  ) values (
    gen_random_uuid(), p_store_id, v_order_id, 'created',
    jsonb_build_object(
      'type', p_payload #>> '{order,order_type}',
      'operation_id', p_operation_id,
      'customer_identity_resolution', v_snapshot_source,
      'request_hash', p_request_hash,
      'device_custody_status', p_payload #>> '{order,device_custody_status}'
    ),
    p_payload #>> '{order,operator_name}', v_now
  );

  if v_challenge.token is not null then
    update public.repairdesk_customer_identity_challenges set used_at = v_now where token = v_challenge.token;
  end if;

  v_result := jsonb_build_object('ok', true, 'code', 'created', 'id', v_order_id, 'replayed', false);
  update public.repairdesk_order_create_operations
  set status = 'created', result_code = 'created', order_id = v_order_id,
      response_summary = v_result, updated_at = v_now
  where store_id = p_store_id and actor_id = p_actor_id and operation_id = p_operation_id;
  return v_result;
exception when others then
  raise;
end;
$$;

revoke all on function public.repairdesk_create_order_v2(uuid, uuid, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.repairdesk_create_order_v2(uuid, uuid, uuid, text, jsonb)
  to service_role;

comment on function public.repairdesk_create_order_v2(uuid, uuid, uuid, text, jsonb) is
  'Service-role-only atomic order creation with customer identity conflict challenge and idempotency.';

notify pgrst, 'reload schema';
