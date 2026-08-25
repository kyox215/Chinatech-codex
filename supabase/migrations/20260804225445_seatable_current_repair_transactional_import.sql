create schema if not exists private;

create table private.seatable_current_repair_import_batches (
  store_id uuid not null,
  batch_id text not null,
  actor_id uuid not null,
  approval_ref_sha256 text not null,
  source_sha256 text not null,
  payload_sha256 text not null,
  expected_counts jsonb not null,
  result_counts jsonb,
  status text not null,
  applied_at timestamptz,
  rolled_back_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (store_id, batch_id),
  constraint seatable_current_repair_import_batches_status_check
    check (status in ('applying', 'applied', 'rolled_back')),
  constraint seatable_current_repair_import_batches_hashes_check
    check (
      approval_ref_sha256 ~ '^[0-9a-f]{64}$'
      and source_sha256 ~ '^[0-9a-f]{64}$'
      and payload_sha256 ~ '^[0-9a-f]{64}$'
    )
);

create table private.seatable_current_repair_import_rows (
  store_id uuid not null,
  batch_id text not null,
  source_row integer not null,
  customer_id uuid not null,
  device_id uuid not null,
  supplier_id uuid,
  order_id uuid not null,
  event_id uuid not null,
  external_ref_id uuid not null,
  external_record_id text not null,
  expected_order_updated_at timestamptz not null,
  expected_order_status text not null,
  expected_customer_sha256 text not null,
  expected_device_sha256 text not null,
  expected_supplier_sha256 text,
  expected_event_sha256 text not null,
  expected_external_ref_sha256 text not null,
  expected_identity_sha256 text not null,
  expected_fault_prices_sha256 text not null,
  expected_cost_rows_sha256 text,
  expected_cost_revision_sha256 text,
  created_at timestamptz not null default clock_timestamp(),
  primary key (store_id, batch_id, source_row),
  unique (store_id, batch_id, order_id),
  constraint seatable_current_repair_import_rows_batch_fkey
    foreign key (store_id, batch_id)
    references private.seatable_current_repair_import_batches(store_id, batch_id)
    on update cascade on delete restrict
);

alter table private.seatable_current_repair_import_batches enable row level security;
alter table private.seatable_current_repair_import_rows enable row level security;
revoke all on schema private from public, anon;
revoke all on table private.seatable_current_repair_import_batches from public, anon, authenticated;
revoke all on table private.seatable_current_repair_import_rows from public, anon, authenticated;
grant usage on schema private to service_role;
grant select on table private.seatable_current_repair_import_batches to service_role;
grant select on table private.seatable_current_repair_import_rows to service_role;

create or replace function public.repairdesk_apply_seatable_current_repairs_v1(
  p_project_ref text,
  p_store_id uuid,
  p_actor_id uuid,
  p_batch_id text,
  p_approval_ref_sha256 text,
  p_source_sha256 text,
  p_payload_sha256 text,
  p_expected_counts jsonb,
  p_payload_text text,
  p_maintenance_ack boolean,
  p_mode text default 'rehearsal',
  p_fail_after_stage text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
  v_existing private.seatable_current_repair_import_batches%rowtype;
  v_counts jsonb;
  v_now timestamptz := clock_timestamp();
  v_actual_payload_sha256 text;
  v_inserted integer;
  v_source_row integer;
  v_order_id uuid;
  v_customer_id uuid;
  v_device_id uuid;
  v_supplier_id uuid;
  v_event_id uuid;
  v_external_ref_id uuid;
  v_external_record_id text;
  v_order_updated_at timestamptz;
  v_order_status text;
  v_customer_hash text;
  v_device_hash text;
  v_supplier_hash text;
  v_event_hash text;
  v_external_hash text;
  v_identity_hash text;
  v_fault_hash text;
  v_cost_hash text;
  v_revision_hash text;
begin
  if p_project_ref is distinct from 'xluzcoduqsdvjoouqhkc'
     or p_store_id is distinct from '5248dda1-2b32-46cd-8ed0-d15386a9e8ed'::uuid then
    raise exception using errcode = '42501', message = 'target_not_authorized';
  end if;
  if p_maintenance_ack is distinct from true then
    raise exception using errcode = '42501', message = 'maintenance_window_required';
  end if;
  if p_mode not in ('apply', 'rehearsal') then
    raise exception using errcode = '22023', message = 'invalid_mode';
  end if;
  if p_fail_after_stage is not null
     and (p_mode <> 'rehearsal' or p_fail_after_stage not in ('ledger', 'suppliers', 'customers', 'devices', 'orders', 'events', 'refs', 'complete')) then
    raise exception using errcode = '22023', message = 'invalid_failure_injection';
  end if;
  if coalesce(length(p_batch_id), 0) not between 8 and 120
     or p_approval_ref_sha256 !~ '^[0-9a-f]{64}$'
     or p_source_sha256 !~ '^[0-9a-f]{64}$'
     or p_payload_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_approval_binding';
  end if;
  if p_batch_id is distinct from 'seatable-current-20260804-strict-v4'
     or p_approval_ref_sha256 is distinct from '5d57f98532d756446c3152e1a2f171bb185a5e73e92ef5cbe1702af2e4031edf'
     or p_source_sha256 is distinct from 'eaa3ee01e3cae810aba29cece630356701e5fa9261a84e040f9f66703e684bf3'
     or p_payload_sha256 is distinct from '4efb81a3a9f01e05c7a9f77adab50c56bc3231e8dac45d844e6288b4eb5be17a' then
    raise exception using errcode = '42501', message = 'approved_artifact_binding_mismatch';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_store_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_store_id::text || ':seatable-current-repair-import', 0)
  );

  if not exists (
    select 1
    from public.stores as store_row
    where store_row.id = p_store_id
      and store_row.owner_user_id = p_actor_id
      and store_row.status = 'active'::public.store_status
      and exists (
        select 1
        from public.store_memberships as membership
        where membership.store_id = p_store_id
          and membership.user_id = p_actor_id
          and membership.role = 'owner'::public.staff_role
          and membership.status = 'active'::public.store_membership_status
      )
  ) then
    raise exception using errcode = '42501', message = 'active_primary_owner_required';
  end if;

  select * into v_existing
  from private.seatable_current_repair_import_batches as batch
  where batch.store_id = p_store_id and batch.batch_id = p_batch_id
  for update;

  if found then
    if v_existing.payload_sha256 is distinct from p_payload_sha256
       or v_existing.source_sha256 is distinct from p_source_sha256
       or v_existing.approval_ref_sha256 is distinct from p_approval_ref_sha256
       or v_existing.expected_counts is distinct from p_expected_counts then
      raise exception using errcode = '23505', message = 'idempotency_conflict';
    end if;
    if v_existing.status = 'applied' then
      return jsonb_build_object(
        'code', 'idempotent_replay',
        'replayed', true,
        'batch_id', p_batch_id,
        'payload_sha256', p_payload_sha256,
        'counts', v_existing.result_counts
      );
    end if;
    raise exception using errcode = '55000', message = 'batch_not_reusable';
  end if;

  if p_expected_counts is distinct from jsonb_build_object(
    'customers', 162,
    'devices', 167,
    'suppliers', 7,
    'repair_orders', 167,
    'order_events', 167,
    'order_external_refs', 167
  ) then
    raise exception using errcode = '22023', message = 'unexpected_approved_counts';
  end if;

  v_actual_payload_sha256 := encode(
    extensions.digest(pg_catalog.convert_to(p_payload_text, 'UTF8'), 'sha256'),
    'hex'
  );
  if v_actual_payload_sha256 is distinct from p_payload_sha256 then
    raise exception using errcode = '22023', message = 'payload_hash_mismatch';
  end if;
  begin
    v_payload := p_payload_text::jsonb;
  exception when others then
    raise exception using errcode = '22023', message = 'invalid_payload_json';
  end;

  if jsonb_typeof(v_payload) <> 'object'
     or (select array_agg(key order by key) from jsonb_object_keys(v_payload) as key)
        is distinct from array['customers','devices','order_events','repair_orders','suppliers']::text[]
     or jsonb_typeof(v_payload->'customers') <> 'array'
     or jsonb_typeof(v_payload->'devices') <> 'array'
     or jsonb_typeof(v_payload->'suppliers') <> 'array'
     or jsonb_typeof(v_payload->'repair_orders') <> 'array'
     or jsonb_typeof(v_payload->'order_events') <> 'array' then
    raise exception using errcode = '22023', message = 'invalid_payload_shape';
  end if;

  v_counts := jsonb_build_object(
    'customers', jsonb_array_length(v_payload->'customers'),
    'devices', jsonb_array_length(v_payload->'devices'),
    'suppliers', jsonb_array_length(v_payload->'suppliers'),
    'repair_orders', jsonb_array_length(v_payload->'repair_orders'),
    'order_events', jsonb_array_length(v_payload->'order_events'),
    'order_external_refs', jsonb_array_length(v_payload->'order_events')
  );
  if v_counts is distinct from p_expected_counts then
    raise exception using errcode = '22023', message = 'payload_count_mismatch';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_payload->'customers') as item
    where item->>'store_id' is distinct from p_store_id::text
       or coalesce(item->>'phone_e164', '') = ''
       or coalesce(item->>'name', '') = ''
       or coalesce((item->>'consent_marketing')::boolean, true)
       or coalesce((item->>'consent_sms')::boolean, true)
  ) or exists (
    select 1 from jsonb_array_elements(v_payload->'devices') as item
    where item->>'store_id' is distinct from p_store_id::text
  ) or exists (
    select 1 from jsonb_array_elements(v_payload->'suppliers') as item
    where item->>'store_id' is distinct from p_store_id::text
  ) or exists (
    select 1 from jsonb_array_elements(v_payload->'repair_orders') as item
    where item->>'store_id' is distinct from p_store_id::text
       or item ?| array['device_unlock_value','device_unlock_pattern','password','pin','secret']
       or coalesce(item->>'status_raw', '') ~* '(fatto|作废|作廢|void|cancel)'
       or coalesce((item->>'quotation_amount')::numeric, -1) < 0
       or coalesce((item->>'deposit_amount')::numeric, -1) < 0
       or (item->>'deposit_amount')::numeric > (item->>'quotation_amount')::numeric
       or coalesce(item->>'currency_code', '') <> 'EUR'
       or coalesce(item->>'created_at', '') = ''
       or ((item->>'delivered_at') is not null and (item->>'delivered_at')::timestamptz < (item->>'created_at')::timestamptz)
       or ((item->>'completed_at') is not null and (item->>'completed_at')::timestamptz < (item->>'created_at')::timestamptz)
  ) or exists (
    select 1 from jsonb_array_elements(v_payload->'order_events') as item
    where item->>'store_id' is distinct from p_store_id::text
       or jsonb_typeof(item->'payload') <> 'object'
       or (select array_agg(key order by key) from jsonb_object_keys(item->'payload') as key)
          is distinct from array[
            'action','currency_code','fallback_timestamp','import_batch_id',
            'mapper_version','provenance_version','source','source_data_aggiunta',
            'source_data_ritiro','source_file','source_file_sha256','source_row',
            'source_status','source_supplier'
          ]::text[]
       or (item->'payload') ?| array['name','phone','phone_e164','imei','serial_or_imei','issue_description','problem','pin','password','secret','device_unlock_value']
       or item->>'operator_name' is distinct from 'SeaTable 导入'
       or item->'payload'->>'action' is distinct from 'seatable_imported'
       or item->'payload'->>'source' is distinct from 'RIPARAZIONE'
       or item->'payload'->>'currency_code' is distinct from 'EUR'
       or item->'payload'->>'mapper_version' is distinct from '2026-07-16'
       or item->'payload'->>'provenance_version' is distinct from '1'
       or item->'payload'->>'source_file' is distinct from 'chinatech-current-repairs-private.csv'
       or length(coalesce(item->'payload'->>'source_status', '')) > 80
       or length(coalesce(item->'payload'->>'source_supplier', '')) > 80
       or jsonb_typeof(item->'payload'->'fallback_timestamp') <> 'string'
       or item->'payload'->>'fallback_timestamp' is distinct from '2026-08-04T07:00:00.000Z'
       or coalesce(item->'payload'->>'source_data_aggiunta', '') = ''
       or coalesce(item->'payload'->>'source_data_ritiro', '') = ''
       or item->'payload'->>'source_file_sha256' is distinct from p_source_sha256
       or item->'payload'->>'import_batch_id' is distinct from p_batch_id
  ) then
    raise exception using errcode = '22023', message = 'payload_invariant_failed';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_payload->'repair_orders') as order_item
    left join jsonb_array_elements(v_payload->'order_events') as event_item
      on event_item->>'order_id' = order_item->>'id'
    where event_item is null
       or (order_item->>'created_at')::timestamptz
          is distinct from (event_item->'payload'->>'source_data_aggiunta')::timestamptz
       or (event_item->>'created_at')::timestamptz
          is distinct from (event_item->'payload'->>'source_data_aggiunta')::timestamptz
       or (
         order_item->>'delivered_at' is not null
         and (order_item->>'delivered_at')::timestamptz
             is distinct from (event_item->'payload'->>'source_data_ritiro')::timestamptz
       )
       or (
         order_item->>'completed_at' is not null
         and (order_item->>'completed_at')::timestamptz
             is distinct from (event_item->'payload'->>'source_data_ritiro')::timestamptz
       )
  ) then
    raise exception using errcode = '22023', message = 'historical_time_contract_failed';
  end if;

  if (select count(*) from public.customers where store_id = p_store_id) <> 0
     or (select count(*) from public.devices where store_id = p_store_id) <> 0
     or (select count(*) from public.suppliers where store_id = p_store_id) <> 0
     or (select count(*) from public.repair_orders where store_id = p_store_id) <> 0
     or (select count(*) from public.order_events where store_id = p_store_id) <> 0
     or (select count(*) from public.order_external_refs where store_id = p_store_id) <> 0 then
    raise exception using errcode = '55000', message = 'target_baseline_changed';
  end if;

  if exists (
    select 1 from jsonb_array_elements(v_payload->'customers') item join public.customers row on row.id = (item->>'id')::uuid
  ) or exists (
    select 1 from jsonb_array_elements(v_payload->'devices') item join public.devices row on row.id = (item->>'id')::uuid
  ) or exists (
    select 1 from jsonb_array_elements(v_payload->'suppliers') item join public.suppliers row on row.id = (item->>'id')::uuid
  ) or exists (
    select 1 from jsonb_array_elements(v_payload->'repair_orders') item join public.repair_orders row on row.id = (item->>'id')::uuid or row.public_no = item->>'public_no'
  ) or exists (
    select 1 from jsonb_array_elements(v_payload->'order_events') item join public.order_events row on row.id = (item->>'id')::uuid
  ) then
    raise exception using errcode = '23505', message = 'global_identity_collision';
  end if;

  insert into private.seatable_current_repair_import_batches (
    store_id, batch_id, actor_id, approval_ref_sha256, source_sha256,
    payload_sha256, expected_counts, status, created_at, updated_at
  ) values (
    p_store_id, p_batch_id, p_actor_id, p_approval_ref_sha256, p_source_sha256,
    p_payload_sha256, p_expected_counts, 'applying', v_now, v_now
  );
  if p_fail_after_stage = 'ledger' then raise exception 'rehearsal_failure:ledger'; end if;

  insert into public.suppliers (id, store_id, name, short_name, color, created_at, updated_at)
  select id, p_store_id, name, short_name, color, v_now, v_now
  from jsonb_to_recordset(v_payload->'suppliers') as row(
    id uuid, name text, short_name text, color text
  );
  get diagnostics v_inserted = row_count;
  if v_inserted <> 7 then raise exception 'supplier_count_mismatch'; end if;
  if p_fail_after_stage = 'suppliers' then raise exception 'rehearsal_failure:suppliers'; end if;

  insert into public.customers (
    id, store_id, name, phone_e164, phone_raw, contact_phones,
    consent_marketing, consent_sms, consent_required_notify,
    preferred_channel, language, created_at, updated_at
  )
  select id, p_store_id, name, phone_e164, phone_raw, contact_phones,
    false, false, false, preferred_channel, language, created_at, updated_at
  from jsonb_to_recordset(v_payload->'customers') as row(
    id uuid, name text, phone_e164 text, phone_raw text, contact_phones text[],
    preferred_channel text, language text, created_at timestamptz, updated_at timestamptz
  );
  get diagnostics v_inserted = row_count;
  if v_inserted <> 162 then raise exception 'customer_count_mismatch'; end if;
  if p_fail_after_stage = 'customers' then raise exception 'rehearsal_failure:customers'; end if;

  insert into public.devices (
    id, store_id, customer_id, brand, model, serial_or_imei,
    device_notes, created_at, updated_at
  )
  select id, p_store_id, customer_id, brand, model, serial_or_imei,
    device_notes, created_at, updated_at
  from jsonb_to_recordset(v_payload->'devices') as row(
    id uuid, customer_id uuid, brand text, model text, serial_or_imei text,
    device_notes text, created_at timestamptz, updated_at timestamptz
  );
  get diagnostics v_inserted = row_count;
  if v_inserted <> 167 then raise exception 'device_count_mismatch'; end if;
  if p_fail_after_stage = 'devices' then raise exception 'rehearsal_failure:devices'; end if;

  insert into public.repair_orders (
    id, store_id, public_no, order_type, status, customer_id, device_id,
    issue_description, diagnosis_result, quotation_amount, deposit_amount,
    balance_amount, is_paid, approval_status, approval_sent_at,
    approval_confirmed_at, technician_name, internal_tag, warranty_text,
    completed_at, delivered_at, pause_reason, cancel_reason, supplier_id,
    parts_supplier_id, original_order_id, contact_phones, fault_prices,
    customer_signature, currency_code, device_snapshot, accessory_notes,
    workflow_status, exception_status, payment_status, approval_flow_status,
    parts_status, notify_status, device_custody_status, created_at, updated_at
  )
  select id, p_store_id, public_no, order_type::public.repair_order_type, status,
    customer_id, device_id, issue_description, diagnosis_result,
    quotation_amount, deposit_amount, balance_amount, is_paid,
    approval_status::public.approval_status, approval_sent_at,
    approval_confirmed_at, technician_name, internal_tag, warranty_text,
    completed_at, delivered_at, pause_reason, cancel_reason, null::uuid,
    parts_supplier_id, original_order_id, contact_phones, fault_prices,
    customer_signature, currency_code, device_snapshot, accessory_notes,
    workflow_status, exception_status, payment_status, approval_flow_status,
    parts_status, notify_status,
    case when delivered_at is null then 'with_shop' else 'with_customer' end,
    created_at, updated_at
  from jsonb_to_recordset(v_payload->'repair_orders') as row(
    id uuid, public_no text, order_type text, status text, customer_id uuid,
    device_id uuid, issue_description text, diagnosis_result text,
    quotation_amount numeric, deposit_amount numeric, balance_amount numeric,
    is_paid boolean, approval_status text, approval_sent_at timestamptz,
    approval_confirmed_at timestamptz, technician_name text, internal_tag text,
    warranty_text text, completed_at timestamptz, delivered_at timestamptz,
    pause_reason text, cancel_reason text, supplier_id uuid, parts_supplier_id uuid,
    original_order_id uuid, contact_phones text[], fault_prices jsonb,
    customer_signature text, currency_code text, device_snapshot jsonb,
    accessory_notes text, workflow_status text, exception_status text,
    payment_status text, approval_flow_status text, parts_status text,
    notify_status text, created_at timestamptz, updated_at timestamptz
  );
  get diagnostics v_inserted = row_count;
  if v_inserted <> 167 then raise exception 'order_count_mismatch'; end if;
  if p_fail_after_stage = 'orders' then raise exception 'rehearsal_failure:orders'; end if;

  insert into public.order_events (id, store_id, order_id, event_type, payload, operator_name, created_at)
  select id, p_store_id, order_id, event_type, payload, operator_name, created_at
  from jsonb_to_recordset(v_payload->'order_events') as row(
    id uuid, order_id uuid, event_type text, payload jsonb,
    operator_name text, created_at timestamptz
  );
  get diagnostics v_inserted = row_count;
  if v_inserted <> 167 then raise exception 'event_count_mismatch'; end if;
  if p_fail_after_stage = 'events' then raise exception 'rehearsal_failure:events'; end if;

  insert into public.order_external_refs (
    id, store_id, source_system, external_record_id, order_id, created_at, updated_at
  )
  select gen_random_uuid(), p_store_id, 'seatable:riparazione:strict-v1',
    p_source_sha256 || ':row:' || (event.payload->>'source_row'),
    event.order_id, v_now, v_now
  from public.order_events as event
  where event.store_id = p_store_id
    and event.id in (
      select (item->>'id')::uuid from jsonb_array_elements(v_payload->'order_events') item
    );
  get diagnostics v_inserted = row_count;
  if v_inserted <> 167 then raise exception 'external_ref_count_mismatch'; end if;
  if p_fail_after_stage = 'refs' then raise exception 'rehearsal_failure:refs'; end if;

  for v_source_row, v_order_id, v_customer_id, v_device_id, v_supplier_id,
      v_event_id, v_external_ref_id, v_external_record_id, v_order_updated_at,
      v_order_status, v_customer_hash, v_device_hash, v_supplier_hash,
      v_event_hash, v_external_hash, v_identity_hash, v_fault_hash in
    select
      (event.payload->>'source_row')::integer,
      order_row.id,
      order_row.customer_id,
      order_row.device_id,
      order_row.parts_supplier_id,
      event.id,
      external_ref.id,
      external_ref.external_record_id,
      order_row.updated_at,
      order_row.status,
      encode(extensions.digest(pg_catalog.convert_to(to_jsonb(customer_row)::text, 'UTF8'), 'sha256'), 'hex'),
      encode(extensions.digest(pg_catalog.convert_to(to_jsonb(device_row)::text, 'UTF8'), 'sha256'), 'hex'),
      case when supplier_row.id is null then null else
        encode(extensions.digest(pg_catalog.convert_to(to_jsonb(supplier_row)::text, 'UTF8'), 'sha256'), 'hex')
      end,
      encode(extensions.digest(pg_catalog.convert_to(to_jsonb(event)::text, 'UTF8'), 'sha256'), 'hex'),
      encode(extensions.digest(pg_catalog.convert_to(to_jsonb(external_ref)::text, 'UTF8'), 'sha256'), 'hex'),
      encode(extensions.digest(pg_catalog.convert_to(to_jsonb(identity_row)::text, 'UTF8'), 'sha256'), 'hex'),
      encode(extensions.digest(pg_catalog.convert_to(order_row.fault_prices::text, 'UTF8'), 'sha256'), 'hex')
    from public.order_events event
    join public.repair_orders order_row on order_row.store_id = event.store_id and order_row.id = event.order_id
    join public.customers customer_row on customer_row.store_id = order_row.store_id and customer_row.id = order_row.customer_id
    join public.devices device_row on device_row.store_id = order_row.store_id and device_row.id = order_row.device_id
    left join public.suppliers supplier_row on supplier_row.store_id = order_row.store_id and supplier_row.id = order_row.parts_supplier_id
    join public.order_external_refs external_ref on external_ref.store_id = event.store_id and external_ref.order_id = event.order_id
    join public.repair_order_customer_status_identities identity_row
      on identity_row.store_id = event.store_id and identity_row.order_id = event.order_id
    where event.store_id = p_store_id
      and event.id in (select (item->>'id')::uuid from jsonb_array_elements(v_payload->'order_events') item)
  loop
    if pg_catalog.to_regclass('public.repair_order_line_costs') is not null then
      execute $cost$
        select encode(extensions.digest(pg_catalog.convert_to(
          coalesce(jsonb_agg(to_jsonb(cost_row) order by id)::text, '[]'),
          'UTF8'), 'sha256'), 'hex')
        from public.repair_order_line_costs cost_row where store_id = $1 and order_id = $2
      $cost$ into v_cost_hash using p_store_id, v_order_id;
    else
      v_cost_hash := null;
    end if;
    if pg_catalog.to_regclass('public.repair_order_line_cost_revisions') is not null then
      execute $revision$
        select encode(extensions.digest(pg_catalog.convert_to(
          coalesce(jsonb_agg(to_jsonb(revision_row) order by id)::text, '[]'),
          'UTF8'), 'sha256'), 'hex')
        from public.repair_order_line_cost_revisions revision_row
        where store_id = $1 and order_id = $2
      $revision$ into v_revision_hash using p_store_id, v_order_id;
    else
      v_revision_hash := null;
    end if;
    insert into private.seatable_current_repair_import_rows (
      store_id, batch_id, source_row, customer_id, device_id, supplier_id,
      order_id, event_id, external_ref_id, external_record_id,
      expected_order_updated_at, expected_order_status,
      expected_customer_sha256, expected_device_sha256, expected_supplier_sha256,
      expected_event_sha256, expected_external_ref_sha256, expected_identity_sha256,
      expected_fault_prices_sha256, expected_cost_rows_sha256,
      expected_cost_revision_sha256
    ) values (
      p_store_id, p_batch_id, v_source_row, v_customer_id, v_device_id, v_supplier_id,
      v_order_id, v_event_id, v_external_ref_id, v_external_record_id,
      v_order_updated_at, v_order_status,
      v_customer_hash, v_device_hash, v_supplier_hash,
      v_event_hash, v_external_hash, v_identity_hash,
      v_fault_hash, v_cost_hash, v_revision_hash
    );
  end loop;

  if (select count(*) from private.seatable_current_repair_import_rows where store_id = p_store_id and batch_id = p_batch_id) <> 167 then
    raise exception 'ledger_row_count_mismatch';
  end if;

  update private.seatable_current_repair_import_batches
  set status = 'applied', result_counts = v_counts, applied_at = v_now, updated_at = v_now
  where store_id = p_store_id and batch_id = p_batch_id;

  if p_mode = 'rehearsal' or p_fail_after_stage = 'complete' then
    raise exception using errcode = 'P0001', message = 'rehearsal_complete_forced_rollback';
  end if;

  return jsonb_build_object(
    'code', 'applied', 'replayed', false, 'batch_id', p_batch_id,
    'payload_sha256', p_payload_sha256, 'counts', v_counts
  );
end;
$$;

create or replace function public.repairdesk_rollback_seatable_current_repairs_v1(
  p_project_ref text,
  p_store_id uuid,
  p_actor_id uuid,
  p_batch_id text,
  p_approval_ref_sha256 text,
  p_source_sha256 text,
  p_payload_sha256 text,
  p_maintenance_ack boolean,
  p_preview_only boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch private.seatable_current_repair_import_batches%rowtype;
  v_blockers integer := 0;
  v_expected integer;
  v_cost_hash text;
  v_revision_hash text;
  v_fk record;
  v_target record;
  v_fk_count bigint;
  v_row private.seatable_current_repair_import_rows%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if p_project_ref is distinct from 'xluzcoduqsdvjoouqhkc'
     or p_store_id is distinct from '5248dda1-2b32-46cd-8ed0-d15386a9e8ed'::uuid
     or p_maintenance_ack is distinct from true then
    raise exception using errcode = '42501', message = 'rollback_target_not_authorized';
  end if;
  if p_batch_id is distinct from 'seatable-current-20260804-strict-v4'
     or p_approval_ref_sha256 is distinct from '5d57f98532d756446c3152e1a2f171bb185a5e73e92ef5cbe1702af2e4031edf'
     or p_source_sha256 is distinct from 'eaa3ee01e3cae810aba29cece630356701e5fa9261a84e040f9f66703e684bf3'
     or p_payload_sha256 is distinct from '4efb81a3a9f01e05c7a9f77adab50c56bc3231e8dac45d844e6288b4eb5be17a' then
    raise exception using errcode = '42501', message = 'approved_artifact_binding_mismatch';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_store_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_store_id::text || ':seatable-current-repair-import', 0)
  );
  if not exists (
    select 1 from public.stores store_row
    where store_row.id = p_store_id
      and store_row.owner_user_id = p_actor_id
      and store_row.status = 'active'::public.store_status
      and exists (
        select 1 from public.store_memberships membership
        where membership.store_id = p_store_id and membership.user_id = p_actor_id
          and membership.role = 'owner'::public.staff_role
          and membership.status = 'active'::public.store_membership_status
      )
  ) then
    raise exception using errcode = '42501', message = 'active_primary_owner_required';
  end if;

  select * into strict v_batch
  from private.seatable_current_repair_import_batches
  where store_id = p_store_id and batch_id = p_batch_id
  for update;
  if v_batch.status <> 'applied'
     or v_batch.approval_ref_sha256 is distinct from p_approval_ref_sha256
     or v_batch.source_sha256 is distinct from p_source_sha256
     or v_batch.payload_sha256 is distinct from p_payload_sha256 then
    raise exception using errcode = '55000', message = 'rollback_binding_mismatch';
  end if;

  select count(*) into v_expected
  from private.seatable_current_repair_import_rows
  where store_id = p_store_id and batch_id = p_batch_id;
  if v_expected <> 167 then raise exception 'rollback_ledger_incomplete'; end if;

  for v_row in
    select * from private.seatable_current_repair_import_rows
    where store_id = p_store_id and batch_id = p_batch_id
    order by source_row
  loop
    if not exists (
      select 1 from public.repair_orders order_row
      where order_row.store_id = p_store_id and order_row.id = v_row.order_id
        and order_row.updated_at = v_row.expected_order_updated_at
        and order_row.status = v_row.expected_order_status
        and encode(extensions.digest(pg_catalog.convert_to(order_row.fault_prices::text, 'UTF8'), 'sha256'), 'hex') = v_row.expected_fault_prices_sha256
    ) then
      v_blockers := v_blockers + 1;
    end if;
    if not exists (
      select 1 from public.customers customer_row
      where customer_row.store_id = p_store_id and customer_row.id = v_row.customer_id
        and encode(extensions.digest(pg_catalog.convert_to(to_jsonb(customer_row)::text, 'UTF8'), 'sha256'), 'hex')
            = v_row.expected_customer_sha256
    ) or not exists (
      select 1 from public.devices device_row
      where device_row.store_id = p_store_id and device_row.id = v_row.device_id
        and encode(extensions.digest(pg_catalog.convert_to(to_jsonb(device_row)::text, 'UTF8'), 'sha256'), 'hex')
            = v_row.expected_device_sha256
    ) or (
      v_row.supplier_id is not null and not exists (
        select 1 from public.suppliers supplier_row
        where supplier_row.store_id = p_store_id and supplier_row.id = v_row.supplier_id
          and encode(extensions.digest(pg_catalog.convert_to(to_jsonb(supplier_row)::text, 'UTF8'), 'sha256'), 'hex')
              = v_row.expected_supplier_sha256
      )
    ) then
      v_blockers := v_blockers + 1;
    end if;
    if (select count(*) from public.order_events where store_id = p_store_id and order_id = v_row.order_id) <> 1
       or (select count(*) from public.order_external_refs where store_id = p_store_id and order_id = v_row.order_id) <> 1
       or not exists (select 1 from public.order_events where store_id = p_store_id and id = v_row.event_id and order_id = v_row.order_id)
       or not exists (
         select 1 from public.order_external_refs
         where store_id = p_store_id and id = v_row.external_ref_id
           and order_id = v_row.order_id and external_record_id = v_row.external_record_id
       ) then
      v_blockers := v_blockers + 1;
    end if;
    if not exists (
      select 1 from public.order_events event_row
      where event_row.store_id = p_store_id and event_row.id = v_row.event_id
        and encode(extensions.digest(pg_catalog.convert_to(to_jsonb(event_row)::text, 'UTF8'), 'sha256'), 'hex')
            = v_row.expected_event_sha256
    ) or not exists (
      select 1 from public.order_external_refs external_ref_row
      where external_ref_row.store_id = p_store_id and external_ref_row.id = v_row.external_ref_id
        and encode(extensions.digest(pg_catalog.convert_to(to_jsonb(external_ref_row)::text, 'UTF8'), 'sha256'), 'hex')
            = v_row.expected_external_ref_sha256
    ) or not exists (
      select 1 from public.repair_order_customer_status_identities identity_row
      where identity_row.store_id = p_store_id and identity_row.order_id = v_row.order_id
        and encode(extensions.digest(pg_catalog.convert_to(to_jsonb(identity_row)::text, 'UTF8'), 'sha256'), 'hex')
            = v_row.expected_identity_sha256
    ) then
      v_blockers := v_blockers + 1;
    end if;
    if exists (select 1 from public.message_logs where store_id = p_store_id and order_id = v_row.order_id)
       or exists (select 1 from public.customer_interactions where store_id = p_store_id and order_id = v_row.order_id)
       or exists (select 1 from public.order_attachments where store_id = p_store_id and order_id = v_row.order_id)
       or exists (select 1 from public.order_payment_ledger where store_id = p_store_id and order_id = v_row.order_id)
       or exists (select 1 from public.order_part_allocations where store_id = p_store_id and order_id = v_row.order_id) then
      v_blockers := v_blockers + 1;
    end if;
    if pg_catalog.to_regclass('public.repair_order_line_costs') is not null then
      execute $cost$
        select encode(extensions.digest(pg_catalog.convert_to(
          coalesce(jsonb_agg(to_jsonb(cost_row) order by id)::text, '[]'),
          'UTF8'), 'sha256'), 'hex')
        from public.repair_order_line_costs cost_row where store_id = $1 and order_id = $2
      $cost$ into v_cost_hash using p_store_id, v_row.order_id;
      if v_cost_hash is distinct from v_row.expected_cost_rows_sha256 then v_blockers := v_blockers + 1; end if;
    end if;
    if pg_catalog.to_regclass('public.repair_order_line_cost_revisions') is not null then
      execute $revision$
        select encode(extensions.digest(pg_catalog.convert_to(
          coalesce(jsonb_agg(to_jsonb(revision_row) order by id)::text, '[]'),
          'UTF8'), 'sha256'), 'hex')
        from public.repair_order_line_cost_revisions revision_row
        where store_id = $1 and order_id = $2
      $revision$ into v_revision_hash using p_store_id, v_row.order_id;
      if v_revision_hash is distinct from v_row.expected_cost_revision_sha256 then v_blockers := v_blockers + 1; end if;
    end if;
  end loop;

  for v_fk in
    select namespace_row.nspname as schema_name,
      relation_row.relname as table_name,
      source_column.attname as order_id_column
    from pg_catalog.pg_constraint fk
    join pg_catalog.pg_class relation_row on relation_row.oid = fk.conrelid
    join pg_catalog.pg_namespace namespace_row on namespace_row.oid = relation_row.relnamespace
    join lateral unnest(fk.conkey, fk.confkey) with ordinality
      as key_pair(source_attnum, target_attnum, position) on true
    join pg_catalog.pg_attribute source_column
      on source_column.attrelid = fk.conrelid and source_column.attnum = key_pair.source_attnum
    join pg_catalog.pg_attribute target_column
      on target_column.attrelid = fk.confrelid and target_column.attnum = key_pair.target_attnum
    where fk.contype = 'f'
      and fk.confrelid = 'public.repair_orders'::regclass
      and target_column.attname = 'id'
      and not (
        namespace_row.nspname = 'public'
        and relation_row.relname in (
          'order_events', 'order_external_refs',
          'repair_order_customer_status_identities', 'repair_order_line_costs',
          'repair_order_line_cost_revisions'
        )
      )
  loop
    execute pg_catalog.format(
      'select count(*) from %I.%I dependent where dependent.%I in (
         select order_id from private.seatable_current_repair_import_rows
         where store_id = $1 and batch_id = $2
       )',
      v_fk.schema_name, v_fk.table_name, v_fk.order_id_column
    ) into v_fk_count using p_store_id, p_batch_id;
    if v_fk_count <> 0 then
      v_blockers := v_blockers + 1;
    end if;
  end loop;

  for v_target in
    select * from (values
      ('public.customers'::regclass, 'customer_id'::text, array['devices','repair_orders']::text[]),
      ('public.devices'::regclass, 'device_id'::text, array['repair_orders']::text[]),
      ('public.suppliers'::regclass, 'supplier_id'::text, array['repair_orders']::text[])
    ) as target(target_relation, ledger_column, allowed_relations)
  loop
    for v_fk in
      select namespace_row.nspname as schema_name,
        relation_row.relname as table_name,
        source_column.attname as target_id_column
      from pg_catalog.pg_constraint fk
      join pg_catalog.pg_class relation_row on relation_row.oid = fk.conrelid
      join pg_catalog.pg_namespace namespace_row on namespace_row.oid = relation_row.relnamespace
      join lateral unnest(fk.conkey, fk.confkey) with ordinality
        as key_pair(source_attnum, target_attnum, position) on true
      join pg_catalog.pg_attribute source_column
        on source_column.attrelid = fk.conrelid and source_column.attnum = key_pair.source_attnum
      join pg_catalog.pg_attribute target_column
        on target_column.attrelid = fk.confrelid and target_column.attnum = key_pair.target_attnum
      where fk.contype = 'f'
        and fk.confrelid = v_target.target_relation
        and target_column.attname = 'id'
        and not relation_row.relname = any(v_target.allowed_relations)
    loop
      execute pg_catalog.format(
        'select count(*) from %I.%I dependent where dependent.%I in (
           select %I from private.seatable_current_repair_import_rows
           where store_id = $1 and batch_id = $2 and %I is not null
         )',
        v_fk.schema_name, v_fk.table_name, v_fk.target_id_column,
        v_target.ledger_column, v_target.ledger_column
      ) into v_fk_count using p_store_id, p_batch_id;
      if v_fk_count <> 0 then
        v_blockers := v_blockers + 1;
      end if;
    end loop;
  end loop;

  if v_blockers <> 0 then
    raise exception using errcode = '55000', message = 'rollback_business_activity_detected';
  end if;
  if p_preview_only then
    return jsonb_build_object('code', 'rollback_preview_clear', 'eligible_orders', 167, 'blockers', 0);
  end if;

  delete from public.repair_orders order_row
  using private.seatable_current_repair_import_rows ledger
  where ledger.store_id = p_store_id and ledger.batch_id = p_batch_id
    and order_row.store_id = ledger.store_id and order_row.id = ledger.order_id;
  get diagnostics v_expected = row_count;
  if v_expected <> 167 then raise exception 'rollback_order_count_mismatch'; end if;

  delete from public.devices device_row
  using private.seatable_current_repair_import_rows ledger
  where ledger.store_id = p_store_id and ledger.batch_id = p_batch_id
    and device_row.store_id = ledger.store_id and device_row.id = ledger.device_id
    and not exists (select 1 from public.repair_orders remaining where remaining.store_id = device_row.store_id and remaining.device_id = device_row.id);

  delete from public.customers customer_row
  where customer_row.store_id = p_store_id
    and customer_row.id in (
      select distinct customer_id from private.seatable_current_repair_import_rows
      where store_id = p_store_id and batch_id = p_batch_id
    )
    and not exists (select 1 from public.devices remaining where remaining.store_id = customer_row.store_id and remaining.customer_id = customer_row.id)
    and not exists (select 1 from public.repair_orders remaining where remaining.store_id = customer_row.store_id and remaining.customer_id = customer_row.id);

  delete from public.suppliers supplier_row
  where supplier_row.store_id = p_store_id
    and supplier_row.id in (
      select distinct supplier_id from private.seatable_current_repair_import_rows
      where store_id = p_store_id and batch_id = p_batch_id and supplier_id is not null
    )
    and not exists (select 1 from public.repair_orders remaining where remaining.store_id = supplier_row.store_id and (remaining.supplier_id = supplier_row.id or remaining.parts_supplier_id = supplier_row.id));

  if (select count(*) from public.repair_orders where store_id = p_store_id) <> 0
     or (select count(*) from public.devices where store_id = p_store_id) <> 0
     or (select count(*) from public.customers where store_id = p_store_id) <> 0
     or (select count(*) from public.suppliers where store_id = p_store_id) <> 0
     or (select count(*) from public.order_events where store_id = p_store_id) <> 0
     or (select count(*) from public.order_external_refs where store_id = p_store_id) <> 0 then
    raise exception 'rollback_residual_business_rows';
  end if;

  update private.seatable_current_repair_import_batches
  set status = 'rolled_back', rolled_back_at = v_now, updated_at = v_now
  where store_id = p_store_id and batch_id = p_batch_id;

  return jsonb_build_object(
    'code', 'rolled_back', 'orders_deleted', 167,
    'audit_ledger_retained', true, 'domain_revision_not_rewound', true
  );
end;
$$;

alter function public.repairdesk_apply_seatable_current_repairs_v1(
  text, uuid, uuid, text, text, text, text, jsonb, text, boolean, text, text
) owner to postgres;
alter function public.repairdesk_rollback_seatable_current_repairs_v1(
  text, uuid, uuid, text, text, text, text, boolean, boolean
) owner to postgres;

revoke all on function public.repairdesk_apply_seatable_current_repairs_v1(
  text, uuid, uuid, text, text, text, text, jsonb, text, boolean, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.repairdesk_rollback_seatable_current_repairs_v1(
  text, uuid, uuid, text, text, text, text, boolean, boolean
) from public, anon, authenticated, service_role;
grant execute on function public.repairdesk_apply_seatable_current_repairs_v1(
  text, uuid, uuid, text, text, text, text, jsonb, text, boolean, text, text
) to service_role;
grant execute on function public.repairdesk_rollback_seatable_current_repairs_v1(
  text, uuid, uuid, text, text, text, text, boolean, boolean
) to service_role;

comment on function public.repairdesk_apply_seatable_current_repairs_v1(
  text, uuid, uuid, text, text, text, text, jsonb, text, boolean, text, text
) is 'One-off, append-only, all-or-nothing SeaTable current repair import. D4 approval required.';
comment on function public.repairdesk_rollback_seatable_current_repairs_v1(
  text, uuid, uuid, text, text, text, text, boolean, boolean
) is 'Fail-closed preview/apply rollback for the exact SeaTable current repair import batch.';

notify pgrst, 'reload schema';
