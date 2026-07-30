set lock_timeout = '5s';
set statement_timeout = '2min';

alter table public.inventory_product_variants
  add column if not exists specifications jsonb not null default '{}'::jsonb,
  add column if not exists specification_schema_version smallint not null default 1;

alter table public.inventory_product_variants
  add constraint inventory_product_variants_specifications_object_check
    check (jsonb_typeof(specifications) = 'object') not valid,
  add constraint inventory_product_variants_specifications_size_check
    check (pg_column_size(specifications) <= 4096) not valid,
  add constraint inventory_product_variants_specification_version_check
    check (specification_schema_version = 1) not valid;

alter table public.inventory_product_variants
  validate constraint inventory_product_variants_specifications_object_check;
alter table public.inventory_product_variants
  validate constraint inventory_product_variants_specifications_size_check;
alter table public.inventory_product_variants
  validate constraint inventory_product_variants_specification_version_check;

create unique index if not exists inventory_stock_unit_identifiers_active_unit_kind_unique_idx
  on public.inventory_stock_unit_identifiers (store_id, stock_unit_id, kind)
  where retired_at is null;

create unique index if not exists inventory_stock_unit_identifiers_active_device_value_unique_idx
  on public.inventory_stock_unit_identifiers (store_id, normalized_value)
  where retired_at is null and kind in ('imei1', 'imei2', 'serial', 'eid');

create table if not exists public.inventory_product_update_command_ledger (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  idempotency_key uuid not null,
  request_hash text not null,
  actor_id uuid not null,
  inventory_item_id uuid not null,
  stock_unit_id uuid not null,
  version_before bigint not null,
  version_after bigint not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  constraint inventory_product_update_ledger_store_fkey
    foreign key (store_id) references public.stores(id) on update cascade on delete restrict,
  constraint inventory_product_update_ledger_actor_fkey
    foreign key (actor_id) references auth.users(id) on update cascade on delete restrict,
  constraint inventory_product_update_ledger_item_same_store_fkey
    foreign key (inventory_item_id, store_id)
    references public.inventory_items(id, store_id) on update cascade on delete restrict,
  constraint inventory_product_update_ledger_unit_same_store_fkey
    foreign key (stock_unit_id, store_id)
    references public.inventory_stock_units(id, store_id) on update cascade on delete restrict,
  constraint inventory_product_update_ledger_idempotency_unique unique (store_id, idempotency_key),
  constraint inventory_product_update_ledger_hash_check check (char_length(request_hash) = 32),
  constraint inventory_product_update_ledger_version_check
    check (version_before >= 1 and version_after = version_before + 1),
  constraint inventory_product_update_ledger_result_check check (jsonb_typeof(result) = 'object')
);

alter table public.inventory_product_update_command_ledger enable row level security;
revoke all on table public.inventory_product_update_command_ledger
  from public, anon, authenticated, service_role;
grant select, insert on table public.inventory_product_update_command_ledger to service_role;

create or replace function public.repairdesk_create_inventory_product_v2(
  p_store_id uuid,
  p_actor_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key uuid;
  v_hash text;
  v_existing public.inventory_intake_command_ledger%rowtype;
  v_result jsonb;
  v_identifier jsonb;
  v_primary jsonb;
  v_legacy_primary jsonb;
  v_kind text;
  v_value text;
  v_normalized text;
  v_item_id uuid;
  v_unit_id uuid;
  v_variant_id uuid;
  v_old_variant_id uuid;
  v_catalog_id uuid;
  v_variant_key text;
  v_specs jsonb := coalesce(p_payload -> 'specifications', '{}'::jsonb);
begin
  if jsonb_typeof(p_payload) <> 'object'
     or jsonb_typeof(v_specs) <> 'object'
     or pg_column_size(v_specs) > 4096 then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;
  begin
    v_key := (p_payload ->> 'idempotency_key')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_idempotency_key');
  end;
  v_hash := md5(jsonb_build_object('command', 'inventory_product_device_data_v2', 'payload', p_payload)::text);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_store_id::text || ':inventory-intake-v2:' || v_key::text, 0
  ));
  select ledger.* into v_existing
    from public.inventory_intake_command_ledger ledger
   where ledger.store_id = p_store_id and ledger.idempotency_key = v_key;
  if found then
    if v_existing.request_hash <> v_hash then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    select item.public_no into v_value
      from public.inventory_items item
     where item.store_id = p_store_id and item.id = v_existing.inventory_item_id;
    return jsonb_build_object(
      'ok', true, 'code', 'idempotent_replay', 'id', v_existing.inventory_item_id,
      'stock_unit_id', v_existing.stock_unit_id, 'sku', v_value,
      'created_at', v_existing.created_at
    );
  end if;

  if jsonb_typeof(coalesce(p_payload -> 'identifiers', '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_payload -> 'identifiers', '[]'::jsonb)) > 4 then
    return jsonb_build_object('ok', false, 'code', 'invalid_identifiers');
  end if;
  for v_identifier in select value from jsonb_array_elements(coalesce(p_payload -> 'identifiers', '[]'::jsonb)) loop
    v_kind := btrim(coalesce(v_identifier ->> 'kind', ''));
    v_value := btrim(coalesce(v_identifier ->> 'value', ''));
    v_normalized := public.repairdesk_inventory_v2_normalize_identifier(v_value);
    if v_kind not in ('imei1', 'imei2', 'serial', 'eid')
       or btrim(coalesce(v_identifier ->> 'source', '')) not in ('manual', 'scan', 'ai_confirmed')
       or char_length(v_normalized) < 3
       or (v_kind in ('imei1', 'imei2') and not public.repairdesk_inventory_v2_imei_is_valid(v_normalized))
       or (v_kind = 'eid' and v_normalized !~ '^[0-9]{32}$') then
      return jsonb_build_object('ok', false, 'code', 'invalid_identifiers');
    end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      p_store_id::text || ':inventory-device-identifier:' || v_normalized, 0
    ));
    if exists (
      select 1 from public.inventory_stock_unit_identifiers i
       where i.store_id = p_store_id and i.normalized_value = v_normalized
         and i.kind in ('imei1', 'imei2', 'serial', 'eid') and i.retired_at is null
    ) then
      return jsonb_build_object('ok', false, 'code', 'duplicate_identifier');
    end if;
    if coalesce((v_identifier ->> 'primary')::boolean, false) then
      if v_primary is not null then
        return jsonb_build_object('ok', false, 'code', 'primary_identifier_required');
      end if;
      v_primary := v_identifier;
    end if;
    if v_kind in ('imei1', 'serial') and v_legacy_primary is null then
      v_legacy_primary := v_identifier;
    end if;
  end loop;
  if jsonb_array_length(coalesce(p_payload -> 'identifiers', '[]'::jsonb)) > 0
     and v_primary is null then
    return jsonb_build_object('ok', false, 'code', 'primary_identifier_required');
  end if;

  v_result := public.repairdesk_create_inventory_product(
    p_store_id, p_actor_id, v_key,
    p_payload ->> 'category', p_payload ->> 'brand', p_payload ->> 'model',
    p_payload ->> 'color', p_payload ->> 'storage_capacity',
    v_legacy_primary ->> 'kind', v_legacy_primary ->> 'value',
    nullif(p_payload ->> 'list_price', '')::numeric,
    nullif(p_payload ->> 'cost_amount', '')::numeric,
    p_payload ->> 'location', nullif(p_payload ->> 'warranty_months', '')::integer,
    p_payload ->> 'notes'
  );
  if coalesce((v_result ->> 'ok')::boolean, false) is not true then return v_result; end if;
  v_item_id := (v_result ->> 'id')::uuid;
  v_unit_id := (v_result ->> 'stock_unit_id')::uuid;
  select unit.variant_id, variant.catalog_item_id into v_old_variant_id, v_catalog_id
    from public.inventory_stock_units unit
    join public.inventory_product_variants variant
      on variant.id = unit.variant_id and variant.store_id = unit.store_id
   where unit.store_id = p_store_id and unit.id = v_unit_id;
  v_variant_key := lower(btrim(p_payload ->> 'category') || '|' || btrim(p_payload ->> 'brand')
    || '|' || btrim(p_payload ->> 'model') || '|serial|'
    || coalesce(nullif(btrim(p_payload ->> 'ram_capacity'), ''), '-') || '|'
    || coalesce(nullif(btrim(p_payload ->> 'storage_capacity'), ''), '-') || '|'
    || coalesce(nullif(btrim(p_payload ->> 'color'), ''), '-') || '|'
    || coalesce(nullif(btrim(p_payload ->> 'gtin'), ''), '-') || '|' || md5(v_specs::text));
  insert into public.inventory_product_variants (
    store_id, catalog_item_id, ram_capacity, storage_capacity, color, gtin,
    specifications, specification_schema_version, normalized_key,
    created_by, updated_by, created_at, updated_at
  ) values (
    p_store_id, v_catalog_id, nullif(btrim(p_payload ->> 'ram_capacity'), ''),
    nullif(btrim(p_payload ->> 'storage_capacity'), ''), nullif(btrim(p_payload ->> 'color'), ''),
    nullif(btrim(p_payload ->> 'gtin'), ''), v_specs, 1, v_variant_key,
    p_actor_id, p_actor_id, clock_timestamp(), clock_timestamp()
  ) on conflict (store_id, normalized_key) do update
    set updated_at = excluded.updated_at, updated_by = excluded.updated_by
  returning id into v_variant_id;
  update public.inventory_stock_units
     set variant_id = v_variant_id, updated_by = p_actor_id, updated_at = clock_timestamp()
   where store_id = p_store_id and id = v_unit_id;
  update public.inventory_stock_movements
     set variant_id = v_variant_id
   where store_id = p_store_id and stock_unit_id = v_unit_id
     and variant_id = v_old_variant_id;
  delete from public.inventory_product_variants variant
   where variant.store_id = p_store_id and variant.id = v_old_variant_id
     and variant.id <> v_variant_id
     and not exists (
       select 1 from public.inventory_stock_units unit
        where unit.store_id = p_store_id and unit.variant_id = variant.id
     )
     and not exists (
       select 1 from public.inventory_stock_movements movement
        where movement.store_id = p_store_id and movement.variant_id = variant.id
     );
  update public.inventory_items
     set serial_or_imei = v_primary ->> 'value',
         imei_check_status = case when v_primary is null then 'unchecked' else 'unknown' end,
         legacy_payload = legacy_payload || jsonb_build_object(
       'ram_capacity', nullif(btrim(coalesce(p_payload ->> 'ram_capacity', '')), ''),
       'gtin', nullif(btrim(coalesce(p_payload ->> 'gtin', '')), ''),
       'condition', nullif(btrim(coalesce(p_payload ->> 'condition', '')), '')
     )
   where store_id = p_store_id and id = v_item_id;

  delete from public.inventory_stock_unit_identifiers
   where store_id = p_store_id and stock_unit_id = v_unit_id
     and kind <> 'sku' and retired_at is null;
  update public.inventory_stock_unit_identifiers
     set is_primary = (jsonb_array_length(coalesce(p_payload -> 'identifiers', '[]'::jsonb)) = 0)
   where store_id = p_store_id and stock_unit_id = v_unit_id
     and kind = 'sku' and retired_at is null;
  for v_identifier in select value from jsonb_array_elements(coalesce(p_payload -> 'identifiers', '[]'::jsonb)) loop
    v_kind := btrim(v_identifier ->> 'kind');
    v_value := btrim(v_identifier ->> 'value');
    insert into public.inventory_stock_unit_identifiers (
      store_id, stock_unit_id, kind, slot, display_value, normalized_value,
      source, is_primary, created_by, created_at
    ) values (
      p_store_id, v_unit_id, v_kind,
      case when v_kind = 'imei1' then 1 when v_kind = 'imei2' then 2 else null end,
      v_value, public.repairdesk_inventory_v2_normalize_identifier(v_value),
      v_identifier ->> 'source', coalesce((v_identifier ->> 'primary')::boolean, false),
      p_actor_id, clock_timestamp()
    );
  end loop;
  update public.inventory_intake_command_ledger
     set request_hash = v_hash
   where store_id = p_store_id and idempotency_key = v_key;
  return v_result;
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'duplicate_identifier');
end;
$$;

create or replace function public.repairdesk_update_inventory_product_v1(
  p_store_id uuid,
  p_actor_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key uuid;
  v_item_id uuid;
  v_expected_version bigint;
  v_hash text;
  v_existing public.inventory_product_update_command_ledger%rowtype;
  v_item public.inventory_items%rowtype;
  v_unit public.inventory_stock_units%rowtype;
  v_catalog_id uuid;
  v_variant_id uuid;
  v_catalog_key text;
  v_variant_key text;
  v_specs jsonb := coalesce(p_payload -> 'specifications', '{}'::jsonb);
  v_identifier jsonb;
  v_kind text;
  v_value text;
  v_normalized text;
  v_primary_value text;
  v_primary_count integer := 0;
  v_actor_name text;
  v_actor_role text;
  v_now timestamptz := clock_timestamp();
  v_result jsonb;
begin
  begin
    v_key := (p_payload ->> 'idempotency_key')::uuid;
    v_item_id := (p_payload ->> 'product_id')::uuid;
    v_expected_version := (p_payload ->> 'expected_version')::bigint;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;
  if jsonb_typeof(p_payload) <> 'object' or jsonb_typeof(v_specs) <> 'object'
     or pg_column_size(v_specs) > 4096 then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;
  v_hash := md5(jsonb_build_object('command', 'inventory_product_update_v1', 'payload', p_payload)::text);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_store_id::text || ':inventory-product-update:' || v_key::text, 0
  ));
  select ledger.* into v_existing
    from public.inventory_product_update_command_ledger ledger
   where ledger.store_id = p_store_id and ledger.idempotency_key = v_key;
  if found then
    if v_existing.request_hash <> v_hash then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return v_existing.result || jsonb_build_object('code', 'idempotent_replay');
  end if;

  select coalesce(m.display_name, p.display_name, 'Staff'), m.role::text
    into v_actor_name, v_actor_role
    from public.staff_profiles p
    join public.store_memberships m on m.user_id = p.id and m.store_id = p_store_id
      and m.status::text = 'active'
    join public.stores s on s.id = m.store_id and s.status::text = 'active'
   where p.id = p_actor_id and p.status::text = 'active' limit 1;
  if v_actor_role is null or v_actor_role not in ('owner', 'manager', 'technician', 'sales') then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;

  select * into v_item from public.inventory_items
   where store_id = p_store_id and id = v_item_id and source_type <> 'buyback' for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  select * into v_unit from public.inventory_stock_units
   where store_id = p_store_id and legacy_inventory_item_id = v_item_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if v_unit.status in ('sold', 'cancelled', 'recycled') then
    return jsonb_build_object('ok', false, 'code', 'terminal_state');
  end if;
  if v_item.status in ('sold', 'cancelled', 'recycled') then
    return jsonb_build_object('ok', false, 'code', 'terminal_state');
  end if;
  if coalesce((v_item.legacy_payload ->> 'inventory_v2_intake')::boolean, false) is not true
     or coalesce(v_item.legacy_payload ->> 'inventory_v2_unit_id', '') <> v_unit.id::text
     or v_item.status::text <> v_unit.status
     or v_item.list_price <> v_unit.list_price
     or v_item.buyback_price <> v_unit.cost_amount then
    return jsonb_build_object('ok', false, 'code', 'projection_conflict');
  end if;
  if v_unit.version <> v_expected_version then
    return jsonb_build_object('ok', false, 'code', 'version_conflict', 'version', v_unit.version);
  end if;

  if jsonb_typeof(coalesce(p_payload -> 'identifiers', '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_payload -> 'identifiers', '[]'::jsonb)) > 4 then
    return jsonb_build_object('ok', false, 'code', 'invalid_identifiers');
  end if;
  for v_identifier in select value from jsonb_array_elements(coalesce(p_payload -> 'identifiers', '[]'::jsonb)) loop
    v_kind := btrim(coalesce(v_identifier ->> 'kind', ''));
    v_value := btrim(coalesce(v_identifier ->> 'value', ''));
    v_normalized := public.repairdesk_inventory_v2_normalize_identifier(v_value);
    if v_kind not in ('imei1', 'imei2', 'serial', 'eid')
       or btrim(coalesce(v_identifier ->> 'source', '')) not in ('manual', 'scan', 'ai_confirmed')
       or char_length(v_normalized) < 3
       or (v_kind in ('imei1', 'imei2') and not public.repairdesk_inventory_v2_imei_is_valid(v_normalized))
       or (v_kind = 'eid' and v_normalized !~ '^[0-9]{32}$') then
      return jsonb_build_object('ok', false, 'code', 'invalid_identifiers');
    end if;
    if coalesce((v_identifier ->> 'primary')::boolean, false) then
      v_primary_count := v_primary_count + 1;
      v_primary_value := v_value;
    end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      p_store_id::text || ':inventory-device-identifier:' || v_normalized, 0
    ));
    if exists (
      select 1 from public.inventory_stock_unit_identifiers i
       where i.store_id = p_store_id and i.stock_unit_id <> v_unit.id
         and i.normalized_value = v_normalized
         and i.kind in ('imei1', 'imei2', 'serial', 'eid') and i.retired_at is null
    ) then
      return jsonb_build_object('ok', false, 'code', 'duplicate_identifier');
    end if;
  end loop;
  if jsonb_array_length(coalesce(p_payload -> 'identifiers', '[]'::jsonb)) > 0
     and v_primary_count <> 1 then
    return jsonb_build_object('ok', false, 'code', 'primary_identifier_required');
  end if;

  v_catalog_key := lower(btrim(p_payload ->> 'category') || '|' || btrim(p_payload ->> 'brand') || '|' || btrim(p_payload ->> 'model') || '|serial');
  v_variant_key := v_catalog_key || '|' || lower(coalesce(nullif(btrim(p_payload ->> 'ram_capacity'), ''), '-')) || '|'
    || lower(coalesce(nullif(btrim(p_payload ->> 'storage_capacity'), ''), '-')) || '|'
    || lower(coalesce(nullif(btrim(p_payload ->> 'color'), ''), '-')) || '|'
    || lower(coalesce(nullif(btrim(p_payload ->> 'gtin'), ''), '-')) || '|'
    || md5(v_specs::text);
  insert into public.inventory_product_catalog_items (
    store_id, category, brand, model, normalized_key, tracking_mode,
    standardization_status, created_by, updated_by, created_at, updated_at
  ) values (
    p_store_id, btrim(p_payload ->> 'category'), btrim(p_payload ->> 'brand'),
    btrim(p_payload ->> 'model'), v_catalog_key, 'serial', 'unstandardized',
    p_actor_id, p_actor_id, v_now, v_now
  ) on conflict (store_id, normalized_key) do update
    set updated_at = excluded.updated_at, updated_by = excluded.updated_by
  returning id into v_catalog_id;
  insert into public.inventory_product_variants (
    store_id, catalog_item_id, ram_capacity, storage_capacity, color, gtin,
    specifications, specification_schema_version, normalized_key,
    created_by, updated_by, created_at, updated_at
  ) values (
    p_store_id, v_catalog_id, nullif(btrim(p_payload ->> 'ram_capacity'), ''),
    nullif(btrim(p_payload ->> 'storage_capacity'), ''), nullif(btrim(p_payload ->> 'color'), ''),
    nullif(btrim(p_payload ->> 'gtin'), ''), v_specs, 1, v_variant_key,
    p_actor_id, p_actor_id, v_now, v_now
  ) on conflict (store_id, normalized_key) do update
    set updated_at = excluded.updated_at, updated_by = excluded.updated_by
  returning id into v_variant_id;

  update public.inventory_stock_unit_identifiers current_identifier
     set is_primary = false
   where current_identifier.store_id = p_store_id
     and current_identifier.stock_unit_id = v_unit.id
     and current_identifier.kind <> 'sku' and current_identifier.retired_at is null;
  update public.inventory_stock_unit_identifiers current_identifier
     set retired_at = v_now
   where current_identifier.store_id = p_store_id
     and current_identifier.stock_unit_id = v_unit.id
     and current_identifier.kind <> 'sku' and current_identifier.retired_at is null
     and not exists (
       select 1
         from jsonb_array_elements(coalesce(p_payload -> 'identifiers', '[]'::jsonb)) requested(value)
        where requested.value ->> 'kind' = current_identifier.kind
          and public.repairdesk_inventory_v2_normalize_identifier(requested.value ->> 'value') =
              current_identifier.normalized_value
     );
  update public.inventory_stock_unit_identifiers
     set is_primary = (jsonb_array_length(coalesce(p_payload -> 'identifiers', '[]'::jsonb)) = 0)
   where store_id = p_store_id and stock_unit_id = v_unit.id and kind = 'sku' and retired_at is null;
  for v_identifier in select value from jsonb_array_elements(coalesce(p_payload -> 'identifiers', '[]'::jsonb)) loop
    v_kind := btrim(v_identifier ->> 'kind');
    v_value := btrim(v_identifier ->> 'value');
    update public.inventory_stock_unit_identifiers current_identifier
       set source = v_identifier ->> 'source',
           is_primary = coalesce((v_identifier ->> 'primary')::boolean, false)
     where current_identifier.store_id = p_store_id
       and current_identifier.stock_unit_id = v_unit.id
       and current_identifier.kind = v_kind
       and current_identifier.normalized_value =
           public.repairdesk_inventory_v2_normalize_identifier(v_value)
       and current_identifier.retired_at is null;
    if found then continue; end if;
    insert into public.inventory_stock_unit_identifiers (
      store_id, stock_unit_id, kind, slot, display_value, normalized_value,
      source, is_primary, created_by, created_at
    ) values (
      p_store_id, v_unit.id, v_kind,
      case when v_kind = 'imei1' then 1 when v_kind = 'imei2' then 2 else null end,
      v_value, public.repairdesk_inventory_v2_normalize_identifier(v_value),
      v_identifier ->> 'source', coalesce((v_identifier ->> 'primary')::boolean, false),
      p_actor_id, v_now
    );
  end loop;

  update public.inventory_stock_units
     set variant_id = v_variant_id,
         location = nullif(btrim(coalesce(p_payload ->> 'location', '')), ''),
         cost_amount = case when p_payload ? 'cost_amount'
           then coalesce(nullif(p_payload ->> 'cost_amount', '')::numeric, 0)
           else cost_amount end,
         list_price = coalesce(nullif(p_payload ->> 'list_price', '')::numeric, 0),
         notes = nullif(btrim(coalesce(p_payload ->> 'notes', '')), ''),
         version = version + 1, updated_by = p_actor_id, updated_at = v_now
   where store_id = p_store_id and id = v_unit.id and version = v_expected_version;
  update public.inventory_items
     set category = btrim(p_payload ->> 'category'), brand = btrim(p_payload ->> 'brand'),
         model = btrim(p_payload ->> 'model'), color = nullif(btrim(p_payload ->> 'color'), ''),
         storage_capacity = nullif(btrim(p_payload ->> 'storage_capacity'), ''),
         serial_or_imei = v_primary_value,
         imei_check_status = case when v_primary_value is null then 'unchecked' else 'unknown' end,
         buyback_price = case when p_payload ? 'cost_amount'
           then coalesce(nullif(p_payload ->> 'cost_amount', '')::numeric, 0)
           else buyback_price end,
         list_price = coalesce(nullif(p_payload ->> 'list_price', '')::numeric, 0),
         warranty_months = coalesce(nullif(p_payload ->> 'warranty_months', '')::integer, 0),
         notes = nullif(btrim(coalesce(p_payload ->> 'notes', '')), ''),
         legacy_payload = legacy_payload || jsonb_build_object(
           'ram_capacity', nullif(btrim(coalesce(p_payload ->> 'ram_capacity', '')), ''),
           'gtin', nullif(btrim(coalesce(p_payload ->> 'gtin', '')), ''),
           'condition', nullif(btrim(coalesce(p_payload ->> 'condition', '')), ''),
           'list_price_provided', p_payload ? 'list_price',
           'warranty_provided', p_payload ? 'warranty_months',
           'location', nullif(btrim(coalesce(p_payload ->> 'location', '')), '')
         ) || case when p_payload ? 'cost_amount'
           then jsonb_build_object('cost_provided', true)
           else '{}'::jsonb end,
         updated_by = p_actor_id, updated_at = v_now
   where store_id = p_store_id and id = v_item_id;

  v_result := jsonb_build_object('ok', true, 'code', 'updated', 'id', v_item_id,
    'version', v_expected_version + 1, 'updated_at', v_now);
  insert into public.inventory_product_update_command_ledger (
    store_id, idempotency_key, request_hash, actor_id, inventory_item_id, stock_unit_id,
    version_before, version_after, result, created_at
  ) values (
    p_store_id, v_key, v_hash, p_actor_id, v_item_id, v_unit.id,
    v_expected_version, v_expected_version + 1, v_result, v_now
  );
  insert into public.inventory_events (
    id, store_id, item_id, event_type, payload, operator_user_id, operator_name, created_at
  ) values (
    gen_random_uuid(), p_store_id, v_item_id, 'product_updated',
    jsonb_build_object('version', v_expected_version + 1,
      'identifier_kinds', coalesce((select jsonb_agg(value ->> 'kind') from jsonb_array_elements(coalesce(p_payload -> 'identifiers', '[]'::jsonb))), '[]'::jsonb)),
    p_actor_id, v_actor_name, v_now
  );
  insert into public.audit_logs (
    id, actor_id, actor_name, store_id, action, entity_type, entity_id, metadata, created_at
  ) values (
    gen_random_uuid()::text, p_actor_id, v_actor_name, p_store_id, 'update',
    'inventory_product', v_unit.id::text,
    jsonb_build_object('inventory_item_id', v_item_id, 'version', v_expected_version + 1,
      'identifier_count', jsonb_array_length(coalesce(p_payload -> 'identifiers', '[]'::jsonb))), v_now
  );
  return v_result;
exception
  when unique_violation then return jsonb_build_object('ok', false, 'code', 'duplicate_identifier');
end;
$$;

alter function public.repairdesk_create_inventory_product_v2(uuid, uuid, jsonb)
  owner to postgres;
alter function public.repairdesk_update_inventory_product_v1(uuid, uuid, jsonb)
  owner to postgres;

revoke all on function public.repairdesk_create_inventory_product_v2(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.repairdesk_update_inventory_product_v1(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;

comment on function public.repairdesk_create_inventory_product_v2(uuid, uuid, jsonb)
  is 'Dormant product quick create with device specifications and multiple unit identifiers.';
comment on function public.repairdesk_update_inventory_product_v1(uuid, uuid, jsonb)
  is 'Dormant idempotent CAS update for product device data; service-role only after enable migration.';

create schema if not exists private;
revoke all on schema private from public, anon;

create or replace function private.bump_repairdesk_inventory_domain_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid;
begin
  v_store_id := case when tg_op = 'DELETE' then old.store_id else new.store_id end;
  if v_store_id is not null then
    insert into public.repairdesk_store_domain_versions (store_id, domain, version, updated_at)
    values (v_store_id, 'inventory', 1, clock_timestamp())
    on conflict (store_id, domain) do update
      set version = public.repairdesk_store_domain_versions.version + 1,
          updated_at = excluded.updated_at;
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

alter function private.bump_repairdesk_inventory_domain_version() owner to postgres;
revoke all on function private.bump_repairdesk_inventory_domain_version()
  from public, anon, authenticated, service_role;

drop trigger if exists repairdesk_realtime_inventory_revision on public.inventory_stock_units;
create trigger repairdesk_realtime_inventory_revision
after insert or update or delete on public.inventory_stock_units
for each row execute function private.bump_repairdesk_inventory_domain_version();
