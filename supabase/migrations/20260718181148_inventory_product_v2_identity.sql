-- Inventory Product V2 expand step 2: catalog, variant, serial unit identity
-- and a dormant atomic intake command. No V1 object is removed or rewritten.

set lock_timeout = '5s';

create table if not exists public.inventory_product_catalog_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  category text not null,
  brand text not null,
  model text not null,
  normalized_key text not null,
  tracking_mode text not null default 'serial',
  standardization_status text not null default 'unstandardized',
  active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_product_catalog_items_store_fkey
    foreign key (store_id) references public.stores(id)
    on update cascade on delete restrict,
  constraint inventory_product_catalog_items_tracking_check
    check (tracking_mode in ('serial', 'quantity')),
  constraint inventory_product_catalog_items_standardization_check
    check (standardization_status in ('standard', 'unstandardized', 'needs_review')),
  constraint inventory_product_catalog_items_text_check
    check (
      char_length(btrim(category)) between 1 and 64
      and char_length(btrim(brand)) between 1 and 120
      and char_length(btrim(model)) between 1 and 160
      and char_length(normalized_key) between 3 and 384
    ),
  constraint inventory_product_catalog_items_id_store_unique unique (id, store_id),
  constraint inventory_product_catalog_items_key_unique unique (store_id, normalized_key)
);

create table if not exists public.inventory_product_variants (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  catalog_item_id uuid not null,
  ram_capacity text,
  storage_capacity text,
  color text,
  gtin text,
  internal_sku text,
  normalized_key text not null,
  active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_product_variants_store_fkey
    foreign key (store_id) references public.stores(id)
    on update cascade on delete restrict,
  constraint inventory_product_variants_catalog_same_store_fkey
    foreign key (catalog_item_id, store_id)
    references public.inventory_product_catalog_items(id, store_id)
    on update cascade on delete restrict,
  constraint inventory_product_variants_id_store_unique unique (id, store_id),
  constraint inventory_product_variants_key_unique unique (store_id, normalized_key),
  constraint inventory_product_variants_key_check
    check (char_length(normalized_key) between 3 and 512)
);

create table if not exists public.inventory_stock_units (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  variant_id uuid not null,
  legacy_inventory_item_id uuid not null,
  source_type text not null,
  source_supplier_id uuid,
  source_customer_id uuid,
  status text not null default 'intake',
  location text,
  cost_amount numeric(12, 2) not null default 0,
  list_price numeric(12, 2) not null default 0,
  currency_code text not null default 'EUR',
  version bigint not null default 1,
  notes text,
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_stock_units_store_fkey
    foreign key (store_id) references public.stores(id)
    on update cascade on delete restrict,
  constraint inventory_stock_units_variant_same_store_fkey
    foreign key (variant_id, store_id)
    references public.inventory_product_variants(id, store_id)
    on update cascade on delete restrict,
  constraint inventory_stock_units_legacy_same_store_fkey
    foreign key (legacy_inventory_item_id, store_id)
    references public.inventory_items(id, store_id)
    on update cascade on delete restrict,
  constraint inventory_stock_units_supplier_same_store_fkey
    foreign key (source_supplier_id, store_id)
    references public.suppliers(id, store_id)
    on update cascade on delete restrict,
  constraint inventory_stock_units_customer_same_store_fkey
    foreign key (source_customer_id, store_id)
    references public.customers(id, store_id)
    on update cascade on delete restrict,
  constraint inventory_stock_units_created_by_fkey
    foreign key (created_by) references auth.users(id)
    on update cascade on delete restrict,
  constraint inventory_stock_units_updated_by_fkey
    foreign key (updated_by) references auth.users(id)
    on update cascade on delete restrict,
  constraint inventory_stock_units_id_store_unique unique (id, store_id),
  constraint inventory_stock_units_legacy_unique unique (store_id, legacy_inventory_item_id),
  constraint inventory_stock_units_source_check
    check (source_type in ('supplier_purchase', 'repair_resale', 'manual_stock')),
  constraint inventory_stock_units_status_check
    check (status in (
      'intake', 'evaluating', 'refurbishing', 'ready_for_sale', 'listed',
      'reserved', 'sold', 'returned', 'cancelled', 'recycled'
    )),
  constraint inventory_stock_units_amount_check
    check (
      cost_amount >= 0 and cost_amount = round(cost_amount, 2)
      and list_price >= 0 and list_price = round(list_price, 2)
    ),
  constraint inventory_stock_units_currency_check check (currency_code = 'EUR'),
  constraint inventory_stock_units_version_check check (version >= 1)
);

create table if not exists public.inventory_stock_unit_identifiers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  stock_unit_id uuid not null,
  kind text not null,
  slot integer,
  display_value text not null,
  normalized_value text not null,
  source text not null,
  is_primary boolean not null default false,
  retired_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  constraint inventory_stock_unit_identifiers_store_fkey
    foreign key (store_id) references public.stores(id)
    on update cascade on delete restrict,
  constraint inventory_stock_unit_identifiers_unit_same_store_fkey
    foreign key (stock_unit_id, store_id)
    references public.inventory_stock_units(id, store_id)
    on update cascade on delete restrict,
  constraint inventory_stock_unit_identifiers_created_by_fkey
    foreign key (created_by) references auth.users(id)
    on update cascade on delete restrict,
  constraint inventory_stock_unit_identifiers_kind_check
    check (kind in ('imei1', 'imei2', 'serial', 'eid', 'ean', 'sku')),
  constraint inventory_stock_unit_identifiers_slot_check
    check (slot is null or slot between 1 and 8),
  constraint inventory_stock_unit_identifiers_source_check
    check (source in ('manual', 'scan', 'ai_confirmed')),
  constraint inventory_stock_unit_identifiers_value_check
    check (
      char_length(btrim(display_value)) between 3 and 128
      and char_length(normalized_value) between 3 and 128
    ),
  constraint inventory_stock_unit_identifiers_id_store_unique unique (id, store_id)
);

create unique index if not exists inventory_stock_unit_identifiers_active_unique_idx
  on public.inventory_stock_unit_identifiers (store_id, kind, normalized_value)
  where retired_at is null;

create unique index if not exists inventory_stock_unit_identifiers_one_primary_idx
  on public.inventory_stock_unit_identifiers (store_id, stock_unit_id)
  where is_primary and retired_at is null;

create table if not exists public.inventory_stock_movements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  stock_unit_id uuid not null,
  variant_id uuid not null,
  movement_type text not null,
  quantity integer not null,
  source_kind text not null,
  source_id text not null,
  idempotency_key uuid not null,
  actor_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint inventory_stock_movements_store_fkey
    foreign key (store_id) references public.stores(id)
    on update cascade on delete restrict,
  constraint inventory_stock_movements_unit_same_store_fkey
    foreign key (stock_unit_id, store_id)
    references public.inventory_stock_units(id, store_id)
    on update cascade on delete restrict,
  constraint inventory_stock_movements_variant_same_store_fkey
    foreign key (variant_id, store_id)
    references public.inventory_product_variants(id, store_id)
    on update cascade on delete restrict,
  constraint inventory_stock_movements_actor_fkey
    foreign key (actor_id) references auth.users(id)
    on update cascade on delete restrict,
  constraint inventory_stock_movements_type_check
    check (movement_type in ('receive', 'reserve', 'release', 'sell', 'return', 'adjust', 'write_off')),
  constraint inventory_stock_movements_serial_quantity_check check (quantity in (-1, 1)),
  constraint inventory_stock_movements_metadata_check check (jsonb_typeof(metadata) = 'object'),
  constraint inventory_stock_movements_idempotency_unique unique (store_id, idempotency_key)
);

create table if not exists public.inventory_intake_command_ledger (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  idempotency_key uuid not null,
  request_hash text not null,
  actor_id uuid not null,
  inventory_item_id uuid not null,
  stock_unit_id uuid not null,
  created_at timestamptz not null default now(),
  constraint inventory_intake_command_ledger_store_fkey
    foreign key (store_id) references public.stores(id)
    on update cascade on delete restrict,
  constraint inventory_intake_command_ledger_item_same_store_fkey
    foreign key (inventory_item_id, store_id)
    references public.inventory_items(id, store_id)
    on update cascade on delete restrict,
  constraint inventory_intake_command_ledger_unit_same_store_fkey
    foreign key (stock_unit_id, store_id)
    references public.inventory_stock_units(id, store_id)
    on update cascade on delete restrict,
  constraint inventory_intake_command_ledger_actor_fkey
    foreign key (actor_id) references auth.users(id)
    on update cascade on delete restrict,
  constraint inventory_intake_command_ledger_request_hash_check
    check (request_hash ~ '^[0-9a-f]{32}$'),
  constraint inventory_intake_command_ledger_idempotency_unique unique (store_id, idempotency_key)
);

create index if not exists inventory_product_catalog_search_idx
  on public.inventory_product_catalog_items (store_id, active, brand, model);
create index if not exists inventory_product_variants_catalog_idx
  on public.inventory_product_variants (store_id, catalog_item_id, active);
create index if not exists inventory_stock_units_status_updated_idx
  on public.inventory_stock_units (store_id, status, updated_at desc);
create index if not exists inventory_stock_movements_unit_occurred_idx
  on public.inventory_stock_movements (store_id, stock_unit_id, occurred_at desc);

alter table public.inventory_product_catalog_items enable row level security;
alter table public.inventory_product_variants enable row level security;
alter table public.inventory_stock_units enable row level security;
alter table public.inventory_stock_unit_identifiers enable row level security;
alter table public.inventory_stock_movements enable row level security;
alter table public.inventory_intake_command_ledger enable row level security;

revoke all on table public.inventory_product_catalog_items from public, anon, authenticated, service_role;
revoke all on table public.inventory_product_variants from public, anon, authenticated, service_role;
revoke all on table public.inventory_stock_units from public, anon, authenticated, service_role;
revoke all on table public.inventory_stock_unit_identifiers from public, anon, authenticated, service_role;
revoke all on table public.inventory_stock_movements from public, anon, authenticated, service_role;
revoke all on table public.inventory_intake_command_ledger from public, anon, authenticated, service_role;

grant select, insert, update on table public.inventory_product_catalog_items to service_role;
grant select, insert, update on table public.inventory_product_variants to service_role;
grant select, insert, update on table public.inventory_stock_units to service_role;
grant select, insert, update on table public.inventory_stock_unit_identifiers to service_role;
grant select, insert on table public.inventory_stock_movements to service_role;
grant select, insert on table public.inventory_intake_command_ledger to service_role;

create or replace function public.repairdesk_inventory_v2_normalize_identifier(p_value text)
returns text
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select upper(pg_catalog.regexp_replace(btrim(p_value), '[^A-Za-z0-9]', '', 'g'))
$$;

create or replace function public.repairdesk_inventory_v2_imei_is_valid(p_value text)
returns boolean
language plpgsql
immutable
strict
security invoker
set search_path = ''
as $$
declare
  v_value text := public.repairdesk_inventory_v2_normalize_identifier(p_value);
  v_sum integer := 0;
  v_digit integer;
  v_index integer;
begin
  if v_value !~ '^[0-9]{15}$' then
    return false;
  end if;
  for v_index in 1..15 loop
    v_digit := substring(v_value from v_index for 1)::integer;
    if mod(v_index, 2) = 0 then
      v_digit := v_digit * 2;
      if v_digit > 9 then v_digit := v_digit - 9; end if;
    end if;
    v_sum := v_sum + v_digit;
  end loop;
  return mod(v_sum, 10) = 0;
end;
$$;

revoke all on function public.repairdesk_inventory_v2_normalize_identifier(text)
  from public, anon, authenticated;
revoke all on function public.repairdesk_inventory_v2_imei_is_valid(text)
  from public, anon, authenticated;
grant execute on function public.repairdesk_inventory_v2_normalize_identifier(text) to service_role;
grant execute on function public.repairdesk_inventory_v2_imei_is_valid(text) to service_role;

create or replace function public.repairdesk_create_inventory_unit_v2(
  p_store_id uuid,
  p_actor_id uuid,
  p_idempotency_key uuid,
  p_source_type text,
  p_customer_id uuid,
  p_supplier_id uuid,
  p_category text,
  p_brand text,
  p_model text,
  p_ram_capacity text,
  p_storage_capacity text,
  p_color text,
  p_identifiers jsonb,
  p_cost_amount numeric,
  p_list_price numeric,
  p_warranty_months integer,
  p_location text,
  p_notes text,
  p_standardization_status text,
  p_created_at timestamptz
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
  v_request_hash text;
  v_catalog_key text;
  v_variant_key text;
  v_identifier jsonb;
  v_kind text;
  v_value text;
  v_normalized text;
  v_source text;
  v_primary_value text;
  v_primary_count integer := 0;
  v_now timestamptz := p_created_at;
begin
  if p_store_id is null or p_actor_id is null then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;
  if p_idempotency_key is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_idempotency_key');
  end if;
  if p_created_at is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_created_at');
  end if;
  if p_source_type not in ('supplier_purchase', 'repair_resale', 'manual_stock') then
    return jsonb_build_object('ok', false, 'code', 'invalid_source');
  end if;
  if p_source_type = 'supplier_purchase' and p_supplier_id is null then
    return jsonb_build_object('ok', false, 'code', 'supplier_required');
  end if;
  if p_source_type = 'supplier_purchase' and p_customer_id is not null then
    return jsonb_build_object('ok', false, 'code', 'invalid_source_party');
  end if;
  if p_source_type = 'repair_resale' and p_customer_id is null then
    return jsonb_build_object('ok', false, 'code', 'customer_required');
  end if;
  if p_source_type = 'repair_resale' and p_supplier_id is not null then
    return jsonb_build_object('ok', false, 'code', 'invalid_source_party');
  end if;
  if p_source_type = 'manual_stock'
     and (p_customer_id is not null or p_supplier_id is not null) then
    return jsonb_build_object('ok', false, 'code', 'invalid_source_party');
  end if;
  if p_source_type = 'manual_stock'
     and nullif(btrim(coalesce(p_notes, '')), '') is null then
    return jsonb_build_object('ok', false, 'code', 'manual_reason_required');
  end if;
  if nullif(btrim(coalesce(p_category, '')), '') is null
     or nullif(btrim(coalesce(p_brand, '')), '') is null
     or nullif(btrim(coalesce(p_model, '')), '') is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_model');
  end if;
  if p_cost_amount is null or p_cost_amount < 0 or p_cost_amount <> round(p_cost_amount, 2)
     or p_list_price is null or p_list_price < 0 or p_list_price <> round(p_list_price, 2) then
    return jsonb_build_object('ok', false, 'code', 'invalid_amount');
  end if;
  if p_warranty_months is null or p_warranty_months < 0 or p_warranty_months > 120 then
    return jsonb_build_object('ok', false, 'code', 'invalid_warranty');
  end if;
  if p_standardization_status not in ('standard', 'unstandardized', 'needs_review') then
    return jsonb_build_object('ok', false, 'code', 'invalid_standardization');
  end if;
  if jsonb_typeof(p_identifiers) <> 'array'
     or jsonb_array_length(p_identifiers) < 1
     or jsonb_array_length(p_identifiers) > 8 then
    return jsonb_build_object('ok', false, 'code', 'invalid_identifiers');
  end if;

  v_request_hash := md5(
    jsonb_build_object(
      'source_type', p_source_type,
      'customer_id', p_customer_id,
      'supplier_id', p_supplier_id,
      'category', btrim(p_category),
      'brand', btrim(p_brand),
      'model', btrim(p_model),
      'ram_capacity', nullif(btrim(coalesce(p_ram_capacity, '')), ''),
      'storage_capacity', nullif(btrim(coalesce(p_storage_capacity, '')), ''),
      'color', nullif(btrim(coalesce(p_color, '')), ''),
      'identifiers', p_identifiers,
      'cost_amount', p_cost_amount,
      'list_price', p_list_price,
      'warranty_months', p_warranty_months,
      'location', nullif(btrim(coalesce(p_location, '')), ''),
      'notes', nullif(btrim(coalesce(p_notes, '')), ''),
      'standardization_status', p_standardization_status,
      'created_at', p_created_at
    )::text
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_store_id::text || ':inventory-intake-v2:' || p_idempotency_key::text,
      0
    )
  );

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
   where profile.id = p_actor_id
     and profile.status::text = 'active'
   limit 1;

  if v_actor_role is null or v_actor_role not in ('owner', 'manager', 'technician', 'sales') then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;

  select ledger.* into v_existing
    from public.inventory_intake_command_ledger as ledger
   where ledger.store_id = p_store_id
     and ledger.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> v_request_hash then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return jsonb_build_object(
      'ok', true,
      'code', 'idempotent_replay',
      'item_id', v_existing.inventory_item_id,
      'stock_unit_id', v_existing.stock_unit_id,
      'created_at', v_existing.created_at
    );
  end if;

  if p_customer_id is not null and not exists (
    select 1 from public.customers
     where id = p_customer_id and store_id = p_store_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'customer_not_found');
  end if;
  if p_supplier_id is not null and not exists (
    select 1 from public.suppliers
     where id = p_supplier_id and store_id = p_store_id and archived_at is null
  ) then
    return jsonb_build_object('ok', false, 'code', 'supplier_not_found');
  end if;

  for v_identifier in select value from jsonb_array_elements(p_identifiers) loop
    if jsonb_typeof(v_identifier) <> 'object' then
      return jsonb_build_object('ok', false, 'code', 'invalid_identifiers');
    end if;
    v_kind := btrim(coalesce(v_identifier ->> 'kind', ''));
    v_value := btrim(coalesce(v_identifier ->> 'value', ''));
    v_source := btrim(coalesce(v_identifier ->> 'source', ''));
    v_normalized := public.repairdesk_inventory_v2_normalize_identifier(v_value);
    if v_kind not in ('imei1', 'imei2', 'serial', 'eid', 'ean', 'sku')
       or v_source not in ('manual', 'scan', 'ai_confirmed')
       or char_length(v_normalized) < 3 then
      return jsonb_build_object('ok', false, 'code', 'invalid_identifiers');
    end if;
    if v_kind in ('imei1', 'imei2')
       and not public.repairdesk_inventory_v2_imei_is_valid(v_normalized) then
      return jsonb_build_object('ok', false, 'code', 'invalid_imei');
    end if;
    if coalesce((v_identifier ->> 'primary')::boolean, false) then
      if v_kind not in ('imei1', 'imei2', 'serial') then
        return jsonb_build_object('ok', false, 'code', 'primary_identifier_required');
      end if;
      v_primary_count := v_primary_count + 1;
      v_primary_value := v_value;
    end if;
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        p_store_id::text || ':inventory-identifier:' || v_kind || ':' || v_normalized,
        0
      )
    );
    if exists (
      select 1 from public.inventory_stock_unit_identifiers as identifier
       where identifier.store_id = p_store_id
         and identifier.kind = v_kind
         and identifier.normalized_value = v_normalized
         and identifier.retired_at is null
    ) then
      return jsonb_build_object('ok', false, 'code', 'duplicate_identifier', 'kind', v_kind);
    end if;
  end loop;

  if v_primary_count <> 1 then
    return jsonb_build_object('ok', false, 'code', 'primary_identifier_required');
  end if;

  v_catalog_key := lower(
    btrim(p_category) || '|' || btrim(p_brand) || '|' || btrim(p_model) || '|serial'
  );
  v_variant_key := v_catalog_key || '|'
    || lower(coalesce(nullif(btrim(p_ram_capacity), ''), '-')) || '|'
    || lower(coalesce(nullif(btrim(p_storage_capacity), ''), '-')) || '|'
    || lower(coalesce(nullif(btrim(p_color), ''), '-'));

  insert into public.inventory_product_catalog_items (
    store_id, category, brand, model, normalized_key, tracking_mode,
    standardization_status, created_by, updated_by, created_at, updated_at
  ) values (
    p_store_id, btrim(p_category), btrim(p_brand), btrim(p_model), v_catalog_key, 'serial',
    p_standardization_status, p_actor_id, p_actor_id, v_now, v_now
  )
  on conflict (store_id, normalized_key) do update
    set updated_at = excluded.updated_at,
        updated_by = excluded.updated_by
  returning id into v_catalog_id;

  insert into public.inventory_product_variants (
    store_id, catalog_item_id, ram_capacity, storage_capacity, color,
    normalized_key, created_by, updated_by, created_at, updated_at
  ) values (
    p_store_id, v_catalog_id,
    nullif(btrim(coalesce(p_ram_capacity, '')), ''),
    nullif(btrim(coalesce(p_storage_capacity, '')), ''),
    nullif(btrim(coalesce(p_color, '')), ''),
    v_variant_key, p_actor_id, p_actor_id, v_now, v_now
  )
  on conflict (store_id, normalized_key) do update
    set updated_at = excluded.updated_at,
        updated_by = excluded.updated_by
  returning id into v_variant_id;

  insert into public.inventory_items (
    id, store_id, status, source_type, source_ref, customer_id, category,
    brand, model, color, storage_capacity, serial_or_imei,
    imei_check_status, activation_lock_status, data_wipe_status,
    buyback_price, list_price, currency_code, warranty_months, notes,
    legacy_payload, created_by, updated_by, created_at, updated_at
  ) values (
    v_item_id, p_store_id, 'intake', p_source_type, p_supplier_id::text, p_customer_id,
    btrim(p_category), btrim(p_brand), btrim(p_model),
    nullif(btrim(coalesce(p_color, '')), ''),
    nullif(btrim(coalesce(p_storage_capacity, '')), ''),
    v_primary_value,
    'unknown', 'unchecked', 'unchecked',
    p_cost_amount, p_list_price, 'EUR', p_warranty_months,
    nullif(btrim(coalesce(p_notes, '')), ''),
    jsonb_build_object('inventory_v2_unit_id', v_unit_id, 'inventory_v2_intake', true),
    p_actor_id, p_actor_id, v_now, v_now
  );

  insert into public.inventory_stock_units (
    id, store_id, variant_id, legacy_inventory_item_id, source_type,
    source_supplier_id, source_customer_id, status, location, cost_amount,
    list_price, currency_code, notes, created_by, updated_by, created_at, updated_at
  ) values (
    v_unit_id, p_store_id, v_variant_id, v_item_id, p_source_type,
    p_supplier_id, p_customer_id, 'intake', nullif(btrim(coalesce(p_location, '')), ''),
    p_cost_amount, p_list_price, 'EUR', nullif(btrim(coalesce(p_notes, '')), ''),
    p_actor_id, p_actor_id, v_now, v_now
  );

  for v_identifier in select value from jsonb_array_elements(p_identifiers) loop
    v_kind := btrim(v_identifier ->> 'kind');
    v_value := btrim(v_identifier ->> 'value');
    v_source := btrim(v_identifier ->> 'source');
    v_normalized := public.repairdesk_inventory_v2_normalize_identifier(v_value);
    insert into public.inventory_stock_unit_identifiers (
      store_id, stock_unit_id, kind, slot, display_value, normalized_value,
      source, is_primary, created_by, created_at
    ) values (
      p_store_id, v_unit_id, v_kind,
      case when v_identifier ? 'slot' then (v_identifier ->> 'slot')::integer else null end,
      v_value, v_normalized, v_source,
      coalesce((v_identifier ->> 'primary')::boolean, false), p_actor_id, v_now
    );
  end loop;

  insert into public.inventory_stock_movements (
    id, store_id, stock_unit_id, variant_id, movement_type, quantity,
    source_kind, source_id, idempotency_key, actor_id, metadata, occurred_at, created_at
  ) values (
    v_movement_id, p_store_id, v_unit_id, v_variant_id, 'receive', 1,
    'inventory_intake_v2', v_item_id, p_idempotency_key, p_actor_id,
    jsonb_build_object('source_type', p_source_type), v_now, v_now
  );

  insert into public.inventory_intake_command_ledger (
    store_id, idempotency_key, request_hash, actor_id,
    inventory_item_id, stock_unit_id, created_at
  ) values (
    p_store_id, p_idempotency_key, v_request_hash, p_actor_id,
    v_item_id, v_unit_id, v_now
  );

  insert into public.inventory_events (
    id, store_id, item_id, event_type, to_status, payload,
    operator_user_id, operator_name, created_at
  ) values (
    gen_random_uuid(), p_store_id, v_item_id, 'created', 'intake',
    jsonb_build_object('inventory_v2_unit_id', v_unit_id, 'movement_id', v_movement_id),
    p_actor_id, v_actor_name, v_now
  );

  insert into public.audit_logs (
    id, actor_id, actor_name, store_id, action, entity_type, entity_id, metadata, created_at
  ) values (
    gen_random_uuid()::text, p_actor_id, v_actor_name, p_store_id,
    'create', 'inventory_v2_stock_unit', v_unit_id::text,
    jsonb_build_object('inventory_item_id', v_item_id, 'movement_id', v_movement_id), v_now
  );

  return jsonb_build_object(
    'ok', true,
    'code', 'created',
    'item_id', v_item_id,
    'stock_unit_id', v_unit_id,
    'created_at', v_now
  );
end;
$$;

revoke all on function public.repairdesk_create_inventory_unit_v2(
  uuid, uuid, uuid, text, uuid, uuid, text, text, text, text, text, text,
  jsonb, numeric, numeric, integer, text, text, text, timestamptz
) from public, anon, authenticated, service_role;

comment on function public.repairdesk_create_inventory_unit_v2(
  uuid, uuid, uuid, text, uuid, uuid, text, text, text, text, text, text,
  jsonb, numeric, numeric, integer, text, text, text, timestamptz
) is 'Dormant atomic serial-unit intake. EXECUTE requires a separate Owner-approved enable migration.';

create or replace function public.repairdesk_inventory_v2_reconcile(
  p_store_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not exists (
    select 1
      from public.store_memberships as membership
     where membership.store_id = p_store_id
       and membership.user_id = p_actor_id
       and membership.status = 'active'
       and membership.role in ('owner', 'manager')
  ) then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;

  with unit_rollup as (
    select
      unit.id,
      unit.legacy_inventory_item_id,
      unit.status::text as unit_status,
      item.id as legacy_item_id,
      item.status::text as legacy_status,
      item.legacy_payload ->> 'inventory_v2_unit_id' as payload_unit_id,
      coalesce((
        select sum(movement.quantity)
          from public.inventory_stock_movements as movement
         where movement.store_id = p_store_id
           and movement.stock_unit_id = unit.id
      ), 0)::bigint as movement_balance,
      (
        select count(*)
          from public.inventory_stock_movements as movement
         where movement.store_id = p_store_id
           and movement.stock_unit_id = unit.id
           and movement.movement_type = 'receive'
      )::bigint as receive_count,
      (
        select count(*)
          from public.inventory_stock_movements as movement
         where movement.store_id = p_store_id
           and movement.stock_unit_id = unit.id
           and movement.movement_type = 'sell'
      )::bigint as sell_count,
      (
        select count(*)
          from public.inventory_stock_unit_identifiers as identifier
         where identifier.store_id = p_store_id
           and identifier.stock_unit_id = unit.id
           and identifier.retired_at is null
      )::bigint as active_identifier_count,
      (
        select count(*)
          from public.inventory_stock_unit_identifiers as identifier
         where identifier.store_id = p_store_id
           and identifier.stock_unit_id = unit.id
           and identifier.retired_at is null
           and identifier.is_primary
      )::bigint as primary_identifier_count,
      exists (
        select 1
          from public.inventory_intake_command_ledger as ledger
         where ledger.store_id = p_store_id
           and ledger.stock_unit_id = unit.id
      ) as has_intake_ledger,
      exists (
        select 1
          from public.inventory_sale_command_ledger as ledger
         where ledger.store_id = p_store_id
           and ledger.inventory_item_id = unit.legacy_inventory_item_id
      ) as has_sale_ledger
    from public.inventory_stock_units as unit
    left join public.inventory_items as item
      on item.store_id = p_store_id
     and item.id = unit.legacy_inventory_item_id
    where unit.store_id = p_store_id
  ), marked_items as (
    select item.id
      from public.inventory_items as item
     where item.store_id = p_store_id
       and item.legacy_payload @> '{"inventory_v2_intake": true}'::jsonb
  ), metrics as (
    select
      (select count(*) from unit_rollup)::bigint as total_units,
      (select count(*) from marked_items)::bigint as total_v1_marked_items,
      (select count(*) from unit_rollup where legacy_item_id is not null)::bigint
        as linked_pairs,
      (
        select count(*)
          from marked_items as marked
         where not exists (
           select 1
             from unit_rollup as unit
            where unit.legacy_inventory_item_id = marked.id
         )
      )::bigint as missing_v2_units,
      (select count(*) from unit_rollup where legacy_item_id is null)::bigint
        as missing_v1_items,
      (
        select count(*)
          from unit_rollup
         where payload_unit_id is distinct from id::text
      )::bigint as payload_link_mismatches,
      (
        select count(*)
          from unit_rollup
         where unit_status is distinct from legacy_status
      )::bigint as status_mismatches,
      (
        select count(*)
          from unit_rollup
         where receive_count <> 1
            or case
              when unit_status = 'sold' then sell_count <> 1 or movement_balance <> 0
              when unit_status in (
                'intake', 'evaluating', 'refurbishing', 'ready_for_sale', 'listed', 'reserved'
              ) then sell_count <> 0 or movement_balance <> 1
              else true
            end
      )::bigint as movement_mismatches,
      (
        select count(*)
          from unit_rollup
         where active_identifier_count < 1
            or primary_identifier_count <> 1
      )::bigint as identifier_mismatches,
      (select count(*) from unit_rollup where not has_intake_ledger)::bigint
        as intake_ledger_mismatches,
      (
        select count(*)
          from unit_rollup
         where unit_status = 'sold'
           and not has_sale_ledger
      )::bigint as sale_ledger_mismatches
  )
  select jsonb_build_object(
    'ok', true,
    'code', 'reconciled',
    'store_id', p_store_id,
    'checked_at', clock_timestamp(),
    'healthy',
      missing_v2_units = 0
      and missing_v1_items = 0
      and payload_link_mismatches = 0
      and status_mismatches = 0
      and movement_mismatches = 0
      and identifier_mismatches = 0
      and intake_ledger_mismatches = 0
      and sale_ledger_mismatches = 0,
    'total_units', total_units,
    'total_v1_marked_items', total_v1_marked_items,
    'linked_pairs', linked_pairs,
    'missing_v2_units', missing_v2_units,
    'missing_v1_items', missing_v1_items,
    'payload_link_mismatches', payload_link_mismatches,
    'status_mismatches', status_mismatches,
    'movement_mismatches', movement_mismatches,
    'identifier_mismatches', identifier_mismatches,
    'intake_ledger_mismatches', intake_ledger_mismatches,
    'sale_ledger_mismatches', sale_ledger_mismatches
  )
    into v_result
    from metrics;

  return v_result;
end;
$$;

revoke all on function public.repairdesk_inventory_v2_reconcile(uuid, uuid)
  from public, anon, authenticated, service_role;

comment on function public.repairdesk_inventory_v2_reconcile(uuid, uuid)
  is 'Store-scoped V1/V2 shadow reconciliation. Runtime EXECUTE requires a separate Owner-approved enable migration.';
