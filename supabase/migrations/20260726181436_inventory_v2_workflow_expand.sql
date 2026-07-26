-- Production migration history version: 20260726181436.
set lock_timeout = '5s';

create table public.inventory_workflow_command_ledger (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  idempotency_key uuid not null,
  request_hash text not null,
  operation text not null,
  inventory_item_id uuid not null,
  stock_unit_id uuid not null,
  actor_id uuid not null,
  item_updated_at_before timestamptz not null,
  item_updated_at_after timestamptz not null,
  unit_version_before bigint not null,
  unit_version_after bigint not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  constraint inventory_workflow_command_ledger_store_fkey
    foreign key (store_id) references public.stores(id)
    on update cascade on delete restrict,
  constraint inventory_workflow_command_ledger_item_same_store_fkey
    foreign key (inventory_item_id, store_id)
    references public.inventory_items(id, store_id)
    on update cascade on delete restrict,
  constraint inventory_workflow_command_ledger_unit_same_store_fkey
    foreign key (stock_unit_id, store_id)
    references public.inventory_stock_units(id, store_id)
    on update cascade on delete restrict,
  constraint inventory_workflow_command_ledger_actor_fkey
    foreign key (actor_id) references auth.users(id)
    on update cascade on delete restrict,
  constraint inventory_workflow_command_ledger_idempotency_unique
    unique (store_id, idempotency_key),
  constraint inventory_workflow_command_ledger_operation_check
    check (operation in ('inspect', 'transition', 'update_commercials')),
  constraint inventory_workflow_command_ledger_versions_check
    check (unit_version_before >= 1 and unit_version_after = unit_version_before + 1),
  constraint inventory_workflow_command_ledger_result_check
    check (jsonb_typeof(result) = 'object')
);

create index inventory_workflow_command_ledger_item_created_idx
  on public.inventory_workflow_command_ledger
  (store_id, inventory_item_id, created_at desc);

create index inventory_workflow_command_ledger_unit_created_idx
  on public.inventory_workflow_command_ledger
  (store_id, stock_unit_id, created_at desc);

alter table public.inventory_workflow_command_ledger enable row level security;

revoke all on table public.inventory_workflow_command_ledger
  from public, anon, authenticated, service_role;
grant select, insert on table public.inventory_workflow_command_ledger to service_role;

create or replace function public.repairdesk_apply_inventory_unit_workflow_v2(
  p_store_id uuid,
  p_item_id uuid,
  p_actor_id uuid,
  p_expected_item_updated_at timestamptz,
  p_expected_unit_version bigint,
  p_idempotency_key uuid,
  p_operation text,
  p_target_status text,
  p_inspection jsonb,
  p_commercial_patch jsonb,
  p_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor_name text;
  v_existing public.inventory_workflow_command_ledger%rowtype;
  v_item public.inventory_items%rowtype;
  v_unit public.inventory_stock_units%rowtype;
  v_request_hash text;
  v_operation text := btrim(coalesce(p_operation, ''));
  v_target_status text := nullif(btrim(coalesce(p_target_status, '')), '');
  v_inspection jsonb := coalesce(p_inspection, '{}'::jsonb);
  v_commercial jsonb := coalesce(p_commercial_patch, '{}'::jsonb);
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_now timestamptz := clock_timestamp();
  v_command_id uuid := gen_random_uuid();
  v_quality_check_id uuid;
  v_cost numeric(12, 2);
  v_list numeric(12, 2);
  v_repair_cost numeric(12, 2);
  v_fees numeric(12, 2);
  v_warranty integer;
  v_location text;
  v_notes text;
  v_imei_status text;
  v_activation_status text;
  v_wipe_status text;
  v_cosmetic text;
  v_functional text;
  v_battery numeric(5, 2);
  v_result jsonb;
begin
  if p_store_id is null or p_item_id is null or p_actor_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_target');
  end if;
  if p_expected_item_updated_at is null or p_expected_unit_version is null then
    return jsonb_build_object('ok', false, 'code', 'missing_expected_version');
  end if;
  if p_idempotency_key is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_idempotency_key');
  end if;
  if v_operation not in ('inspect', 'transition', 'update_commercials') then
    return jsonb_build_object('ok', false, 'code', 'invalid_operation');
  end if;
  if jsonb_typeof(v_inspection) <> 'object' or jsonb_typeof(v_commercial) <> 'object' then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;
  if exists (
    select 1 from jsonb_object_keys(v_inspection) as key_name
     where key_name not in (
       'screen_status', 'touch_status', 'camera_status', 'buttons_status',
       'ports_status', 'speaker_status', 'microphone_status', 'wifi_status',
       'bluetooth_status', 'cellular_status', 'battery_health', 'cosmetic_grade',
       'functional_grade', 'imei_check_status', 'activation_lock_status',
       'data_wipe_status', 'notes'
     )
  ) or exists (
    select 1 from jsonb_object_keys(v_commercial) as key_name
     where key_name not in (
       'cost_amount', 'list_price', 'repair_cost_amount', 'fees_amount',
       'warranty_months', 'location', 'notes'
     )
  ) then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;
  if char_length(coalesce(v_inspection ->> 'notes', '')) > 2000
     or char_length(coalesce(v_commercial ->> 'notes', '')) > 2000
     or char_length(coalesce(v_commercial ->> 'location', '')) > 200 then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  begin
    v_cost := case when v_commercial ? 'cost_amount'
      then (v_commercial ->> 'cost_amount')::numeric else null end;
    v_list := case when v_commercial ? 'list_price'
      then (v_commercial ->> 'list_price')::numeric else null end;
    v_repair_cost := case when v_commercial ? 'repair_cost_amount'
      then (v_commercial ->> 'repair_cost_amount')::numeric else null end;
    v_fees := case when v_commercial ? 'fees_amount'
      then (v_commercial ->> 'fees_amount')::numeric else null end;
    v_warranty := case when v_commercial ? 'warranty_months'
      then (v_commercial ->> 'warranty_months')::integer else null end;
    v_battery := case when v_inspection ? 'battery_health'
      and jsonb_typeof(v_inspection -> 'battery_health') <> 'null'
      then (v_inspection ->> 'battery_health')::numeric else null end;
  exception when invalid_text_representation or numeric_value_out_of_range then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  if (v_commercial ? 'cost_amount' and (v_cost is null or v_cost < 0 or v_cost > 9999999.99 or v_cost <> round(v_cost, 2)))
     or (v_commercial ? 'list_price' and (v_list is null or v_list < 0 or v_list > 9999999.99 or v_list <> round(v_list, 2)))
     or (v_commercial ? 'repair_cost_amount' and (v_repair_cost is null or v_repair_cost < 0 or v_repair_cost > 9999999.99 or v_repair_cost <> round(v_repair_cost, 2)))
     or (v_commercial ? 'fees_amount' and (v_fees is null or v_fees < 0 or v_fees > 9999999.99 or v_fees <> round(v_fees, 2))) then
    return jsonb_build_object('ok', false, 'code', 'invalid_amount');
  end if;
  if v_commercial ? 'warranty_months'
     and (v_warranty is null or v_warranty < 0 or v_warranty > 120) then
    return jsonb_build_object('ok', false, 'code', 'invalid_warranty');
  end if;
  if v_inspection ? 'battery_health'
     and jsonb_typeof(v_inspection -> 'battery_health') <> 'null'
     and (v_battery is null or v_battery < 0 or v_battery > 100) then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;
  if exists (
    select 1 from jsonb_each_text(v_inspection) as entry(key_name, value_text)
     where key_name in (
       'screen_status', 'touch_status', 'camera_status', 'buttons_status',
       'ports_status', 'speaker_status', 'microphone_status', 'wifi_status',
       'bluetooth_status', 'cellular_status', 'imei_check_status',
       'activation_lock_status', 'data_wipe_status'
     ) and value_text not in ('unchecked', 'pass', 'fail', 'unknown')
  ) then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;
  if (v_inspection ? 'cosmetic_grade' and coalesce(v_inspection ->> 'cosmetic_grade', '') not in ('unknown', 'new', 'mint', 'good', 'fair', 'poor', 'for_parts'))
     or (v_inspection ? 'functional_grade' and coalesce(v_inspection ->> 'functional_grade', '') not in ('untested', 'passed', 'needs_repair', 'failed', 'for_parts')) then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  v_request_hash := md5(jsonb_build_object(
    'item_id', p_item_id,
    'actor_id', p_actor_id,
    'expected_item_updated_at', p_expected_item_updated_at,
    'expected_unit_version', p_expected_unit_version,
    'operation', v_operation,
    'target_status', v_target_status,
    'inspection', v_inspection,
    'commercial_patch', v_commercial,
    'reason', v_reason
  )::text);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_store_id::text || ':inventory-workflow-v2:' || p_idempotency_key::text, 0
    )
  );

  select ledger.* into v_existing
    from public.inventory_workflow_command_ledger as ledger
   where ledger.store_id = p_store_id
     and ledger.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> v_request_hash then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return v_existing.result || jsonb_build_object('code', 'idempotent_replay');
  end if;

  select coalesce(membership.display_name, profile.display_name, 'Staff')
    into v_actor_name
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
  if v_actor_name is null then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;

  select item.* into v_item
    from public.inventory_items as item
   where item.store_id = p_store_id and item.id = p_item_id
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'item_not_found');
  end if;

  select unit.* into v_unit
    from public.inventory_stock_units as unit
   where unit.store_id = p_store_id
     and unit.legacy_inventory_item_id = p_item_id
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'unit_not_found');
  end if;
  if coalesce((v_item.legacy_payload ->> 'inventory_v2_intake')::boolean, false) is not true
     or coalesce(v_item.legacy_payload ->> 'inventory_v2_unit_id', '') <> v_unit.id::text then
    return jsonb_build_object('ok', false, 'code', 'not_v2_item');
  end if;
  if v_item.status::text <> v_unit.status
     or v_item.buyback_price <> v_unit.cost_amount
     or v_item.list_price <> v_unit.list_price then
    return jsonb_build_object('ok', false, 'code', 'projection_mismatch');
  end if;
  if v_item.updated_at <> p_expected_item_updated_at then
    return jsonb_build_object('ok', false, 'code', 'stale_item_version');
  end if;
  if v_unit.version <> p_expected_unit_version then
    return jsonb_build_object('ok', false, 'code', 'stale_unit_version');
  end if;

  if v_target_status is null then v_target_status := v_item.status::text; end if;
  if v_operation = 'update_commercials' and v_target_status <> v_item.status::text then
    return jsonb_build_object('ok', false, 'code', 'invalid_operation');
  end if;
  if v_operation = 'inspect'
     and v_target_status <> v_item.status::text
     and not (v_item.status::text = 'intake' and v_target_status = 'evaluating') then
    return jsonb_build_object('ok', false, 'code', 'invalid_operation');
  end if;
  if v_operation = 'transition'
     and (v_inspection <> '{}'::jsonb or v_commercial <> '{}'::jsonb) then
    return jsonb_build_object('ok', false, 'code', 'invalid_operation');
  end if;
  if not (
    (v_item.status::text = 'intake' and v_target_status in ('intake', 'evaluating'))
    or (v_item.status::text = 'evaluating' and v_target_status in ('evaluating', 'refurbishing', 'ready_for_sale'))
    or (v_item.status::text = 'refurbishing' and v_target_status in ('evaluating', 'refurbishing', 'ready_for_sale'))
    or (v_item.status::text = 'ready_for_sale' and v_target_status in ('ready_for_sale', 'listed'))
    or (v_item.status::text = 'listed' and v_target_status = 'listed')
  ) then
    return jsonb_build_object('ok', false, 'code', 'invalid_state_transition');
  end if;
  if v_operation = 'inspect' and v_inspection = '{}'::jsonb then
    return jsonb_build_object('ok', false, 'code', 'inspection_required');
  end if;

  v_cost := case when v_commercial ? 'cost_amount' then v_cost else v_item.buyback_price end;
  v_list := case when v_commercial ? 'list_price' then v_list else v_item.list_price end;
  v_warranty := case when v_commercial ? 'warranty_months' then v_warranty else v_item.warranty_months end;
  v_repair_cost := case when v_commercial ? 'repair_cost_amount' then v_repair_cost else v_item.repair_cost_amount end;
  v_fees := case when v_commercial ? 'fees_amount' then v_fees else v_item.fees_amount end;
  v_location := case when v_commercial ? 'location'
    then nullif(btrim(coalesce(v_commercial ->> 'location', '')), '') else v_unit.location end;
  v_notes := case when v_commercial ? 'notes'
    then nullif(btrim(coalesce(v_commercial ->> 'notes', '')), '') else v_item.notes end;
  v_imei_status := coalesce(v_inspection ->> 'imei_check_status', v_item.imei_check_status::text);
  v_activation_status := coalesce(v_inspection ->> 'activation_lock_status', v_item.activation_lock_status::text);
  v_wipe_status := coalesce(v_inspection ->> 'data_wipe_status', v_item.data_wipe_status::text);
  v_cosmetic := coalesce(v_inspection ->> 'cosmetic_grade', v_item.cosmetic_grade::text);
  v_functional := coalesce(v_inspection ->> 'functional_grade', v_item.functional_grade::text);
  if not (v_inspection ? 'battery_health') then v_battery := v_item.battery_health; end if;

  if v_target_status in ('ready_for_sale', 'listed') and (
    nullif(btrim(coalesce(v_item.serial_or_imei, '')), '') is null
    or v_imei_status <> 'pass'
    or v_activation_status <> 'pass'
    or v_wipe_status <> 'pass'
    or v_functional <> 'passed'
    or v_cosmetic = 'unknown'
    or v_list <= 0
    or v_warranty < 0 or v_warranty > 120
  ) then
    return jsonb_build_object('ok', false, 'code', 'inspection_blocked');
  end if;

  if v_inspection <> '{}'::jsonb then
    v_quality_check_id := gen_random_uuid();
    insert into public.inventory_quality_checks (
      id, store_id, item_id, screen_status, touch_status, camera_status,
      buttons_status, ports_status, speaker_status, microphone_status,
      wifi_status, bluetooth_status, cellular_status, battery_health,
      cosmetic_grade, functional_grade, imei_check_status,
      activation_lock_status, data_wipe_status, notes, checked_by,
      checked_at, created_at
    ) values (
      v_quality_check_id, p_store_id, p_item_id,
      coalesce(v_inspection ->> 'screen_status', 'unchecked')::public.inventory_check_status,
      coalesce(v_inspection ->> 'touch_status', 'unchecked')::public.inventory_check_status,
      coalesce(v_inspection ->> 'camera_status', 'unchecked')::public.inventory_check_status,
      coalesce(v_inspection ->> 'buttons_status', 'unchecked')::public.inventory_check_status,
      coalesce(v_inspection ->> 'ports_status', 'unchecked')::public.inventory_check_status,
      coalesce(v_inspection ->> 'speaker_status', 'unchecked')::public.inventory_check_status,
      coalesce(v_inspection ->> 'microphone_status', 'unchecked')::public.inventory_check_status,
      coalesce(v_inspection ->> 'wifi_status', 'unchecked')::public.inventory_check_status,
      coalesce(v_inspection ->> 'bluetooth_status', 'unchecked')::public.inventory_check_status,
      coalesce(v_inspection ->> 'cellular_status', 'unchecked')::public.inventory_check_status,
      v_battery,
      v_cosmetic::public.inventory_cosmetic_grade,
      v_functional::public.inventory_functional_grade,
      v_imei_status::public.inventory_check_status,
      v_activation_status::public.inventory_check_status,
      v_wipe_status::public.inventory_check_status,
      nullif(btrim(coalesce(v_inspection ->> 'notes', '')), ''),
      p_actor_id, v_now, v_now
    );
  end if;

  update public.inventory_items
     set status = v_target_status::public.inventory_item_status,
         imei_check_status = v_imei_status::public.inventory_check_status,
         activation_lock_status = v_activation_status::public.inventory_check_status,
         data_wipe_status = v_wipe_status::public.inventory_check_status,
         cosmetic_grade = v_cosmetic::public.inventory_cosmetic_grade,
         functional_grade = v_functional::public.inventory_functional_grade,
         battery_health = v_battery,
         buyback_price = v_cost,
         list_price = v_list,
         repair_cost_amount = v_repair_cost,
         fees_amount = v_fees,
         warranty_months = v_warranty,
         notes = v_notes,
         listed_at = case when v_target_status = 'listed' and v_item.status::text <> 'listed'
           then v_now else v_item.listed_at end,
         updated_by = p_actor_id,
         updated_at = v_now
   where store_id = p_store_id and id = p_item_id
     and updated_at = p_expected_item_updated_at;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'stale_item_version');
  end if;

  update public.inventory_stock_units
     set status = v_target_status,
         cost_amount = v_cost,
         list_price = v_list,
         location = v_location,
         notes = v_notes,
         version = version + 1,
         updated_by = p_actor_id,
         updated_at = v_now
   where store_id = p_store_id and id = v_unit.id
     and version = p_expected_unit_version;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'stale_unit_version');
  end if;

  if v_quality_check_id is not null then
    insert into public.inventory_events (
      id, store_id, item_id, event_type, from_status, to_status, payload,
      operator_user_id, operator_name, created_at
    ) values (
      gen_random_uuid(), p_store_id, p_item_id, 'quality_checked',
      v_item.status, v_target_status::public.inventory_item_status,
      jsonb_build_object('workflow_command_id', v_command_id, 'quality_check_id', v_quality_check_id),
      p_actor_id, v_actor_name, v_now
    );
  end if;
  if v_item.status::text <> v_target_status then
    insert into public.inventory_events (
      id, store_id, item_id, event_type, from_status, to_status, payload,
      operator_user_id, operator_name, created_at
    ) values (
      gen_random_uuid(), p_store_id, p_item_id, 'status_changed',
      v_item.status, v_target_status::public.inventory_item_status,
      jsonb_build_object('workflow_command_id', v_command_id, 'reason', v_reason),
      p_actor_id, v_actor_name, v_now
    );
  end if;

  insert into public.audit_logs (
    id, actor_id, actor_name, store_id, action, entity_type, entity_id,
    metadata, created_at
  ) values (
    gen_random_uuid()::text, p_actor_id, v_actor_name, p_store_id,
    'inventory_v2_workflow', 'inventory_item', p_item_id::text,
    jsonb_build_object(
      'workflow_command_id', v_command_id,
      'operation', v_operation,
      'from_status', v_item.status::text,
      'to_status', v_target_status,
      'changed_fields', (
        select coalesce(jsonb_agg(key_name order by key_name), '[]'::jsonb)
          from (
            select jsonb_object_keys(v_inspection) as key_name
            union
            select jsonb_object_keys(v_commercial) as key_name
          ) as changed
      ),
      'item_updated_at_before', v_item.updated_at,
      'item_updated_at_after', v_now,
      'unit_version_before', v_unit.version,
      'unit_version_after', v_unit.version + 1
    ), v_now
  );

  v_result := jsonb_build_object(
    'ok', true,
    'code', 'applied',
    'workflow_command_id', v_command_id,
    'item_id', p_item_id,
    'stock_unit_id', v_unit.id,
    'previous_status', v_item.status::text,
    'status', v_target_status,
    'item_updated_at', v_now,
    'unit_version', v_unit.version + 1,
    'quality_check_id', v_quality_check_id,
    'applied_at', v_now
  );

  insert into public.inventory_workflow_command_ledger (
    id, store_id, idempotency_key, request_hash, operation,
    inventory_item_id, stock_unit_id, actor_id,
    item_updated_at_before, item_updated_at_after,
    unit_version_before, unit_version_after, result, created_at
  ) values (
    v_command_id, p_store_id, p_idempotency_key, v_request_hash, v_operation,
    p_item_id, v_unit.id, p_actor_id,
    v_item.updated_at, v_now, v_unit.version, v_unit.version + 1, v_result, v_now
  );

  return v_result;
end;
$$;

revoke all on function public.repairdesk_apply_inventory_unit_workflow_v2(
  uuid, uuid, uuid, timestamptz, bigint, uuid, text, text, jsonb, jsonb, text
) from public, anon, authenticated, service_role;

comment on function public.repairdesk_apply_inventory_unit_workflow_v2(
  uuid, uuid, uuid, timestamptz, bigint, uuid, text, text, jsonb, jsonb, text
) is 'Dormant atomic V2 inspection/commercial/listing workflow. Enable only after reconciliation preflight.';

create or replace function public.repairdesk_guard_inventory_v2_unit_sale()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item public.inventory_items%rowtype;
begin
  if new.status <> 'sold' or old.status = 'sold' then return new; end if;
  select item.* into v_item
    from public.inventory_items as item
   where item.store_id = new.store_id
     and item.id = new.legacy_inventory_item_id;
  if not found
     or coalesce((v_item.legacy_payload ->> 'inventory_v2_intake')::boolean, false) is not true
     or coalesce(v_item.legacy_payload ->> 'inventory_v2_unit_id', '') <> new.id::text
     or v_item.status::text <> 'sold'
     or old.status not in ('ready_for_sale', 'listed', 'reserved')
     or v_item.buyback_price <> new.cost_amount
     or v_item.list_price <> new.list_price
     or nullif(btrim(coalesce(v_item.serial_or_imei, '')), '') is null
     or v_item.imei_check_status::text <> 'pass'
     or v_item.activation_lock_status::text <> 'pass'
     or v_item.data_wipe_status::text <> 'pass'
     or v_item.functional_grade::text <> 'passed'
     or v_item.cosmetic_grade::text = 'unknown'
     or v_item.list_price <= 0 then
    raise exception using
      errcode = 'check_violation',
      message = 'Inventory V2 sale projection or inspection gate failed';
  end if;
  return new;
end;
$$;

revoke all on function public.repairdesk_guard_inventory_v2_unit_sale()
  from public, anon, authenticated, service_role;

drop trigger if exists inventory_v2_unit_sale_guard on public.inventory_stock_units;
create trigger inventory_v2_unit_sale_guard
before update of status on public.inventory_stock_units
for each row execute function public.repairdesk_guard_inventory_v2_unit_sale();
