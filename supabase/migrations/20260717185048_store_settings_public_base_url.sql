alter table public.store_settings
  add column if not exists public_base_url text not null default '';

alter table public.store_settings
  add constraint store_settings_public_base_url_check
  check (
    public_base_url = ''
    or (
      public_base_url !~ '[[:space:]]'
      and (
        public_base_url ~ '^https://[^[:space:]]+$'
        or public_base_url ~ '^http://(localhost|127\\.0\\.0\\.1)(:[0-9]+)?(/[^[:space:]]*)?$'
      )
    )
  ) not valid;

alter table public.store_settings
  validate constraint store_settings_public_base_url_check;

comment on column public.store_settings.public_base_url is
  'Optional store-owned public customer portal base URL. Empty means customer-visible messages omit external portal links.';

-- Keep the historical rollback helper valid on production schemas where
-- customer/device primary keys are UUID-backed. The previous function compared
-- ids directly to JSON text, which blocks schema lint and can fail at runtime.
create or replace function public.repairdesk_rollback_order_data_batch_v1(
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
      where id::text = v_before_customer ->> 'id'
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
      where id::text = v_before_device ->> 'id'
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
      where id::text = v_before_customer ->> 'id'
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
      where id::text = v_before_device ->> 'id'
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

revoke all on function public.repairdesk_rollback_order_data_batch_v1(
  uuid,
  uuid,
  uuid,
  text,
  text
) from public, anon, authenticated, service_role;

grant execute on function public.repairdesk_rollback_order_data_batch_v1(
  uuid,
  uuid,
  uuid,
  text,
  text
) to service_role;
