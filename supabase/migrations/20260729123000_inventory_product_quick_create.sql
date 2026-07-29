create unique index if not exists inventory_stock_unit_identifiers_active_external_value_unique_idx
  on public.inventory_stock_unit_identifiers (store_id, normalized_value)
  where retired_at is null and kind in ('imei1', 'imei2', 'serial');

create or replace function public.repairdesk_create_inventory_product(
  p_store_id uuid, p_actor_id uuid, p_idempotency_key uuid,
  p_category text, p_brand text, p_model text, p_color text,
  p_storage_capacity text, p_identifier_kind text, p_serial_or_imei text,
  p_list_price numeric, p_cost_amount numeric, p_location text,
  p_warranty_months integer, p_notes text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor_name text;
  v_actor_role text;
  v_existing public.inventory_intake_command_ledger%rowtype;
  v_catalog_id uuid;
  v_variant_id uuid;
  v_unit_id uuid := gen_random_uuid();
  v_item_id uuid := gen_random_uuid();
  v_movement_id uuid := gen_random_uuid();
  v_public_no text;
  v_request_hash text;
  v_catalog_key text;
  v_variant_key text;
  v_identifier text := nullif(btrim(coalesce(p_serial_or_imei, '')), '');
  v_identifier_kind text := nullif(btrim(coalesce(p_identifier_kind, '')), '');
  v_identifier_normalized text;
  v_location text := nullif(btrim(coalesce(p_location, '')), '');
  v_now timestamptz := clock_timestamp();
begin
  if p_store_id is null or p_actor_id is null then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;
  if p_idempotency_key is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_idempotency_key');
  end if;
  if p_category not in ('phone', 'tablet', 'computer', 'game_console', 'other') then
    return jsonb_build_object('ok', false, 'code', 'invalid_category');
  end if;
  if nullif(btrim(coalesce(p_brand, '')), '') is null
     or nullif(btrim(coalesce(p_model, '')), '') is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_model');
  end if;
  if p_list_price is not null
     and (p_list_price < 0 or p_list_price <> round(p_list_price, 2)) then
    return jsonb_build_object('ok', false, 'code', 'invalid_amount');
  end if;
  if p_cost_amount is not null
     and (p_cost_amount < 0 or p_cost_amount <> round(p_cost_amount, 2)) then
    return jsonb_build_object('ok', false, 'code', 'invalid_amount');
  end if;
  if p_warranty_months is not null
     and (p_warranty_months < 0 or p_warranty_months > 120) then
    return jsonb_build_object('ok', false, 'code', 'invalid_warranty');
  end if;
  if (v_identifier is null) <> (v_identifier_kind is null)
     or (v_identifier_kind is not null and v_identifier_kind not in ('imei1', 'serial')) then
    return jsonb_build_object('ok', false, 'code', 'invalid_identifier');
  end if;

  if v_identifier is not null then
    v_identifier_normalized := public.repairdesk_inventory_v2_normalize_identifier(v_identifier);
    if char_length(v_identifier_normalized) < 3 then
      return jsonb_build_object('ok', false, 'code', 'invalid_identifier');
    end if;
    if v_identifier_kind = 'imei1'
       and not public.repairdesk_inventory_v2_imei_is_valid(v_identifier_normalized) then
      return jsonb_build_object('ok', false, 'code', 'invalid_imei');
    end if;
  end if;

  select coalesce(membership.display_name, profile.display_name, 'Staff'), membership.role::text
    into v_actor_name, v_actor_role
    from public.staff_profiles as profile
    join public.store_memberships as membership
      on membership.user_id = profile.id
     and membership.store_id = p_store_id
     and membership.status::text = 'active'
    join public.stores as store_row
      on store_row.id = membership.store_id
     and store_row.status::text = 'active'
   where profile.id = p_actor_id and profile.status::text = 'active'
   limit 1;
  if v_actor_role is null or v_actor_role not in ('owner', 'manager', 'technician', 'sales') then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;

  v_request_hash := md5(jsonb_build_object(
    'command', 'inventory_product_quick_create_v1',
    'category', p_category, 'brand', btrim(p_brand), 'model', btrim(p_model),
    'color', nullif(btrim(coalesce(p_color, '')), ''),
    'storage_capacity', nullif(btrim(coalesce(p_storage_capacity, '')), ''),
    'identifier_kind', v_identifier_kind, 'serial_or_imei', v_identifier,
    'list_price', p_list_price, 'cost_amount', p_cost_amount,
    'location', v_location, 'warranty_months', p_warranty_months,
    'notes', nullif(btrim(coalesce(p_notes, '')), '')
  )::text);

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_store_id::text || ':inventory-intake-v2:' || p_idempotency_key::text, 0
  ));
  select ledger.* into v_existing
    from public.inventory_intake_command_ledger as ledger
   where ledger.store_id = p_store_id and ledger.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> v_request_hash then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    select item.public_no into v_public_no from public.inventory_items as item
     where item.id = v_existing.inventory_item_id and item.store_id = p_store_id;
    return jsonb_build_object(
      'ok', true, 'code', 'idempotent_replay',
      'id', v_existing.inventory_item_id, 'stock_unit_id', v_existing.stock_unit_id,
      'sku', v_public_no, 'created_at', v_existing.created_at
    );
  end if;

  if v_identifier_normalized is not null then
    -- Share the legacy V2 writer's lock namespaces for every external identifier
    -- kind. The quick flow treats an IMEI/SN value as unique across kinds, so it
    -- must fence concurrent legacy imei1, imei2 and serial commands as well.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      p_store_id::text || ':inventory-identifier:imei1:' || v_identifier_normalized, 0
    ));
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      p_store_id::text || ':inventory-identifier:imei2:' || v_identifier_normalized, 0
    ));
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      p_store_id::text || ':inventory-identifier:serial:' || v_identifier_normalized, 0
    ));
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      p_store_id::text || ':inventory-product-identifier:' || v_identifier_normalized, 0
    ));
    if exists (
      select 1 from public.inventory_stock_unit_identifiers as identifier
       where identifier.store_id = p_store_id
         and identifier.kind in ('imei1', 'imei2', 'serial')
         and identifier.normalized_value = v_identifier_normalized
         and identifier.retired_at is null
    ) or exists (
      select 1 from public.inventory_items as item
       where item.store_id = p_store_id
         and item.source_type <> 'buyback'
         and upper(regexp_replace(coalesce(item.serial_or_imei, ''), '[^A-Za-z0-9]', '', 'g')) =
             v_identifier_normalized
         and item.status not in ('cancelled', 'recycled')
    ) then
      return jsonb_build_object('ok', false, 'code', 'duplicate_identifier');
    end if;
  end if;

  v_catalog_key := lower(btrim(p_category) || '|' || btrim(p_brand) || '|' || btrim(p_model) || '|serial');
  v_variant_key := v_catalog_key || '|-|' ||
    lower(coalesce(nullif(btrim(p_storage_capacity), ''), '-')) || '|' ||
    lower(coalesce(nullif(btrim(p_color), ''), '-'));

  insert into public.inventory_product_catalog_items (
    store_id, category, brand, model, normalized_key, tracking_mode,
    standardization_status, created_by, updated_by, created_at, updated_at
  ) values (
    p_store_id, p_category, btrim(p_brand), btrim(p_model), v_catalog_key, 'serial',
    'unstandardized', p_actor_id, p_actor_id, v_now, v_now
  ) on conflict (store_id, normalized_key) do update
    set updated_at = excluded.updated_at, updated_by = excluded.updated_by
  returning id into v_catalog_id;

  insert into public.inventory_product_variants (
    store_id, catalog_item_id, storage_capacity, color, normalized_key,
    created_by, updated_by, created_at, updated_at
  ) values (
    p_store_id, v_catalog_id, nullif(btrim(coalesce(p_storage_capacity, '')), ''),
    nullif(btrim(coalesce(p_color, '')), ''), v_variant_key,
    p_actor_id, p_actor_id, v_now, v_now
  ) on conflict (store_id, normalized_key) do update
    set updated_at = excluded.updated_at, updated_by = excluded.updated_by
  returning id into v_variant_id;

  insert into public.inventory_items (
    id, store_id, status, source_type, category, brand, model, color,
    storage_capacity, serial_or_imei, imei_check_status,
    buyback_price, list_price, currency_code, warranty_months, notes,
    legacy_payload, created_by, updated_by, created_at, updated_at
  ) values (
    v_item_id, p_store_id, 'intake', 'manual_stock', p_category,
    btrim(p_brand), btrim(p_model), nullif(btrim(coalesce(p_color, '')), ''),
    nullif(btrim(coalesce(p_storage_capacity, '')), ''), v_identifier,
    case when v_identifier is null then 'unchecked' else 'unknown' end,
    coalesce(p_cost_amount, 0), coalesce(p_list_price, 0), 'EUR',
    coalesce(p_warranty_months, 0), nullif(btrim(coalesce(p_notes, '')), ''),
    jsonb_build_object(
      'inventory_v2_intake', true, 'inventory_v2_unit_id', v_unit_id,
      'inventory_product_quick_create', true,
      'cost_provided', p_cost_amount is not null,
      'list_price_provided', p_list_price is not null,
      'warranty_provided', p_warranty_months is not null,
      'location', v_location
    ), p_actor_id, p_actor_id, v_now, v_now
  ) returning public_no into v_public_no;

  update public.inventory_items
     set legacy_payload = legacy_payload || jsonb_build_object('internal_sku', v_public_no)
   where id = v_item_id and store_id = p_store_id;

  insert into public.inventory_stock_units (
    id, store_id, variant_id, legacy_inventory_item_id, source_type,
    status, location, cost_amount, list_price, currency_code, notes,
    created_by, updated_by, created_at, updated_at
  ) values (
    v_unit_id, p_store_id, v_variant_id, v_item_id, 'manual_stock',
    'intake', v_location, coalesce(p_cost_amount, 0), coalesce(p_list_price, 0),
    'EUR', nullif(btrim(coalesce(p_notes, '')), ''),
    p_actor_id, p_actor_id, v_now, v_now
  );

  insert into public.inventory_stock_unit_identifiers (
    store_id, stock_unit_id, kind, display_value, normalized_value,
    source, is_primary, created_by, created_at
  ) values (
    p_store_id, v_unit_id, 'sku', v_public_no,
    public.repairdesk_inventory_v2_normalize_identifier(v_public_no),
    'manual', v_identifier is null, p_actor_id, v_now
  );
  if v_identifier is not null then
    insert into public.inventory_stock_unit_identifiers (
      store_id, stock_unit_id, kind, slot, display_value, normalized_value,
      source, is_primary, created_by, created_at
    ) values (
      p_store_id, v_unit_id, v_identifier_kind,
      case when v_identifier_kind = 'imei1' then 1 else null end,
      v_identifier, v_identifier_normalized, 'manual', true, p_actor_id, v_now
    );
  end if;

  insert into public.inventory_stock_movements (
    id, store_id, stock_unit_id, variant_id, movement_type, quantity,
    source_kind, source_id, idempotency_key, actor_id, metadata, occurred_at, created_at
  ) values (
    v_movement_id, p_store_id, v_unit_id, v_variant_id, 'receive', 1,
    'inventory_product_quick_create', v_item_id::text, p_idempotency_key, p_actor_id,
    jsonb_build_object('sku', v_public_no, 'category', p_category), v_now, v_now
  );
  insert into public.inventory_intake_command_ledger (
    store_id, idempotency_key, request_hash, actor_id,
    inventory_item_id, stock_unit_id, created_at
  ) values (p_store_id, p_idempotency_key, v_request_hash, p_actor_id, v_item_id, v_unit_id, v_now);
  insert into public.inventory_events (
    id, store_id, item_id, event_type, to_status, payload,
    operator_user_id, operator_name, created_at
  ) values (
    gen_random_uuid(), p_store_id, v_item_id, 'product_created', 'intake',
    jsonb_build_object('sku', v_public_no, 'stock_unit_id', v_unit_id, 'movement_id', v_movement_id),
    p_actor_id, v_actor_name, v_now
  );
  insert into public.audit_logs (
    id, actor_id, actor_name, store_id, action, entity_type, entity_id, metadata, created_at
  ) values (
    gen_random_uuid()::text, p_actor_id, v_actor_name, p_store_id,
    'create', 'inventory_product', v_unit_id::text,
    jsonb_build_object('inventory_item_id', v_item_id, 'sku', v_public_no, 'movement_id', v_movement_id), v_now
  );

  return jsonb_build_object(
    'ok', true, 'code', 'created', 'id', v_item_id, 'stock_unit_id', v_unit_id,
    'sku', v_public_no, 'created_at', v_now
  );
end;
$$;

revoke all on function public.repairdesk_create_inventory_product(
  uuid, uuid, uuid, text, text, text, text, text, text, text,
  numeric, numeric, text, integer, text
) from public, anon, authenticated, service_role;
comment on function public.repairdesk_create_inventory_product(
  uuid, uuid, uuid, text, text, text, text, text, text, text,
  numeric, numeric, text, integer, text
) is 'Dormant atomic idempotent V2 product intake. Product-only; enable through a separate grant migration.';
