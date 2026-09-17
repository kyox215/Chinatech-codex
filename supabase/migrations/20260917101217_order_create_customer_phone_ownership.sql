-- Forward-only repair of creation/profile phone ownership. No historical rows
-- are scanned for migration, rewritten, merged, or constrained by a new trigger.
-- Lock order: operation receipt (order creation only), sorted incoming phone
-- advisory locks, then customer row. Same phone namespace/order as mutation v4.
set lock_timeout = '5s';
set statement_timeout = '60s';

create or replace function public.repairdesk_create_order_v2(
  p_store_id uuid,
  p_actor_id uuid,
  p_operation_id uuid,
  p_request_hash text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
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
  v_contacts text[];
  v_phone_keys text[];
  v_phone text;
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

  -- Normalize every incoming primary/backup and use the v4 lock namespace.
  -- Receipt replay above deliberately precedes validation of a new request.
  if (v_phone_raw <> '' and (
      v_phone_e164 !~ '^[+0-9][0-9 ().-]*$' or v_phone_raw !~ '^[0-9]{7,15}$'
      or regexp_replace(v_phone_e164, '[^0-9]', '', 'g') <> v_phone_raw
    )) or (v_phone_raw = '' and v_phone_e164 <> '')
    or jsonb_typeof(coalesce(p_payload -> 'contact_phones', '[]'::jsonb)) is distinct from 'array' then
    return jsonb_build_object('ok', false, 'code', 'invalid_customer_phone');
  end if;
  if jsonb_array_length(coalesce(p_payload -> 'contact_phones', '[]'::jsonb)) > 20 or exists (
    select 1 from jsonb_array_elements(coalesce(p_payload -> 'contact_phones', '[]'::jsonb)) x
     where jsonb_typeof(x) <> 'string' or (x #>> '{}') !~ '^[+0-9][0-9 ().-]*$'
       or regexp_replace(x #>> '{}', '[^0-9]', '', 'g') !~ '^[0-9]{7,15}$'
  ) then return jsonb_build_object('ok', false, 'code', 'invalid_customer_phone'); end if;
  select coalesce(array_agg(phone order by ordinal), '{}'::text[]) into v_contacts from (
    select distinct on (raw) phone, ordinal from (
      select btrim(value) phone, ordinal, regexp_replace(value, '[^0-9]', '', 'g') raw
        from jsonb_array_elements_text(coalesce(p_payload -> 'contact_phones', '[]'::jsonb)) with ordinality phones(value, ordinal)
    ) normalized where raw <> v_phone_raw order by raw, ordinal
  ) deduplicated;
  select coalesce(array_agg(phone_key order by phone_key), '{}'::text[]) into v_phone_keys from (
    select distinct regexp_replace(value, '[^0-9]', '', 'g') phone_key
      from unnest(v_contacts || array[v_phone_raw]) value where value <> ''
  ) keys;
  foreach v_phone in array v_phone_keys loop
    perform pg_advisory_xact_lock(hashtextextended(p_store_id::text || ':phone:' || v_phone, 0));
  end loop;

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
      v_customer_id := gen_random_uuid();
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
        v_snapshot_source := 'shared_phone';
      else
        return jsonb_build_object('ok', false, 'code', 'identity_resolution_invalid');
      end if;
    end if;
  end if;

  -- A selected/reused customer keeps its profile and identity. Only the existing
  -- audited shared-primary resolution permits another primary with the same raw.
  -- That exception never permits sharing somebody else's backup number.
  if exists (
    select 1 from public.customers c
     where c.store_id = p_store_id and c.id <> v_customer_id and (
       (v_phone_raw <> '' and exists (
         select 1 from unnest(c.contact_phones) phone
          where regexp_replace(phone, '[^0-9]', '', 'g') = v_phone_raw
       )) or (
         v_phone_raw <> '' and c.phone_raw = v_phone_raw
         and v_snapshot_source <> 'shared_phone'
         and not (v_snapshot_source = 'selected' and v_customer.phone_raw = v_phone_raw)
       ) or exists (
         select 1 from unnest(v_contacts) requested
          where regexp_replace(requested, '[^0-9]', '', 'g') = c.phone_raw
             or exists (select 1 from unnest(c.contact_phones) stored
               where regexp_replace(stored, '[^0-9]', '', 'g') = regexp_replace(requested, '[^0-9]', '', 'g'))
       )
     )
  ) then return jsonb_build_object('ok', false, 'code', 'customer_phone_conflict'); end if;

  if v_snapshot_source in ('created', 'shared_phone') then
    insert into public.customers (
      id, store_id, name, phone_e164, phone_raw, contact_phones,
      consent_marketing, consent_sms, preferred_channel, language, created_at, updated_at
    ) values (
      v_customer_id, p_store_id, v_customer_name, v_phone_e164, v_phone_raw, v_contacts,
      false, true, 'whatsapp', 'it', v_now, v_now
    ) returning * into v_customer;
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
    v_customer.contact_phones,
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



create or replace function public.repairdesk_create_customer_v1(
  p_store_id uuid, p_actor_id uuid, p_customer_id uuid,
  p_profile jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_customer public.customers%rowtype;
  v_contacts text[];
  v_keys text[];
  v_check_keys text[];
  v_key text;
  v_now timestamptz;
begin
  if p_store_id is null or p_actor_id is null or p_customer_id is null
     or jsonb_typeof(p_profile) is distinct from 'object'
     or exists (select 1 from jsonb_object_keys(p_profile) k where k not in (
       'name','phone_e164','phone_raw','contact_phones','email','consent_marketing',
       'consent_sms','preferred_channel','language','notes','marketing_notes','blacklisted_at'
     )) then return jsonb_build_object('ok', false, 'code', 'invalid_request'); end if;
  perform pg_advisory_xact_lock_shared(hashtextextended(p_store_id::text, 0));
  if not exists (
    select 1 from public.store_memberships sm
    join public.staff_profiles sp on sp.id = sm.user_id and sp.status = 'active'
    join public.stores st on st.id = sm.store_id and st.status = 'active'
    join public.store_lifecycles sl on sl.store_id = st.id and sl.phase = 'active'
    where sm.store_id = p_store_id and sm.user_id = p_actor_id
      and sm.status = 'active' and sm.role in ('owner','manager','sales')
  ) then return jsonb_build_object('ok', false, 'code', 'actor_forbidden'); end if;
  if jsonb_typeof(p_profile -> 'name') is distinct from 'string'
     or btrim(p_profile ->> 'name') = ''
     or jsonb_typeof(p_profile -> 'phone_e164') is distinct from 'string'
     or jsonb_typeof(p_profile -> 'phone_raw') is distinct from 'string'
     or (p_profile ->> 'phone_e164') !~ '^[+0-9][0-9 ().-]*$'
     or (p_profile ->> 'phone_raw') !~ '^[0-9]{7,15}$'
     or regexp_replace(p_profile ->> 'phone_e164', '[^0-9]', '', 'g') <> p_profile ->> 'phone_raw'
     or jsonb_typeof(coalesce(p_profile -> 'contact_phones', '[]'::jsonb)) is distinct from 'array'
  then return jsonb_build_object('ok', false, 'code', 'invalid_customer_phone'); end if;
  if jsonb_array_length(coalesce(p_profile -> 'contact_phones', '[]'::jsonb)) > 20 or exists (
    select 1 from jsonb_array_elements(coalesce(p_profile -> 'contact_phones', '[]'::jsonb)) x
    where jsonb_typeof(x) <> 'string' or (x #>> '{}') !~ '^[+0-9][0-9 ().-]*$'
      or regexp_replace(x #>> '{}', '[^0-9]', '', 'g') !~ '^[0-9]{7,15}$'
  ) then return jsonb_build_object('ok', false, 'code', 'invalid_customer_phone'); end if;
  if coalesce(p_profile ->> 'preferred_channel', 'whatsapp') not in ('whatsapp','sms')
     or coalesce(p_profile ->> 'language','it') not in ('it','zh','en')
     or (p_profile ? 'consent_marketing' and jsonb_typeof(p_profile -> 'consent_marketing') <> 'boolean')
     or (p_profile ? 'consent_sms' and jsonb_typeof(p_profile -> 'consent_sms') <> 'boolean')
  then return jsonb_build_object('ok', false, 'code', 'invalid_request'); end if;
  select coalesce(array_agg(phone order by ordinal), '{}'::text[]) into v_contacts from (
    select distinct on (raw) phone, ordinal from (
      select btrim(value) phone, ordinal, regexp_replace(value, '[^0-9]', '', 'g') raw
        from jsonb_array_elements_text(coalesce(p_profile -> 'contact_phones', '[]'::jsonb)) with ordinality phones(value, ordinal)
    ) normalized where raw <> p_profile ->> 'phone_raw' order by raw, ordinal
  ) deduplicated;
  select array_agg(phone_key order by phone_key) into v_keys from (
    select distinct regexp_replace(value, '[^0-9]', '', 'g') phone_key
      from unnest(v_contacts || array[p_profile ->> 'phone_raw']) value
  ) keys;
  foreach v_key in array v_keys loop
    perform pg_advisory_xact_lock(hashtextextended(p_store_id::text || ':phone:' || v_key, 0));
  end loop;
  if exists (select 1 from public.customers where id = p_customer_id) then
    return jsonb_build_object('ok', false, 'code', 'customer_exists');
  end if;
  v_check_keys := v_keys;
  if exists (
    select 1 from public.customers c where c.store_id = p_store_id and c.id <> p_customer_id
      and (c.phone_raw = any(v_check_keys) or exists (
        select 1 from unnest(c.contact_phones) phone where regexp_replace(phone, '[^0-9]', '', 'g') = any(v_check_keys)
      ))
  ) then return jsonb_build_object('ok', false, 'code', 'customer_phone_conflict'); end if;
  v_now := clock_timestamp();
  insert into public.customers (
    id,store_id,name,phone_e164,phone_raw,contact_phones,email,consent_marketing,consent_sms,
    preferred_channel,language,notes,marketing_notes,blacklisted_at,created_at,updated_at
  ) values (
    p_customer_id,p_store_id,btrim(p_profile ->> 'name'),btrim(p_profile ->> 'phone_e164'),
    p_profile ->> 'phone_raw',v_contacts,nullif(btrim(p_profile ->> 'email'),''),
    coalesce((p_profile ->> 'consent_marketing')::boolean,false),coalesce((p_profile ->> 'consent_sms')::boolean,true),
    coalesce(p_profile ->> 'preferred_channel','whatsapp')::public.message_channel,
    coalesce(p_profile ->> 'language','it'),nullif(btrim(p_profile ->> 'notes'),''),
    nullif(btrim(p_profile ->> 'marketing_notes'),''),(p_profile ->> 'blacklisted_at')::timestamptz,v_now,v_now
  ) returning * into v_customer;
  return jsonb_build_object('ok', true, 'id', v_customer.id, 'updated_at', v_customer.updated_at);
end;
$$;
revoke all on function public.repairdesk_create_customer_v1(uuid,uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.repairdesk_create_customer_v1(uuid,uuid,uuid,jsonb) to service_role;

create or replace function public.repairdesk_update_customer_v1(
  p_store_id uuid, p_actor_id uuid, p_customer_id uuid,
  p_expected_updated_at timestamptz,
  p_profile jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_customer public.customers%rowtype;
  v_contacts text[];
  v_keys text[];
  v_check_keys text[];
  v_key text;
  v_now timestamptz;
begin
  if p_store_id is null or p_actor_id is null or p_customer_id is null
     or jsonb_typeof(p_profile) is distinct from 'object'
     or exists (select 1 from jsonb_object_keys(p_profile) k where k not in (
       'name','phone_e164','phone_raw','contact_phones','email','consent_marketing',
       'consent_sms','preferred_channel','language','notes','marketing_notes','blacklisted_at'
     )) then return jsonb_build_object('ok', false, 'code', 'invalid_request'); end if;
  perform pg_advisory_xact_lock_shared(hashtextextended(p_store_id::text, 0));
  if not exists (
    select 1 from public.store_memberships sm
    join public.staff_profiles sp on sp.id = sm.user_id and sp.status = 'active'
    join public.stores st on st.id = sm.store_id and st.status = 'active'
    join public.store_lifecycles sl on sl.store_id = st.id and sl.phase = 'active'
    where sm.store_id = p_store_id and sm.user_id = p_actor_id
      and sm.status = 'active' and sm.role in ('owner','manager','sales')
  ) then return jsonb_build_object('ok', false, 'code', 'actor_forbidden'); end if;
  if jsonb_typeof(p_profile -> 'name') is distinct from 'string'
     or btrim(p_profile ->> 'name') = ''
     or jsonb_typeof(p_profile -> 'phone_e164') is distinct from 'string'
     or jsonb_typeof(p_profile -> 'phone_raw') is distinct from 'string'
     or (p_profile ->> 'phone_e164') !~ '^[+0-9][0-9 ().-]*$'
     or (p_profile ->> 'phone_raw') !~ '^[0-9]{7,15}$'
     or regexp_replace(p_profile ->> 'phone_e164', '[^0-9]', '', 'g') <> p_profile ->> 'phone_raw'
     or jsonb_typeof(coalesce(p_profile -> 'contact_phones', '[]'::jsonb)) is distinct from 'array'
  then return jsonb_build_object('ok', false, 'code', 'invalid_customer_phone'); end if;
  if jsonb_array_length(coalesce(p_profile -> 'contact_phones', '[]'::jsonb)) > 20 or exists (
    select 1 from jsonb_array_elements(coalesce(p_profile -> 'contact_phones', '[]'::jsonb)) x
    where jsonb_typeof(x) <> 'string' or (x #>> '{}') !~ '^[+0-9][0-9 ().-]*$'
      or regexp_replace(x #>> '{}', '[^0-9]', '', 'g') !~ '^[0-9]{7,15}$'
  ) then return jsonb_build_object('ok', false, 'code', 'invalid_customer_phone'); end if;
  if coalesce(p_profile ->> 'preferred_channel', 'whatsapp') not in ('whatsapp','sms')
     or coalesce(p_profile ->> 'language','it') not in ('it','zh','en')
     or (p_profile ? 'consent_marketing' and jsonb_typeof(p_profile -> 'consent_marketing') <> 'boolean')
     or (p_profile ? 'consent_sms' and jsonb_typeof(p_profile -> 'consent_sms') <> 'boolean')
  then return jsonb_build_object('ok', false, 'code', 'invalid_request'); end if;
  select coalesce(array_agg(phone order by ordinal), '{}'::text[]) into v_contacts from (
    select distinct on (raw) phone, ordinal from (
      select btrim(value) phone, ordinal, regexp_replace(value, '[^0-9]', '', 'g') raw
        from jsonb_array_elements_text(coalesce(p_profile -> 'contact_phones', '[]'::jsonb)) with ordinality phones(value, ordinal)
    ) normalized where raw <> p_profile ->> 'phone_raw' order by raw, ordinal
  ) deduplicated;
  select array_agg(phone_key order by phone_key) into v_keys from (
    select distinct regexp_replace(value, '[^0-9]', '', 'g') phone_key
      from unnest(v_contacts || array[p_profile ->> 'phone_raw']) value
  ) keys;
  foreach v_key in array v_keys loop
    perform pg_advisory_xact_lock(hashtextextended(p_store_id::text || ':phone:' || v_key, 0));
  end loop;
  if p_expected_updated_at is null then
    return jsonb_build_object('ok', false, 'code', 'customer_version_required');
  end if;
  select * into v_customer from public.customers
    where store_id = p_store_id and id = p_customer_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'customer_not_found'); end if;
  if v_customer.updated_at is distinct from p_expected_updated_at then
    return jsonb_build_object('ok', false, 'code', 'customer_stale_version');
  end if;
  -- Preserve unchanged historical ownership (including audited shared primaries).
  -- A number entering a new primary/backup role must pass ownership again, so a
  -- shared primary cannot be silently promoted into a shared-backup exception.
  select coalesce(array_agg(distinct raw), '{}'::text[]) into v_check_keys from (
    select p_profile ->> 'phone_raw' raw where (p_profile ->> 'phone_raw') <> v_customer.phone_raw
    union all
    select regexp_replace(phone, '[^0-9]', '', 'g') from unnest(v_contacts) phone
      where not exists (select 1 from unnest(v_customer.contact_phones) old_phone
        where regexp_replace(old_phone, '[^0-9]', '', 'g') = regexp_replace(phone, '[^0-9]', '', 'g'))
  ) introduced;
  if exists (
    select 1 from public.customers c where c.store_id = p_store_id and c.id <> p_customer_id
      and (c.phone_raw = any(v_check_keys) or exists (
        select 1 from unnest(c.contact_phones) phone where regexp_replace(phone, '[^0-9]', '', 'g') = any(v_check_keys)
      ))
  ) then return jsonb_build_object('ok', false, 'code', 'customer_phone_conflict'); end if;
  v_now := greatest(clock_timestamp(), v_customer.updated_at + interval '1 microsecond');
  update public.customers set
    name = btrim(p_profile ->> 'name'), phone_e164 = btrim(p_profile ->> 'phone_e164'),
    phone_raw = p_profile ->> 'phone_raw', contact_phones = v_contacts,
    email = nullif(btrim(p_profile ->> 'email'), ''),
    consent_marketing = coalesce((p_profile ->> 'consent_marketing')::boolean, false),
    consent_sms = coalesce((p_profile ->> 'consent_sms')::boolean, true),
    preferred_channel = coalesce(p_profile ->> 'preferred_channel','whatsapp')::public.message_channel,
    language = coalesce(p_profile ->> 'language','it'), notes = nullif(btrim(p_profile ->> 'notes'), ''),
    marketing_notes = nullif(btrim(p_profile ->> 'marketing_notes'), ''),
    blacklisted_at = (p_profile ->> 'blacklisted_at')::timestamptz, updated_at = v_now
    where store_id = p_store_id and id = p_customer_id returning * into v_customer;
  return jsonb_build_object('ok', true, 'id', v_customer.id, 'updated_at', v_customer.updated_at);
end;
$$;
revoke all on function public.repairdesk_update_customer_v1(uuid,uuid,uuid,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.repairdesk_update_customer_v1(uuid,uuid,uuid,timestamptz,jsonb) to service_role;

notify pgrst, 'reload schema';
