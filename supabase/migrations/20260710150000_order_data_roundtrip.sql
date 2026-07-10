create table if not exists public.order_data_batches (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  actor_id uuid,
  kind text not null check (kind in ('template', 'order_export', 'customer_stats', 'import')),
  template_version text not null,
  parser_version text not null,
  mode text check (mode is null or mode in ('update_only', 'create_and_update')),
  status text not null check (status in ('building', 'completed', 'previewed', 'applying', 'applied', 'partial', 'failed', 'expired', 'rolled_back', 'rollback_partial')),
  source_batch_id uuid,
  file_hash text,
  payload_hash text,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  previewed_at timestamptz,
  applied_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint order_data_batches_store_id_fkey
    foreign key (store_id) references public.stores(id)
    on update cascade on delete cascade,
  constraint order_data_batches_actor_id_fkey
    foreign key (actor_id) references public.staff_profiles(id)
    on update cascade on delete set null,
  constraint order_data_batches_id_store_id_key
    unique (id, store_id),
  constraint order_data_batches_source_batch_store_fkey
    foreign key (source_batch_id, store_id) references public.order_data_batches(id, store_id)
    on update cascade on delete set null (source_batch_id),
  constraint order_data_batches_summary_object
    check (jsonb_typeof(summary) = 'object')
);

create index if not exists order_data_batches_store_created_idx
  on public.order_data_batches (store_id, created_at desc);
create index if not exists order_data_batches_expiry_idx
  on public.order_data_batches (expires_at)
  where status in ('building', 'previewed');

create table if not exists public.order_data_batch_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  store_id uuid not null,
  row_number integer not null check (row_number > 1),
  action text not null check (action in ('create', 'update', 'skip')),
  status text not null check (status in ('ready', 'invalid', 'applied', 'conflict', 'failed', 'skipped', 'rolled_back', 'rollback_conflict', 'recovery_manual')),
  order_id uuid,
  expected_updated_at timestamptz,
  customer_id uuid,
  customer_expected_updated_at timestamptz,
  device_id uuid,
  device_expected_updated_at timestamptz,
  source_system text,
  external_record_id text,
  normalized_data jsonb not null default '{}'::jsonb,
  changed_fields text[] not null default '{}',
  warnings jsonb not null default '[]'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  before_data jsonb not null default '{}'::jsonb,
  result_order_id uuid,
  after_updated_at timestamptz,
  applied_at timestamptz,
  rolled_back_at timestamptz,
  created_at timestamptz not null default now(),
  constraint order_data_batch_rows_batch_store_fkey
    foreign key (batch_id, store_id) references public.order_data_batches(id, store_id)
    on update cascade on delete cascade,
  constraint order_data_batch_rows_order_store_fkey
    foreign key (order_id, store_id) references public.repair_orders(id, store_id)
    on update cascade on delete restrict,
  constraint order_data_batch_rows_customer_store_fkey
    foreign key (customer_id, store_id) references public.customers(id, store_id)
    on update cascade on delete restrict,
  constraint order_data_batch_rows_device_store_fkey
    foreign key (device_id, store_id) references public.devices(id, store_id)
    on update cascade on delete restrict,
  constraint order_data_batch_rows_result_order_store_fkey
    foreign key (result_order_id, store_id) references public.repair_orders(id, store_id)
    on update cascade on delete restrict,
  constraint order_data_batch_rows_normalized_object
    check (jsonb_typeof(normalized_data) = 'object'),
  constraint order_data_batch_rows_warnings_array
    check (jsonb_typeof(warnings) = 'array'),
  constraint order_data_batch_rows_errors_array
    check (jsonb_typeof(errors) = 'array'),
  constraint order_data_batch_rows_before_object
    check (jsonb_typeof(before_data) = 'object'),
  constraint order_data_batch_rows_update_ready_fields
    check (
      status = 'invalid'
      or action <> 'update'
      or (order_id is not null and expected_updated_at is not null)
    ),
  constraint order_data_batch_rows_create_ready_fields
    check (
      status = 'invalid'
      or action <> 'create'
      or (
        nullif(trim(source_system), '') is not null
        and nullif(trim(external_record_id), '') is not null
      )
    ),
  unique (batch_id, row_number)
);

create index if not exists order_data_batch_rows_batch_status_idx
  on public.order_data_batch_rows (batch_id, status, row_number);

create table if not exists public.order_external_refs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  source_system text not null,
  external_record_id text not null,
  order_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_external_refs_store_id_fkey
    foreign key (store_id) references public.stores(id)
    on update cascade on delete cascade,
  constraint order_external_refs_order_store_fkey
    foreign key (order_id, store_id) references public.repair_orders(id, store_id)
    on update cascade on delete cascade,
  unique (store_id, source_system, external_record_id)
);

create index if not exists order_external_refs_order_idx
  on public.order_external_refs (store_id, order_id);

alter table public.order_data_batches enable row level security;
alter table public.order_data_batch_rows enable row level security;
alter table public.order_external_refs enable row level security;

revoke all on table public.order_data_batches from public, anon, authenticated;
revoke all on table public.order_data_batch_rows from public, anon, authenticated;
revoke all on table public.order_external_refs from public, anon, authenticated;
grant select, insert, update, delete on table public.order_data_batches to service_role;
grant select, insert, update, delete on table public.order_data_batch_rows to service_role;
grant select, insert, update, delete on table public.order_external_refs to service_role;

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
  v_batch public.order_data_batches%rowtype;
  v_row public.order_data_batch_rows%rowtype;
  v_order public.repair_orders%rowtype;
  v_customer public.customers%rowtype;
  v_device public.devices%rowtype;
  v_customer_id uuid;
  v_device_id uuid;
  v_order_id uuid;
  v_fault_prices jsonb;
  v_quotation numeric(12, 2);
  v_deposit numeric(12, 2);
  v_balance numeric(12, 2);
  v_paid_amount numeric(12, 2);
  v_contact_phones text[];
  v_success integer := 0;
  v_conflict integer := 0;
  v_failed integer := 0;
  v_skipped integer := 0;
  v_now timestamptz := now();
  v_result jsonb;
  v_before_data jsonb;
  v_has_customer_changes boolean;
  v_has_device_changes boolean;
  v_has_finance_changes boolean;
begin
  if not exists (
    select 1
    from public.stores s
    join public.store_memberships sm
      on sm.store_id = s.id
     and sm.user_id = p_actor_id
     and sm.role = 'owner'
     and sm.status = 'active'
    where s.id = p_store_id
      and s.owner_user_id = p_actor_id
      and s.status = 'active'
  ) then
    raise exception 'order_data_forbidden' using errcode = '42501';
  end if;

  select * into v_batch
  from public.order_data_batches
  where id = p_batch_id
    and store_id = p_store_id
    and actor_id = p_actor_id
    and kind = 'import'
  for update;

  if not found then
    raise exception 'order_data_batch_not_found' using errcode = 'P0002';
  end if;

  if v_batch.status in ('applied', 'partial') then
    return v_batch.summary;
  end if;
  if v_batch.status <> 'previewed' or v_batch.expires_at <= v_now then
    raise exception 'order_data_batch_not_applicable' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.order_data_batch_rows
    where batch_id = v_batch.id and status = 'invalid'
  ) then
    raise exception 'order_data_batch_has_invalid_rows' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.order_data_batch_rows
    where batch_id = v_batch.id and status = 'ready'
  ) then
    raise exception 'order_data_batch_has_no_ready_rows' using errcode = '22023';
  end if;

  update public.order_data_batches
  set status = 'applying'
  where id = v_batch.id;

  for v_row in
    select *
    from public.order_data_batch_rows
    where batch_id = v_batch.id
    order by row_number
  loop
    if v_row.status <> 'ready' or v_row.action = 'skip' then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    begin
      v_order_id := null;
      v_customer_id := null;
      v_device_id := null;
      v_contact_phones := null;
      v_paid_amount := 0;
      v_before_data := '{}'::jsonb;
      v_has_customer_changes := v_row.normalized_data ?| array[
        'customer_name', 'customer_phone_e164', 'customer_phone_raw', 'contact_phones'
      ];
      v_has_device_changes := v_row.normalized_data ?| array[
        'device_brand', 'device_model', 'device_imei', 'device_notes'
      ];
      v_has_finance_changes := v_row.normalized_data ?| array[
        'fault_prices', 'deposit_amount'
      ];
      if v_row.action = 'update' then
        select * into v_order
        from public.repair_orders
        where id = v_row.order_id
          and store_id = p_store_id
        for update;

        if not found then
          raise exception 'order_not_accessible' using errcode = 'P0002';
        end if;
        if v_row.expected_updated_at is null or v_order.updated_at <> v_row.expected_updated_at then
          raise exception 'order_version_conflict' using errcode = '40001';
        end if;

        if v_has_customer_changes then
          select * into v_customer
          from public.customers
          where id = v_order.customer_id
            and store_id = p_store_id
          for update;
          if not found
            or v_row.customer_expected_updated_at is null
            or v_customer.updated_at <> v_row.customer_expected_updated_at then
            raise exception 'customer_version_conflict' using errcode = '40001';
          end if;
          if v_row.normalized_data ? 'customer_phone_raw' and exists (
            select 1
            from public.customers other_customer
            where other_customer.store_id = p_store_id
              and other_customer.id <> v_customer.id
              and other_customer.phone_raw = v_row.normalized_data ->> 'customer_phone_raw'
          ) then
            raise exception 'customer_phone_conflict' using errcode = '40001';
          end if;
          v_before_data := v_before_data || jsonb_build_object(
            'customer', jsonb_build_object(
              'id', v_customer.id,
              'name', v_customer.name,
              'phone_e164', v_customer.phone_e164,
              'phone_raw', v_customer.phone_raw,
              'contact_phones', to_jsonb(v_customer.contact_phones),
              'updated_at', v_customer.updated_at
            )
          );
        end if;

        if v_has_device_changes then
          select * into v_device
          from public.devices
          where id = v_order.device_id
            and store_id = p_store_id
          for update;
          if not found
            or v_row.device_expected_updated_at is null
            or v_device.updated_at <> v_row.device_expected_updated_at then
            raise exception 'device_version_conflict' using errcode = '40001';
          end if;
          v_before_data := v_before_data || jsonb_build_object(
            'device', jsonb_build_object(
              'id', v_device.id,
              'brand', v_device.brand,
              'model', v_device.model,
              'serial_or_imei', v_device.serial_or_imei,
              'device_notes', v_device.device_notes,
              'updated_at', v_device.updated_at
            )
          );
        end if;

        v_before_data := v_before_data || jsonb_build_object(
          'order', jsonb_build_object(
            'id', v_order.id,
            'issue_description', v_order.issue_description,
            'diagnosis_result', v_order.diagnosis_result,
            'internal_tag', v_order.internal_tag,
            'accessory_notes', v_order.accessory_notes,
            'warranty_text', v_order.warranty_text,
            'warranty_months', v_order.warranty_months,
            'fault_prices', v_order.fault_prices,
            'quotation_amount', v_order.quotation_amount,
            'deposit_amount', v_order.deposit_amount,
            'balance_amount', v_order.balance_amount,
            'is_paid', v_order.is_paid,
            'payment_status', v_order.payment_status,
            'contact_phones', to_jsonb(v_order.contact_phones),
            'device_snapshot', v_order.device_snapshot,
            'updated_at', v_order.updated_at
          )
        );

        if v_has_customer_changes then
          update public.customers
          set
            name = case when v_row.normalized_data ? 'customer_name'
              then v_row.normalized_data ->> 'customer_name' else name end,
            phone_e164 = case when v_row.normalized_data ? 'customer_phone_e164'
              then v_row.normalized_data ->> 'customer_phone_e164' else phone_e164 end,
            phone_raw = case when v_row.normalized_data ? 'customer_phone_raw'
              then v_row.normalized_data ->> 'customer_phone_raw' else phone_raw end,
            contact_phones = case when v_row.normalized_data ? 'contact_phones'
              then array(
                select distinct phone
                from unnest(
                  coalesce(contact_phones, '{}'::text[])
                  || array(select jsonb_array_elements_text(v_row.normalized_data -> 'contact_phones'))
                ) phone
                where nullif(trim(phone), '') is not null
              )
              else contact_phones end,
            updated_at = v_now
          where id = v_order.customer_id
            and store_id = p_store_id;
        end if;

        if v_has_device_changes then
          update public.devices
          set
            brand = case when v_row.normalized_data ? 'device_brand'
              then v_row.normalized_data ->> 'device_brand' else brand end,
            model = case when v_row.normalized_data ? 'device_model'
              then v_row.normalized_data ->> 'device_model' else model end,
            serial_or_imei = case when v_row.normalized_data ? 'device_imei'
              then coalesce(v_row.normalized_data ->> 'device_imei', '') else serial_or_imei end,
            device_notes = case when v_row.normalized_data ? 'device_notes'
              then v_row.normalized_data ->> 'device_notes' else device_notes end,
            updated_at = v_now
          where id = v_order.device_id
            and store_id = p_store_id;
        end if;

        v_fault_prices := case when v_row.normalized_data ? 'fault_prices'
          then v_row.normalized_data -> 'fault_prices' else v_order.fault_prices end;
        if v_has_finance_changes then
          select coalesce(sum((item ->> 'price')::numeric), 0)
            into v_quotation
          from jsonb_array_elements(v_fault_prices) item;
          v_deposit := case when v_row.normalized_data ? 'deposit_amount'
            then (v_row.normalized_data ->> 'deposit_amount')::numeric else v_order.deposit_amount end;
          if v_deposit < 0 or v_deposit > v_quotation then
            raise exception 'invalid_deposit' using errcode = '22023';
          end if;
          v_paid_amount := greatest(
            0,
            v_order.quotation_amount - v_order.deposit_amount - v_order.balance_amount
          );
          v_balance := greatest(0, v_quotation - v_deposit - v_paid_amount);
        else
          v_quotation := v_order.quotation_amount;
          v_deposit := v_order.deposit_amount;
          v_balance := v_order.balance_amount;
        end if;
        select contact_phones into v_contact_phones
        from public.customers
        where id = v_order.customer_id
          and store_id = p_store_id;

        update public.repair_orders
        set
          issue_description = case when v_row.normalized_data ? 'issue_description'
            then v_row.normalized_data ->> 'issue_description' else issue_description end,
          diagnosis_result = case when v_row.normalized_data ? 'diagnosis_result'
            then v_row.normalized_data ->> 'diagnosis_result' else diagnosis_result end,
          internal_tag = case when v_row.normalized_data ? 'internal_tag'
            then v_row.normalized_data ->> 'internal_tag' else internal_tag end,
          accessory_notes = case when v_row.normalized_data ? 'accessory_notes'
            then v_row.normalized_data ->> 'accessory_notes' else accessory_notes end,
          warranty_text = case when v_row.normalized_data ? 'warranty_text'
            then v_row.normalized_data ->> 'warranty_text' else warranty_text end,
          warranty_months = case when v_row.normalized_data ? 'warranty_months'
            then (v_row.normalized_data ->> 'warranty_months')::integer else warranty_months end,
          contact_phones = coalesce(v_contact_phones, contact_phones),
          fault_prices = v_fault_prices,
          quotation_amount = v_quotation,
          deposit_amount = v_deposit,
          balance_amount = v_balance,
          is_paid = case when v_has_finance_changes then v_balance = 0 else is_paid end,
          payment_status = case
            when not v_has_finance_changes then payment_status
            when v_balance = 0 then 'paid'
            when v_deposit + v_paid_amount > 0 then 'partial'
            else 'unpaid'
          end,
          device_snapshot = jsonb_build_object(
            'brand', (select brand from public.devices where id = v_order.device_id and store_id = p_store_id),
            'model', (select model from public.devices where id = v_order.device_id and store_id = p_store_id),
            'serial_or_imei', (select serial_or_imei from public.devices where id = v_order.device_id and store_id = p_store_id),
            'device_notes', (select device_notes from public.devices where id = v_order.device_id and store_id = p_store_id)
          ),
          updated_at = v_now
        where id = v_order.id
          and store_id = p_store_id;
        v_order_id := v_order.id;
      else
        if v_row.source_system is null or v_row.external_record_id is null then
          raise exception 'external_reference_required' using errcode = '22023';
        end if;

        perform pg_advisory_xact_lock(hashtextextended(
          p_store_id::text || ':external:' || v_row.source_system || ':' || v_row.external_record_id,
          0
        ));
        select order_id into v_order_id
        from public.order_external_refs
        where store_id = p_store_id
          and source_system = v_row.source_system
          and external_record_id = v_row.external_record_id;

        if found then
          update public.order_data_batch_rows
          set status = 'skipped', result_order_id = v_order_id, applied_at = v_now
          where id = v_row.id;
          v_skipped := v_skipped + 1;
          continue;
        end if;

        perform pg_advisory_xact_lock(hashtextextended(
          p_store_id::text || ':customer-phone:' || (v_row.normalized_data ->> 'customer_phone_raw'),
          0
        ));
        select * into v_customer
        from public.customers
        where store_id = p_store_id
          and phone_raw = v_row.normalized_data ->> 'customer_phone_raw'
        order by created_at
        limit 1
        for update;

        if found then
          v_customer_id := v_customer.id;
          if lower(regexp_replace(trim(v_customer.name), '\s+', ' ', 'g')) <>
            lower(regexp_replace(trim(v_row.normalized_data ->> 'customer_name'), '\s+', ' ', 'g')) then
            raise exception 'customer_phone_conflict' using errcode = '40001';
          end if;
        end if;

        v_contact_phones := array(
          select jsonb_array_elements_text(v_row.normalized_data -> 'contact_phones')
        );
        if v_customer_id is null then
          v_customer_id := gen_random_uuid();
          insert into public.customers (
            id, store_id, name, phone_e164, phone_raw, contact_phones,
            consent_marketing, consent_sms, created_at, updated_at
          ) values (
            v_customer_id,
            p_store_id,
            v_row.normalized_data ->> 'customer_name',
            v_row.normalized_data ->> 'customer_phone_e164',
            v_row.normalized_data ->> 'customer_phone_raw',
            v_contact_phones,
            false,
            false,
            v_now,
            v_now
          );
        end if;

        v_device_id := gen_random_uuid();
        insert into public.devices (
          id, store_id, customer_id, brand, model, serial_or_imei, device_notes,
          created_at, updated_at
        ) values (
          v_device_id,
          p_store_id,
          v_customer_id,
          v_row.normalized_data ->> 'device_brand',
          v_row.normalized_data ->> 'device_model',
          coalesce(v_row.normalized_data ->> 'device_imei', ''),
          v_row.normalized_data ->> 'device_notes',
          v_now,
          v_now
        );

        v_fault_prices := coalesce(v_row.normalized_data -> 'fault_prices', '[]'::jsonb);
        select coalesce(sum((item ->> 'price')::numeric), 0)
          into v_quotation
        from jsonb_array_elements(v_fault_prices) item;
        v_deposit := coalesce((v_row.normalized_data ->> 'deposit_amount')::numeric, 0);
        if v_deposit < 0 or v_deposit > v_quotation then
          raise exception 'invalid_deposit' using errcode = '22023';
        end if;
        v_balance := greatest(0, v_quotation - v_deposit);
        v_order_id := gen_random_uuid();

        insert into public.repair_orders (
          id, store_id, order_type, status, workflow_status, exception_status,
          payment_status, approval_flow_status, parts_status, notify_status,
          customer_id, device_id, issue_description, diagnosis_result,
          quotation_amount, deposit_amount, balance_amount, currency_code, is_paid,
          approval_status, technician_name, internal_tag, accessory_notes,
          warranty_text, warranty_months, contact_phones, fault_prices, device_snapshot,
          created_at, updated_at
        ) values (
          v_order_id,
          p_store_id,
          (v_row.normalized_data ->> 'order_type')::public.repair_order_type,
          'new',
          'intake',
          null,
          case when v_balance = 0 then 'paid' when v_deposit > 0 then 'partial' else 'unpaid' end,
          'not_required',
          'not_required',
          'not_sent',
          v_customer_id,
          v_device_id,
          v_row.normalized_data ->> 'issue_description',
          v_row.normalized_data ->> 'diagnosis_result',
          v_quotation,
          v_deposit,
          v_balance,
          'EUR',
          v_balance = 0,
          'pending',
          coalesce(nullif(p_actor_name, ''), '店主'),
          v_row.normalized_data ->> 'internal_tag',
          v_row.normalized_data ->> 'accessory_notes',
          coalesce(v_row.normalized_data ->> 'warranty_text', '6 mesi'),
          coalesce((v_row.normalized_data ->> 'warranty_months')::integer, 6),
          v_contact_phones,
          v_fault_prices,
          jsonb_build_object(
            'brand', v_row.normalized_data ->> 'device_brand',
            'model', v_row.normalized_data ->> 'device_model',
            'serial_or_imei', coalesce(v_row.normalized_data ->> 'device_imei', ''),
            'device_notes', v_row.normalized_data ->> 'device_notes'
          ),
          v_now,
          v_now
        );

        insert into public.order_external_refs (
          store_id, source_system, external_record_id, order_id, created_at, updated_at
        ) values (
          p_store_id, v_row.source_system, v_row.external_record_id, v_order_id, v_now, v_now
        );
        v_before_data := jsonb_build_object('created_order_id', v_order_id);
      end if;

      insert into public.order_events (
        id, store_id, order_id, event_type, payload, operator_name, created_at
      ) values (
        gen_random_uuid(),
        p_store_id,
        v_order_id,
        case when v_row.action = 'create' then 'created' else 'note' end,
        jsonb_build_object(
          'source', 'order_data_import',
          'batch_id', v_batch.id,
          'changed_fields', to_jsonb(v_row.changed_fields)
        ),
        coalesce(nullif(p_actor_name, ''), '店主'),
        v_now
      );

      update public.order_data_batch_rows
      set
        status = 'applied',
        result_order_id = v_order_id,
        before_data = v_before_data,
        after_updated_at = v_now,
        applied_at = v_now
      where id = v_row.id;
      v_success := v_success + 1;
    exception
      when serialization_failure then
        update public.order_data_batch_rows
        set
          status = 'conflict',
          errors = errors || jsonb_build_array(jsonb_build_object('code', 'version_conflict'))
        where id = v_row.id;
        v_conflict := v_conflict + 1;
      when others then
        update public.order_data_batch_rows
        set
          status = 'failed',
          errors = errors || jsonb_build_array(jsonb_build_object('code', 'apply_failed'))
        where id = v_row.id;
        v_failed := v_failed + 1;
    end;
  end loop;

  v_result := jsonb_build_object(
    'batchId', v_batch.id,
    'status', case when v_failed > 0 or v_conflict > 0 then 'partial' else 'applied' end,
    'applied', v_success,
    'conflicts', v_conflict,
    'failed', v_failed,
    'skipped', v_skipped,
    'rows', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'rowNumber', row_number,
          'status', status,
          'errors', errors
        )
        order by row_number
      )
      from public.order_data_batch_rows
      where batch_id = v_batch.id
        and status in ('conflict', 'failed', 'skipped')
    ), '[]'::jsonb)
  );

  update public.order_data_batches
  set
    status = case when v_failed > 0 or v_conflict > 0 then 'partial' else 'applied' end,
    summary = v_result,
    applied_at = v_now
  where id = v_batch.id;

  insert into public.audit_logs (
    id, actor_id, actor_email, actor_name, store_id, action, entity_type, entity_id,
    metadata, created_at
  ) values (
    gen_random_uuid()::text,
    p_actor_id,
    p_actor_email,
    coalesce(nullif(p_actor_name, ''), '店主'),
    p_store_id,
    'import_apply',
    'order_data_batch',
    v_batch.id::text,
    jsonb_build_object(
      'template_version', v_batch.template_version,
      'mode', v_batch.mode,
      'applied', v_success,
      'conflicts', v_conflict,
      'failed', v_failed,
      'skipped', v_skipped,
      'file_hash', v_batch.file_hash,
      'payload_hash', v_batch.payload_hash
    ),
    v_now
  );

  return v_result;
end;
$$;

revoke execute on function public.repairdesk_apply_order_data_batch(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.repairdesk_apply_order_data_batch(uuid, uuid, uuid, text, text)
  to service_role;

create or replace function public.repairdesk_rollback_order_data_batch(
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
  v_batch public.order_data_batches%rowtype;
  v_row public.order_data_batch_rows%rowtype;
  v_order public.repair_orders%rowtype;
  v_customer public.customers%rowtype;
  v_device public.devices%rowtype;
  v_before_order jsonb;
  v_before_customer jsonb;
  v_before_device jsonb;
  v_rolled_back integer := 0;
  v_conflicts integer := 0;
  v_manual integer := 0;
  v_now timestamptz := now();
  v_result jsonb;
begin
  if not exists (
    select 1
    from public.stores s
    join public.store_memberships sm
      on sm.store_id = s.id
     and sm.user_id = p_actor_id
     and sm.role = 'owner'
     and sm.status = 'active'
    where s.id = p_store_id
      and s.owner_user_id = p_actor_id
      and s.status = 'active'
  ) then
    raise exception 'order_data_forbidden' using errcode = '42501';
  end if;

  select * into v_batch
  from public.order_data_batches
  where id = p_batch_id
    and store_id = p_store_id
    and actor_id = p_actor_id
    and kind = 'import'
  for update;

  if not found then
    raise exception 'order_data_batch_not_found' using errcode = 'P0002';
  end if;
  if v_batch.status in ('rolled_back', 'rollback_partial') then
    return coalesce(v_batch.summary -> 'rollback', '{}'::jsonb);
  end if;
  if v_batch.status not in ('applied', 'partial') then
    raise exception 'order_data_batch_not_rollbackable' using errcode = '22023';
  end if;

  for v_row in
    select *
    from public.order_data_batch_rows
    where batch_id = v_batch.id
      and status = 'applied'
    order by row_number desc
  loop
    if v_row.action = 'create' then
      update public.order_data_batch_rows
      set status = 'recovery_manual'
      where id = v_row.id;
      v_manual := v_manual + 1;
      continue;
    end if;

    select * into v_order
    from public.repair_orders
    where id = v_row.result_order_id
      and store_id = p_store_id
    for update;
    if not found or v_row.after_updated_at is null or v_order.updated_at <> v_row.after_updated_at then
      update public.order_data_batch_rows
      set status = 'rollback_conflict'
      where id = v_row.id;
      v_conflicts := v_conflicts + 1;
      continue;
    end if;

    v_before_order := v_row.before_data -> 'order';
    v_before_customer := v_row.before_data -> 'customer';
    v_before_device := v_row.before_data -> 'device';
    if v_before_order is null then
      update public.order_data_batch_rows
      set status = 'rollback_conflict'
      where id = v_row.id;
      v_conflicts := v_conflicts + 1;
      continue;
    end if;

    if v_before_customer is not null then
      select * into v_customer
      from public.customers
      where id = v_before_customer ->> 'id'
        and store_id = p_store_id
      for update;
      if not found or v_customer.updated_at <> v_row.after_updated_at then
        update public.order_data_batch_rows
        set status = 'rollback_conflict'
        where id = v_row.id;
        v_conflicts := v_conflicts + 1;
        continue;
      end if;
    end if;

    if v_before_device is not null then
      select * into v_device
      from public.devices
      where id = v_before_device ->> 'id'
        and store_id = p_store_id
      for update;
      if not found or v_device.updated_at <> v_row.after_updated_at then
        update public.order_data_batch_rows
        set status = 'rollback_conflict'
        where id = v_row.id;
        v_conflicts := v_conflicts + 1;
        continue;
      end if;
    end if;

    if v_before_customer is not null then
      update public.customers
      set
        name = v_before_customer ->> 'name',
        phone_e164 = v_before_customer ->> 'phone_e164',
        phone_raw = v_before_customer ->> 'phone_raw',
        contact_phones = array(
          select jsonb_array_elements_text(v_before_customer -> 'contact_phones')
        ),
        updated_at = v_now
      where id = v_before_customer ->> 'id'
        and store_id = p_store_id;
    end if;

    if v_before_device is not null then
      update public.devices
      set
        brand = v_before_device ->> 'brand',
        model = v_before_device ->> 'model',
        serial_or_imei = coalesce(v_before_device ->> 'serial_or_imei', ''),
        device_notes = v_before_device ->> 'device_notes',
        updated_at = v_now
      where id = v_before_device ->> 'id'
        and store_id = p_store_id;
    end if;

    update public.repair_orders
    set
      issue_description = v_before_order ->> 'issue_description',
      diagnosis_result = v_before_order ->> 'diagnosis_result',
      internal_tag = v_before_order ->> 'internal_tag',
      accessory_notes = v_before_order ->> 'accessory_notes',
      warranty_text = v_before_order ->> 'warranty_text',
      warranty_months = (v_before_order ->> 'warranty_months')::integer,
      fault_prices = v_before_order -> 'fault_prices',
      quotation_amount = (v_before_order ->> 'quotation_amount')::numeric,
      deposit_amount = (v_before_order ->> 'deposit_amount')::numeric,
      balance_amount = (v_before_order ->> 'balance_amount')::numeric,
      is_paid = (v_before_order ->> 'is_paid')::boolean,
      payment_status = v_before_order ->> 'payment_status',
      contact_phones = array(
        select jsonb_array_elements_text(v_before_order -> 'contact_phones')
      ),
      device_snapshot = v_before_order -> 'device_snapshot',
      updated_at = v_now
    where id = v_order.id
      and store_id = p_store_id;

    insert into public.order_events (
      id, store_id, order_id, event_type, payload, operator_name, created_at
    ) values (
      gen_random_uuid(),
      p_store_id,
      v_order.id,
      'note',
      jsonb_build_object('source', 'order_data_rollback', 'batch_id', v_batch.id),
      coalesce(nullif(p_actor_name, ''), '店主'),
      v_now
    );

    update public.order_data_batch_rows
    set status = 'rolled_back', rolled_back_at = v_now
    where id = v_row.id;
    v_rolled_back := v_rolled_back + 1;
  end loop;

  v_result := jsonb_build_object(
    'batchId', v_batch.id,
    'status', case when v_conflicts > 0 or v_manual > 0 then 'rollback_partial' else 'rolled_back' end,
    'rolledBack', v_rolled_back,
    'conflicts', v_conflicts,
    'manual', v_manual
  );

  update public.order_data_batches
  set
    status = case when v_conflicts > 0 or v_manual > 0 then 'rollback_partial' else 'rolled_back' end,
    summary = summary || jsonb_build_object('rollback', v_result)
  where id = v_batch.id;

  insert into public.audit_logs (
    id, actor_id, actor_email, actor_name, store_id, action, entity_type, entity_id,
    metadata, created_at
  ) values (
    gen_random_uuid()::text,
    p_actor_id,
    p_actor_email,
    coalesce(nullif(p_actor_name, ''), '店主'),
    p_store_id,
    'import_rollback',
    'order_data_batch',
    v_batch.id::text,
    jsonb_build_object(
      'rolled_back', v_rolled_back,
      'conflicts', v_conflicts,
      'manual', v_manual
    ),
    v_now
  );

  return v_result;
end;
$$;

revoke execute on function public.repairdesk_rollback_order_data_batch(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.repairdesk_rollback_order_data_batch(uuid, uuid, uuid, text, text)
  to service_role;

create or replace function public.repairdesk_cleanup_expired_order_data_batches()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.order_data_batches
  set status = 'expired', summary = summary || jsonb_build_object('expiredAt', now())
  where expires_at <= now()
    and status in ('building', 'previewed');
  get diagnostics v_count = row_count;

  update public.order_data_batch_rows rows
  set normalized_data = '{}'::jsonb
  from public.order_data_batches batches
  where rows.batch_id = batches.id
    and batches.status = 'expired';

  delete from public.order_data_batches
  where created_at < now() - interval '30 days';

  return v_count;
end;
$$;

revoke execute on function public.repairdesk_cleanup_expired_order_data_batches()
  from public, anon, authenticated;
grant execute on function public.repairdesk_cleanup_expired_order_data_batches()
  to service_role;

notify pgrst, 'reload schema';
