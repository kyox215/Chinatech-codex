-- Store-private spare-parts procurement and repair-line cost allocation.
-- Reissued after the applied Phase 1 migrations so linked history stays append-only.
-- This remains separate from resale-device inventory_items.

set lock_timeout = '5s';
set statement_timeout = '60s';

create table public.parts_catalog_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on update cascade on delete restrict,
  sku text not null,
  name text not null,
  catalog_key text,
  compatible_models jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  idempotency_key uuid not null,
  created_by uuid references auth.users(id) on update cascade on delete set null,
  updated_by uuid references auth.users(id) on update cascade on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (id, store_id),
  unique (store_id, idempotency_key),
  constraint parts_catalog_items_sku_check check (char_length(btrim(sku)) between 1 and 80),
  constraint parts_catalog_items_name_check check (char_length(btrim(name)) between 1 and 160),
  constraint parts_catalog_items_catalog_key_check check (
    catalog_key is null
    or catalog_key ~ '^[a-z0-9][a-z0-9_-]{0,63}:[a-z0-9][a-z0-9_-]{0,63}$'
  ),
  constraint parts_catalog_items_models_check check (
    jsonb_typeof(compatible_models) = 'array'
    and jsonb_array_length(compatible_models) <= 100
  )
);

create unique index parts_catalog_items_store_sku_active_idx
  on public.parts_catalog_items (store_id, lower(sku))
  where active;
create index parts_catalog_items_store_catalog_idx
  on public.parts_catalog_items (store_id, catalog_key, updated_at desc)
  where active;

create table public.parts_purchase_lots (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on update cascade on delete restrict,
  part_item_id uuid not null,
  supplier_id uuid,
  lot_code text not null,
  supplier_document_ref text,
  received_quantity integer not null,
  available_quantity integer not null,
  original_unit_cost numeric(18, 6) not null,
  original_currency_code text not null,
  fx_rate_to_eur numeric(20, 10) not null,
  fx_rate_at timestamptz not null,
  fx_rate_source text not null,
  unit_cost_eur numeric(12, 2) not null,
  evidence_status text not null,
  received_at timestamptz not null,
  idempotency_key uuid not null,
  created_by uuid references auth.users(id) on update cascade on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  unique (id, store_id),
  unique (store_id, idempotency_key),
  constraint parts_purchase_lots_part_store_fkey foreign key (part_item_id, store_id)
    references public.parts_catalog_items(id, store_id) on update cascade on delete restrict,
  constraint parts_purchase_lots_supplier_store_fkey foreign key (supplier_id, store_id)
    references public.suppliers(id, store_id) on update cascade on delete restrict,
  constraint parts_purchase_lots_code_check check (char_length(btrim(lot_code)) between 1 and 100),
  constraint parts_purchase_lots_document_check check (
    supplier_document_ref is null
    or char_length(btrim(supplier_document_ref)) between 1 and 160
  ),
  constraint parts_purchase_lots_quantity_check check (
    received_quantity between 1 and 1000000
    and available_quantity between 0 and received_quantity
  ),
  constraint parts_purchase_lots_original_cost_check check (
    original_unit_cost between 0 and 999999999999.999999
    and original_unit_cost = round(original_unit_cost, 6)
  ),
  constraint parts_purchase_lots_currency_check check (original_currency_code ~ '^[A-Z]{3}$'),
  constraint parts_purchase_lots_fx_check check (
    fx_rate_to_eur > 0 and fx_rate_to_eur <= 1000000
    and fx_rate_to_eur = round(fx_rate_to_eur, 10)
  ),
  constraint parts_purchase_lots_eur_cost_check check (
    unit_cost_eur between 0 and 999999.99
    and unit_cost_eur = round(original_unit_cost * fx_rate_to_eur, 2)
  ),
  constraint parts_purchase_lots_evidence_check check (
    evidence_status in ('confirmed', 'reconciled')
  ),
  constraint parts_purchase_lots_fx_source_check check (
    char_length(btrim(fx_rate_source)) between 1 and 80
  )
);

create index parts_purchase_lots_available_match_idx
  on public.parts_purchase_lots (store_id, part_item_id, received_at, id)
  where available_quantity > 0;
create index parts_purchase_lots_supplier_received_idx
  on public.parts_purchase_lots (store_id, supplier_id, received_at desc);

create table public.order_part_allocations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on update cascade on delete restrict,
  order_id uuid not null,
  line_id uuid not null,
  lot_id uuid not null,
  part_item_id uuid not null,
  supplier_id uuid,
  quantity integer not null,
  part_sku_snapshot text not null,
  part_name_snapshot text not null,
  supplier_name_snapshot text,
  original_unit_cost numeric(18, 6) not null,
  original_currency_code text not null,
  fx_rate_to_eur numeric(20, 10) not null,
  fx_rate_at timestamptz not null,
  fx_rate_source text not null,
  unit_cost_eur numeric(12, 2) not null,
  total_cost_eur numeric(12, 2) not null,
  state text not null default 'allocated',
  previous_cost_amount numeric(12, 2),
  previous_source text not null,
  previous_evidence_status text not null,
  previous_original_amount numeric(18, 6),
  previous_original_currency_code text,
  previous_fx_rate_to_eur numeric(20, 10),
  previous_fx_rate_at timestamptz,
  previous_fx_rate_source text,
  previous_source_reference_type text,
  previous_source_reference_id uuid,
  idempotency_key uuid not null,
  allocated_by uuid references auth.users(id) on update cascade on delete set null,
  allocated_at timestamptz not null default clock_timestamp(),
  released_by uuid references auth.users(id) on update cascade on delete set null,
  released_at timestamptz,
  release_reason text,
  unique (id, store_id),
  unique (store_id, idempotency_key),
  constraint order_part_allocations_order_store_fkey foreign key (order_id, store_id)
    references public.repair_orders(id, store_id) on update cascade on delete restrict,
  constraint order_part_allocations_lot_store_fkey foreign key (lot_id, store_id)
    references public.parts_purchase_lots(id, store_id) on update cascade on delete restrict,
  constraint order_part_allocations_part_store_fkey foreign key (part_item_id, store_id)
    references public.parts_catalog_items(id, store_id) on update cascade on delete restrict,
  constraint order_part_allocations_supplier_store_fkey foreign key (supplier_id, store_id)
    references public.suppliers(id, store_id) on update cascade on delete restrict,
  constraint order_part_allocations_quantity_check check (quantity between 1 and 1000),
  constraint order_part_allocations_cost_check check (
    unit_cost_eur between 0 and 999999.99
    and total_cost_eur = round(unit_cost_eur * quantity, 2)
  ),
  constraint order_part_allocations_state_check check (state in ('allocated', 'released')),
  constraint order_part_allocations_release_check check (
    (state = 'allocated' and released_by is null and released_at is null and release_reason is null)
    or (
      state = 'released'
      and released_at is not null
      and char_length(btrim(coalesce(release_reason, ''))) between 1 and 500
    )
  )
);

create unique index order_part_allocations_active_line_idx
  on public.order_part_allocations (store_id, order_id, line_id)
  where state = 'allocated';
create index order_part_allocations_order_history_idx
  on public.order_part_allocations (store_id, order_id, allocated_at desc);
create index order_part_allocations_supplier_report_idx
  on public.order_part_allocations (store_id, supplier_id, allocated_at desc);

create table public.part_stock_movements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on update cascade on delete restrict,
  lot_id uuid not null,
  allocation_id uuid,
  movement_type text not null,
  quantity_delta integer not null,
  unit_cost_eur_snapshot numeric(12, 2) not null,
  idempotency_key uuid not null,
  reason text,
  actor_id uuid references auth.users(id) on update cascade on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  unique (store_id, idempotency_key),
  constraint part_stock_movements_lot_store_fkey foreign key (lot_id, store_id)
    references public.parts_purchase_lots(id, store_id) on update cascade on delete restrict,
  constraint part_stock_movements_allocation_store_fkey foreign key (allocation_id, store_id)
    references public.order_part_allocations(id, store_id) on update cascade on delete restrict,
  constraint part_stock_movements_type_check check (
    movement_type in ('receipt', 'allocation', 'release', 'adjustment', 'write_off')
  ),
  constraint part_stock_movements_quantity_check check (quantity_delta <> 0),
  constraint part_stock_movements_direction_check check (
    (movement_type in ('receipt', 'release') and quantity_delta > 0)
    or (movement_type in ('allocation', 'write_off') and quantity_delta < 0)
    or movement_type = 'adjustment'
  ),
  constraint part_stock_movements_cost_check check (
    unit_cost_eur_snapshot between 0 and 999999.99
  ),
  constraint part_stock_movements_reason_check check (
    reason is null or char_length(btrim(reason)) between 1 and 500
  )
);

create index part_stock_movements_lot_created_idx
  on public.part_stock_movements (store_id, lot_id, created_at, id);
create index part_stock_movements_allocation_idx
  on public.part_stock_movements (store_id, allocation_id, created_at)
  where allocation_id is not null;

alter table public.parts_catalog_items enable row level security;
alter table public.parts_purchase_lots enable row level security;
alter table public.order_part_allocations enable row level security;
alter table public.part_stock_movements enable row level security;

revoke all on table public.parts_catalog_items from public, anon, authenticated, service_role;
revoke all on table public.parts_purchase_lots from public, anon, authenticated, service_role;
revoke all on table public.order_part_allocations from public, anon, authenticated, service_role;
revoke all on table public.part_stock_movements from public, anon, authenticated, service_role;
grant select on table public.parts_catalog_items to service_role;
grant select on table public.parts_purchase_lots to service_role;
grant select on table public.order_part_allocations to service_role;
grant select on table public.part_stock_movements to service_role;

create or replace function public.repairdesk_guard_part_lot_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then raise exception 'parts_purchase_lot_delete_forbidden'; end if;
  if row(
    new.id, new.store_id, new.part_item_id, new.supplier_id, new.lot_code,
    new.supplier_document_ref, new.received_quantity, new.original_unit_cost,
    new.original_currency_code, new.fx_rate_to_eur, new.fx_rate_at,
    new.fx_rate_source, new.unit_cost_eur, new.evidence_status, new.received_at,
    new.idempotency_key, new.created_by, new.created_at
  ) is distinct from row(
    old.id, old.store_id, old.part_item_id, old.supplier_id, old.lot_code,
    old.supplier_document_ref, old.received_quantity, old.original_unit_cost,
    old.original_currency_code, old.fx_rate_to_eur, old.fx_rate_at,
    old.fx_rate_source, old.unit_cost_eur, old.evidence_status, old.received_at,
    old.idempotency_key, old.created_by, old.created_at
  ) then raise exception 'parts_purchase_lot_snapshot_immutable'; end if;
  return new;
end;
$$;

revoke all on function public.repairdesk_guard_part_lot_immutable()
  from public, anon, authenticated, service_role;
create trigger repairdesk_part_lot_immutable_trigger
before update or delete on public.parts_purchase_lots
for each row execute function public.repairdesk_guard_part_lot_immutable();

create or replace function public.repairdesk_guard_part_allocation_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then raise exception 'order_part_allocation_delete_forbidden'; end if;
  if row(
    new.id, new.store_id, new.order_id, new.line_id, new.lot_id, new.part_item_id,
    new.supplier_id, new.quantity, new.part_sku_snapshot, new.part_name_snapshot,
    new.supplier_name_snapshot, new.original_unit_cost, new.original_currency_code,
    new.fx_rate_to_eur, new.fx_rate_at, new.fx_rate_source, new.unit_cost_eur,
    new.total_cost_eur, new.previous_cost_amount, new.previous_source,
    new.previous_evidence_status, new.previous_original_amount,
    new.previous_original_currency_code, new.previous_fx_rate_to_eur,
    new.previous_fx_rate_at, new.previous_fx_rate_source,
    new.previous_source_reference_type, new.previous_source_reference_id,
    new.idempotency_key, new.allocated_by, new.allocated_at
  ) is distinct from row(
    old.id, old.store_id, old.order_id, old.line_id, old.lot_id, old.part_item_id,
    old.supplier_id, old.quantity, old.part_sku_snapshot, old.part_name_snapshot,
    old.supplier_name_snapshot, old.original_unit_cost, old.original_currency_code,
    old.fx_rate_to_eur, old.fx_rate_at, old.fx_rate_source, old.unit_cost_eur,
    old.total_cost_eur, old.previous_cost_amount, old.previous_source,
    old.previous_evidence_status, old.previous_original_amount,
    old.previous_original_currency_code, old.previous_fx_rate_to_eur,
    old.previous_fx_rate_at, old.previous_fx_rate_source,
    old.previous_source_reference_type, old.previous_source_reference_id,
    old.idempotency_key, old.allocated_by, old.allocated_at
  ) then raise exception 'order_part_allocation_snapshot_immutable'; end if;
  return new;
end;
$$;

revoke all on function public.repairdesk_guard_part_allocation_immutable()
  from public, anon, authenticated, service_role;
create trigger repairdesk_part_allocation_immutable_trigger
before update or delete on public.order_part_allocations
for each row execute function public.repairdesk_guard_part_allocation_immutable();

create or replace function public.repairdesk_reject_part_stock_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'part_stock_movements_append_only';
end;
$$;

revoke all on function public.repairdesk_reject_part_stock_mutation()
  from public, anon, authenticated, service_role;
create trigger repairdesk_part_stock_append_only_trigger
before update or delete on public.part_stock_movements
for each row execute function public.repairdesk_reject_part_stock_mutation();

create or replace function public.repairdesk_read_parts_procurement_rpc(
  p_store_id uuid,
  p_actor_id uuid,
  p_order_id uuid default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not public.repairdesk_actor_has_phase2_cost_permission(
      p_store_id, p_actor_id, 'inventory:cost_allocate'
    ) then jsonb_build_object('ok', false, 'code', 'actor_forbidden')
    when p_order_id is not null and not exists (
      select 1 from public.repair_orders as order_row
      where order_row.store_id = p_store_id
        and order_row.id = p_order_id
        and order_row.record_state::text = 'active'
        and order_row.deleted_at is null
    ) then jsonb_build_object('ok', false, 'code', 'order_not_found')
    else jsonb_build_object(
      'ok', true,
      'code', 'read',
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', part.id,
          'sku', part.sku,
          'name', part.name,
          'catalog_key', part.catalog_key,
          'compatible_models', part.compatible_models,
          'active', part.active,
          'weighted_average_unit_cost_eur', (
            select case when sum(lot.available_quantity) > 0
              then round(
                sum(lot.unit_cost_eur * lot.available_quantity)
                  / sum(lot.available_quantity),
                2
              )
              else null end
            from public.parts_purchase_lots as lot
            where lot.store_id = part.store_id
              and lot.part_item_id = part.id
              and lot.available_quantity > 0
          ),
          'available_quantity', (
            select coalesce(sum(lot.available_quantity), 0)
            from public.parts_purchase_lots as lot
            where lot.store_id = part.store_id and lot.part_item_id = part.id
          ),
          'created_at', part.created_at,
          'updated_at', part.updated_at
        ) order by lower(part.name), lower(part.sku))
        from public.parts_catalog_items as part
        where part.store_id = p_store_id and part.active
      ), '[]'::jsonb),
      'lots', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', lot.id,
          'part_item_id', lot.part_item_id,
          'part_sku', part.sku,
          'part_name', part.name,
          'catalog_key', part.catalog_key,
          'supplier_id', lot.supplier_id,
          'supplier_name', supplier.name,
          'lot_code', lot.lot_code,
          'supplier_document_ref', lot.supplier_document_ref,
          'received_quantity', lot.received_quantity,
          'available_quantity', lot.available_quantity,
          'original_unit_cost', lot.original_unit_cost,
          'original_currency_code', lot.original_currency_code,
          'fx_rate_to_eur', lot.fx_rate_to_eur,
          'fx_rate_at', lot.fx_rate_at,
          'fx_rate_source', lot.fx_rate_source,
          'unit_cost_eur', lot.unit_cost_eur,
          'evidence_status', lot.evidence_status,
          'received_at', lot.received_at
        ) order by lot.received_at desc, lot.id)
        from public.parts_purchase_lots as lot
        join public.parts_catalog_items as part
          on part.id = lot.part_item_id and part.store_id = lot.store_id
        left join public.suppliers as supplier
          on supplier.id = lot.supplier_id and supplier.store_id = lot.store_id
        where lot.store_id = p_store_id
      ), '[]'::jsonb),
      'suppliers', coalesce((
        select jsonb_agg(jsonb_build_object('id', supplier.id, 'name', supplier.name)
          order by lower(supplier.name))
        from public.suppliers as supplier
        where supplier.store_id = p_store_id and supplier.archived_at is null
      ), '[]'::jsonb),
      'allocations', case when p_order_id is null then '[]'::jsonb else coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', allocation.id,
          'order_id', allocation.order_id,
          'line_id', allocation.line_id,
          'lot_id', allocation.lot_id,
          'part_item_id', allocation.part_item_id,
          'supplier_id', allocation.supplier_id,
          'quantity', allocation.quantity,
          'part_sku', allocation.part_sku_snapshot,
          'part_name', allocation.part_name_snapshot,
          'supplier_name', allocation.supplier_name_snapshot,
          'unit_cost_eur', allocation.unit_cost_eur,
          'total_cost_eur', allocation.total_cost_eur,
          'state', allocation.state,
          'allocated_at', allocation.allocated_at,
          'released_at', allocation.released_at,
          'release_reason', allocation.release_reason
        ) order by allocation.allocated_at desc)
        from public.order_part_allocations as allocation
        where allocation.store_id = p_store_id and allocation.order_id = p_order_id
      ), '[]'::jsonb) end
    )
  end;
$$;

create or replace function public.repairdesk_create_part_catalog_item_rpc(
  p_store_id uuid,
  p_actor_id uuid,
  p_sku text,
  p_name text,
  p_catalog_key text,
  p_compatible_models jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_existing public.parts_catalog_items%rowtype;
  v_models jsonb := coalesce(p_compatible_models, '[]'::jsonb);
begin
  if not public.repairdesk_actor_has_phase2_cost_permission(
    p_store_id, p_actor_id, 'inventory:cost_allocate'
  ) then return jsonb_build_object('ok', false, 'code', 'actor_forbidden'); end if;
  if p_idempotency_key is null
     or char_length(btrim(coalesce(p_sku, ''))) not between 1 and 80
     or char_length(btrim(coalesce(p_name, ''))) not between 1 and 160
     or jsonb_typeof(v_models) <> 'array'
     or jsonb_array_length(v_models) > 100 then
    return jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;

  insert into public.parts_catalog_items (
    store_id, sku, name, catalog_key, compatible_models,
    idempotency_key, created_by, updated_by
  ) values (
    p_store_id, btrim(p_sku), btrim(p_name), nullif(btrim(p_catalog_key), ''), v_models,
    p_idempotency_key, p_actor_id, p_actor_id
  ) on conflict (store_id, idempotency_key) do nothing
  returning id into v_id;

  if v_id is null then
    select * into v_existing from public.parts_catalog_items
    where store_id = p_store_id and idempotency_key = p_idempotency_key;
    if v_existing.sku <> btrim(p_sku)
       or v_existing.name <> btrim(p_name)
       or v_existing.catalog_key is distinct from nullif(btrim(p_catalog_key), '')
       or v_existing.compatible_models <> v_models then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return jsonb_build_object('ok', true, 'code', 'idempotent_replay', 'id', v_existing.id);
  end if;

  insert into public.audit_logs (
    id, actor_id, actor_name, store_id, action, entity_type, entity_id, metadata
  ) values (
    gen_random_uuid()::text, p_actor_id, 'staff', p_store_id, 'created',
    'parts_catalog_item', v_id::text,
    jsonb_build_object('sku', btrim(p_sku), 'catalog_key', nullif(btrim(p_catalog_key), ''))
  );
  return jsonb_build_object('ok', true, 'code', 'created', 'id', v_id);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'code', 'sku_conflict');
end;
$$;

create or replace function public.repairdesk_receive_part_lot_rpc(
  p_store_id uuid,
  p_actor_id uuid,
  p_part_item_id uuid,
  p_supplier_id uuid,
  p_lot_code text,
  p_supplier_document_ref text,
  p_quantity integer,
  p_original_unit_cost numeric,
  p_original_currency_code text,
  p_fx_rate_to_eur numeric,
  p_fx_rate_at timestamptz,
  p_fx_rate_source text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_cost_eur numeric(12, 2);
  v_existing public.parts_purchase_lots%rowtype;
begin
  if not public.repairdesk_actor_has_phase2_cost_permission(
    p_store_id, p_actor_id, 'inventory:cost_allocate'
  ) then return jsonb_build_object('ok', false, 'code', 'actor_forbidden'); end if;
  if p_idempotency_key is null or p_part_item_id is null
     or p_quantity not between 1 and 1000000
     or p_original_unit_cost is null or p_original_unit_cost < 0
     or p_fx_rate_to_eur is null or p_fx_rate_to_eur <= 0
     or p_fx_rate_at is null
     or p_original_currency_code !~ '^[A-Z]{3}$'
     or char_length(btrim(coalesce(p_lot_code, ''))) not between 1 and 100
     or char_length(btrim(coalesce(p_fx_rate_source, ''))) not between 1 and 80 then
    return jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;
  if not exists (
    select 1 from public.parts_catalog_items
    where id = p_part_item_id and store_id = p_store_id and active
  ) then return jsonb_build_object('ok', false, 'code', 'part_not_found'); end if;
  if p_supplier_id is not null and not exists (
    select 1 from public.suppliers
    where id = p_supplier_id and store_id = p_store_id and archived_at is null
  ) then return jsonb_build_object('ok', false, 'code', 'supplier_not_found'); end if;

  v_cost_eur := round(p_original_unit_cost * p_fx_rate_to_eur, 2);
  insert into public.parts_purchase_lots (
    store_id, part_item_id, supplier_id, lot_code, supplier_document_ref,
    received_quantity, available_quantity, original_unit_cost, original_currency_code,
    fx_rate_to_eur, fx_rate_at, fx_rate_source, unit_cost_eur, evidence_status,
    received_at, idempotency_key, created_by
  ) values (
    p_store_id, p_part_item_id, p_supplier_id, btrim(p_lot_code),
    nullif(btrim(p_supplier_document_ref), ''), p_quantity, p_quantity,
    round(p_original_unit_cost, 6), p_original_currency_code, round(p_fx_rate_to_eur, 10),
    p_fx_rate_at, btrim(p_fx_rate_source), v_cost_eur, 'confirmed', p_fx_rate_at,
    p_idempotency_key, p_actor_id
  ) on conflict (store_id, idempotency_key) do nothing
  returning id into v_id;

  if v_id is null then
    select * into v_existing from public.parts_purchase_lots
    where store_id = p_store_id and idempotency_key = p_idempotency_key;
    if v_existing.part_item_id <> p_part_item_id
       or v_existing.supplier_id is distinct from p_supplier_id
       or v_existing.received_quantity <> p_quantity
       or v_existing.original_unit_cost <> round(p_original_unit_cost, 6)
       or v_existing.original_currency_code <> p_original_currency_code
       or v_existing.fx_rate_to_eur <> round(p_fx_rate_to_eur, 10) then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return jsonb_build_object('ok', true, 'code', 'idempotent_replay', 'id', v_existing.id);
  end if;

  insert into public.part_stock_movements (
    store_id, lot_id, movement_type, quantity_delta, unit_cost_eur_snapshot,
    idempotency_key, reason, actor_id
  ) values (
    p_store_id, v_id, 'receipt', p_quantity, v_cost_eur,
    p_idempotency_key, 'purchase_receipt', p_actor_id
  );
  insert into public.audit_logs (
    id, actor_id, actor_name, store_id, action, entity_type, entity_id, metadata
  ) values (
    gen_random_uuid()::text, p_actor_id, 'staff', p_store_id, 'received',
    'parts_purchase_lot', v_id::text,
    jsonb_build_object('part_item_id', p_part_item_id, 'quantity', p_quantity,
      'supplier_id', p_supplier_id, 'currency_code', p_original_currency_code)
  );
  return jsonb_build_object('ok', true, 'code', 'received', 'id', v_id);
end;
$$;

create or replace function public.repairdesk_allocate_order_part_rpc(
  p_store_id uuid,
  p_order_id uuid,
  p_actor_id uuid,
  p_line_id uuid,
  p_lot_id uuid,
  p_quantity integer,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lot public.parts_purchase_lots%rowtype;
  v_part public.parts_catalog_items%rowtype;
  v_cost public.repair_order_line_costs%rowtype;
  v_supplier_name text;
  v_allocation_id uuid;
  v_total_eur numeric(12, 2);
  v_existing public.order_part_allocations%rowtype;
begin
  if not public.repairdesk_actor_has_phase2_cost_permission(
    p_store_id, p_actor_id, 'inventory:cost_allocate'
  ) then return jsonb_build_object('ok', false, 'code', 'actor_forbidden'); end if;
  if p_idempotency_key is null or p_order_id is null or p_line_id is null
     or p_lot_id is null or p_quantity not between 1 and 1000 then
    return jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;

  select * into v_existing from public.order_part_allocations
  where store_id = p_store_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.order_id <> p_order_id or v_existing.line_id <> p_line_id
       or v_existing.lot_id <> p_lot_id or v_existing.quantity <> p_quantity then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return jsonb_build_object('ok', true, 'code', 'idempotent_replay', 'id', v_existing.id);
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_store_id::text || ':part-line:' || p_order_id::text || ':' || p_line_id::text, 0)
  );
  if not exists (
    select 1 from public.repair_orders as order_row
    where order_row.id = p_order_id and order_row.store_id = p_store_id
      and order_row.record_state::text = 'active' and order_row.deleted_at is null
      and order_row.status::text <> 'cancelled'
      and coalesce(order_row.exception_status::text, '') <> 'cancelled'
      and exists (
        select 1 from jsonb_array_elements(order_row.fault_prices) as line
        where line ->> 'line_id' = p_line_id::text
      )
  ) then return jsonb_build_object('ok', false, 'code', 'order_line_not_found'); end if;
  if exists (
    select 1 from public.order_part_allocations
    where store_id = p_store_id and order_id = p_order_id and line_id = p_line_id
      and state = 'allocated'
  ) then return jsonb_build_object('ok', false, 'code', 'line_already_allocated'); end if;

  select * into v_lot from public.parts_purchase_lots
  where id = p_lot_id and store_id = p_store_id
  for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'lot_not_found'); end if;
  if v_lot.available_quantity < p_quantity then
    return jsonb_build_object('ok', false, 'code', 'insufficient_quantity',
      'available_quantity', v_lot.available_quantity);
  end if;
  select * into v_part from public.parts_catalog_items
  where id = v_lot.part_item_id and store_id = p_store_id;
  select supplier.name into v_supplier_name from public.suppliers as supplier
  where supplier.id = v_lot.supplier_id and supplier.store_id = p_store_id;
  select * into v_cost from public.repair_order_line_costs
  where store_id = p_store_id and order_id = p_order_id and line_id = p_line_id and is_active
  for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'cost_line_not_found'); end if;

  v_total_eur := round(v_lot.unit_cost_eur * p_quantity, 2);
  insert into public.order_part_allocations (
    store_id, order_id, line_id, lot_id, part_item_id, supplier_id, quantity,
    part_sku_snapshot, part_name_snapshot, supplier_name_snapshot,
    original_unit_cost, original_currency_code, fx_rate_to_eur, fx_rate_at,
    fx_rate_source, unit_cost_eur, total_cost_eur,
    previous_cost_amount, previous_source, previous_evidence_status,
    previous_original_amount, previous_original_currency_code, previous_fx_rate_to_eur,
    previous_fx_rate_at, previous_fx_rate_source, previous_source_reference_type,
    previous_source_reference_id, idempotency_key, allocated_by
  ) values (
    p_store_id, p_order_id, p_line_id, v_lot.id, v_part.id, v_lot.supplier_id, p_quantity,
    v_part.sku, v_part.name, v_supplier_name,
    v_lot.original_unit_cost, v_lot.original_currency_code, v_lot.fx_rate_to_eur,
    v_lot.fx_rate_at, v_lot.fx_rate_source, v_lot.unit_cost_eur, v_total_eur,
    v_cost.cost_amount, v_cost.source, v_cost.evidence_status,
    v_cost.original_amount, v_cost.original_currency_code, v_cost.fx_rate_to_eur,
    v_cost.fx_rate_at, v_cost.fx_rate_source, v_cost.source_reference_type,
    v_cost.source_reference_id, p_idempotency_key, p_actor_id
  ) returning id into v_allocation_id;

  update public.parts_purchase_lots
  set available_quantity = available_quantity - p_quantity
  where id = v_lot.id and store_id = p_store_id;
  insert into public.part_stock_movements (
    store_id, lot_id, allocation_id, movement_type, quantity_delta,
    unit_cost_eur_snapshot, idempotency_key, reason, actor_id
  ) values (
    p_store_id, v_lot.id, v_allocation_id, 'allocation', -p_quantity,
    v_lot.unit_cost_eur, p_idempotency_key, 'repair_order_allocation', p_actor_id
  );

  perform pg_catalog.set_config('repairdesk.cost_actor_id', p_actor_id::text, true);
  update public.repair_order_line_costs
  set cost_amount = v_total_eur,
      source = 'purchase_lot',
      original_amount = round(v_lot.original_unit_cost * p_quantity, 6),
      original_currency_code = v_lot.original_currency_code,
      fx_rate_to_eur = v_lot.fx_rate_to_eur,
      fx_rate_at = v_lot.fx_rate_at,
      fx_rate_source = v_lot.fx_rate_source,
      source_reference_type = 'parts_purchase_lot',
      source_reference_id = v_lot.id,
      revision = revision + 1,
      updated_by = p_actor_id,
      updated_at = clock_timestamp()
  where id = v_cost.id;

  insert into public.audit_logs (
    id, actor_id, actor_name, store_id, action, entity_type, entity_id, metadata
  ) values (
    gen_random_uuid()::text, p_actor_id, 'staff', p_store_id, 'allocated',
    'order_part_allocation', v_allocation_id::text,
    jsonb_build_object('order_id', p_order_id, 'line_id', p_line_id,
      'lot_id', p_lot_id, 'quantity', p_quantity)
  );
  return jsonb_build_object('ok', true, 'code', 'allocated', 'id', v_allocation_id,
    'cost_amount', v_total_eur);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'code', 'line_already_allocated');
end;
$$;

create or replace function public.repairdesk_release_order_part_rpc(
  p_store_id uuid,
  p_allocation_id uuid,
  p_actor_id uuid,
  p_reason text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allocation public.order_part_allocations%rowtype;
  v_cost public.repair_order_line_costs%rowtype;
begin
  if not public.repairdesk_actor_has_phase2_cost_permission(
    p_store_id, p_actor_id, 'inventory:cost_allocate'
  ) then return jsonb_build_object('ok', false, 'code', 'actor_forbidden'); end if;
  if p_idempotency_key is null or p_allocation_id is null
     or char_length(btrim(coalesce(p_reason, ''))) not between 1 and 500 then
    return jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;
  if exists (
    select 1 from public.part_stock_movements
    where store_id = p_store_id and idempotency_key = p_idempotency_key
      and movement_type = 'release' and allocation_id = p_allocation_id
  ) then return jsonb_build_object('ok', true, 'code', 'idempotent_replay', 'id', p_allocation_id); end if;

  select * into v_allocation from public.order_part_allocations
  where id = p_allocation_id and store_id = p_store_id
  for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'allocation_not_found'); end if;
  if v_allocation.state <> 'allocated' then
    return jsonb_build_object('ok', false, 'code', 'allocation_already_released');
  end if;
  perform 1 from public.parts_purchase_lots
  where id = v_allocation.lot_id and store_id = p_store_id
  for update;

  update public.parts_purchase_lots
  set available_quantity = available_quantity + v_allocation.quantity
  where id = v_allocation.lot_id and store_id = p_store_id;
  update public.order_part_allocations
  set state = 'released', released_by = p_actor_id, released_at = clock_timestamp(),
      release_reason = btrim(p_reason)
  where id = v_allocation.id;
  insert into public.part_stock_movements (
    store_id, lot_id, allocation_id, movement_type, quantity_delta,
    unit_cost_eur_snapshot, idempotency_key, reason, actor_id
  ) values (
    p_store_id, v_allocation.lot_id, v_allocation.id, 'release', v_allocation.quantity,
    v_allocation.unit_cost_eur, p_idempotency_key, btrim(p_reason), p_actor_id
  );

  select * into v_cost from public.repair_order_line_costs
  where store_id = p_store_id and order_id = v_allocation.order_id
    and line_id = v_allocation.line_id and is_active
  for update;
  if found and v_cost.source = 'purchase_lot'
     and v_cost.source_reference_type = 'parts_purchase_lot'
     and v_cost.source_reference_id = v_allocation.lot_id then
    perform pg_catalog.set_config('repairdesk.cost_actor_id', p_actor_id::text, true);
    update public.repair_order_line_costs
    set cost_amount = v_allocation.previous_cost_amount,
        source = v_allocation.previous_source,
        evidence_status = v_allocation.previous_evidence_status,
        original_amount = v_allocation.previous_original_amount,
        original_currency_code = v_allocation.previous_original_currency_code,
        fx_rate_to_eur = v_allocation.previous_fx_rate_to_eur,
        fx_rate_at = v_allocation.previous_fx_rate_at,
        fx_rate_source = v_allocation.previous_fx_rate_source,
        source_reference_type = v_allocation.previous_source_reference_type,
        source_reference_id = v_allocation.previous_source_reference_id,
        revision = revision + 1,
        updated_by = p_actor_id,
        updated_at = clock_timestamp()
    where id = v_cost.id;
  end if;

  insert into public.audit_logs (
    id, actor_id, actor_name, store_id, action, entity_type, entity_id, metadata
  ) values (
    gen_random_uuid()::text, p_actor_id, 'staff', p_store_id, 'released',
    'order_part_allocation', v_allocation.id::text,
    jsonb_build_object('order_id', v_allocation.order_id, 'line_id', v_allocation.line_id,
      'lot_id', v_allocation.lot_id, 'quantity', v_allocation.quantity,
      'reason_code', 'manual_release')
  );
  return jsonb_build_object('ok', true, 'code', 'released', 'id', v_allocation.id);
end;
$$;

create or replace function public.repairdesk_read_profit_breakdowns_rpc(
  p_store_id uuid,
  p_actor_id uuid,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_timezone text;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_result jsonb;
begin
  if not public.repairdesk_actor_has_phase2_cost_permission(
    p_store_id, p_actor_id, 'finance:profit_read'
  ) then return jsonb_build_object('ok', false, 'code', 'actor_forbidden'); end if;
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date
     or p_end_date - p_start_date > 366 then
    return jsonb_build_object('ok', false, 'code', 'invalid_date_range');
  end if;
  select coalesce(nullif(btrim(store_row.timezone), ''), 'Europe/Rome') into v_timezone
  from public.stores as store_row where store_row.id = p_store_id and store_row.status::text = 'active';
  if v_timezone is null then return jsonb_build_object('ok', false, 'code', 'store_not_found'); end if;
  v_start_at := p_start_date::timestamp at time zone v_timezone;
  v_end_at := (p_end_date + 1)::timestamp at time zone v_timezone;

  with line_facts as (
    select
      order_row.id as order_id,
      line.value ->> 'line_id' as line_id,
      coalesce(nullif(split_part(line.value ->> 'catalog_key', ':', 1), ''), 'other') as category_key,
      case
        when allocation.supplier_id is null then 'unlinked'
        else allocation.supplier_id::text
      end as supplier_key,
      coalesce(allocation.supplier_name_snapshot, '未关联供应商') as supplier_name,
      coalesce((line.value ->> 'price')::numeric, 0)::numeric(14, 2) as quote_amount,
      cost_row.cost_amount::numeric(14, 2) as cost_amount
    from public.repair_orders as order_row
    cross join lateral jsonb_array_elements(order_row.fault_prices) as line(value)
    left join public.repair_order_line_costs as cost_row
      on cost_row.store_id = order_row.store_id
     and cost_row.order_id = order_row.id
     and cost_row.line_id::text = line.value ->> 'line_id'
     and cost_row.is_active
    left join public.order_part_allocations as allocation
      on allocation.store_id = order_row.store_id
     and allocation.order_id = order_row.id
     and allocation.line_id::text = line.value ->> 'line_id'
     and allocation.state = 'allocated'
    where order_row.store_id = p_store_id
      and order_row.record_state::text = 'active'
      and order_row.deleted_at is null
      and order_row.status::text <> 'cancelled'
      and coalesce(order_row.exception_status::text, '') <> 'cancelled'
      and order_row.payment_status::text <> 'refunded'
      and order_row.created_at >= v_start_at and order_row.created_at < v_end_at
  ), category_rows as (
    select category_key as key, initcap(replace(category_key, '_', ' ')) as label,
      count(distinct order_id)::integer as order_count,
      count(*)::integer as line_count,
      sum(quote_amount)::numeric(14, 2) as quote_amount,
      coalesce(sum(cost_amount), 0)::numeric(14, 2) as known_cost_amount,
      coalesce(sum(quote_amount - cost_amount) filter (where cost_amount is not null), 0)::numeric(14, 2) as exact_margin_amount,
      count(*) filter (where cost_amount is not null)::integer as exact_line_count,
      count(*) filter (where cost_amount is null)::integer as incomplete_line_count
    from line_facts group by category_key
  ), supplier_rows as (
    select supplier_key as key, supplier_name as label,
      count(distinct order_id)::integer as order_count,
      count(*)::integer as line_count,
      sum(quote_amount)::numeric(14, 2) as quote_amount,
      coalesce(sum(cost_amount), 0)::numeric(14, 2) as known_cost_amount,
      coalesce(sum(quote_amount - cost_amount) filter (where cost_amount is not null), 0)::numeric(14, 2) as exact_margin_amount,
      count(*) filter (where cost_amount is not null)::integer as exact_line_count,
      count(*) filter (where cost_amount is null)::integer as incomplete_line_count
    from line_facts group by supplier_key, supplier_name
  )
  select jsonb_build_object(
    'ok', true, 'code', 'read',
    'categories', coalesce((select jsonb_agg(to_jsonb(category_rows) order by quote_amount desc, key) from category_rows), '[]'::jsonb),
    'suppliers', coalesce((select jsonb_agg(to_jsonb(supplier_rows) order by quote_amount desc, key) from supplier_rows), '[]'::jsonb)
  ) into v_result;
  return v_result;
exception when invalid_parameter_value then
  return jsonb_build_object('ok', false, 'code', 'invalid_store_timezone');
end;
$$;

revoke all on function public.repairdesk_read_parts_procurement_rpc(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.repairdesk_create_part_catalog_item_rpc(uuid, uuid, text, text, text, jsonb, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.repairdesk_receive_part_lot_rpc(uuid, uuid, uuid, uuid, text, text, integer, numeric, text, numeric, timestamptz, text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.repairdesk_allocate_order_part_rpc(uuid, uuid, uuid, uuid, uuid, integer, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.repairdesk_release_order_part_rpc(uuid, uuid, uuid, text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.repairdesk_read_profit_breakdowns_rpc(uuid, uuid, date, date)
  from public, anon, authenticated, service_role;

grant execute on function public.repairdesk_read_parts_procurement_rpc(uuid, uuid, uuid) to service_role;
grant execute on function public.repairdesk_create_part_catalog_item_rpc(uuid, uuid, text, text, text, jsonb, uuid) to service_role;
grant execute on function public.repairdesk_receive_part_lot_rpc(uuid, uuid, uuid, uuid, text, text, integer, numeric, text, numeric, timestamptz, text, uuid) to service_role;
grant execute on function public.repairdesk_allocate_order_part_rpc(uuid, uuid, uuid, uuid, uuid, integer, uuid) to service_role;
grant execute on function public.repairdesk_release_order_part_rpc(uuid, uuid, uuid, text, uuid) to service_role;
grant execute on function public.repairdesk_read_profit_breakdowns_rpc(uuid, uuid, date, date) to service_role;

reset statement_timeout;
reset lock_timeout;
notify pgrst, 'reload schema';
