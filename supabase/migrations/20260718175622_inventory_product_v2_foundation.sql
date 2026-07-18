-- Inventory Product V2 expand step 1: dormant atomic sale bridge.
--
-- This migration is intentionally additive. It does not delete or rewrite V1
-- inventory history and it does not grant runtime EXECUTE to service_role.
-- A later Owner-approved enable migration may grant the RPC after linked
-- dry-run, restore, RLS/Grant and application flag gates pass.

set lock_timeout = '5s';

create unique index if not exists inventory_transactions_id_store_id_uidx
  on public.inventory_transactions (id, store_id);

create table if not exists public.inventory_sale_command_ledger (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  inventory_item_id text not null,
  buyer_customer_id text,
  idempotency_key uuid not null,
  request_hash text not null,
  actor_id uuid not null,
  actor_name_snapshot text not null,
  sale_price numeric(12, 2) not null,
  payment_amount numeric(12, 2) not null,
  payment_method text not null,
  sale_channel text not null default 'store',
  currency_code text not null default 'EUR',
  warranty_months integer not null,
  warranty_snapshot jsonb not null default '{}'::jsonb,
  fiscal_status text not null default 'pending',
  fiscal_reference text,
  payment_transaction_id text not null,
  item_updated_at_before timestamptz not null,
  item_updated_at_after timestamptz not null,
  sold_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint inventory_sale_command_ledger_store_fkey
    foreign key (store_id) references public.stores(id)
    on update cascade on delete restrict,
  constraint inventory_sale_command_ledger_item_same_store_fkey
    foreign key (inventory_item_id, store_id)
    references public.inventory_items(id, store_id)
    on update cascade on delete restrict,
  constraint inventory_sale_command_ledger_buyer_same_store_fkey
    foreign key (buyer_customer_id, store_id)
    references public.customers(id, store_id)
    on update cascade on delete restrict,
  constraint inventory_sale_command_ledger_actor_fkey
    foreign key (actor_id) references auth.users(id)
    on update cascade on delete restrict,
  constraint inventory_sale_command_ledger_payment_fkey
    foreign key (payment_transaction_id, store_id)
    references public.inventory_transactions(id, store_id)
    on update cascade on delete restrict,
  constraint inventory_sale_command_ledger_idempotency_unique
    unique (store_id, idempotency_key),
  constraint inventory_sale_command_ledger_request_hash_check
    check (request_hash ~ '^[0-9a-f]{32}$'),
  constraint inventory_sale_command_ledger_sale_price_check
    check (sale_price > 0 and sale_price = round(sale_price, 2)),
  constraint inventory_sale_command_ledger_payment_check
    check (
      payment_amount > 0
      and payment_amount = round(payment_amount, 2)
      and payment_amount = sale_price
    ),
  constraint inventory_sale_command_ledger_method_check
    check (char_length(payment_method) between 1 and 64),
  constraint inventory_sale_command_ledger_channel_check
    check (char_length(sale_channel) between 1 and 64),
  constraint inventory_sale_command_ledger_currency_check
    check (currency_code = 'EUR'),
  constraint inventory_sale_command_ledger_warranty_check
    check (warranty_months between 0 and 120),
  constraint inventory_sale_command_ledger_warranty_snapshot_check
    check (jsonb_typeof(warranty_snapshot) = 'object'),
  constraint inventory_sale_command_ledger_fiscal_status_check
    check (fiscal_status in ('not_required', 'pending', 'recorded')),
  constraint inventory_sale_command_ledger_fiscal_reference_check
    check (
      (fiscal_status = 'recorded' and nullif(btrim(fiscal_reference), '') is not null)
      or fiscal_status <> 'recorded'
    )
);

create index if not exists inventory_sale_command_ledger_item_created_idx
  on public.inventory_sale_command_ledger (store_id, inventory_item_id, created_at desc);

create index if not exists inventory_sale_command_ledger_buyer_created_idx
  on public.inventory_sale_command_ledger (store_id, buyer_customer_id, created_at desc)
  where buyer_customer_id is not null;

alter table public.inventory_sale_command_ledger enable row level security;

revoke all on table public.inventory_sale_command_ledger
  from public, anon, authenticated, service_role;
grant select, insert on table public.inventory_sale_command_ledger to service_role;

create or replace function public.repairdesk_complete_inventory_sale_v2(
  p_store_id uuid,
  p_item_id text,
  p_actor_id uuid,
  p_expected_updated_at timestamptz,
  p_idempotency_key uuid,
  p_buyer_customer_id text,
  p_sale_price numeric,
  p_payment_amount numeric,
  p_payment_method text,
  p_sale_channel text,
  p_warranty_months integer,
  p_warranty_snapshot jsonb,
  p_fiscal_status text,
  p_fiscal_reference text,
  p_sold_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor_name text;
  v_actor_role text;
  v_existing public.inventory_sale_command_ledger%rowtype;
  v_item public.inventory_items%rowtype;
  v_request_hash text;
  v_payment_method text := btrim(coalesce(p_payment_method, ''));
  v_sale_channel text := btrim(coalesce(p_sale_channel, 'store'));
  v_fiscal_status text := btrim(coalesce(p_fiscal_status, 'pending'));
  v_fiscal_reference text := nullif(btrim(coalesce(p_fiscal_reference, '')), '');
  v_warranty_snapshot jsonb := coalesce(p_warranty_snapshot, '{}'::jsonb);
  v_sale_id uuid := gen_random_uuid();
  v_payment_id text := gen_random_uuid()::text;
  v_now timestamptz := clock_timestamp();
  v_sold_at timestamptz := p_sold_at;
  v_warranty_until timestamptz;
begin
  if p_store_id is null or nullif(btrim(coalesce(p_item_id, '')), '') is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_target');
  end if;
  if p_actor_id is null then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;
  if p_expected_updated_at is null then
    return jsonb_build_object('ok', false, 'code', 'missing_expected_version');
  end if;
  if p_idempotency_key is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_idempotency_key');
  end if;
  if p_sold_at is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_sold_at');
  end if;
  if p_sale_price is null
     or p_sale_price <= 0
     or p_sale_price <> round(p_sale_price, 2)
     or p_payment_amount is null
     or p_payment_amount <> p_sale_price then
    return jsonb_build_object('ok', false, 'code', 'invalid_amount');
  end if;
  if char_length(v_payment_method) < 1 or char_length(v_payment_method) > 64 then
    return jsonb_build_object('ok', false, 'code', 'invalid_payment_method');
  end if;
  if char_length(v_sale_channel) < 1 or char_length(v_sale_channel) > 64 then
    return jsonb_build_object('ok', false, 'code', 'invalid_sale_channel');
  end if;
  if p_warranty_months is null or p_warranty_months < 0 or p_warranty_months > 120 then
    return jsonb_build_object('ok', false, 'code', 'invalid_warranty');
  end if;
  if jsonb_typeof(v_warranty_snapshot) <> 'object' then
    return jsonb_build_object('ok', false, 'code', 'invalid_warranty');
  end if;
  if v_fiscal_status not in ('not_required', 'pending', 'recorded')
     or (v_fiscal_status = 'recorded' and v_fiscal_reference is null) then
    return jsonb_build_object('ok', false, 'code', 'invalid_fiscal_status');
  end if;

  v_request_hash := md5(
    jsonb_build_object(
      'item_id', p_item_id,
      'actor_id', p_actor_id,
      'expected_updated_at', p_expected_updated_at,
      'buyer_customer_id', p_buyer_customer_id,
      'sale_price', p_sale_price::numeric(12, 2),
      'payment_amount', p_payment_amount::numeric(12, 2),
      'payment_method', v_payment_method,
      'sale_channel', v_sale_channel,
      'warranty_months', p_warranty_months,
      'warranty_snapshot', v_warranty_snapshot,
      'fiscal_status', v_fiscal_status,
      'fiscal_reference', v_fiscal_reference,
      'sold_at', v_sold_at
    )::text
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_store_id::text || ':inventory-sale-v2:' || p_idempotency_key::text,
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

  if v_actor_role is null or v_actor_role not in ('owner', 'manager', 'sales') then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;

  select ledger.*
    into v_existing
    from public.inventory_sale_command_ledger as ledger
   where ledger.store_id = p_store_id
     and ledger.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_hash <> v_request_hash then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return jsonb_build_object(
      'ok', true,
      'code', 'idempotent_replay',
      'sale_id', v_existing.id,
      'payment_id', v_existing.payment_transaction_id,
      'item_id', v_existing.inventory_item_id,
      'updated_at', v_existing.item_updated_at_after,
      'fiscal_status', v_existing.fiscal_status
    );
  end if;

  if p_buyer_customer_id is not null and not exists (
    select 1
      from public.customers as customer
     where customer.id = p_buyer_customer_id
       and customer.store_id = p_store_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'customer_not_found');
  end if;

  select item.*
    into v_item
    from public.inventory_items as item
   where item.store_id = p_store_id
     and item.id = p_item_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'item_not_found');
  end if;
  if v_item.updated_at <> p_expected_updated_at then
    return jsonb_build_object('ok', false, 'code', 'stale_version');
  end if;
  if v_item.status::text not in ('ready_for_sale', 'listed', 'reserved') then
    return jsonb_build_object('ok', false, 'code', 'invalid_state');
  end if;
  if v_item.source_type = 'buyback'
     and (
       v_item.imei_check_status::text <> 'pass'
       or v_item.activation_lock_status::text <> 'pass'
       or v_item.data_wipe_status::text <> 'pass'
     ) then
    return jsonb_build_object('ok', false, 'code', 'inspection_blocked');
  end if;

  v_warranty_until := case
    when p_warranty_months > 0 then v_sold_at + pg_catalog.make_interval(months => p_warranty_months)
    else null
  end;

  update public.inventory_items
     set status = 'sold',
         buyer_customer_id = p_buyer_customer_id,
         sale_price = p_sale_price,
         deposit_amount = p_payment_amount,
         payment_method = v_payment_method,
         sale_channel = v_sale_channel,
         warranty_months = p_warranty_months,
         warranty_until = v_warranty_until,
         sold_at = v_sold_at,
         legacy_payload = coalesce(v_item.legacy_payload, '{}'::jsonb)
           || jsonb_build_object(
             'sale_receipt', v_warranty_snapshot,
             'inventory_v2_sale_id', v_sale_id,
             'fiscal_status', v_fiscal_status,
             'fiscal_reference', v_fiscal_reference
           ),
         updated_by = p_actor_id,
         updated_at = v_now
   where store_id = p_store_id
     and id = p_item_id
     and updated_at = p_expected_updated_at;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'stale_version');
  end if;

  insert into public.inventory_transactions (
    id,
    store_id,
    item_id,
    transaction_type,
    amount,
    currency_code,
    method,
    note,
    actor_id,
    created_at
  ) values (
    v_payment_id,
    p_store_id,
    p_item_id,
    'sale_payment',
    p_payment_amount,
    'EUR',
    v_payment_method,
    'Inventory V2 atomic sale',
    p_actor_id,
    v_sold_at
  );

  insert into public.inventory_sale_command_ledger (
    id,
    store_id,
    inventory_item_id,
    buyer_customer_id,
    idempotency_key,
    request_hash,
    actor_id,
    actor_name_snapshot,
    sale_price,
    payment_amount,
    payment_method,
    sale_channel,
    warranty_months,
    warranty_snapshot,
    fiscal_status,
    fiscal_reference,
    payment_transaction_id,
    item_updated_at_before,
    item_updated_at_after,
    sold_at,
    created_at
  ) values (
    v_sale_id,
    p_store_id,
    p_item_id,
    p_buyer_customer_id,
    p_idempotency_key,
    v_request_hash,
    p_actor_id,
    v_actor_name,
    p_sale_price,
    p_payment_amount,
    v_payment_method,
    v_sale_channel,
    p_warranty_months,
    v_warranty_snapshot,
    v_fiscal_status,
    v_fiscal_reference,
    v_payment_id,
    v_item.updated_at,
    v_now,
    v_sold_at,
    v_now
  );

  insert into public.inventory_events (
    id,
    store_id,
    item_id,
    event_type,
    from_status,
    to_status,
    payload,
    operator_user_id,
    operator_name,
    created_at
  ) values (
    gen_random_uuid()::text,
    p_store_id,
    p_item_id,
    'sold',
    v_item.status,
    'sold',
    jsonb_build_object(
      'sale_id', v_sale_id,
      'payment_id', v_payment_id,
      'sale_price', p_sale_price,
      'currency_code', 'EUR',
      'fiscal_status', v_fiscal_status
    ),
    p_actor_id,
    v_actor_name,
    v_sold_at
  );

  insert into public.audit_logs (
    id,
    actor_id,
    actor_name,
    store_id,
    action,
    entity_type,
    entity_id,
    metadata,
    created_at
  ) values (
    gen_random_uuid()::text,
    p_actor_id,
    v_actor_name,
    p_store_id,
    'sale',
    'inventory_item',
    p_item_id,
    jsonb_build_object(
      'sale_id', v_sale_id,
      'payment_id', v_payment_id,
      'fiscal_status', v_fiscal_status
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'code', 'completed',
    'sale_id', v_sale_id,
    'payment_id', v_payment_id,
    'item_id', p_item_id,
    'updated_at', v_now,
    'fiscal_status', v_fiscal_status
  );
end;
$$;

revoke all on function public.repairdesk_complete_inventory_sale_v2(
  uuid,
  text,
  uuid,
  timestamptz,
  uuid,
  text,
  numeric,
  numeric,
  text,
  text,
  integer,
  jsonb,
  text,
  text,
  timestamptz
) from public, anon, authenticated, service_role;

comment on table public.inventory_sale_command_ledger is
  'Dormant V2 full-sale command ledger. Runtime access requires a separate Owner-approved enable migration.';

comment on function public.repairdesk_complete_inventory_sale_v2(
  uuid,
  text,
  uuid,
  timestamptz,
  uuid,
  text,
  numeric,
  numeric,
  text,
  text,
  integer,
  jsonb,
  text,
  text,
  timestamptz
) is 'Dormant atomic inventory full-sale command. EXECUTE intentionally revoked from every runtime role.';
