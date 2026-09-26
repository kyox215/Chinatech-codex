-- Independent, order-scoped purchasing. These rows never create inventory,
-- stock movements, purchase lots, or repair-line cost allocations.
set lock_timeout = '5s';
set statement_timeout = '60s';

create table public.order_part_purchases (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  order_id uuid not null,
  line_id uuid,
  part_name text not null,
  supplier_id uuid,
  unit_cost_eur numeric(12, 2),
  quantity integer not null,
  status text not null default 'needed',
  revision bigint not null default 1,
  created_by uuid,
  updated_by uuid,
  ordered_by uuid,
  arrived_by uuid,
  ordered_at timestamptz,
  arrived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_part_purchases_id_store_unique unique (id, store_id),
  constraint order_part_purchases_store_fkey foreign key (store_id)
    references public.stores(id) on update cascade on delete cascade,
  constraint order_part_purchases_order_store_fkey foreign key (order_id, store_id)
    references public.repair_orders(id, store_id) on update cascade on delete cascade,
  constraint order_part_purchases_supplier_store_fkey foreign key (supplier_id, store_id)
    references public.suppliers(id, store_id) on update cascade on delete restrict,
  constraint order_part_purchases_created_by_fkey foreign key (created_by)
    references auth.users(id) on update cascade on delete set null,
  constraint order_part_purchases_updated_by_fkey foreign key (updated_by)
    references auth.users(id) on update cascade on delete set null,
  constraint order_part_purchases_ordered_by_fkey foreign key (ordered_by)
    references auth.users(id) on update cascade on delete set null,
  constraint order_part_purchases_arrived_by_fkey foreign key (arrived_by)
    references auth.users(id) on update cascade on delete set null,
  constraint order_part_purchases_name_check
    check (char_length(btrim(part_name)) between 1 and 160),
  constraint order_part_purchases_quantity_check check (quantity between 1 and 100000),
  constraint order_part_purchases_cost_check check (
    unit_cost_eur is null or (
      unit_cost_eur between 0 and 999999.99 and unit_cost_eur = round(unit_cost_eur, 2)
    )
  ),
  constraint order_part_purchases_status_check check (status in ('needed', 'ordered', 'arrived')),
  constraint order_part_purchases_revision_check check (revision >= 1),
  constraint order_part_purchases_lifecycle_check check (
    (status = 'needed' and ordered_at is null and ordered_by is null and arrived_at is null and arrived_by is null)
    or (status = 'ordered' and supplier_id is not null and unit_cost_eur is not null
      and ordered_at is not null and ordered_by is not null and arrived_at is null and arrived_by is null)
    or (status = 'arrived' and supplier_id is not null and unit_cost_eur is not null
      and ordered_at is not null and ordered_by is not null and arrived_at is not null and arrived_by is not null)
  )
);

create table public.order_part_purchase_revisions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  purchase_id uuid not null,
  order_id uuid not null,
  revision bigint not null,
  line_id uuid,
  part_name text not null,
  supplier_id uuid,
  unit_cost_eur numeric(12, 2),
  quantity integer not null,
  status text not null,
  changed_by uuid,
  change_kind text not null,
  created_at timestamptz not null default now(),
  constraint order_part_purchase_revisions_purchase_revision_unique
    unique (purchase_id, revision),
  constraint order_part_purchase_revisions_store_fkey foreign key (store_id)
    references public.stores(id) on update cascade on delete cascade,
  constraint order_part_purchase_revisions_purchase_store_fkey foreign key (purchase_id, store_id)
    references public.order_part_purchases(id, store_id) on update cascade on delete cascade,
  constraint order_part_purchase_revisions_order_store_fkey foreign key (order_id, store_id)
    references public.repair_orders(id, store_id) on update cascade on delete cascade,
  constraint order_part_purchase_revisions_changed_by_fkey foreign key (changed_by)
    references auth.users(id) on update cascade on delete set null,
  constraint order_part_purchase_revisions_change_kind_check
    check (change_kind in ('created', 'saved', 'supplier_assigned', 'ordered', 'arrived'))
);

create table public.order_part_purchase_operations (
  store_id uuid not null,
  idempotency_key uuid not null,
  actor_id uuid not null,
  request_hash char(64) not null,
  operation text not null,
  requires_supplier_assign boolean not null default false,
  response jsonb not null,
  created_at timestamptz not null default now(),
  constraint order_part_purchase_operations_pkey primary key (store_id, idempotency_key),
  constraint order_part_purchase_operations_store_fkey foreign key (store_id)
    references public.stores(id) on update cascade on delete cascade,
  constraint order_part_purchase_operations_actor_fkey foreign key (actor_id)
    references auth.users(id) on update cascade on delete restrict,
  constraint order_part_purchase_operations_operation_check
    check (operation in ('save', 'assign_supplier', 'mark_ordered', 'mark_arrived')),
  constraint order_part_purchase_operations_response_check check (jsonb_typeof(response) = 'object')
);

create index order_part_purchases_order_idx
  on public.order_part_purchases(store_id, order_id, status, updated_at desc, id);
create index order_part_purchases_supplier_idx
  on public.order_part_purchases(store_id, supplier_id, status) where supplier_id is not null;
create index order_part_purchase_revisions_order_idx
  on public.order_part_purchase_revisions(store_id, order_id, created_at desc);

alter table public.order_part_purchases enable row level security;
alter table public.order_part_purchase_revisions enable row level security;
alter table public.order_part_purchase_operations enable row level security;
revoke all on table public.order_part_purchases from public, anon, authenticated, service_role;
revoke all on table public.order_part_purchase_revisions from public, anon, authenticated, service_role;
revoke all on table public.order_part_purchase_operations from public, anon, authenticated, service_role;

create trigger order_part_purchases_store_lifecycle_fence
before insert or update or delete on public.order_part_purchases
for each row execute function public.repairdesk_enforce_active_store_write();
create trigger order_part_purchase_revisions_store_lifecycle_fence
before insert or update or delete on public.order_part_purchase_revisions
for each row execute function public.repairdesk_enforce_active_store_write();
create trigger order_part_purchase_operations_store_lifecycle_fence
before insert or update or delete on public.order_part_purchase_operations
for each row execute function public.repairdesk_enforce_active_store_write();

create or replace function public.repairdesk_actor_has_supplier_permission(
  p_store_id uuid,
  p_actor_id uuid,
  p_mode text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_profiles profile
    join public.store_memberships membership
      on membership.user_id = profile.id
     and membership.store_id = p_store_id
     and membership.status::text = 'active'
    join public.stores store_row on store_row.id = p_store_id and store_row.status::text = 'active'
    where profile.id = p_actor_id
      and profile.status::text = 'active'
      and (
        membership.role::text = 'owner'
        or exists (
          select 1 from public.store_member_permission_grants grant_row
          where grant_row.store_id = p_store_id
            and grant_row.membership_id = membership.id
            and grant_row.user_id = p_actor_id
            and grant_row.revoked_at is null
            and (
              (p_mode = 'read' and grant_row.action in ('supplier:read', 'supplier:assign', 'supplier:manage'))
              or (p_mode = 'assign' and grant_row.action in ('supplier:assign', 'supplier:manage'))
            )
        )
      )
  );
$$;
revoke all on function public.repairdesk_actor_has_supplier_permission(uuid, uuid, text)
  from public, anon, authenticated, service_role;

create or replace function public.repairdesk_refresh_order_purchase_status(
  p_store_id uuid,
  p_order_id uuid,
  p_now timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  select case
    when bool_or(purchase.status = 'needed') then 'needed'
    when bool_or(purchase.status = 'ordered') then 'ordered'
    else 'arrived'
  end into v_status
  from public.order_part_purchases purchase
  where purchase.store_id = p_store_id and purchase.order_id = p_order_id;

  if v_status is not null then
    update public.repair_orders
    set parts_status = v_status, updated_at = p_now
    where id = p_order_id and store_id = p_store_id;
  end if;
end;
$$;
revoke all on function public.repairdesk_refresh_order_purchase_status(uuid, uuid, timestamptz)
  from public, anon, authenticated, service_role;

create or replace function public.repairdesk_read_order_purchasing(
  p_store_id uuid,
  p_actor_id uuid,
  p_order_ids uuid[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_groups jsonb;
  v_suppliers jsonb;
begin
  if p_store_id is null or p_actor_id is null or p_order_ids is null
     or cardinality(p_order_ids) < 1 or cardinality(p_order_ids) > 50
     or cardinality(p_order_ids) <> (select count(distinct value) from unnest(p_order_ids) value) then
    return jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;
  if not public.repairdesk_actor_can_manage_order_costs(p_store_id, p_actor_id)
     or not public.repairdesk_actor_has_supplier_permission(p_store_id, p_actor_id, 'read') then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;
  if (select count(*) from public.repair_orders o where o.store_id = p_store_id and o.id = any(p_order_ids))
     <> cardinality(p_order_ids) then
    return jsonb_build_object('ok', false, 'code', 'order_not_found');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'order_id', requested.order_id,
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', purchase.id, 'order_id', purchase.order_id, 'line_id', purchase.line_id,
        'part_name', purchase.part_name, 'supplier_id', purchase.supplier_id,
        'supplier_name', supplier.name,
        'unit_cost_eur', case when purchase.unit_cost_eur is null then null
          else to_char(purchase.unit_cost_eur, 'FM999999990.00') end,
        'quantity', purchase.quantity, 'status', purchase.status, 'revision', purchase.revision,
        'ordered_at', purchase.ordered_at, 'arrived_at', purchase.arrived_at,
        'updated_at', purchase.updated_at
      ) order by purchase.created_at, purchase.id)
      from public.order_part_purchases purchase
      left join public.suppliers supplier
        on supplier.id = purchase.supplier_id and supplier.store_id = purchase.store_id
      where purchase.store_id = p_store_id and purchase.order_id = requested.order_id
    ), '[]'::jsonb)
  ) order by requested.ordinality), '[]'::jsonb)
  into v_groups
  from unnest(p_order_ids) with ordinality requested(order_id, ordinality);

  select coalesce(jsonb_agg(jsonb_build_object('id', supplier.id, 'name', supplier.name)
    order by lower(supplier.name), supplier.id), '[]'::jsonb)
  into v_suppliers
  from public.suppliers supplier
  where supplier.store_id = p_store_id and supplier.archived_at is null;

  return jsonb_build_object(
    'ok', true, 'groups', v_groups, 'suppliers', v_suppliers,
    'permissions', jsonb_build_object(
      'canManage', true,
      'canAssignSupplier', public.repairdesk_actor_has_supplier_permission(p_store_id, p_actor_id, 'assign')
    )
  );
end;
$$;

create or replace function public.repairdesk_save_order_purchase(
  p_store_id uuid,
  p_actor_id uuid,
  p_purchase_id uuid,
  p_order_id uuid,
  p_line_id uuid,
  p_part_name text,
  p_supplier_id uuid,
  p_unit_cost_eur text,
  p_quantity integer,
  p_status text,
  p_expected_revision bigint,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_hash char(64);
  v_receipt public.order_part_purchase_operations%rowtype;
  v_existing public.order_part_purchases%rowtype;
  v_saved public.order_part_purchases%rowtype;
  v_id uuid;
  v_cost numeric(12,2);
  v_response jsonb;
  v_supplier_name text;
  v_requires_supplier_assign boolean := false;
begin
  if p_store_id is null or p_actor_id is null or p_order_id is null or p_idempotency_key is null
     or char_length(btrim(coalesce(p_part_name, ''))) not between 1 and 160
     or p_quantity not between 1 and 100000 or p_status not in ('needed', 'ordered')
     or p_expected_revision < 0
     or (p_purchase_id is null and p_expected_revision <> 0)
     or (p_purchase_id is not null and p_expected_revision < 1)
     or (p_unit_cost_eur is not null and p_unit_cost_eur !~ '^(0|[1-9][0-9]{0,5})(\.[0-9]{1,2})?$') then
    return jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;
  if not public.repairdesk_actor_can_manage_order_costs(p_store_id, p_actor_id) then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;
  if p_supplier_id is not null
     and not public.repairdesk_actor_has_supplier_permission(p_store_id, p_actor_id, 'read') then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;

  v_hash := encode(extensions.digest(pg_catalog.convert_to(jsonb_build_object(
    'purchase_id', p_purchase_id, 'order_id', p_order_id, 'line_id', p_line_id,
    'part_name', btrim(coalesce(p_part_name, '')), 'supplier_id', p_supplier_id,
    'unit_cost_eur', p_unit_cost_eur, 'quantity', p_quantity, 'status', p_status,
    'expected_revision', p_expected_revision
  )::text, 'UTF8'), 'sha256'), 'hex');

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_store_id::text || ':' || p_idempotency_key::text, 0)
  );

  select * into v_receipt from public.order_part_purchase_operations operation
  where operation.store_id = p_store_id and operation.idempotency_key = p_idempotency_key
  for update;
  if found then
    if v_receipt.actor_id <> p_actor_id or v_receipt.request_hash <> v_hash or v_receipt.operation <> 'save' then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    if v_receipt.requires_supplier_assign
       and not public.repairdesk_actor_has_supplier_permission(p_store_id, p_actor_id, 'assign') then
      return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
    end if;
    return v_receipt.response || jsonb_build_object('replayed', true);
  end if;
  perform 1 from public.repair_orders o
  where o.store_id = p_store_id and o.id = p_order_id and o.voided_at is null for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'order_not_found'); end if;
  if p_line_id is not null and not exists (
    select 1 from public.repair_orders o, jsonb_array_elements(o.fault_prices) item
    where o.store_id = p_store_id and o.id = p_order_id and item->>'line_id' = p_line_id::text
  ) then
    return jsonb_build_object('ok', false, 'code', 'line_not_found');
  end if;
  if p_supplier_id is not null and not exists (
    select 1 from public.suppliers s where s.store_id = p_store_id
      and s.id = p_supplier_id and s.archived_at is null
  ) then
    return jsonb_build_object('ok', false, 'code', 'supplier_not_found');
  end if;
  if p_status = 'ordered' and (p_supplier_id is null or p_unit_cost_eur is null) then
    return jsonb_build_object('ok', false, 'code', 'incomplete_order');
  end if;
  v_cost := p_unit_cost_eur::numeric;

  if p_purchase_id is null then
    v_requires_supplier_assign := p_supplier_id is not null;
    if v_requires_supplier_assign
       and not public.repairdesk_actor_has_supplier_permission(p_store_id, p_actor_id, 'assign') then
      return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
    end if;
    v_id := gen_random_uuid();
    insert into public.order_part_purchases(
      id, store_id, order_id, line_id, part_name, supplier_id, unit_cost_eur, quantity, status,
      revision, created_by, updated_by, ordered_by, ordered_at, created_at, updated_at
    ) values (
      v_id, p_store_id, p_order_id, p_line_id, btrim(p_part_name), p_supplier_id, v_cost,
      p_quantity, p_status, 1, p_actor_id, p_actor_id,
      case when p_status = 'ordered' then p_actor_id end,
      case when p_status = 'ordered' then v_now end, v_now, v_now
    ) returning * into v_saved;
  else
    select * into v_existing from public.order_part_purchases purchase
    where purchase.store_id = p_store_id and purchase.id = p_purchase_id for update;
    if not found or v_existing.order_id <> p_order_id then
      return jsonb_build_object('ok', false, 'code', 'purchase_not_found');
    end if;
    if v_existing.revision <> p_expected_revision then
      return jsonb_build_object('ok', false, 'code', 'stale_revision', 'revision', v_existing.revision);
    end if;
    if v_existing.status = 'arrived' or (v_existing.status = 'ordered' and p_status <> 'ordered') then
      return jsonb_build_object('ok', false, 'code', 'invalid_transition');
    end if;
    v_requires_supplier_assign := v_existing.supplier_id is distinct from p_supplier_id;
    if v_requires_supplier_assign
       and not public.repairdesk_actor_has_supplier_permission(p_store_id, p_actor_id, 'assign') then
      return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
    end if;
    update public.order_part_purchases set
      line_id = p_line_id, part_name = btrim(p_part_name), supplier_id = p_supplier_id,
      unit_cost_eur = v_cost, quantity = p_quantity, status = p_status,
      revision = revision + 1, updated_by = p_actor_id, updated_at = v_now,
      ordered_by = case when status = 'needed' and p_status = 'ordered' then p_actor_id else ordered_by end,
      ordered_at = case when status = 'needed' and p_status = 'ordered' then v_now else ordered_at end
    where id = p_purchase_id and store_id = p_store_id and revision = p_expected_revision
    returning * into v_saved;
  end if;

  insert into public.order_part_purchase_revisions(
    store_id, purchase_id, order_id, revision, line_id, part_name, supplier_id,
    unit_cost_eur, quantity, status, changed_by, change_kind, created_at
  ) values (
    p_store_id, v_saved.id, v_saved.order_id, v_saved.revision, v_saved.line_id,
    v_saved.part_name, v_saved.supplier_id, v_saved.unit_cost_eur, v_saved.quantity,
    v_saved.status, p_actor_id,
    case when v_saved.revision = 1 then 'created'
      when v_existing.status = 'needed' and v_saved.status = 'ordered' then 'ordered' else 'saved' end,
    v_now
  );
  perform public.repairdesk_refresh_order_purchase_status(p_store_id, p_order_id, v_now);
  select s.name into v_supplier_name from public.suppliers s
    where s.store_id = p_store_id and s.id = v_saved.supplier_id;
  v_response := jsonb_build_object('ok', true, 'replayed', false, 'line', jsonb_build_object(
    'id', v_saved.id, 'order_id', v_saved.order_id, 'line_id', v_saved.line_id,
    'part_name', v_saved.part_name, 'supplier_id', v_saved.supplier_id,
    'supplier_name', v_supplier_name,
    'unit_cost_eur', case when v_saved.unit_cost_eur is null then null
      else to_char(v_saved.unit_cost_eur, 'FM999999990.00') end,
    'quantity', v_saved.quantity, 'status', v_saved.status, 'revision', v_saved.revision,
    'ordered_at', v_saved.ordered_at, 'arrived_at', v_saved.arrived_at, 'updated_at', v_saved.updated_at
  ));
  insert into public.audit_logs (
    id, actor_id, actor_name, store_id, action, entity_type, entity_id, metadata
  ) values (
    gen_random_uuid()::text, p_actor_id, 'staff', p_store_id, 'save',
    'order_part_purchase', v_saved.id::text,
    jsonb_build_object(
      'order_id', v_saved.order_id,
      'status', v_saved.status,
      'revision', v_saved.revision
    )
  );
  insert into public.order_part_purchase_operations(
    store_id, idempotency_key, actor_id, request_hash, operation,
    requires_supplier_assign, response
  ) values (
    p_store_id, p_idempotency_key, p_actor_id, v_hash, 'save',
    v_requires_supplier_assign, v_response
  );
  return v_response;
end;
$$;

create or replace function public.repairdesk_batch_order_purchases(
  p_store_id uuid,
  p_actor_id uuid,
  p_operation text,
  p_items jsonb,
  p_supplier_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_hash char(64);
  v_receipt public.order_part_purchase_operations%rowtype;
  v_item jsonb;
  v_id uuid;
  v_expected bigint;
  v_row public.order_part_purchases%rowtype;
  v_saved public.order_part_purchases%rowtype;
  v_results jsonb := '[]'::jsonb;
  v_orders uuid[] := array[]::uuid[];
  v_order_id uuid;
  v_code text;
  v_response jsonb;
begin
  if p_store_id is null or p_actor_id is null or p_idempotency_key is null
     or p_operation not in ('assign_supplier', 'mark_ordered', 'mark_arrived')
     or jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) not between 1 and 50
     or (p_operation = 'assign_supplier') is distinct from (p_supplier_id is not null)
     or exists (select 1 from jsonb_array_elements(p_items) item
       where jsonb_typeof(item) <> 'object'
         or coalesce(item->>'id', '') !~ '^[0-9a-fA-F-]{36}$'
         or coalesce(item->>'expected_revision', '') !~ '^[1-9][0-9]*$')
     or (select count(*) from jsonb_array_elements(p_items)) <>
        (select count(distinct item->>'id') from jsonb_array_elements(p_items) item) then
    return jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;
  if not public.repairdesk_actor_can_manage_order_costs(p_store_id, p_actor_id)
     or (p_operation = 'assign_supplier'
       and not public.repairdesk_actor_has_supplier_permission(p_store_id, p_actor_id, 'assign')) then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;
  v_hash := encode(extensions.digest(pg_catalog.convert_to(jsonb_build_object(
    'operation', p_operation, 'items', p_items, 'supplier_id', p_supplier_id
  )::text, 'UTF8'), 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_store_id::text || ':' || p_idempotency_key::text, 0)
  );
  select * into v_receipt from public.order_part_purchase_operations operation
  where operation.store_id = p_store_id and operation.idempotency_key = p_idempotency_key
  for update;
  if found then
    if v_receipt.actor_id <> p_actor_id or v_receipt.request_hash <> v_hash
       or v_receipt.operation <> p_operation then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return v_receipt.response || jsonb_build_object('replayed', true);
  end if;
  if p_supplier_id is not null and not exists (
    select 1 from public.suppliers s where s.store_id = p_store_id
      and s.id = p_supplier_id and s.archived_at is null
  ) then
    return jsonb_build_object('ok', false, 'code', 'supplier_not_found');
  end if;

  -- All purchase mutations use the same parent-order -> purchase-row lock order.
  -- Sorting parent ids prevents multi-order batches from choosing opposite orders.
  perform 1
  from public.repair_orders order_row
  where order_row.store_id = p_store_id
    and order_row.id in (
      select distinct purchase.order_id
      from public.order_part_purchases purchase
      where purchase.store_id = p_store_id
        and purchase.id in (
          select (item ->> 'id')::uuid from jsonb_array_elements(p_items) item
        )
    )
  order by order_row.id
  for update of order_row;

  for v_item in select value from jsonb_array_elements(p_items) order by value->>'id' loop
    v_id := (v_item->>'id')::uuid;
    v_expected := (v_item->>'expected_revision')::bigint;
    v_code := null;
    select * into v_row from public.order_part_purchases purchase
      where purchase.store_id = p_store_id and purchase.id = v_id for update;
    if not found then v_code := 'purchase_not_found';
    elsif v_row.revision <> v_expected then v_code := 'stale_revision';
    elsif exists (select 1 from public.repair_orders o where o.id = v_row.order_id
      and o.store_id = p_store_id and o.voided_at is not null) then v_code := 'order_voided';
    elsif p_operation = 'assign_supplier' and v_row.status <> 'needed' then v_code := 'invalid_transition';
    elsif p_operation = 'mark_ordered' and v_row.status <> 'needed' then v_code := 'invalid_transition';
    elsif p_operation = 'mark_ordered'
      and (v_row.supplier_id is null or v_row.unit_cost_eur is null) then v_code := 'incomplete_order';
    elsif p_operation = 'mark_arrived' and v_row.status <> 'ordered' then v_code := 'invalid_transition';
    end if;

    if v_code is not null then
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'id', v_id, 'ok', false, 'code', v_code,
        'revision', case when v_row.id is null then null else v_row.revision end
      ));
      continue;
    end if;
    update public.order_part_purchases set
      supplier_id = case when p_operation = 'assign_supplier' then p_supplier_id else supplier_id end,
      status = case when p_operation = 'mark_ordered' then 'ordered'
                    when p_operation = 'mark_arrived' then 'arrived' else status end,
      revision = revision + 1, updated_by = p_actor_id, updated_at = v_now,
      ordered_by = case when p_operation = 'mark_ordered' then p_actor_id else ordered_by end,
      ordered_at = case when p_operation = 'mark_ordered' then v_now else ordered_at end,
      arrived_by = case when p_operation = 'mark_arrived' then p_actor_id else arrived_by end,
      arrived_at = case when p_operation = 'mark_arrived' then v_now else arrived_at end
    where id = v_id and store_id = p_store_id and revision = v_expected
    returning * into v_saved;
    insert into public.order_part_purchase_revisions(
      store_id, purchase_id, order_id, revision, line_id, part_name, supplier_id,
      unit_cost_eur, quantity, status, changed_by, change_kind, created_at
    ) values (
      p_store_id, v_saved.id, v_saved.order_id, v_saved.revision, v_saved.line_id,
      v_saved.part_name, v_saved.supplier_id, v_saved.unit_cost_eur, v_saved.quantity,
      v_saved.status, p_actor_id,
      case p_operation when 'assign_supplier' then 'supplier_assigned'
        when 'mark_ordered' then 'ordered' else 'arrived' end, v_now
    );
    if not v_saved.order_id = any(v_orders) then v_orders := array_append(v_orders, v_saved.order_id); end if;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'id', v_id, 'ok', true, 'revision', v_saved.revision
    ));
  end loop;
  foreach v_order_id in array v_orders loop
    perform public.repairdesk_refresh_order_purchase_status(p_store_id, v_order_id, v_now);
  end loop;
  v_response := jsonb_build_object('ok', true, 'replayed', false, 'results', v_results);
  insert into public.audit_logs (
    id, actor_id, actor_name, store_id, action, entity_type, entity_id, metadata
  ) values (
    gen_random_uuid()::text, p_actor_id, 'staff', p_store_id, p_operation,
    'order_part_purchase_batch', p_idempotency_key::text,
    jsonb_build_object(
      'item_count', jsonb_array_length(v_results),
      'success_count', (
        select count(*) from jsonb_array_elements(v_results) result where result ->> 'ok' = 'true'
      ),
      'failure_count', (
        select count(*) from jsonb_array_elements(v_results) result where result ->> 'ok' <> 'true'
      )
    )
  );
  insert into public.order_part_purchase_operations(
    store_id, idempotency_key, actor_id, request_hash, operation,
    requires_supplier_assign, response
  ) values (
    p_store_id, p_idempotency_key, p_actor_id, v_hash, p_operation,
    p_operation = 'assign_supplier', v_response
  );
  return v_response;
end;
$$;

revoke all on function public.repairdesk_read_order_purchasing(uuid, uuid, uuid[])
  from public, anon, authenticated, service_role;
revoke all on function public.repairdesk_save_order_purchase(
  uuid, uuid, uuid, uuid, uuid, text, uuid, text, integer, text, bigint, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.repairdesk_batch_order_purchases(uuid, uuid, text, jsonb, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.repairdesk_read_order_purchasing(uuid, uuid, uuid[]) to service_role;
grant execute on function public.repairdesk_save_order_purchase(
  uuid, uuid, uuid, uuid, uuid, text, uuid, text, integer, text, bigint, uuid
) to service_role;
grant execute on function public.repairdesk_batch_order_purchases(uuid, uuid, text, jsonb, uuid, uuid)
  to service_role;

comment on table public.order_part_purchases is
  'Order-only purchasing lines. No inventory receipt, stock movement, or cost allocation semantics.';
