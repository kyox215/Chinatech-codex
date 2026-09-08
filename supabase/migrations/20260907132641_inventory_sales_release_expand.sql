-- Product sales release: new, isolated sales transaction aggregate. Expand is dormant.
-- No historical lifecycle SQL is used. No data backfill and no old RPC replacement.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.store_settings
  add column inventory_sales_print_language text not null default 'it'
  constraint store_settings_inventory_sales_print_language_check check (inventory_sales_print_language in ('it','en','zh'));

-- A sale must point to the same store AND the exact physical item's unit.
create unique index inventory_sales_unit_item_store_uidx
  on public.inventory_stock_units(id, legacy_inventory_item_id, store_id);

create table public.inventory_sale_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  inventory_item_id uuid not null,
  stock_unit_id uuid not null,
  customer_id uuid not null,
  sale_number text not null,
  price_cents bigint not null check (price_cents between 1 and 10000000000),
  paid_cents bigint not null check (paid_cents between 0 and price_cents),
  status text not null check (status in ('awaiting_payment','paid_pending_pickup','delivered')),
  version bigint not null default 1 check (version >= 1),
  agreed_at timestamptz not null check (isfinite(agreed_at)),
  delivered_at timestamptz check (isfinite(delivered_at)),
  warranty_months integer not null check (warranty_months in (12,24)),
  used_device boolean not null,
  shortening_agreed boolean not null default false,
  shortening_agreed_at timestamptz check (isfinite(shortening_agreed_at)),
  terms_version text not null check (terms_version = 'inventory-sales-2026-09-v1'),
  customer_snapshot jsonb not null check (jsonb_typeof(customer_snapshot) = 'object'),
  product_snapshot jsonb not null check (jsonb_typeof(product_snapshot) = 'object'),
  store_snapshot jsonb not null check (jsonb_typeof(store_snapshot) = 'object'),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (id, store_id),
  unique (store_id, inventory_item_id),
  unique (store_id, stock_unit_id),
  unique (store_id, sale_number),
  foreign key (stock_unit_id, inventory_item_id, store_id)
    references public.inventory_stock_units(id, legacy_inventory_item_id, store_id),
  foreign key (inventory_item_id, store_id) references public.inventory_items(id,store_id),
  foreign key (customer_id, store_id) references public.customers(id,store_id),
  check ((status = 'awaiting_payment' and paid_cents < price_cents and delivered_at is null)
    or (status = 'paid_pending_pickup' and paid_cents = price_cents and delivered_at is null)
    or (status = 'delivered' and paid_cents = price_cents and delivered_at >= agreed_at)),
  constraint inventory_sales_delivered_timestamp_required check (status <> 'delivered' or delivered_at is not null),
  check (warranty_months = 24 or (used_device and shortening_agreed and shortening_agreed_at is not null)),
  check (shortening_agreed_at is null or shortening_agreed_at <= agreed_at)
);
create index inventory_sales_store_updated_idx on public.inventory_sale_orders(store_id, updated_at desc, id);

create table public.inventory_sale_payment_entries (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  sale_order_id uuid not null,
  sequence integer not null check (sequence > 0),
  receipt_number text not null,
  amount_cents bigint not null check (amount_cents between 1 and 10000000000),
  paid_after_cents bigint not null check (paid_after_cents between amount_cents and 10000000000),
  balance_after_cents bigint not null check (balance_after_cents between 0 and 10000000000),
  method text not null check (method in ('cash','card','bancomat','transfer','other')),
  occurred_at timestamptz not null check (isfinite(occurred_at)),
  note text check (char_length(note) <= 500),
  actor_id uuid not null references auth.users(id),
  transaction_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  unique (id,store_id), unique (store_id,sale_order_id,sequence), unique (store_id,receipt_number),
  unique (store_id,transaction_id),
  foreign key (sale_order_id,store_id) references public.inventory_sale_orders(id,store_id),
  foreign key (transaction_id,store_id) references public.inventory_transactions(id,store_id) deferrable initially deferred
);
create table public.inventory_warranty_versions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  sale_order_id uuid not null,
  version integer not null default 1 check (version = 1),
  months integer not null check (months in (12,24)),
  starts_at timestamptz not null check (isfinite(starts_at)),
  starts_on date not null,
  ends_on date not null,
  timezone text not null default 'Europe/Rome' check (timezone = 'Europe/Rome'),
  terms_version text not null check (terms_version = 'inventory-sales-2026-09-v1'),
  used_device boolean not null,
  shortening_agreed boolean not null,
  shortening_agreed_at timestamptz,
  actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  unique (sale_order_id,store_id,version),
  foreign key (sale_order_id,store_id) references public.inventory_sale_orders(id,store_id),
  check (starts_on = (starts_at at time zone 'Europe/Rome')::date),
  check (ends_on = (starts_on + make_interval(months => months))::date),
  check (months = 24 or (used_device and shortening_agreed and shortening_agreed_at is not null))
);
create table public.inventory_sales_command_ledger (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  sale_order_id uuid not null,
  actor_id uuid not null references auth.users(id),
  idempotency_key uuid not null,
  command text not null check (command in ('sale.create','payment.append','pickup.confirm')),
  request_payload jsonb not null check (jsonb_typeof(request_payload) = 'object'),
  response jsonb not null check (jsonb_typeof(response) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  unique (store_id,idempotency_key),
  foreign key (sale_order_id,store_id) references public.inventory_sale_orders(id,store_id)
);

alter table public.inventory_sale_orders enable row level security;
alter table public.inventory_sale_payment_entries enable row level security;
alter table public.inventory_warranty_versions enable row level security;
alter table public.inventory_sales_command_ledger enable row level security;
-- Deliberately no browser policies or table ACL. Service BFF uses only bounded RPCs.
revoke all on public.inventory_sale_orders,public.inventory_sale_payment_entries,
  public.inventory_warranty_versions,public.inventory_sales_command_ledger from public,anon,authenticated,service_role;

create function private.inventory_sales_append_only() returns trigger language plpgsql set search_path = '' as $$
begin raise exception using errcode='23514', message='inventory_sales_append_only'; end;
$$;
revoke all on function private.inventory_sales_append_only() from public,anon,authenticated,service_role;
create trigger inventory_sales_payments_immutable before update or delete on public.inventory_sale_payment_entries
for each row execute function private.inventory_sales_append_only();
create trigger inventory_sales_warranty_immutable before update or delete on public.inventory_warranty_versions
for each row execute function private.inventory_sales_append_only();
create trigger inventory_sales_ledger_immutable before update or delete on public.inventory_sales_command_ledger
for each row execute function private.inventory_sales_append_only();

-- Surgical guards apply only to physical items already owned by this new aggregate.
-- They use transaction-visible persisted facts, never a client-settable bypass flag.
create function private.inventory_sales_occupancy_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_order public.inventory_sale_orders%rowtype; v_item_id uuid; v_store_id uuid;
begin
  if tg_table_name = 'inventory_items' then v_item_id := new.id; v_store_id := new.store_id;
  elsif tg_table_name = 'inventory_stock_units' then v_item_id := new.legacy_inventory_item_id; v_store_id := new.store_id;
  else v_item_id := case when tg_op='DELETE' then old.item_id else new.item_id end;
    v_store_id := case when tg_op='DELETE' then old.store_id else new.store_id end;
  end if;
  if tg_table_name='inventory_transactions' then
    -- Serializes a legacy direct payment with sale.create before testing ownership.
    perform 1 from public.inventory_items
      where (id=v_item_id and store_id=v_store_id)
        or (tg_op<>'INSERT' and id=old.item_id and store_id=old.store_id) order by id for update;
    if tg_op<>'INSERT' and exists(select 1 from public.inventory_sale_orders
      where inventory_item_id=old.item_id and store_id=old.store_id)
      then
      raise exception using errcode='23514',message='inventory_sales_payment_protected';
    end if;
  end if;
  select * into v_order from public.inventory_sale_orders where store_id=v_store_id and inventory_item_id=v_item_id;
  if not found then if tg_op='DELETE' then return old; else return new; end if; end if;
  if tg_table_name = 'inventory_transactions' then
    -- A new sales aggregate owns all subsequent money effects; no legacy refunds/adjustments.
    if tg_op <> 'INSERT' or new.transaction_type::text <> 'sale_payment' or not exists (
      select 1 from public.inventory_sale_payment_entries p
      where p.store_id=v_store_id and p.sale_order_id=v_order.id and p.transaction_id=new.id
        and p.amount_cents = new.amount*100 and p.method=new.method and p.actor_id=new.actor_id
        and p.occurred_at=new.created_at
    ) then raise exception using errcode='23514', message='inventory_sales_payment_protected'; end if;
  else
    if new.status::text <> (case when v_order.status='delivered' then 'sold' else 'reserved' end) then
      raise exception using errcode='23514',message='inventory_sales_occupancy_protected';
    end if;
    if tg_table_name = 'inventory_items' then
    if row(new.store_id,new.public_no,new.category,new.brand,new.model,new.color,new.storage_capacity,new.serial_or_imei,new.imei_check_status,new.activation_lock_status,new.data_wipe_status,new.functional_grade,new.cosmetic_grade,new.battery_health,new.legacy_payload,new.buyback_price,new.list_price)
      is distinct from row(old.store_id,old.public_no,old.category,old.brand,old.model,old.color,old.storage_capacity,old.serial_or_imei,old.imei_check_status,old.activation_lock_status,old.data_wipe_status,old.functional_grade,old.cosmetic_grade,old.battery_health,old.legacy_payload,old.buyback_price,old.list_price) then
      raise exception using errcode='23514',message='inventory_sales_device_facts_protected';
    end if;
    if (new.buyer_customer_id is distinct from v_order.customer_id
       or new.sale_price*100 is distinct from v_order.price_cents::numeric
       or new.deposit_amount*100 is distinct from v_order.paid_cents::numeric
       or new.sold_at is distinct from v_order.delivered_at) then
      raise exception using errcode='23514',message='inventory_sales_projection_protected';
    end if;
    elsif row(new.store_id,new.legacy_inventory_item_id,new.variant_id,new.cost_amount,new.list_price)
      is distinct from row(old.store_id,old.legacy_inventory_item_id,old.variant_id,old.cost_amount,old.list_price) then
      raise exception using errcode='23514',message='inventory_sales_device_facts_protected';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.inventory_sales_occupancy_guard() from public,anon,authenticated,service_role;
create trigger inventory_sales_item_occupancy before update on public.inventory_items
for each row execute function private.inventory_sales_occupancy_guard();
create trigger inventory_sales_unit_occupancy before update on public.inventory_stock_units
for each row execute function private.inventory_sales_occupancy_guard();
create trigger inventory_sales_transaction_occupancy before insert or update or delete on public.inventory_transactions
for each row execute function private.inventory_sales_occupancy_guard();

-- Freeze identifiers and shared variant facts once any linked physical unit is sold/held.
-- Lock parent items before ownership checks so concurrent sale.create sees one identity version.
create function private.inventory_sales_device_facts_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_unit_ids uuid[];
begin
  if tg_op='UPDATE' and to_jsonb(new) is not distinct from to_jsonb(old) then return new; end if;
  if tg_table_name='inventory_product_variants' then
    if tg_op='UPDATE' and (to_jsonb(new)-array['updated_at','updated_by']) is not distinct from
      (to_jsonb(old)-array['updated_at','updated_by']) then return new; end if;
    select array_agg(u.id) into v_unit_ids from public.inventory_stock_units u
      where (u.variant_id=old.id and u.store_id=old.store_id)
        or (tg_op='UPDATE' and u.variant_id=new.id and u.store_id=new.store_id);
  else
    v_unit_ids:=array[case when tg_op<>'DELETE' then new.stock_unit_id end,case when tg_op<>'INSERT' then old.stock_unit_id end];
  end if;
  perform 1 from public.inventory_items i join public.inventory_stock_units u on u.legacy_inventory_item_id=i.id and u.store_id=i.store_id
    where u.id=any(v_unit_ids) order by i.id for update of i;
  if exists(select 1 from public.inventory_sale_orders where stock_unit_id=any(v_unit_ids)) then
    raise exception using errcode='23514',message='inventory_sales_device_facts_protected';
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function private.inventory_sales_device_facts_guard() from public,anon,authenticated,service_role;
create trigger inventory_sales_identifier_facts before insert or update or delete on public.inventory_stock_unit_identifiers
for each row execute function private.inventory_sales_device_facts_guard();
create trigger inventory_sales_variant_facts before update or delete on public.inventory_product_variants
for each row execute function private.inventory_sales_device_facts_guard();

create function private.inventory_sales_movement_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_order public.inventory_sale_orders%rowtype; v_unit_id uuid; v_store_id uuid;
begin
  v_unit_id:=case when tg_op='DELETE' then old.stock_unit_id else new.stock_unit_id end;
  v_store_id:=case when tg_op='DELETE' then old.store_id else new.store_id end;
  perform 1 from public.inventory_items i join public.inventory_stock_units u on u.legacy_inventory_item_id=i.id and u.store_id=i.store_id
    where (u.id=v_unit_id and u.store_id=v_store_id)
      or (tg_op<>'INSERT' and u.id=old.stock_unit_id and u.store_id=old.store_id) order by i.id for update of i;
  if tg_op<>'INSERT' and exists(select 1 from public.inventory_sale_orders where store_id=old.store_id and stock_unit_id=old.stock_unit_id) then
    raise exception using errcode='23514',message='inventory_sales_movement_protected';
  end if;
  select * into v_order from public.inventory_sale_orders where store_id=v_store_id and stock_unit_id=v_unit_id;
  if not found then if tg_op='DELETE' then return old; else return new; end if; end if;
  if tg_op<>'INSERT' or v_order.status<>'delivered' or new.movement_type<>'sell' or new.quantity<>-1
    or new.source_kind is distinct from 'inventory_sales' or new.source_id is distinct from v_order.id::text
    or new.occurred_at is distinct from v_order.delivered_at or exists(select 1 from public.inventory_stock_movements m
      where m.store_id=v_store_id and m.stock_unit_id=v_unit_id and m.movement_type='sell') then
    raise exception using errcode='23514',message='inventory_sales_movement_protected';
  end if;
  return new;
end;
$$;
revoke all on function private.inventory_sales_movement_guard() from public,anon,authenticated,service_role;
create trigger inventory_sales_movement_occupancy before insert or update or delete on public.inventory_stock_movements
for each row execute function private.inventory_sales_movement_guard();

create function private.inventory_sales_order_immutable() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' or old.status='delivered' or
    (to_jsonb(new) - array['paid_cents','status','version','delivered_at','updated_by','updated_at']) is distinct from
    (to_jsonb(old) - array['paid_cents','status','version','delivered_at','updated_by','updated_at']) or
    new.version <> old.version+1 or new.paid_cents < old.paid_cents then
    raise exception using errcode='23514',message='inventory_sales_order_immutable';
  end if;
  return new;
end;
$$;
revoke all on function private.inventory_sales_order_immutable() from public,anon,authenticated,service_role;
create trigger inventory_sales_order_immutable before update or delete on public.inventory_sale_orders
for each row execute function private.inventory_sales_order_immutable();
-- Existing transactional revision helper: a rolled-back payment has no revision effect.
create trigger inventory_sales_revision after insert or update on public.inventory_sale_orders
for each row execute function private.bump_repairdesk_inventory_domain_version();

create function private.inventory_sales_missing_checks(
  p_item public.inventory_items,p_unit public.inventory_stock_units,p_kind text,p_identifier text,p_specifications jsonb
) returns text[] language plpgsql immutable set search_path='' as $$
declare missing text[]:='{}';cellular boolean;
begin
  if p_unit.id is null then missing:=array_append(missing,'stock_unit_required'); end if;
  if p_item.imei_check_status::text is distinct from 'pass' then missing:=array_append(missing,'identifier_check'); end if;
  if p_item.activation_lock_status::text is distinct from 'pass' then missing:=array_append(missing,'activation_lock'); end if;
  if p_item.data_wipe_status::text is distinct from 'pass' then missing:=array_append(missing,'data_wipe'); end if;
  if p_item.functional_grade::text is distinct from 'passed' then missing:=array_append(missing,'functional'); end if;
  if p_item.cosmetic_grade::text is null or p_item.cosmetic_grade::text='unknown' then missing:=array_append(missing,'cosmetic'); end if;
  if p_item.list_price is null or p_item.list_price<=0 then missing:=array_append(missing,'list_price'); end if;
  if p_unit.id is not null and (coalesce(p_item.legacy_payload->>'inventory_v2_intake','false')<>'true'
    or p_item.legacy_payload->>'inventory_v2_unit_id' is distinct from p_unit.id::text
    or p_item.buyback_price is distinct from p_unit.cost_amount or p_item.list_price is distinct from p_unit.list_price) then
    missing:=array_append(missing,'stock_projection'); end if;
  cellular:=p_item.category='phone' or (p_item.category='tablet' and
    (coalesce(p_specifications->>'network_variant','') ~* '(cellular|4g|5g|lte)'
      or coalesce(p_specifications->>'connectivity','') ~* '(cellular|4g|5g|lte)' or p_kind='imei1'));
  if p_unit.id is not null and (p_kind is null or p_identifier is null
    or public.repairdesk_inventory_v2_normalize_identifier(p_identifier) is distinct from public.repairdesk_inventory_v2_normalize_identifier(p_item.serial_or_imei)
    or (cellular and (p_kind<>'imei1' or not public.repairdesk_inventory_v2_imei_is_valid(p_identifier)))
    or (not cellular and (p_kind<>'serial' or char_length(public.repairdesk_inventory_v2_normalize_identifier(p_identifier)) not between 3 and 128))) then
    missing:=array_append(missing,'device_identifier'); end if;
  return missing;
end;
$$;
revoke all on function private.inventory_sales_missing_checks(public.inventory_items,public.inventory_stock_units,text,text,jsonb) from public,anon,authenticated,service_role;

create function public.repairdesk_inventory_sales_command(
  p_store_id uuid, p_actor_id uuid, p_command text, p_idempotency_key uuid, p_payload jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_role text; v_actor_name text; v_existing public.inventory_sales_command_ledger%rowtype;
  v_item public.inventory_items%rowtype; v_unit public.inventory_stock_units%rowtype;
  v_order public.inventory_sale_orders%rowtype; v_customer public.customers%rowtype;
  v_settings public.store_settings%rowtype; v_order_id uuid; v_payment_id uuid;
  v_amount bigint; v_price bigint; v_paid bigint; v_sequence integer; v_method text;
  v_now timestamptz := clock_timestamp(); v_agreed_at timestamptz; v_occurred_at timestamptz;
  v_delivered_at timestamptz; v_deliver boolean; v_months integer; v_used boolean; v_consent boolean;
  v_consent_at timestamptz; v_starts_on date; v_ends_on date; v_result jsonb; v_status text;
  v_identity_kind text; v_identity_value text; v_specifications jsonb; v_missing text[] := '{}';
begin
  if p_store_id is null or p_actor_id is null or p_idempotency_key is null or jsonb_typeof(p_payload) is distinct from 'object'
    then return jsonb_build_object('ok',false,'code','invalid_request'); end if;
  if p_command not in ('sale.create','payment.append','pickup.confirm') or p_command is null then
    return jsonb_build_object('ok',false,'code','invalid_command'); end if;
  -- Same key locks before every resource lock. Same-item commands always lock item -> unit -> order.
  perform pg_advisory_xact_lock(hashtextextended(p_store_id::text||':inventory-sales:'||p_idempotency_key::text,0));
  select m.role::text,coalesce(m.display_name,s.display_name,'Staff') into v_role,v_actor_name
    from public.store_memberships m join public.staff_profiles s on s.id=m.user_id
    join public.stores t on t.id=m.store_id
    where m.store_id=p_store_id and m.user_id=p_actor_id and m.status::text='active'
      and s.status::text='active' and t.status::text='active' for share of m,s,t;
  -- All four existing command permissions map to owner/manager/sales; no client role/grants accepted.
  if v_role is null or v_role not in ('owner','manager','sales') then
    return jsonb_build_object('ok',false,'code','actor_forbidden'); end if;
  select * into v_existing from public.inventory_sales_command_ledger where store_id=p_store_id and idempotency_key=p_idempotency_key;
  if found then
    if v_existing.actor_id<>p_actor_id or v_existing.command<>p_command or v_existing.request_payload<>p_payload then
      return jsonb_build_object('ok',false,'code','idempotency_conflict'); end if;
    return v_existing.response || jsonb_build_object('code','idempotent_replay');
  end if;
  if (select count(*) from jsonb_object_keys(p_payload) k where k not in (
    'inventory_item_id','stock_unit_id','expected_item_updated_at','expected_unit_version','sale_order_id',
    'expected_order_version','customer_id','price_cents','agreed_at','payment','deliver','delivered_at',
    'warranty_months','used_device','shortening_agreed','shortening_agreed_at','terms_version')) > 0 then
    return jsonb_build_object('ok',false,'code','invalid_payload'); end if;
  if p_command='sale.create' and (not (p_payload ?& array['customer_id','price_cents','agreed_at','payment','warranty_months','used_device','shortening_agreed','terms_version'])
    or jsonb_typeof(p_payload->'used_device') is distinct from 'boolean' or jsonb_typeof(p_payload->'shortening_agreed') is distinct from 'boolean') then
    return jsonb_build_object('ok',false,'code','invalid_payload'); end if;
  if p_payload ? 'deliver' and jsonb_typeof(p_payload->'deliver') is distinct from 'boolean' then
    return jsonb_build_object('ok',false,'code','invalid_payload'); end if;
  if coalesce(p_payload->>'expected_unit_version','') !~ '^[1-9][0-9]{0,14}$'
    or not (p_payload ? 'expected_item_updated_at') then return jsonb_build_object('ok',false,'code','stale_version'); end if;
  select * into v_item from public.inventory_items where store_id=p_store_id and id=(p_payload->>'inventory_item_id')::uuid
    and deleted_at is null for update;
  if not found then return jsonb_build_object('ok',false,'code','not_found'); end if;
  select * into v_unit from public.inventory_stock_units where store_id=p_store_id and id=(p_payload->>'stock_unit_id')::uuid
    and legacy_inventory_item_id=v_item.id for update;
  if not found then return jsonb_build_object('ok',false,'code','stock_unit_required'); end if;
  select * into v_order from public.inventory_sale_orders where store_id=p_store_id and inventory_item_id=v_item.id for update;
  if p_command='sale.create' and (found or exists(select 1 from public.inventory_transactions where store_id=p_store_id and item_id=v_item.id and transaction_type::text='sale_payment')
    or exists(select 1 from public.inventory_stock_movements where store_id=p_store_id and stock_unit_id=v_unit.id and movement_type='sell')) then
    return jsonb_build_object('ok',false,'code','already_sold'); end if;
  if p_command<>'sale.create' and (v_order.id is null or v_order.id is distinct from (p_payload->>'sale_order_id')::uuid) then
    return jsonb_build_object('ok',false,'code','not_found'); end if;
  if v_item.updated_at is distinct from (p_payload->>'expected_item_updated_at')::timestamptz
    or v_unit.version is distinct from (p_payload->>'expected_unit_version')::bigint
    or (p_command<>'sale.create' and (v_order.version is distinct from (p_payload->>'expected_order_version')::bigint)) then
    return jsonb_build_object('ok',false,'code','stale_version'); end if;
  v_deliver := p_command='pickup.confirm' or coalesce((p_payload->>'deliver')::boolean,false);
  v_delivered_at := (p_payload->>'delivered_at')::timestamptz;
  if v_deliver is distinct from (v_delivered_at is not null) then return jsonb_build_object('ok',false,'code','invalid_delivery'); end if;
  if p_command='sale.create' then
    if v_item.status::text not in ('ready_for_sale','listed') or v_unit.status not in ('ready_for_sale','listed') then
      return jsonb_build_object('ok',false,'code','inspection_blocked'); end if;
    if jsonb_typeof(p_payload->'price_cents') is distinct from 'number' or coalesce(p_payload->>'price_cents','') !~ '^[1-9][0-9]{0,10}$'
      then return jsonb_build_object('ok',false,'code','invalid_amount'); end if;
    v_price := (p_payload->>'price_cents')::bigint; v_paid := 0; v_order_id := gen_random_uuid();
    v_agreed_at := (p_payload->>'agreed_at')::timestamptz;
    v_months := (p_payload->>'warranty_months')::integer;
    v_used := (p_payload->>'used_device')::boolean; v_consent := (p_payload->>'shortening_agreed')::boolean;
    v_consent_at := (p_payload->>'shortening_agreed_at')::timestamptz;
    if v_price>10000000000 then return jsonb_build_object('ok',false,'code','invalid_amount'); end if;
    if v_agreed_at is null or not isfinite(v_agreed_at) or v_agreed_at>v_now+interval '5 minutes' then
      return jsonb_build_object('ok',false,'code','invalid_time'); end if;
    if v_months is null or v_months not in (12,24) or v_used is null or v_consent is null
      or p_payload->>'terms_version' is distinct from 'inventory-sales-2026-09-v1'
      or (v_months=12 and (not v_used or not v_consent or v_consent_at is null or v_item.cosmetic_grade::text='new'))
      or (v_consent_at is not null and (not isfinite(v_consent_at) or v_consent_at>v_agreed_at)) then
      return jsonb_build_object('ok',false,'code','invalid_warranty'); end if;
    select * into v_customer from public.customers where id=(p_payload->>'customer_id')::uuid and store_id=p_store_id and deleted_at is null for share;
    if not found then return jsonb_build_object('ok',false,'code','customer_not_found'); end if;
    select * into v_settings from public.store_settings where store_id=p_store_id;
  else
    if v_order.status='delivered' or v_unit.status<>'reserved' or v_item.status::text<>'reserved' then
      return jsonb_build_object('ok',false,'code','invalid_state'); end if;
    v_price := v_order.price_cents; v_paid := v_order.paid_cents; v_order_id := v_order.id;
    v_agreed_at := v_order.agreed_at; v_months := v_order.warranty_months;
    v_used := v_order.used_device; v_consent := v_order.shortening_agreed; v_consent_at := v_order.shortening_agreed_at;
  end if;
  v_amount := 0;
  if p_command in ('sale.create','payment.append') then
    if jsonb_typeof(p_payload->'payment') is distinct from 'object'
      or jsonb_typeof(p_payload->'payment'->'amount_cents') is distinct from 'number'
      or coalesce(p_payload->'payment'->>'amount_cents','') !~ '^[1-9][0-9]{0,10}$'
      or exists(select 1 from jsonb_object_keys(p_payload->'payment') k where k not in ('amount_cents','method','occurred_at','note')) then
      return jsonb_build_object('ok',false,'code','invalid_amount'); end if;
    v_amount := (p_payload->'payment'->>'amount_cents')::bigint;
    v_method := p_payload->'payment'->>'method'; v_occurred_at := (p_payload->'payment'->>'occurred_at')::timestamptz;
    if v_amount>v_price-v_paid then return jsonb_build_object('ok',false,'code','overpayment'); end if;
    if v_method is null or v_method not in ('cash','card','bancomat','transfer','other')
      or char_length(coalesce(p_payload->'payment'->>'note',''))>500 then return jsonb_build_object('ok',false,'code','invalid_payment'); end if;
    if v_occurred_at is null or not isfinite(v_occurred_at) or v_occurred_at<v_agreed_at or v_occurred_at>v_now+interval '5 minutes' then
      return jsonb_build_object('ok',false,'code','invalid_time'); end if;
    v_payment_id := gen_random_uuid();
  elsif p_payload ? 'payment' then return jsonb_build_object('ok',false,'code','invalid_payload'); end if;
  v_paid := v_paid+v_amount;
  if v_deliver and v_paid<>v_price then return jsonb_build_object('ok',false,'code','balance_remaining'); end if;
  if v_deliver and (not isfinite(v_delivered_at) or v_delivered_at<v_agreed_at or v_delivered_at>v_now+interval '5 minutes'
    or v_delivered_at<coalesce(v_occurred_at,v_agreed_at) or exists(select 1 from public.inventory_sale_payment_entries
      where sale_order_id=v_order_id and store_id=p_store_id and occurred_at>v_delivered_at)) then
    return jsonb_build_object('ok',false,'code','invalid_delivery'); end if;
  -- Preserve all applied inspection gates. Intake can never become an implicit pass.
  if p_command='sale.create' or v_deliver then
    select kind,display_value into v_identity_kind,v_identity_value from public.inventory_stock_unit_identifiers
      where store_id=p_store_id and stock_unit_id=v_unit.id and retired_at is null and is_primary;
    select specifications into v_specifications from public.inventory_product_variants where store_id=p_store_id and id=v_unit.variant_id;
    v_missing:=private.inventory_sales_missing_checks(v_item,v_unit,v_identity_kind,v_identity_value,v_specifications);
    if cardinality(v_missing)>0 then return jsonb_build_object('ok',false,'code','inspection_blocked','missing',to_jsonb(v_missing)); end if;
  end if;
  v_status := case when v_deliver then 'delivered' when v_paid=v_price then 'paid_pending_pickup' else 'awaiting_payment' end;
  -- Every failure below raises and rolls back this entire PL/pgSQL subtransaction.
  if p_command='sale.create' then
    insert into public.inventory_sale_orders(id,store_id,inventory_item_id,stock_unit_id,customer_id,sale_number,
      price_cents,paid_cents,status,agreed_at,delivered_at,warranty_months,used_device,shortening_agreed,shortening_agreed_at,terms_version,
      customer_snapshot,product_snapshot,store_snapshot,created_by,updated_by,created_at,updated_at)
    values(v_order_id,p_store_id,v_item.id,v_unit.id,v_customer.id,'S-'||v_order_id::text,v_price,v_paid,v_status,v_agreed_at,v_delivered_at,
      v_months,v_used,v_consent,v_consent_at,'inventory-sales-2026-09-v1',
      jsonb_build_object('name',coalesce(v_customer.name,''),'phone',v_customer.phone_e164),
      jsonb_build_object('name',concat_ws(' ',v_item.brand,v_item.model),'sku',v_item.public_no,'identifier',v_identity_value,'identifier_label',case when v_identity_kind='imei1' then 'IMEI' else 'SN' end,'category',v_item.category,'storage',v_item.storage_capacity,'color',v_item.color,'ram',(select ram_capacity from public.inventory_product_variants where store_id=p_store_id and id=v_unit.variant_id)),
      jsonb_build_object('name',coalesce(v_settings.store_name,''),'address',coalesce(v_settings.store_address,''),'phone',coalesce(v_settings.store_phone,''),
        'email',coalesce(v_settings.store_email,''),'footer',coalesce(v_settings.print_footer,'')),p_actor_id,p_actor_id,v_now,v_now) returning * into v_order;
  else
    update public.inventory_sale_orders set paid_cents=v_paid,status=v_status,version=version+1,delivered_at=v_delivered_at,
      updated_by=p_actor_id,updated_at=v_now where id=v_order_id and store_id=p_store_id returning * into v_order;
  end if;
  if v_amount>0 then
    select coalesce(max(sequence),0)+1 into v_sequence from public.inventory_sale_payment_entries where sale_order_id=v_order_id and store_id=p_store_id;
    insert into public.inventory_sale_payment_entries(id,store_id,sale_order_id,sequence,receipt_number,amount_cents,paid_after_cents,
      balance_after_cents,method,occurred_at,note,actor_id,transaction_id,created_at)
    values(v_payment_id,p_store_id,v_order_id,v_sequence,v_order.sale_number||'-P'||v_sequence,v_amount,v_paid,v_price-v_paid,v_method,
      v_occurred_at,nullif(p_payload->'payment'->>'note',''),p_actor_id,v_payment_id,v_now);
    insert into public.inventory_transactions(id,store_id,item_id,transaction_type,amount,currency_code,method,note,actor_id,created_at)
      values(v_payment_id,p_store_id,v_item.id,'sale_payment',v_amount::numeric/100,'EUR',v_method,'Inventory sales payment #'||v_sequence,p_actor_id,v_occurred_at);
  end if;
  if v_deliver then
    v_starts_on := (v_delivered_at at time zone 'Europe/Rome')::date;
    v_ends_on := (v_starts_on+make_interval(months=>v_months))::date;
    insert into public.inventory_warranty_versions(store_id,sale_order_id,months,starts_at,starts_on,ends_on,terms_version,used_device,shortening_agreed,shortening_agreed_at,actor_id)
      values(p_store_id,v_order_id,v_months,v_delivered_at,v_starts_on,v_ends_on,v_order.terms_version,v_used,v_consent,v_consent_at,p_actor_id);
  end if;
  update public.inventory_items set status=case when v_deliver then 'sold'::public.inventory_item_status else 'reserved'::public.inventory_item_status end,
    buyer_customer_id=v_order.customer_id,sale_price=v_price::numeric/100,deposit_amount=v_paid::numeric/100,
    payment_method=coalesce(v_method,payment_method),sale_channel='store',sold_at=v_delivered_at,warranty_months=v_months,
    warranty_until=case when v_deliver then v_ends_on::timestamp at time zone 'Europe/Rome' else null end,
    updated_by=p_actor_id,updated_at=v_now where id=v_item.id and store_id=p_store_id;
  update public.inventory_stock_units set status=case when v_deliver then 'sold' else 'reserved' end,
    version=version+1,updated_by=p_actor_id,updated_at=v_now where id=v_unit.id and store_id=p_store_id returning * into v_unit;
  if v_deliver then
    insert into public.inventory_stock_movements(id,store_id,stock_unit_id,variant_id,movement_type,quantity,source_kind,source_id,idempotency_key,actor_id,metadata,occurred_at,created_at)
      values(gen_random_uuid(),p_store_id,v_unit.id,v_unit.variant_id,'sell',-1,'inventory_sales',v_order_id::text,p_idempotency_key,p_actor_id,
        jsonb_build_object('sale_order_id',v_order_id),v_delivered_at,v_now);
  end if;
  insert into public.inventory_events(id,store_id,item_id,inventory_item_id,event_type,from_status,to_status,payload,operator_user_id,operator_name,created_at)
    values(gen_random_uuid(),p_store_id,v_item.id,v_item.id,case when v_deliver then 'sold' else 'updated' end,v_item.status,
      case when v_deliver then 'sold'::public.inventory_item_status else 'reserved'::public.inventory_item_status end,
      jsonb_build_object('command',p_command,'sale_order_id',v_order_id,'payment_id',v_payment_id),p_actor_id,v_actor_name,v_now);
  insert into public.audit_logs(id,actor_id,actor_name,store_id,action,entity_type,entity_id,metadata,created_at)
    values(gen_random_uuid()::text,p_actor_id,v_actor_name,p_store_id,'sale','inventory_sale_order',v_order_id::text,
      jsonb_build_object('command',p_command,'sale_order_id',v_order_id,'payment_id',v_payment_id),v_now);
  v_result := jsonb_build_object('ok',true,'code','completed','sale_order_id',v_order_id,'inventory_item_id',v_item.id,
    'stock_unit_id',v_unit.id,'item_updated_at',v_now,'unit_version',v_unit.version,'order_version',v_order.version,
    'paid_cents',v_paid,'balance_cents',v_price-v_paid,'status',v_status);
  if v_payment_id is not null then v_result:=v_result||jsonb_build_object('payment_id',v_payment_id); end if;
  insert into public.inventory_sales_command_ledger(store_id,sale_order_id,actor_id,idempotency_key,command,request_payload,response)
    values(p_store_id,v_order_id,p_actor_id,p_idempotency_key,p_command,p_payload,v_result);
  return v_result;
exception
  when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow then
    return jsonb_build_object('ok',false,'code','invalid_payload');
  when check_violation then return jsonb_build_object('ok',false,'code','invariant_failed');
  when foreign_key_violation then return jsonb_build_object('ok',false,'code','reference_conflict');
end;
$$;
revoke all on function public.repairdesk_inventory_sales_command(uuid,uuid,text,uuid,jsonb) from public,anon,authenticated,service_role;

create function private.inventory_sales_order_projection(p_order public.inventory_sale_orders)
returns jsonb language sql immutable set search_path='' as $$
  select jsonb_build_object('id',p_order.id,'sale_number',p_order.sale_number,'inventory_item_id',p_order.inventory_item_id,
    'stock_unit_id',p_order.stock_unit_id,'customer_id',p_order.customer_id,'price_cents',p_order.price_cents,
    'paid_cents',p_order.paid_cents,'balance_cents',p_order.price_cents-p_order.paid_cents,'status',p_order.status,
    'version',p_order.version,'agreed_at',p_order.agreed_at,'recorded_at',p_order.created_at,'delivered_at',p_order.delivered_at,
    'warranty_months',p_order.warranty_months,'used_device',p_order.used_device,'shortening_agreed',p_order.shortening_agreed,
    'shortening_agreed_at',p_order.shortening_agreed_at,'terms_version',p_order.terms_version);
$$;
revoke all on function private.inventory_sales_order_projection(public.inventory_sale_orders) from public,anon,authenticated,service_role;
create function public.repairdesk_inventory_sales_read(
  p_store_id uuid,p_actor_id uuid,p_mode text,p_id uuid,p_kind text default null,p_payment_id uuid default null,p_language text default null
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_role text; v_item public.inventory_items%rowtype; v_unit public.inventory_stock_units%rowtype;
  v_order public.inventory_sale_orders%rowtype; v_payment public.inventory_sale_payment_entries%rowtype;
  v_order_json jsonb; v_payments jsonb; v_warranty jsonb; v_language text; v_kind text; v_value text; v_specifications jsonb; v_missing text[]:='{}'; v_result jsonb;
begin
  select m.role::text into v_role from public.store_memberships m join public.staff_profiles s on s.id=m.user_id
    join public.stores t on t.id=m.store_id where m.store_id=p_store_id and m.user_id=p_actor_id
    and m.status::text='active' and s.status::text='active' and t.status::text='active';
  if v_role is null or v_role not in ('owner','manager','technician','sales')
    or (p_mode='receipt' and v_role not in ('owner','manager','sales')) then
    return jsonb_build_object('ok',false,'code','actor_forbidden'); end if;
  if p_mode not in ('summary','detail','receipt') or p_mode is null then return jsonb_build_object('ok',false,'code','invalid_request'); end if;
  if p_mode='summary' then
    select * into v_item from public.inventory_items where id=p_id and store_id=p_store_id and deleted_at is null;
    if not found then return jsonb_build_object('ok',true,'data',null); end if;
    select * into v_order from public.inventory_sale_orders where store_id=p_store_id and inventory_item_id=v_item.id;
  else
    select * into v_order from public.inventory_sale_orders where id=p_id and store_id=p_store_id;
    if not found then return jsonb_build_object('ok',true,'data',null); end if;
    select * into v_item from public.inventory_items where id=v_order.inventory_item_id and store_id=p_store_id and deleted_at is null;
    if not found then return jsonb_build_object('ok',true,'data',null); end if;
  end if;
  select * into v_unit from public.inventory_stock_units where legacy_inventory_item_id=v_item.id and store_id=p_store_id;
  select kind,display_value into v_kind,v_value from public.inventory_stock_unit_identifiers where store_id=p_store_id and stock_unit_id=v_unit.id and retired_at is null and is_primary;
  select specifications into v_specifications from public.inventory_product_variants where store_id=p_store_id and id=v_unit.variant_id;
  v_missing:=private.inventory_sales_missing_checks(v_item,v_unit,v_kind,v_value,v_specifications);
  if v_order.id is null and exists(select 1 from public.inventory_transactions where store_id=p_store_id and item_id=v_item.id and transaction_type::text='sale_payment') then
    v_missing:=array_append(v_missing,'existing_sale_payment'); end if;
  if v_order.id is null and (v_item.status::text not in ('ready_for_sale','listed') or v_unit.status not in ('ready_for_sale','listed')) then
    v_missing:=array_append(v_missing,'ready_for_sale'); end if;
  v_order_json := case when v_order.id is not null then private.inventory_sales_order_projection(v_order) else null end;
  v_result := jsonb_build_object('inventory_item_id',v_item.id,'stock_unit_id',v_unit.id,'item_updated_at',v_item.updated_at,
    'unit_version',v_unit.version,'item_status',v_item.status::text,'inspection_missing',to_jsonb(v_missing),
    'inspection_href','/inventory/'||v_item.id::text||'/edit','inspection',jsonb_build_object('imei_check_status',v_item.imei_check_status,'activation_lock_status',v_item.activation_lock_status,'data_wipe_status',v_item.data_wipe_status,'functional_grade',v_item.functional_grade,'cosmetic_grade',v_item.cosmetic_grade,'list_price_cents',(v_item.list_price*100)::bigint),'allowed_actions','[]'::jsonb,'order',v_order_json);
  if p_mode='summary' then return jsonb_build_object('ok',true,'data',v_result); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'sequence',p.sequence,'receipt_number',p.receipt_number,
    'amount_cents',p.amount_cents,'paid_after_cents',p.paid_after_cents,'balance_after_cents',p.balance_after_cents,
    'method',p.method,'occurred_at',p.occurred_at,'recorded_at',p.created_at) order by p.sequence),'[]'::jsonb)
    into v_payments from public.inventory_sale_payment_entries p where p.sale_order_id=v_order.id and p.store_id=p_store_id;
  select jsonb_build_object('starts_at',w.starts_at,'starts_on',w.starts_on,'ends_on',w.ends_on,'months',w.months)
    into v_warranty from public.inventory_warranty_versions w where w.sale_order_id=v_order.id and w.store_id=p_store_id and w.version=1;
  if p_mode='detail' then return jsonb_build_object('ok',true,'data',v_result||jsonb_build_object('payments',v_payments,'warranty',v_warranty,'customer',case when v_role in ('owner','manager','sales') then v_order.customer_snapshot else null end)); end if;
  if p_kind is null or p_kind not in ('sale','payment','warranty') or ((p_kind='payment') is distinct from (p_payment_id is not null))
    or (p_language is not null and p_language not in ('it','en','zh')) then return jsonb_build_object('ok',false,'code','invalid_request'); end if;
  -- Historical seller facts are independently required; current settings cannot repair them.
  if nullif(btrim(v_order.store_snapshot->>'name'),'') is null
    or nullif(btrim(v_order.store_snapshot->>'address'),'') is null
    or (nullif(btrim(v_order.store_snapshot->>'phone'),'') is null and nullif(btrim(v_order.store_snapshot->>'email'),'') is null) then
    return jsonb_build_object('ok',false,'code','historical_store_identity_incomplete');
  end if;
  if p_kind='warranty' and v_warranty is null then return jsonb_build_object('ok',false,'code','warranty_not_started'); end if;
  if p_kind='payment' then
    select * into v_payment from public.inventory_sale_payment_entries where id=p_payment_id and sale_order_id=v_order.id and store_id=p_store_id;
    if not found then return jsonb_build_object('ok',true,'data',null); end if;
    -- Reprinting an old payment never imports the current balance, delivery, or warranty.
    select coalesce(jsonb_agg(p),'[]'::jsonb) into v_payments from jsonb_array_elements(v_payments) p
      where (p->>'sequence')::integer<=v_payment.sequence;
    v_order_json:=v_order_json||jsonb_build_object('paid_cents',v_payment.paid_after_cents,'balance_cents',v_payment.balance_after_cents,
      'delivered_at',null,'status',case when v_payment.balance_after_cents=0 then 'paid_pending_pickup' else 'awaiting_payment' end);
    v_warranty:=null;
  end if;
  select coalesce(p_language,s.inventory_sales_print_language,'it') into v_language from public.store_settings s where s.store_id=p_store_id;
  return jsonb_build_object('ok',true,'data',jsonb_build_object('kind',p_kind,'language',coalesce(v_language,p_language,'it'),
    'payment_id',p_payment_id,'order',v_order_json,'payments',v_payments,'warranty',v_warranty,
    'customer',v_order.customer_snapshot,'product',v_order.product_snapshot,'store',v_order.store_snapshot));
end;
$$;
revoke all on function public.repairdesk_inventory_sales_read(uuid,uuid,text,uuid,text,uuid,text) from public,anon,authenticated,service_role;
comment on function public.repairdesk_inventory_sales_command(uuid,uuid,text,uuid,jsonb) is
  'Dormant sales-only service BFF entry; actor is injected by authentication. Four-table atomic payment/delivery with no legacy lifecycle dependency.';
create function public.repairdesk_inventory_sales_list(p_store_id uuid,p_actor_id uuid,p_filter jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_role text;v_queue text;v_search text;v_limit integer;v_offset integer;v_rows jsonb;v_counts jsonb;v_total integer;v_key text;v_values jsonb;v_facets jsonb;
begin
  select m.role::text into v_role from public.store_memberships m join public.staff_profiles s on s.id=m.user_id
    join public.stores t on t.id=m.store_id where m.store_id=p_store_id and m.user_id=p_actor_id
    and m.status::text='active' and s.status::text='active' and t.status::text='active';
  if v_role is null or v_role not in ('owner','manager','technician','sales') then return jsonb_build_object('ok',false,'code','actor_forbidden'); end if;
  if jsonb_typeof(p_filter) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_filter) k where k not in ('queue','search','offset','limit','categories','statuses','brands','locations')) then
    return jsonb_build_object('ok',false,'code','invalid_request'); end if;
  v_queue:=coalesce(p_filter->>'queue','all'); v_search:=lower(btrim(coalesce(p_filter->>'search','')));
  v_limit:=coalesce((p_filter->>'limit')::integer,30);v_offset:=coalesce((p_filter->>'offset')::integer,0);
  if v_queue not in ('all','available','awaiting_payment','paid_pending_pickup','delivered') or char_length(v_search)>100 or v_limit not between 1 and 100 or v_offset not between 0 and 100000 then
    return jsonb_build_object('ok',false,'code','invalid_request'); end if;
  foreach v_key in array array['categories','statuses','brands','locations'] loop
    if p_filter ? v_key then
      v_values:=p_filter->v_key;
      if jsonb_typeof(v_values) is distinct from 'array' then return jsonb_build_object('ok',false,'code','invalid_request'); end if;
      if jsonb_array_length(v_values)>(case when v_key in ('categories','statuses') then 5 else 20 end) then return jsonb_build_object('ok',false,'code','invalid_request'); end if;
      if exists(select 1 from jsonb_array_elements(v_values) e where jsonb_typeof(e)<>'string' or char_length(btrim(e#>>'{}')) not between 1 and 120
        or (v_key='categories' and e#>>'{}' not in ('phone','tablet','computer','game_console','other'))
        or (v_key='statuses' and e#>>'{}' not in ('in_stock','reserved','sold','removed','returned'))) then return jsonb_build_object('ok',false,'code','invalid_request'); end if;
    end if;
  end loop;
  -- One set-based statement and one MVCC snapshot for the entire inventory page and queue counts.
  with matched as materialized (
    select i as item,u as unit,o as sale,v as variant,x.kind,x.display_value,d.category as normalized_category,
      btrim(coalesce(o.product_snapshot->>'identifier',i.serial_or_imei,'')) as raw_identifier,
      case when o.id is not null then o.status
        when i.status::text not in ('sold','cancelled','returned','recycled') then 'available' else 'legacy' end as queue,
      exists(select 1 from public.inventory_transactions t where t.store_id=i.store_id and t.item_id=i.id and t.transaction_type::text='sale_payment') as has_payment
    from public.inventory_items i
    left join public.inventory_stock_units u on u.legacy_inventory_item_id=i.id and u.store_id=i.store_id
    left join public.inventory_sale_orders o on o.inventory_item_id=i.id and o.store_id=i.store_id
    left join public.inventory_product_variants v on v.id=u.variant_id and v.store_id=i.store_id
    left join public.inventory_stock_unit_identifiers x on x.stock_unit_id=u.id and x.store_id=i.store_id and x.retired_at is null and x.is_primary
    cross join lateral (select case when lower(btrim(i.category)) in ('phone','手机','智能手机','smartphone','telephone') then 'phone' when lower(btrim(i.category)) in ('tablet','平板','平板电脑','ipad') then 'tablet' when lower(btrim(i.category)) in ('computer','电脑','笔记本','台式机','laptop','desktop','pc') then 'computer' when lower(btrim(i.category)) in ('game_console','游戏机','主机','console','game console') then 'game_console' else 'other' end as category) d
    where i.store_id=p_store_id and i.deleted_at is null and i.source_type::text<>'buyback' and (v_search='' or strpos(lower(coalesce(i.public_no,'')||' '||coalesce(i.brand,'')||' '||coalesce(i.model,'')||' '||coalesce(i.storage_capacity,'')||' '||coalesce((i.legacy_payload->>'location'),'')||' '||coalesce(o.sale_number,'')),v_search)>0
      or exists(select 1 from public.inventory_stock_unit_identifiers sx where sx.store_id=i.store_id and sx.stock_unit_id=u.id and sx.retired_at is null and sx.normalized_value=upper(regexp_replace(v_search,'[[:space:]]','','g'))))
      and (coalesce(jsonb_array_length(p_filter->'categories'),0)=0 or (p_filter->'categories') ? d.category)
      and (coalesce(jsonb_array_length(p_filter->'statuses'),0)=0 or (p_filter->'statuses') ? (case when i.status::text in ('reserved','sold','returned') then i.status::text when i.status::text in ('cancelled','recycled') then 'removed' else 'in_stock' end))
      and (coalesce(jsonb_array_length(p_filter->'brands'),0)=0 or (p_filter->'brands') ? i.brand)
      and (coalesce(jsonb_array_length(p_filter->'locations'),0)=0 or (p_filter->'locations') ? (i.legacy_payload->>'location'))
  ), page as (
    select m.* from matched m where v_queue='all' or m.queue=v_queue order by (m.item).updated_at desc,(m.item).id desc limit v_limit offset v_offset
  )
  select (select coalesce(jsonb_agg(jsonb_build_object(
      'inventory_item_id',(p.item).id,'stock_unit_id',(p.unit).id,'item_updated_at',(p.item).updated_at,'unit_version',(p.unit).version,
      'item_status',(p.item).status,'order',case when (p.sale).id is not null then private.inventory_sales_order_projection(p.sale) else null end,
      'inspection_href','/inventory/'||(p.item).id::text||'/edit','allowed_actions','[]'::jsonb,
      'inspection_missing',to_jsonb(private.inventory_sales_missing_checks(p.item,p.unit,p.kind,p.display_value,(p.variant).specifications)
        ||case when (p.sale).id is null and ((p.item).status::text not in ('ready_for_sale','listed') or (p.unit).status not in ('ready_for_sale','listed')) then array['ready_for_sale'] else '{}'::text[] end
        ||case when (p.sale).id is null and p.has_payment then array['existing_sale_payment'] else '{}'::text[] end),
      'inspection',jsonb_build_object('imei_check_status',(p.item).imei_check_status,'activation_lock_status',(p.item).activation_lock_status,'data_wipe_status',(p.item).data_wipe_status,
        'functional_grade',(p.item).functional_grade,'cosmetic_grade',(p.item).cosmetic_grade,'list_price_cents',((p.item).list_price*100)::bigint),
      'product',coalesce((p.sale).product_snapshot,jsonb_build_object('name',concat_ws(' ',(p.item).brand,(p.item).model),'sku',(p.item).public_no,
        'identifier',coalesce((p.item).serial_or_imei,''),'identifier_label',case when p.kind='imei1' then 'IMEI' else 'SN' end,'category',case when lower(btrim((p.item).category)) in ('phone','tablet','computer','game_console') then lower(btrim((p.item).category)) else 'other' end,
        'storage',(p.item).storage_capacity,'ram',(p.variant).ram_capacity,'color',(p.item).color))
        ||jsonb_build_object('category',p.normalized_category,'identifier',case when p.raw_identifier='' then '' when char_length(p.raw_identifier)<=4 then '••••'||p.raw_identifier else '•••• '||right(p.raw_identifier,4) end),
      'customer',case when v_role in ('owner','manager','sales') then (p.sale).customer_snapshot else null end)
    order by (p.item).updated_at desc,(p.item).id desc),'[]'::jsonb) from page p),
    jsonb_build_object('all',count(*),'available',count(*) filter(where queue='available'),'awaiting_payment',count(*) filter(where queue='awaiting_payment'),
      'paid_pending_pickup',count(*) filter(where queue='paid_pending_pickup'),'delivered',count(*) filter(where queue='delivered')),
    count(*) filter(where v_queue='all' or queue=v_queue)::integer,
    jsonb_build_object('brands',coalesce(jsonb_agg(distinct (item).brand) filter(where nullif((item).brand,'') is not null),'[]'::jsonb),
      'locations',coalesce(jsonb_agg(distinct ((item).legacy_payload->>'location')) filter(where nullif(((item).legacy_payload->>'location'),'') is not null),'[]'::jsonb))
    into v_rows,v_counts,v_total,v_facets from matched;
  return jsonb_build_object('ok',true,'data',jsonb_build_object('rows',v_rows,'counts',v_counts,'total',v_total,'limit',v_limit,'offset',v_offset,'facets',v_facets));
exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('ok',false,'code','invalid_request');
end;
$$;
revoke all on function public.repairdesk_inventory_sales_list(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
commit;
