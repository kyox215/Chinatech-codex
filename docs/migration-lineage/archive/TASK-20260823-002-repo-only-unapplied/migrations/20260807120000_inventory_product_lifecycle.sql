-- Inventory Product Lifecycle V1 (expand-only, dormant by default)
--
-- The existing inventory V2 identity/stock-unit tables remain the source of
-- product identity. This migration adds the business facts that cannot safely
-- be represented by a single inventory_items.status or deposit_amount field.
-- All writes are routed through the service-role-only command RPC below.

set lock_timeout = '5s';
set statement_timeout = '2min';

-- Fail closed before any lifecycle DDL. The V2 bridge relies on UUID identity
-- columns and tenant-safe composite uniqueness from the canonical production
-- schema; a partially migrated/legacy text schema must not receive residue.
do $$
declare
  v_missing text;
begin
  select string_agg(requirement, ', ' order by requirement)
    into v_missing
    from (
      select 'inventory_items.id uuid' as requirement
       where not exists (
         select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'inventory_items'
            and column_name = 'id' and udt_name = 'uuid'
       )
      union all
      select 'inventory_items.store_id uuid'
       where not exists (
         select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'inventory_items'
            and column_name = 'store_id' and udt_name = 'uuid'
       )
      union all
      select 'customers.id uuid'
       where not exists (
         select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'customers'
            and column_name = 'id' and udt_name = 'uuid'
       )
      union all
      select 'customers.store_id uuid'
       where not exists (
         select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'customers'
            and column_name = 'store_id' and udt_name = 'uuid'
       )
      union all
      select 'inventory_stock_units.legacy_inventory_item_id uuid'
       where not exists (
         select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'inventory_stock_units'
            and column_name = 'legacy_inventory_item_id' and udt_name = 'uuid'
       )
      union all
      select 'inventory_items(id,store_id) unique'
       where not exists (
         select 1
           from pg_catalog.pg_index index_row
           join pg_catalog.pg_class table_row on table_row.oid = index_row.indrelid
           join pg_catalog.pg_namespace schema_row on schema_row.oid = table_row.relnamespace
          where schema_row.nspname = 'public'
            and table_row.relname = 'inventory_items'
            and index_row.indisunique
            and pg_catalog.strpos(
              pg_catalog.pg_get_indexdef(index_row.indexrelid),
              '(id, store_id)'
            ) > 0
       )
      union all
      select 'customers(id,store_id) unique'
       where not exists (
         select 1
           from pg_catalog.pg_index index_row
           join pg_catalog.pg_class table_row on table_row.oid = index_row.indrelid
           join pg_catalog.pg_namespace schema_row on schema_row.oid = table_row.relnamespace
          where schema_row.nspname = 'public'
            and table_row.relname = 'customers'
            and index_row.indisunique
            and pg_catalog.strpos(
              pg_catalog.pg_get_indexdef(index_row.indexrelid),
              '(id, store_id)'
            ) > 0
       )
      union all
      select 'inventory_stock_units(id,store_id) unique'
       where not exists (
         select 1
           from pg_catalog.pg_index index_row
           join pg_catalog.pg_class table_row on table_row.oid = index_row.indrelid
           join pg_catalog.pg_namespace schema_row on schema_row.oid = table_row.relnamespace
          where schema_row.nspname = 'public'
            and table_row.relname = 'inventory_stock_units'
            and index_row.indisunique
            and pg_catalog.strpos(
              pg_catalog.pg_get_indexdef(index_row.indexrelid),
              '(id, store_id)'
            ) > 0
       )
      union all
      select 'repairdesk_complete_inventory_sale_v2 canonical RPC'
       where to_regprocedure(
         'public.repairdesk_complete_inventory_sale_v2(uuid,uuid,uuid,timestamptz,uuid,uuid,numeric,numeric,text,text,integer,jsonb,text,text,timestamptz)'
       ) is null
      union all
      select 'inventory_transactions.id/store_id/item_id uuid'
       where exists (
         select 1
           from (values ('id'), ('store_id'), ('item_id')) required(column_name)
          where not exists (
            select 1
              from information_schema.columns column_row
             where column_row.table_schema = 'public'
               and column_row.table_name = 'inventory_transactions'
               and column_row.column_name = required.column_name
               and column_row.udt_name = 'uuid'
          )
       )
      union all
      select 'inventory_events.store_id/item_id uuid'
       where exists (
         select 1
           from (values ('store_id'), ('item_id')) required(column_name)
          where not exists (
            select 1
              from information_schema.columns column_row
             where column_row.table_schema = 'public'
               and column_row.table_name = 'inventory_events'
               and column_row.column_name = required.column_name
               and column_row.udt_name = 'uuid'
          )
       )
      union all
      select 'inventory_items.status text'
       where not exists (
         select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'inventory_items'
            and column_name = 'status' and udt_name = 'text'
       )
      union all
      select 'inventory_stock_units.status text'
       where not exists (
         select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'inventory_stock_units'
            and column_name = 'status' and udt_name = 'text'
       )
      union all
      select 'inventory_events.from_status/to_status text'
       where exists (
         select 1
           from (values ('from_status'), ('to_status')) required(column_name)
          where not exists (
            select 1
              from information_schema.columns column_row
             where column_row.table_schema = 'public'
               and column_row.table_name = 'inventory_events'
               and column_row.column_name = required.column_name
               and column_row.udt_name = 'text'
          )
       )
    ) missing;
  if v_missing is not null then
    raise exception using
      errcode = '55000',
      message = 'inventory lifecycle schema preflight failed: ' || v_missing;
  end if;
end;
$$;

-- The legacy inventory row is still the read-model used by existing screens.
-- Keep an explicit start alongside the existing warranty_until column so the
-- lifecycle delivery command can synchronize both boundaries atomically.
alter table public.inventory_items
  add column if not exists warranty_start timestamptz;

create table if not exists public.inventory_product_acquisitions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  inventory_item_id uuid not null,
  stock_unit_id uuid not null,
  source_type text not null default 'manual_stock',
  source_party text,
  acquired_at timestamptz not null,
  condition_at_acquisition text,
  cost_amount numeric(12,2) not null default 0,
  currency_code text not null default 'EUR',
  payment_method text,
  reference text,
  notes text,
  version bigint not null default 1,
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_product_acquisitions_store_fkey
    foreign key (store_id) references public.stores(id) on update cascade on delete restrict,
  constraint inventory_product_acquisitions_item_same_store_fkey
    foreign key (inventory_item_id, store_id)
    references public.inventory_items(id, store_id) on update cascade on delete restrict,
  constraint inventory_product_acquisitions_unit_same_store_fkey
    foreign key (stock_unit_id, store_id)
    references public.inventory_stock_units(id, store_id) on update cascade on delete restrict,
  constraint inventory_product_acquisitions_creator_same_store_fkey
    foreign key (created_by) references auth.users(id) on update cascade on delete restrict,
  constraint inventory_product_acquisitions_updater_same_store_fkey
    foreign key (updated_by) references auth.users(id) on update cascade on delete restrict,
  constraint inventory_product_acquisitions_amount_check
    check (cost_amount >= 0 and cost_amount = round(cost_amount, 2)),
  constraint inventory_product_acquisitions_currency_check check (currency_code = 'EUR'),
  constraint inventory_product_acquisitions_version_check check (version >= 1),
  constraint inventory_product_acquisitions_item_unique unique (store_id, inventory_item_id),
  constraint inventory_product_acquisitions_unit_unique unique (store_id, stock_unit_id)
);

create or replace function public.repairdesk_inventory_lifecycle_checks_valid(p_checks jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_pair record;
  v_count integer := 0;
begin
  if p_checks is null
     or pg_catalog.jsonb_typeof(p_checks) <> 'object'
     or pg_catalog.pg_column_size(p_checks) > 8192 then
    return false;
  end if;
  for v_pair in select * from pg_catalog.jsonb_each(p_checks) loop
    v_count := v_count + 1;
    if v_count > 32
       or pg_catalog.char_length(v_pair.key) > 64
       or pg_catalog.jsonb_typeof(v_pair.value) not in ('string', 'number', 'boolean', 'null')
       or pg_catalog.pg_column_size(v_pair.value) > 1024 then
      return false;
    end if;
  end loop;
  return true;
end;
$$;
revoke all on function public.repairdesk_inventory_lifecycle_checks_valid(jsonb)
  from public, anon, authenticated, service_role;

create table if not exists public.inventory_device_inspections (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  inventory_item_id uuid not null,
  stock_unit_id uuid not null,
  device_kind text not null,
  battery_health smallint,
  face_id_status text not null default 'not_tested',
  touch_id_status text not null default 'not_tested',
  true_tone_status text not null default 'not_tested',
  activation_lock_status text not null default 'not_tested',
  data_wipe_status text not null default 'not_tested',
  imei_status text not null default 'not_tested',
  checks jsonb not null default '{}'::jsonb,
  notes text,
  inspected_at timestamptz not null,
  inspected_by uuid not null,
  created_at timestamptz not null default now(),
  constraint inventory_device_inspections_store_fkey
    foreign key (store_id) references public.stores(id) on update cascade on delete restrict,
  constraint inventory_device_inspections_item_same_store_fkey
    foreign key (inventory_item_id, store_id)
    references public.inventory_items(id, store_id) on update cascade on delete restrict,
  constraint inventory_device_inspections_unit_same_store_fkey
    foreign key (stock_unit_id, store_id)
    references public.inventory_stock_units(id, store_id) on update cascade on delete restrict,
  constraint inventory_device_inspections_actor_fkey
    foreign key (inspected_by) references auth.users(id) on update cascade on delete restrict,
  constraint inventory_device_inspections_battery_check
    check (battery_health is null or battery_health between 0 and 100),
  constraint inventory_device_inspections_check_object
    check (jsonb_typeof(checks) = 'object'),
  constraint inventory_device_inspections_checks_bound
    check (public.repairdesk_inventory_lifecycle_checks_valid(checks)),
  constraint inventory_device_inspections_face_id_check
    check (face_id_status in ('not_tested', 'normal', 'abnormal', 'not_applicable')),
  constraint inventory_device_inspections_touch_id_check
    check (touch_id_status in ('not_tested', 'normal', 'abnormal', 'not_applicable')),
  constraint inventory_device_inspections_true_tone_check
    check (true_tone_status in ('not_tested', 'normal', 'abnormal', 'not_applicable')),
  constraint inventory_device_inspections_activation_check
    check (activation_lock_status in ('not_tested', 'normal', 'abnormal', 'not_applicable')),
  constraint inventory_device_inspections_wipe_check
    check (data_wipe_status in ('not_tested', 'normal', 'abnormal', 'not_applicable')),
  constraint inventory_device_inspections_imei_check
    check (imei_status in ('not_tested', 'normal', 'abnormal', 'not_applicable'))
);

create table if not exists public.inventory_sale_orders (
  -- Production authority reports customer IDs as UUID; local text snapshots
  -- intentionally fail the preflight above rather than receive this table.
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  inventory_item_id uuid not null,
  stock_unit_id uuid not null,
  customer_id uuid,
  agreed_price numeric(12,2) not null,
  currency_code text not null default 'EUR',
  no_deposit_reason text,
  status text not null default 'reserved',
  reserved_at timestamptz,
  expires_at timestamptz,
  expected_pickup_at timestamptz,
  sold_at timestamptz,
  actual_pickup_at timestamptz,
  cancelled_at timestamptz,
  cancellation_disposition text,
  cancellation_reason text,
  version bigint not null default 1,
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_sale_orders_store_fkey
    foreign key (store_id) references public.stores(id) on update cascade on delete restrict,
  constraint inventory_sale_orders_item_same_store_fkey
    foreign key (inventory_item_id, store_id)
    references public.inventory_items(id, store_id) on update cascade on delete restrict,
  constraint inventory_sale_orders_unit_same_store_fkey
    foreign key (stock_unit_id, store_id)
    references public.inventory_stock_units(id, store_id) on update cascade on delete restrict,
  constraint inventory_sale_orders_customer_same_store_fkey
    foreign key (customer_id, store_id)
    references public.customers(id, store_id) on update cascade on delete restrict,
  constraint inventory_sale_orders_creator_fkey
    foreign key (created_by) references auth.users(id) on update cascade on delete restrict,
  constraint inventory_sale_orders_updater_fkey
    foreign key (updated_by) references auth.users(id) on update cascade on delete restrict,
  constraint inventory_sale_orders_price_check
    check (agreed_price >= 0 and agreed_price = round(agreed_price, 2)),
  constraint inventory_sale_orders_currency_check check (currency_code = 'EUR'),
  constraint inventory_sale_orders_no_deposit_reason_check
    check (no_deposit_reason is null or char_length(btrim(no_deposit_reason)) between 1 and 500),
  constraint inventory_sale_orders_status_check
    check (status in ('reserved', 'sold', 'cancelled')),
  constraint inventory_sale_orders_disposition_check
    check (
      cancellation_disposition is null
      or cancellation_disposition in ('refund_pending', 'retain', 'pending')
    ),
  constraint inventory_sale_orders_version_check check (version >= 1),
  constraint inventory_sale_orders_id_store_unique unique (id, store_id)
);

create unique index if not exists inventory_sale_orders_one_active_unit_idx
  on public.inventory_sale_orders(store_id, stock_unit_id)
  where status in ('reserved', 'sold');
create index if not exists inventory_sale_orders_queue_idx
  on public.inventory_sale_orders(store_id, status, expires_at, expected_pickup_at, updated_at desc);
alter table public.inventory_sale_orders
  add column if not exists no_deposit_reason text;
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.inventory_sale_orders'::regclass
       and conname = 'inventory_sale_orders_no_deposit_reason_check'
  ) then
    alter table public.inventory_sale_orders
      add constraint inventory_sale_orders_no_deposit_reason_check
      check (no_deposit_reason is null or char_length(btrim(no_deposit_reason)) between 1 and 500);
  end if;
end;
$$;

create table if not exists public.inventory_sale_payment_entries (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  sale_order_id uuid not null,
  kind text not null,
  amount numeric(12,2) not null,
  currency_code text not null default 'EUR',
  method text not null,
  occurred_at timestamptz not null,
  reference_last4 text,
  reversal_of uuid,
  note text,
  actor_id uuid not null,
  created_at timestamptz not null default now(),
  constraint inventory_sale_payment_entries_store_fkey
    foreign key (store_id) references public.stores(id) on update cascade on delete restrict,
  constraint inventory_sale_payment_entries_order_same_store_fkey
    foreign key (sale_order_id, store_id)
    references public.inventory_sale_orders(id, store_id) on update cascade on delete restrict,
  constraint inventory_sale_payment_entries_reversal_same_store_fkey
    foreign key (reversal_of, store_id)
    references public.inventory_sale_payment_entries(id, store_id) on update cascade on delete restrict,
  constraint inventory_sale_payment_entries_actor_fkey
    foreign key (actor_id) references auth.users(id) on update cascade on delete restrict,
  constraint inventory_sale_payment_entries_kind_check
    check (kind in ('deposit', 'balance', 'payment', 'refund', 'reversal')),
  constraint inventory_sale_payment_entries_amount_check
    check (amount > 0 and amount = round(amount, 2)),
  constraint inventory_sale_payment_entries_currency_check check (currency_code = 'EUR'),
  constraint inventory_sale_payment_entries_method_check
    check (method in ('cash', 'card', 'bancomat', 'transfer', 'other')),
  constraint inventory_sale_payment_entries_reversal_check
    check ((kind in ('reversal', 'refund') and reversal_of is not null) or (kind not in ('reversal', 'refund') and reversal_of is null)),
  constraint inventory_sale_payment_entries_id_store_unique unique (id, store_id)
);
create index if not exists inventory_sale_payment_entries_order_idx
  on public.inventory_sale_payment_entries(store_id, sale_order_id, occurred_at, created_at);

-- Manager-only pickup overrides are append-only evidence. The balance is
-- captured at the decision point so a later payment cannot rewrite history.
create table if not exists public.inventory_pickup_override_ledger (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  sale_order_id uuid not null,
  outstanding_balance numeric(12,2) not null,
  reason text not null,
  actor_id uuid not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint inventory_pickup_override_ledger_store_fkey
    foreign key (store_id) references public.stores(id) on update cascade on delete restrict,
  constraint inventory_pickup_override_ledger_order_same_store_fkey
    foreign key (sale_order_id, store_id)
    references public.inventory_sale_orders(id, store_id) on update cascade on delete restrict,
  constraint inventory_pickup_override_ledger_actor_fkey
    foreign key (actor_id) references auth.users(id) on update cascade on delete restrict,
  constraint inventory_pickup_override_ledger_balance_check
    check (outstanding_balance > 0 and outstanding_balance = round(outstanding_balance, 2)),
  constraint inventory_pickup_override_ledger_reason_check
    check (char_length(btrim(reason)) between 1 and 500),
  constraint inventory_pickup_override_ledger_order_unique
    unique (store_id, sale_order_id)
);
create index if not exists inventory_pickup_override_ledger_created_idx
  on public.inventory_pickup_override_ledger(store_id, created_at desc);

create table if not exists public.inventory_warranty_versions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  sale_order_id uuid not null,
  version_no integer not null,
  basis text not null default 'commercial',
  months integer not null,
  starts_at timestamptz,
  ends_at timestamptz,
  reason text,
  supersedes_version_no integer,
  actor_id uuid not null,
  created_at timestamptz not null default now(),
  constraint inventory_warranty_versions_store_fkey
    foreign key (store_id) references public.stores(id) on update cascade on delete restrict,
  constraint inventory_warranty_versions_order_same_store_fkey
    foreign key (sale_order_id, store_id)
    references public.inventory_sale_orders(id, store_id) on update cascade on delete restrict,
  constraint inventory_warranty_versions_actor_fkey
    foreign key (actor_id) references auth.users(id) on update cascade on delete restrict,
  constraint inventory_warranty_versions_basis_check check (basis in ('legal', 'commercial')),
  constraint inventory_warranty_versions_months_check check (months between 0 and 120),
  constraint inventory_warranty_versions_time_check check (ends_at is null or starts_at is null or ends_at >= starts_at),
  constraint inventory_warranty_versions_version_unique unique (store_id, sale_order_id, version_no)
);

create table if not exists public.inventory_after_sales_cases (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  sale_order_id uuid not null,
  inventory_item_id uuid not null,
  status text not null default 'open',
  issue_summary text not null,
  diagnosis text,
  coverage_decision text,
  received_at timestamptz not null,
  returned_at timestamptz,
  closed_at timestamptz,
  version bigint not null default 1,
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_after_sales_cases_store_fkey
    foreign key (store_id) references public.stores(id) on update cascade on delete restrict,
  constraint inventory_after_sales_cases_order_same_store_fkey
    foreign key (sale_order_id, store_id)
    references public.inventory_sale_orders(id, store_id) on update cascade on delete restrict,
  constraint inventory_after_sales_cases_item_same_store_fkey
    foreign key (inventory_item_id, store_id)
    references public.inventory_items(id, store_id) on update cascade on delete restrict,
  constraint inventory_after_sales_cases_creator_fkey
    foreign key (created_by) references auth.users(id) on update cascade on delete restrict,
  constraint inventory_after_sales_cases_updater_fkey
    foreign key (updated_by) references auth.users(id) on update cascade on delete restrict,
  constraint inventory_after_sales_cases_status_check
    check (status in ('open', 'in_progress', 'waiting_customer', 'returned', 'closed')),
  constraint inventory_after_sales_cases_coverage_check
    check (coverage_decision is null or coverage_decision in ('pending', 'covered', 'not_covered')),
  constraint inventory_after_sales_cases_version_check check (version >= 1),
  constraint inventory_after_sales_cases_id_store_unique
    unique (id, store_id)
);
create index if not exists inventory_after_sales_cases_queue_idx
  on public.inventory_after_sales_cases(store_id, status, received_at desc);
do $$
begin
  if exists (
    select 1
      from public.inventory_after_sales_cases
     where status <> 'closed'
     group by store_id, sale_order_id
    having count(*) > 1
  ) then
    raise exception using
      errcode = '55000',
      message = 'inventory lifecycle schema preflight failed: duplicate active after-sales orders';
  end if;
end;
$$;
create unique index if not exists inventory_after_sales_cases_one_active_order_idx
  on public.inventory_after_sales_cases(store_id, sale_order_id)
  where status <> 'closed';

create table if not exists public.inventory_after_sales_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  case_id uuid not null,
  event_type text not null,
  from_status text,
  to_status text,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  actor_id uuid not null,
  created_at timestamptz not null default now(),
  constraint inventory_after_sales_events_store_fkey
    foreign key (store_id) references public.stores(id) on update cascade on delete restrict,
  constraint inventory_after_sales_events_case_same_store_fkey
    foreign key (case_id, store_id)
    references public.inventory_after_sales_cases(id, store_id) on update cascade on delete restrict,
  constraint inventory_after_sales_events_actor_fkey
    foreign key (actor_id) references auth.users(id) on update cascade on delete restrict,
  constraint inventory_after_sales_events_payload_check check (jsonb_typeof(payload) = 'object')
);
create index if not exists inventory_after_sales_events_case_idx
  on public.inventory_after_sales_events(store_id, case_id, occurred_at desc);

create table if not exists public.inventory_lifecycle_command_ledger (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  idempotency_key uuid not null,
  request_hash char(32) not null check (request_hash ~ '^[0-9a-f]{32}$'),
  command text not null,
  actor_id uuid not null,
  inventory_item_id uuid,
  stock_unit_id uuid,
  sale_order_id uuid,
  after_sales_case_id uuid,
  result jsonb not null,
  created_at timestamptz not null default now(),
  constraint inventory_lifecycle_command_ledger_store_fkey
    foreign key (store_id) references public.stores(id) on update cascade on delete restrict,
  constraint inventory_lifecycle_command_ledger_actor_fkey
    foreign key (actor_id) references auth.users(id) on update cascade on delete restrict,
  constraint inventory_lifecycle_command_ledger_item_same_store_fkey
    foreign key (inventory_item_id, store_id)
    references public.inventory_items(id, store_id) on update cascade on delete restrict,
  constraint inventory_lifecycle_command_ledger_unit_same_store_fkey
    foreign key (stock_unit_id, store_id)
    references public.inventory_stock_units(id, store_id) on update cascade on delete restrict,
  constraint inventory_lifecycle_command_ledger_order_same_store_fkey
    foreign key (sale_order_id, store_id)
    references public.inventory_sale_orders(id, store_id) on update cascade on delete restrict,
  constraint inventory_lifecycle_command_ledger_case_same_store_fkey
    foreign key (after_sales_case_id, store_id)
    references public.inventory_after_sales_cases(id, store_id) on update cascade on delete restrict,
  constraint inventory_lifecycle_command_ledger_result_check check (jsonb_typeof(result) = 'object'),
  constraint inventory_lifecycle_command_ledger_idempotency_unique unique (store_id, idempotency_key)
);
create index if not exists inventory_lifecycle_command_ledger_created_idx
  on public.inventory_lifecycle_command_ledger(store_id, created_at desc);

alter table public.inventory_product_acquisitions enable row level security;
alter table public.inventory_device_inspections enable row level security;
alter table public.inventory_sale_orders enable row level security;
alter table public.inventory_sale_payment_entries enable row level security;
alter table public.inventory_pickup_override_ledger enable row level security;
alter table public.inventory_warranty_versions enable row level security;
alter table public.inventory_after_sales_cases enable row level security;
alter table public.inventory_after_sales_events enable row level security;
alter table public.inventory_lifecycle_command_ledger enable row level security;

revoke all on table public.inventory_product_acquisitions from public, anon, authenticated, service_role;
revoke all on table public.inventory_device_inspections from public, anon, authenticated, service_role;
revoke all on table public.inventory_sale_orders from public, anon, authenticated, service_role;
revoke all on table public.inventory_sale_payment_entries from public, anon, authenticated, service_role;
revoke all on table public.inventory_pickup_override_ledger from public, anon, authenticated, service_role;
revoke all on table public.inventory_warranty_versions from public, anon, authenticated, service_role;
revoke all on table public.inventory_after_sales_cases from public, anon, authenticated, service_role;
revoke all on table public.inventory_after_sales_events from public, anon, authenticated, service_role;
revoke all on table public.inventory_lifecycle_command_ledger from public, anon, authenticated, service_role;
-- The BFF service role may read the minimized lifecycle projection, but every
-- write must cross the SECURITY DEFINER command boundary below.
grant select on table public.inventory_product_acquisitions to service_role;
grant select on table public.inventory_device_inspections to service_role;
grant select on table public.inventory_sale_orders to service_role;
grant select on table public.inventory_sale_payment_entries to service_role;
grant select on table public.inventory_pickup_override_ledger to service_role;
grant select on table public.inventory_warranty_versions to service_role;
grant select on table public.inventory_after_sales_cases to service_role;
grant select on table public.inventory_after_sales_events to service_role;
grant select on table public.inventory_lifecycle_command_ledger to service_role;

create or replace function public.repairdesk_inventory_lifecycle_append_only_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using errcode = '42501', message = 'inventory_lifecycle_append_only';
end;
$$;

revoke all on function public.repairdesk_inventory_lifecycle_append_only_guard() from public, anon, authenticated, service_role;

drop trigger if exists inventory_device_inspections_append_only on public.inventory_device_inspections;
create trigger inventory_device_inspections_append_only
before update or delete on public.inventory_device_inspections
for each row execute function public.repairdesk_inventory_lifecycle_append_only_guard();
drop trigger if exists inventory_sale_payment_entries_append_only on public.inventory_sale_payment_entries;
create trigger inventory_sale_payment_entries_append_only
before update or delete on public.inventory_sale_payment_entries
for each row execute function public.repairdesk_inventory_lifecycle_append_only_guard();
drop trigger if exists inventory_pickup_override_ledger_append_only on public.inventory_pickup_override_ledger;
create trigger inventory_pickup_override_ledger_append_only
before update or delete on public.inventory_pickup_override_ledger
for each row execute function public.repairdesk_inventory_lifecycle_append_only_guard();
drop trigger if exists inventory_warranty_versions_append_only on public.inventory_warranty_versions;
create trigger inventory_warranty_versions_append_only
before update or delete on public.inventory_warranty_versions
for each row execute function public.repairdesk_inventory_lifecycle_append_only_guard();
drop trigger if exists inventory_after_sales_events_append_only on public.inventory_after_sales_events;
create trigger inventory_after_sales_events_append_only
before update or delete on public.inventory_after_sales_events
for each row execute function public.repairdesk_inventory_lifecycle_append_only_guard();
drop trigger if exists inventory_lifecycle_command_ledger_append_only on public.inventory_lifecycle_command_ledger;
create trigger inventory_lifecycle_command_ledger_append_only
before update or delete on public.inventory_lifecycle_command_ledger
for each row execute function public.repairdesk_inventory_lifecycle_append_only_guard();

create or replace function public.repairdesk_inventory_lifecycle_command(
  p_store_id uuid,
  p_actor_id uuid,
  p_command text,
  p_idempotency_key uuid,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_command text := pg_catalog.btrim(coalesce(p_command, ''));
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_request_hash char(32);
  v_existing public.inventory_lifecycle_command_ledger%rowtype;
  v_actor_role text;
  v_actor_user_id uuid;
  v_item public.inventory_items%rowtype;
  v_unit public.inventory_stock_units%rowtype;
  v_order public.inventory_sale_orders%rowtype;
  v_case public.inventory_after_sales_cases%rowtype;
  v_original_payment public.inventory_sale_payment_entries%rowtype;
  v_payment_id uuid;
  v_order_id uuid;
  v_case_id uuid;
  v_result jsonb;
  v_amount numeric(12,2);
  v_price numeric(12,2);
  v_method text;
  v_kind text;
  v_disposition text;
  v_reason text;
  v_status text;
  v_target_status text;
  v_balance numeric(12,2);
  v_paid numeric(12,2);
  v_refunded numeric(12,2);
  v_version integer;
  v_months integer;
  v_start timestamptz;
  v_end timestamptz;
  v_latest_payment_at timestamptz;
  v_stock_unit_id uuid;
  v_item_id uuid;
  v_customer_id uuid;
  v_expires_at timestamptz;
  v_expected_pickup_at timestamptz;
  v_expected_unit_version bigint;
  v_expected_order_version bigint;
  v_expected_case_version bigint;
  v_expected_warranty_version integer;
  v_actor_name text;
begin
  if p_store_id is null or p_actor_id is null or p_idempotency_key is null
     or jsonb_typeof(v_payload) <> 'object' then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  if v_command not in (
    'acquisition.save', 'inspection.save', 'reservation.create', 'payment.append',
    'sale.complete', 'pickup.confirm', 'reservation.cancel', 'warranty.adjust',
    'after_sales.create', 'after_sales.update', 'after_sales.close'
  ) then
    return jsonb_build_object('ok', false, 'code', 'invalid_command');
  end if;

  -- Membership, profile and active-store checks deliberately run before the
  -- idempotency lookup. A replay never becomes an authorization oracle.
  select membership.role::text,
         coalesce(membership.display_name, profile.display_name, 'Staff'),
         membership.user_id
    into v_actor_role, v_actor_name, v_actor_user_id
    from public.store_memberships membership
    join public.staff_profiles profile on profile.id = membership.user_id
    join public.stores store_row on store_row.id = membership.store_id and store_row.status::text = 'active'
    left join public.store_lifecycles lifecycle on lifecycle.store_id = store_row.id
   where membership.store_id = p_store_id
     and membership.user_id = p_actor_id
     and membership.status::text = 'active'
     and profile.status::text = 'active'
     and (lifecycle.store_id is null or lifecycle.phase::text = 'active')
   limit 1;
  if v_actor_role is null then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;

  v_request_hash := pg_catalog.md5(jsonb_build_object(
    'command', v_command, 'payload', v_payload
  )::text);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_store_id::text || ':inventory-lifecycle:' || p_idempotency_key::text, 0
  ));
  select * into v_existing
    from public.inventory_lifecycle_command_ledger ledger
   where ledger.store_id = p_store_id and ledger.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> v_request_hash then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return v_existing.result || jsonb_build_object('code', 'idempotent_replay');
  end if;

  if v_command = 'acquisition.save' and v_actor_role not in ('owner', 'manager') then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;
  if v_command = 'inspection.save'
     and v_actor_role not in ('owner', 'manager', 'technician') then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;
  if v_command in ('reservation.create', 'payment.append', 'sale.complete')
     and v_actor_role not in ('owner', 'manager', 'sales') then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;
  if v_command = 'reservation.cancel' and v_actor_role not in ('owner', 'manager') then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;
  if v_command = 'pickup.confirm' and v_actor_role not in ('owner', 'manager', 'sales') then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;
  if v_command = 'warranty.adjust' and v_actor_role not in ('owner', 'manager') then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;
  if v_command = 'after_sales.create' and v_actor_role not in ('owner', 'manager', 'sales', 'technician') then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;
  if v_command in ('after_sales.update', 'after_sales.close') and v_actor_role not in ('owner', 'manager', 'technician') then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;

  -- Acquisition and inspection share the stock-unit target and are always
  -- same-store locked. The inspection is versioned by append-only rows.
  if v_command in ('acquisition.save', 'inspection.save') then
    v_stock_unit_id := nullif(v_payload ->> 'stock_unit_id', '')::uuid;
    v_expected_unit_version := nullif(v_payload ->> 'expected_unit_version', '')::bigint;
    if v_stock_unit_id is null or v_expected_unit_version is null then
      return jsonb_build_object('ok', false, 'code', 'invalid_target');
    end if;
    select unit.* into v_unit
      from public.inventory_stock_units unit
     where unit.store_id = p_store_id and unit.id = v_stock_unit_id
     for update;
    if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
    if v_unit.version <> v_expected_unit_version then
      return jsonb_build_object('ok', false, 'code', 'stale_version');
    end if;
    v_item_id := v_unit.legacy_inventory_item_id;
    if v_command = 'acquisition.save' then
      -- A notes/source-only correction must never erase the existing cost.
      -- Explicit zero remains valid; omission inherits the locked stock-unit fact.
      v_price := coalesce(
        nullif(v_payload ->> 'cost_amount', '')::numeric,
        v_unit.cost_amount,
        0
      );
      if v_price < 0 or v_price <> round(v_price, 2) then
        return jsonb_build_object('ok', false, 'code', 'invalid_amount');
      end if;
      insert into public.inventory_product_acquisitions (
        store_id, inventory_item_id, stock_unit_id, source_type, source_party,
        acquired_at, condition_at_acquisition, cost_amount, payment_method, reference,
        notes, version, created_by, updated_by, created_at, updated_at
      ) values (
        p_store_id, v_item_id, v_stock_unit_id,
        coalesce(nullif(v_payload ->> 'source_type', ''), 'manual_stock'),
        nullif(v_payload ->> 'source_party', ''),
        coalesce(nullif(v_payload ->> 'acquired_at', '')::timestamptz, v_now),
        nullif(v_payload ->> 'condition_at_acquisition', ''), v_price,
        nullif(v_payload ->> 'payment_method', ''), nullif(v_payload ->> 'reference', ''),
        nullif(v_payload ->> 'notes', ''),
        1, p_actor_id, p_actor_id, v_now, v_now
      ) on conflict (store_id, stock_unit_id) do update
        set source_type = excluded.source_type,
            source_party = excluded.source_party,
            acquired_at = excluded.acquired_at,
            condition_at_acquisition = excluded.condition_at_acquisition,
            cost_amount = excluded.cost_amount,
            payment_method = excluded.payment_method,
            reference = excluded.reference,
            notes = excluded.notes,
            version = public.inventory_product_acquisitions.version + 1,
            updated_by = excluded.updated_by,
            updated_at = excluded.updated_at;
      update public.inventory_stock_units
         set cost_amount = v_price,
             version = version + 1,
             updated_by = p_actor_id,
             updated_at = v_now
       where store_id = p_store_id and id = v_stock_unit_id
       returning version into v_expected_unit_version;
      v_result := jsonb_build_object(
        'ok', true,
        'code', 'saved',
        'stock_unit_id', v_stock_unit_id,
        'inventory_item_id', v_item_id,
        'version', v_expected_unit_version
      );
    else
      insert into public.inventory_device_inspections (
        store_id, inventory_item_id, stock_unit_id, device_kind, battery_health,
        face_id_status, touch_id_status, true_tone_status, activation_lock_status,
        data_wipe_status, imei_status, checks, notes, inspected_at, inspected_by
      ) values (
        p_store_id, v_item_id, v_stock_unit_id,
        coalesce(nullif(v_payload ->> 'device_kind', ''), 'other'),
        nullif(v_payload ->> 'battery_health', '')::smallint,
        coalesce(nullif(v_payload ->> 'face_id_status', ''), 'not_tested'),
        coalesce(nullif(v_payload ->> 'touch_id_status', ''), 'not_tested'),
        coalesce(nullif(v_payload ->> 'true_tone_status', ''), 'not_tested'),
        coalesce(nullif(v_payload ->> 'activation_lock_status', ''), 'not_tested'),
        coalesce(nullif(v_payload ->> 'data_wipe_status', ''), 'not_tested'),
        coalesce(nullif(v_payload ->> 'imei_status', ''), 'not_tested'),
        coalesce(v_payload -> 'checks', '{}'::jsonb), nullif(v_payload ->> 'notes', ''),
        coalesce(nullif(v_payload ->> 'inspected_at', '')::timestamptz, v_now), p_actor_id
      );
      update public.inventory_stock_units
         set version = version + 1,
             updated_by = p_actor_id,
             updated_at = v_now
       where store_id = p_store_id and id = v_stock_unit_id
       returning version into v_expected_unit_version;
      v_result := jsonb_build_object(
        'ok', true,
        'code', 'saved',
        'stock_unit_id', v_stock_unit_id,
        'inventory_item_id', v_item_id,
        'version', v_expected_unit_version
      );
    end if;
  elsif v_command = 'reservation.create' then
    v_stock_unit_id := nullif(v_payload ->> 'stock_unit_id', '')::uuid;
    v_expected_unit_version := nullif(v_payload ->> 'expected_unit_version', '')::bigint;
    v_price := nullif(v_payload ->> 'agreed_price', '')::numeric;
    v_customer_id := nullif(btrim(v_payload ->> 'customer_id'), '')::uuid;
    v_amount := coalesce(nullif(v_payload ->> 'deposit_amount', '')::numeric, 0);
    v_reason := nullif(btrim(v_payload ->> 'no_deposit_reason'), '');
    v_expires_at := coalesce(nullif(v_payload ->> 'expires_at', '')::timestamptz, v_now + interval '7 days');
    v_expected_pickup_at := nullif(v_payload ->> 'expected_pickup_at', '')::timestamptz;
    if v_stock_unit_id is null
       or v_expected_unit_version is null
       or v_customer_id is null
       or v_price is null
       or v_price <= 0
       or v_price <> round(v_price, 2) then
      return jsonb_build_object('ok', false, 'code', 'invalid_payload');
    end if;
    if v_amount < 0 or v_amount > v_price or v_amount <> round(v_amount, 2) then
      return jsonb_build_object('ok', false, 'code', 'invalid_amount');
    end if;
    if v_amount = 0 and (v_actor_role not in ('owner', 'manager') or v_reason is null) then
      return jsonb_build_object('ok', false, 'code', 'deposit_required');
    end if;
    if v_amount > 0
       and nullif(v_payload ->> 'payment_method', '') not in ('cash', 'card', 'bancomat', 'transfer', 'other') then
      return jsonb_build_object('ok', false, 'code', 'invalid_payload');
    end if;
    if v_expires_at <= v_now
       or (v_expected_pickup_at is not null
           and (v_expected_pickup_at < v_now or v_expected_pickup_at > v_expires_at)) then
      return jsonb_build_object('ok', false, 'code', 'invalid_schedule');
    end if;
    if not exists (
      select 1 from public.customers customer
       where customer.id = v_customer_id and customer.store_id = p_store_id
    ) then
      return jsonb_build_object('ok', false, 'code', 'not_found');
    end if;
    select unit.* into v_unit from public.inventory_stock_units unit
     where unit.store_id = p_store_id and unit.id = v_stock_unit_id for update;
    if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
    if v_unit.version <> v_expected_unit_version then
      return jsonb_build_object('ok', false, 'code', 'stale_version');
    end if;
    if v_unit.status::text <> 'listed' then
      return jsonb_build_object('ok', false, 'code', 'invalid_state');
    end if;
    if exists (select 1 from public.inventory_sale_orders where store_id = p_store_id and stock_unit_id = v_stock_unit_id and status in ('reserved','sold')) then
      return jsonb_build_object('ok', false, 'code', 'already_reserved');
    end if;
    insert into public.inventory_sale_orders (
      store_id, inventory_item_id, stock_unit_id, customer_id, agreed_price,
      no_deposit_reason, status, reserved_at, expires_at, expected_pickup_at,
      version, created_by, updated_by, created_at, updated_at
    ) values (
      p_store_id, v_unit.legacy_inventory_item_id, v_stock_unit_id,
      v_customer_id, v_price, case when v_amount = 0 then v_reason else null end,
      'reserved', v_now,
      v_expires_at,
      v_expected_pickup_at,
      1, p_actor_id, p_actor_id, v_now, v_now
    ) returning * into v_order;
    update public.inventory_stock_units
       set status = 'reserved', version = version + 1,
           updated_by = p_actor_id, updated_at = v_now
     where store_id = p_store_id and id = v_stock_unit_id
       and version = v_expected_unit_version
     returning version into v_expected_unit_version;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'stale_version');
    end if;
    select item.* into v_item
      from public.inventory_items item
     where item.store_id = p_store_id and item.id = v_order.inventory_item_id
     for update;
    update public.inventory_items
       set status = 'reserved',
           updated_by = p_actor_id,
           updated_at = v_now
     where store_id = p_store_id and id = v_order.inventory_item_id;
    insert into public.inventory_events(
      id, store_id, item_id, event_type, from_status, to_status, payload,
      operator_user_id, operator_name, created_at
    ) values (
      gen_random_uuid(), p_store_id, v_order.inventory_item_id,
      'reservation_created', v_item.status,
      'reserved',
      jsonb_build_object(
        'sale_order_id', v_order.id,
        'stock_unit_id', v_stock_unit_id,
        'expires_at', v_expires_at,
        'deposit_amount', v_amount
      ),
      p_actor_id, v_actor_name, v_now
    );
    v_order_id := v_order.id;
    if v_amount > 0 then
      insert into public.inventory_sale_payment_entries (store_id, sale_order_id, kind, amount, method, occurred_at, note, actor_id)
      values (p_store_id, v_order_id, 'deposit', v_amount, coalesce(nullif(v_payload ->> 'payment_method',''), 'other'), v_now, nullif(v_payload ->> 'payment_note',''), p_actor_id)
      returning id into v_payment_id;
    end if;
    v_result := jsonb_build_object(
      'ok', true,
      'code', 'created',
      'sale_order_id', v_order_id,
      'stock_unit_id', v_stock_unit_id,
      'payment_id', v_payment_id,
      'expires_at', v_order.expires_at,
      'order_version', v_order.version,
      'unit_version', v_expected_unit_version
    );
  elsif v_command = 'payment.append' then
    v_order_id := nullif(v_payload ->> 'sale_order_id', '')::uuid;
    v_expected_order_version := nullif(v_payload ->> 'expected_order_version', '')::bigint;
    v_amount := nullif(v_payload ->> 'amount', '')::numeric;
    v_kind := coalesce(nullif(v_payload ->> 'kind', ''), 'payment');
    v_method := coalesce(nullif(v_payload ->> 'method', ''), 'other');
    if v_order_id is null or v_expected_order_version is null
       or v_amount is null or v_amount <= 0 or v_amount <> round(v_amount, 2)
       or v_kind not in ('deposit','balance','payment','refund','reversal')
       or v_method not in ('cash', 'card', 'bancomat', 'transfer', 'other') then
      return jsonb_build_object('ok', false, 'code', 'invalid_payload');
    end if;
    select * into v_order from public.inventory_sale_orders where store_id = p_store_id and id = v_order_id for update;
    if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
    if v_order.version <> v_expected_order_version then
      return jsonb_build_object('ok', false, 'code', 'stale_version');
    end if;
    v_start := coalesce(nullif(v_payload ->> 'occurred_at','')::timestamptz, v_now);
    if v_start > v_now + interval '5 minutes' then
      return jsonb_build_object('ok', false, 'code', 'invalid_schedule');
    end if;
    if v_kind in ('refund','reversal') and v_actor_role not in ('owner','manager') then return jsonb_build_object('ok', false, 'code', 'actor_forbidden'); end if;
    if v_kind in ('refund','reversal') then
      if v_order.status not in ('sold', 'cancelled') then
        return jsonb_build_object('ok', false, 'code', 'invalid_state');
      end if;
      if nullif(v_payload ->> 'reversal_of', '') is null then return jsonb_build_object('ok', false, 'code', 'invalid_payload'); end if;
      v_payment_id := (v_payload ->> 'reversal_of')::uuid;
      select payment.* into v_original_payment
        from public.inventory_sale_payment_entries payment
       where payment.store_id = p_store_id
         and payment.id = v_payment_id
         and payment.sale_order_id = v_order_id
       for update;
      if not found or v_original_payment.kind not in ('deposit', 'balance', 'payment') then
        return jsonb_build_object('ok', false, 'code', 'invalid_state');
      end if;
      if v_start < v_original_payment.occurred_at then
        return jsonb_build_object('ok', false, 'code', 'invalid_schedule');
      end if;
      select coalesce(sum(reversal.amount), 0)
        into v_refunded
        from public.inventory_sale_payment_entries reversal
       where reversal.store_id = p_store_id
         and reversal.sale_order_id = v_order_id
         and reversal.reversal_of = v_payment_id
         and reversal.kind in ('refund', 'reversal');
      select coalesce(sum(case when payment.kind in ('deposit','balance','payment') then payment.amount when payment.kind in ('refund','reversal') then -payment.amount else 0 end), 0)
        into v_paid
        from public.inventory_sale_payment_entries payment
       where payment.store_id = p_store_id and payment.sale_order_id = v_order_id;
      if v_refunded + v_amount > v_original_payment.amount
         or v_amount > greatest(v_paid, 0) then
        return jsonb_build_object('ok', false, 'code', 'invalid_amount');
      end if;
    else
      if v_order.status <> 'reserved' then
        return jsonb_build_object('ok', false, 'code', 'invalid_state');
      end if;
      if nullif(v_payload ->> 'reversal_of', '') is not null then
        return jsonb_build_object('ok', false, 'code', 'invalid_payload');
      end if;
      if v_order.reserved_at is null or v_start < v_order.reserved_at then
        return jsonb_build_object('ok', false, 'code', 'invalid_schedule');
      end if;
      select coalesce(sum(
               case
                 when payment.kind in ('deposit','balance','payment') then payment.amount
                 when payment.kind in ('refund','reversal') then -payment.amount
                 else 0
               end
             ), 0)
        into v_paid
        from public.inventory_sale_payment_entries payment
       where payment.store_id = p_store_id
         and payment.sale_order_id = v_order_id;
      if v_paid + v_amount > v_order.agreed_price then
        return jsonb_build_object('ok', false, 'code', 'invalid_amount');
      end if;
      v_payment_id := null;
    end if;
    insert into public.inventory_sale_payment_entries (store_id, sale_order_id, kind, amount, method, occurred_at, reference_last4, reversal_of, note, actor_id)
    values (p_store_id, v_order_id, v_kind, v_amount, v_method, v_start, nullif(v_payload ->> 'reference_last4',''), v_payment_id, nullif(v_payload ->> 'note',''), p_actor_id)
    returning id into v_payment_id;
    update public.inventory_sale_orders
       set version = version + 1,
           updated_by = p_actor_id,
           updated_at = v_now
     where store_id = p_store_id and id = v_order_id
       and version = v_expected_order_version
     returning version into v_expected_order_version;
    v_result := jsonb_build_object(
      'ok', true,
      'code', 'appended',
      'sale_order_id', v_order_id,
      'payment_id', v_payment_id,
      'order_version', v_expected_order_version
    );
  elsif v_command = 'sale.complete' then
    v_order_id := nullif(v_payload ->> 'sale_order_id', '')::uuid;
    v_expected_order_version := nullif(v_payload ->> 'expected_order_version', '')::bigint;
    v_expected_unit_version := nullif(v_payload ->> 'expected_unit_version', '')::bigint;
    if v_order_id is null or v_expected_order_version is null
       or v_expected_unit_version is null then
      return jsonb_build_object('ok', false, 'code', 'invalid_target');
    end if;
    select * into v_order from public.inventory_sale_orders where store_id = p_store_id and id = v_order_id for update;
    if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
    if v_order.version <> v_expected_order_version then
      return jsonb_build_object('ok', false, 'code', 'stale_version');
    end if;
    if v_order.status <> 'reserved' then return jsonb_build_object('ok', false, 'code', 'invalid_state'); end if;
    select unit.* into v_unit
      from public.inventory_stock_units unit
     where unit.store_id = p_store_id and unit.id = v_order.stock_unit_id
     for update;
    if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
    if v_unit.version <> v_expected_unit_version or v_unit.status::text <> 'reserved' then
      return jsonb_build_object('ok', false, 'code', 'stale_version');
    end if;
    select coalesce(sum(case when kind in ('deposit','balance','payment') then amount when kind in ('refund','reversal') then -amount else 0 end), 0),
           coalesce(sum(case when kind in ('refund','reversal') then amount else 0 end), 0)
      into v_paid, v_refunded from public.inventory_sale_payment_entries where store_id = p_store_id and sale_order_id = v_order_id;
    if v_paid < 0 or v_paid > v_order.agreed_price then
      return jsonb_build_object('ok', false, 'code', 'invalid_amount');
    end if;
    v_balance := v_order.agreed_price - v_paid;
    v_amount := coalesce(nullif(v_payload ->> 'payment_amount', '')::numeric, 0);
    if v_amount < 0 or v_amount <> round(v_amount, 2) then
      return jsonb_build_object('ok', false, 'code', 'invalid_amount');
    end if;
    if v_paid + v_amount <> v_order.agreed_price then
      return jsonb_build_object('ok', false, 'code', 'balance_remaining', 'balance', v_balance);
    end if;
    v_method := nullif(v_payload ->> 'payment_method', '');
    if v_amount > 0 then
      if v_method not in ('cash', 'card', 'bancomat', 'transfer', 'other') then
        return jsonb_build_object('ok', false, 'code', 'invalid_payload');
      end if;
    else
      select payment.method
        into v_method
        from public.inventory_sale_payment_entries payment
       where payment.store_id = p_store_id
         and payment.sale_order_id = v_order_id
         and payment.kind in ('deposit', 'balance', 'payment')
       order by payment.occurred_at desc, payment.created_at desc
       limit 1;
      v_method := coalesce(v_method, 'other');
    end if;
    v_start := coalesce(nullif(v_payload ->> 'sold_at','')::timestamptz, v_now);
    select max(payment.occurred_at)
      into v_latest_payment_at
      from public.inventory_sale_payment_entries payment
     where payment.store_id = p_store_id
       and payment.sale_order_id = v_order_id
       and payment.kind in ('deposit', 'balance', 'payment');
    if v_start > v_now + interval '5 minutes'
       or v_order.reserved_at is null
       or v_start < v_order.reserved_at
       or (v_latest_payment_at is not null and v_start < v_latest_payment_at) then
      return jsonb_build_object('ok', false, 'code', 'invalid_schedule');
    end if;
    select item.* into v_item
      from public.inventory_items item
     where item.store_id = p_store_id and item.id = v_order.inventory_item_id;
    if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
    select public.repairdesk_complete_inventory_sale_v2(
      p_store_id,
      v_order.inventory_item_id,
      p_actor_id,
      v_item.updated_at,
      p_idempotency_key,
      v_order.customer_id,
      v_order.agreed_price,
      v_order.agreed_price,
      v_method,
      'store',
      0,
      jsonb_build_object(
        'lifecycle_sale_order_id', v_order_id,
        'commercial_warranty', 'pending_until_pickup',
        'statutory_rights_unchanged', true
      ),
      'pending',
      null,
      v_start
    ) into v_result;
    if coalesce((v_result ->> 'ok')::boolean, false) is not true then
      return v_result;
    end if;
    if v_amount > 0 then
      insert into public.inventory_sale_payment_entries (
        store_id, sale_order_id, kind, amount, method, occurred_at, note, actor_id
      ) values (
        p_store_id, v_order_id, 'balance', v_amount, v_method, v_start,
        nullif(v_payload ->> 'payment_note',''), p_actor_id
      ) returning id into v_payment_id;
    end if;
    update public.inventory_sale_orders
       set status = 'sold',
           sold_at = v_start,
           version = version + 1,
           updated_by = p_actor_id,
           updated_at = v_now
     where store_id = p_store_id and id = v_order_id
       and version = v_expected_order_version
     returning version into v_expected_order_version;
    select unit.version
      into v_expected_unit_version
      from public.inventory_stock_units unit
     where unit.store_id = p_store_id and unit.id = v_order.stock_unit_id;
    v_result := jsonb_build_object(
      'ok', true,
      'code', 'completed',
      'sale_order_id', v_order_id,
      'canonical_sale_id', v_result ->> 'sale_id',
      'canonical_payment_id', v_result ->> 'payment_id',
      'lifecycle_payment_id', v_payment_id,
      'balance', 0,
      'sold_at', v_start,
      'order_version', v_expected_order_version,
      'unit_version', v_expected_unit_version
    );
  elsif v_command = 'pickup.confirm' then
    v_order_id := nullif(v_payload ->> 'sale_order_id', '')::uuid;
    v_expected_order_version := nullif(v_payload ->> 'expected_order_version', '')::bigint;
    if v_order_id is null or v_expected_order_version is null then
      return jsonb_build_object('ok', false, 'code', 'invalid_target');
    end if;
    select * into v_order from public.inventory_sale_orders where store_id = p_store_id and id = v_order_id for update;
    if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
    if v_order.version <> v_expected_order_version then
      return jsonb_build_object('ok', false, 'code', 'stale_version');
    end if;
    if v_order.status <> 'sold' or v_order.actual_pickup_at is not null then return jsonb_build_object('ok', false, 'code', 'invalid_state'); end if;
    select coalesce(sum(case when kind in ('deposit','balance','payment') then amount when kind in ('refund','reversal') then -amount else 0 end), 0) into v_paid from public.inventory_sale_payment_entries where store_id = p_store_id and sale_order_id = v_order_id;
    v_balance := greatest(v_order.agreed_price - v_paid, 0);
    if v_balance > 0 then
      if v_actor_role not in ('owner','manager') or nullif(v_payload ->> 'override_reason','') is null then return jsonb_build_object('ok', false, 'code', 'balance_remaining'); end if;
    end if;
    v_start := coalesce(nullif(v_payload ->> 'actual_pickup_at','')::timestamptz, v_now);
    v_months := nullif(v_payload ->> 'warranty_months', '')::integer;
    if v_months is null or v_months < 0 or v_months > 120
       or v_order.sold_at is null or v_start < v_order.sold_at
       or v_start > v_now + interval '5 minutes' then
      return jsonb_build_object('ok', false, 'code', 'invalid_payload');
    end if;
    v_end := case when v_months = 0 then null else v_start + pg_catalog.make_interval(months => v_months) end;
    if v_balance > 0 then
      insert into public.inventory_pickup_override_ledger(
        store_id, sale_order_id, outstanding_balance, reason, actor_id,
        occurred_at, created_at
      ) values (
        p_store_id, v_order_id, v_balance,
        btrim(v_payload ->> 'override_reason'), p_actor_id, v_start, v_now
      );
    end if;
    update public.inventory_sale_orders
       set actual_pickup_at = v_start,
           version = version + 1,
           updated_by = p_actor_id,
           updated_at = v_now
     where store_id = p_store_id and id = v_order_id
       and version = v_expected_order_version
     returning version into v_expected_order_version;
    select coalesce(max(version_no), 0) + 1
      into v_version
      from public.inventory_warranty_versions
     where store_id = p_store_id and sale_order_id = v_order_id;
    insert into public.inventory_warranty_versions(
      store_id, sale_order_id, version_no, basis, months, starts_at, ends_at,
      reason, supersedes_version_no, actor_id, created_at
    ) values (
      p_store_id, v_order_id, v_version, 'commercial', v_months, v_start, v_end,
      'pickup_confirmed', nullif(v_version - 1, 0), p_actor_id, v_now
    );
    update public.inventory_items
       set sold_at = coalesce(sold_at, v_order.sold_at),
           warranty_start = v_start,
           warranty_until = v_end,
           warranty_months = v_months,
           updated_by = p_actor_id,
           updated_at = v_now
     where store_id = p_store_id and id = v_order.inventory_item_id;
    v_result := jsonb_build_object(
      'ok', true, 'code', 'confirmed', 'sale_order_id', v_order_id,
      'actual_pickup_at', v_start, 'balance', v_balance,
      'starts_at', v_start, 'ends_at', v_end, 'version_no', v_version,
      'order_version', v_expected_order_version
    );
  elsif v_command = 'reservation.cancel' then
    v_order_id := nullif(v_payload ->> 'sale_order_id', '')::uuid;
    v_expected_order_version := nullif(v_payload ->> 'expected_order_version', '')::bigint;
    v_expected_unit_version := nullif(v_payload ->> 'expected_unit_version', '')::bigint;
    v_disposition := nullif(v_payload ->> 'disposition', '');
    v_reason := nullif(v_payload ->> 'reason', '');
    if v_order_id is null or v_expected_order_version is null
       or v_expected_unit_version is null
       or v_disposition not in ('refund_pending','retain','pending')
       or v_reason is null then
      return jsonb_build_object('ok', false, 'code', 'invalid_payload');
    end if;
    select * into v_order from public.inventory_sale_orders where store_id = p_store_id and id = v_order_id for update;
    if not found or v_order.status <> 'reserved' then return jsonb_build_object('ok', false, 'code', 'invalid_state'); end if;
    if v_order.version <> v_expected_order_version then
      return jsonb_build_object('ok', false, 'code', 'stale_version');
    end if;
    select unit.* into v_unit
      from public.inventory_stock_units unit
     where unit.store_id = p_store_id and unit.id = v_order.stock_unit_id
     for update;
    if not found or v_unit.status::text <> 'reserved' then
      return jsonb_build_object('ok', false, 'code', 'invalid_state');
    end if;
    if v_unit.version <> v_expected_unit_version then
      return jsonb_build_object('ok', false, 'code', 'stale_version');
    end if;
    select item.* into v_item
      from public.inventory_items item
     where item.store_id = p_store_id and item.id = v_order.inventory_item_id
     for update;
    update public.inventory_sale_orders
       set status='cancelled', cancelled_at=v_now,
           cancellation_disposition=v_disposition, cancellation_reason=v_reason,
           version=version+1, updated_by=p_actor_id, updated_at=v_now
     where store_id=p_store_id and id=v_order_id
       and version=v_expected_order_version
     returning version into v_expected_order_version;
    update public.inventory_stock_units
       set status='listed', version=version+1,
           updated_by=p_actor_id, updated_at=v_now
     where store_id=p_store_id and id=v_order.stock_unit_id
       and version=v_expected_unit_version
     returning version into v_expected_unit_version;
    update public.inventory_items
       set status='listed',
           updated_by=p_actor_id, updated_at=v_now
     where store_id=p_store_id and id=v_order.inventory_item_id;
    insert into public.inventory_events(
      id, store_id, item_id, event_type, from_status, to_status, payload,
      operator_user_id, operator_name, created_at
    ) values (
      gen_random_uuid(), p_store_id, v_order.inventory_item_id,
      'reservation_cancelled', v_item.status,
      'listed',
      jsonb_build_object(
        'sale_order_id', v_order_id,
        'disposition', v_disposition,
        'reason', v_reason
      ),
      p_actor_id, v_actor_name, v_now
    );
    v_result := jsonb_build_object(
      'ok', true,
      'code', 'cancelled',
      'sale_order_id', v_order_id,
      'disposition', v_disposition,
      'order_version', v_expected_order_version,
      'unit_version', v_expected_unit_version
    );
  elsif v_command = 'warranty.adjust' then
    v_order_id := nullif(v_payload ->> 'sale_order_id', '')::uuid;
    v_expected_order_version := nullif(v_payload ->> 'expected_order_version', '')::bigint;
    v_expected_warranty_version := nullif(v_payload ->> 'expected_warranty_version', '')::integer;
    v_months := nullif(v_payload ->> 'months', '')::integer;
    v_reason := nullif(v_payload ->> 'reason', '');
    if v_order_id is null or v_expected_order_version is null
       or v_expected_warranty_version is null
       or v_months is null or v_months < 0 or v_months > 120
       or v_reason is null then
      return jsonb_build_object('ok', false, 'code', 'invalid_payload');
    end if;
    select * into v_order from public.inventory_sale_orders where store_id=p_store_id and id=v_order_id for update;
    if not found or v_order.status <> 'sold' or v_order.actual_pickup_at is null then return jsonb_build_object('ok', false, 'code', 'invalid_state'); end if;
    if v_order.version <> v_expected_order_version then
      return jsonb_build_object('ok', false, 'code', 'stale_version');
    end if;
    select coalesce(max(version_no), 0)
      into v_version
      from public.inventory_warranty_versions
     where store_id=p_store_id and sale_order_id=v_order_id;
    if v_version <> v_expected_warranty_version then
      return jsonb_build_object('ok', false, 'code', 'stale_version');
    end if;
    v_start := coalesce(nullif(v_payload ->> 'starts_at','')::timestamptz, v_order.actual_pickup_at);
    if v_start < v_order.actual_pickup_at then
      return jsonb_build_object('ok', false, 'code', 'invalid_schedule');
    end if;
    v_version := v_version + 1;
    v_end := case when v_start is null or v_months = 0 then null else v_start + pg_catalog.make_interval(months => v_months) end;
    insert into public.inventory_warranty_versions(store_id,sale_order_id,version_no,basis,months,starts_at,ends_at,reason,supersedes_version_no,actor_id,created_at)
    values(p_store_id,v_order_id,v_version,'commercial',v_months,v_start,v_end,v_reason,nullif(v_version - 1, 0),p_actor_id,v_now);
    update public.inventory_items
       set warranty_start = v_start,
           warranty_until = v_end,
           warranty_months = v_months,
           updated_by = p_actor_id,
           updated_at = v_now
     where store_id = p_store_id and id = v_order.inventory_item_id;
    update public.inventory_sale_orders
       set version = version + 1,
           updated_by = p_actor_id,
           updated_at = v_now
     where store_id = p_store_id and id = v_order_id
       and version = v_expected_order_version
     returning version into v_expected_order_version;
    v_result := jsonb_build_object(
      'ok', true,
      'code', 'adjusted',
      'sale_order_id', v_order_id,
      'version_no', v_version,
      'starts_at', v_start,
      'ends_at', v_end,
      'order_version', v_expected_order_version
    );
  elsif v_command = 'after_sales.create' then
    v_order_id := nullif(v_payload ->> 'sale_order_id', '')::uuid;
    v_expected_order_version := nullif(v_payload ->> 'expected_order_version', '')::bigint;
    v_reason := nullif(v_payload ->> 'issue_summary', '');
    if v_order_id is null or v_expected_order_version is null or v_reason is null then
      return jsonb_build_object('ok', false, 'code', 'invalid_payload');
    end if;
    select * into v_order from public.inventory_sale_orders where store_id=p_store_id and id=v_order_id for update;
    if not found or v_order.status <> 'sold' or v_order.actual_pickup_at is null then
      return jsonb_build_object('ok', false, 'code', 'invalid_state');
    end if;
    if v_order.version <> v_expected_order_version then
      return jsonb_build_object('ok', false, 'code', 'stale_version');
    end if;
    v_start := coalesce(nullif(v_payload ->> 'received_at','')::timestamptz,v_now);
    if v_start < v_order.actual_pickup_at or v_start > v_now + interval '5 minutes' then
      return jsonb_build_object('ok', false, 'code', 'invalid_schedule');
    end if;
    insert into public.inventory_after_sales_cases(store_id,sale_order_id,inventory_item_id,status,issue_summary,coverage_decision,received_at,created_by,updated_by,created_at,updated_at)
    values(p_store_id,v_order_id,v_order.inventory_item_id,'open',v_reason,coalesce(nullif(v_payload ->> 'coverage_decision',''),'pending'),v_start,p_actor_id,p_actor_id,v_now,v_now)
    returning * into v_case;
    insert into public.inventory_after_sales_events(store_id,case_id,event_type,to_status,payload,occurred_at,actor_id)
    values(p_store_id,v_case.id,'created','open',jsonb_build_object('issue_summary',v_reason),v_start,p_actor_id);
    update public.inventory_sale_orders
       set version=version+1, updated_by=p_actor_id, updated_at=v_now
     where store_id=p_store_id and id=v_order_id
       and version=v_expected_order_version
     returning version into v_expected_order_version;
    v_case_id := v_case.id;
    v_result := jsonb_build_object(
      'ok', true,
      'code', 'created',
      'case_id', v_case_id,
      'case_version', v_case.version,
      'sale_order_id', v_order_id,
      'order_version', v_expected_order_version
    );
  elsif v_command in ('after_sales.update', 'after_sales.close') then
    v_case_id := nullif(v_payload ->> 'case_id', '')::uuid;
    v_expected_case_version := nullif(v_payload ->> 'expected_case_version', '')::bigint;
    v_target_status := case when v_command = 'after_sales.close' then 'closed' else nullif(v_payload ->> 'status','') end;
    if v_case_id is null or v_expected_case_version is null or v_target_status is null then
      return jsonb_build_object('ok', false, 'code', 'invalid_payload');
    end if;
    select * into v_case from public.inventory_after_sales_cases where store_id=p_store_id and id=v_case_id for update;
    if not found or v_case.status = 'closed' then return jsonb_build_object('ok', false, 'code', 'invalid_state'); end if;
    if v_case.version <> v_expected_case_version then
      return jsonb_build_object('ok', false, 'code', 'stale_version');
    end if;
    if v_target_status not in ('open','in_progress','waiting_customer','returned','closed') then return jsonb_build_object('ok', false, 'code', 'invalid_payload'); end if;
    if not (
      (v_case.status = 'open' and v_target_status in ('in_progress','waiting_customer','returned','closed'))
      or (v_case.status = 'in_progress' and v_target_status in ('waiting_customer','returned','closed'))
      or (v_case.status = 'waiting_customer' and v_target_status in ('in_progress','returned','closed'))
      or (v_case.status = 'returned' and v_target_status = 'closed')
    ) then
      return jsonb_build_object('ok', false, 'code', 'invalid_transition');
    end if;
    v_start := case
      when v_target_status='returned'
        then coalesce(nullif(v_payload ->> 'returned_at','')::timestamptz,v_now)
      else v_case.returned_at
    end;
    if v_start is not null and v_start < v_case.received_at then
      return jsonb_build_object('ok', false, 'code', 'invalid_schedule');
    end if;
    update public.inventory_after_sales_cases
       set status=v_target_status,
           diagnosis=coalesce(nullif(v_payload ->> 'diagnosis',''), diagnosis),
           coverage_decision=coalesce(nullif(v_payload ->> 'coverage_decision',''), coverage_decision),
           returned_at=v_start,
           closed_at=case when v_target_status='closed' then v_now else closed_at end,
           version=version+1, updated_by=p_actor_id, updated_at=v_now
     where store_id=p_store_id and id=v_case_id
       and version=v_expected_case_version
     returning version into v_expected_case_version;
    insert into public.inventory_after_sales_events(store_id,case_id,event_type,from_status,to_status,payload,occurred_at,actor_id)
    values(p_store_id,v_case_id,case when v_target_status='closed' then 'closed' else 'status_changed' end,v_case.status,v_target_status,jsonb_build_object('diagnosis',nullif(v_payload ->> 'diagnosis',''),'coverage_decision',nullif(v_payload ->> 'coverage_decision','')),v_now,p_actor_id);
    v_result := jsonb_build_object(
      'ok', true,
      'code', 'updated',
      'case_id', v_case_id,
      'case_version', v_expected_case_version,
      'status', v_target_status
    );
  end if;

  insert into public.inventory_lifecycle_command_ledger(
    store_id,idempotency_key,request_hash,command,actor_id,inventory_item_id,stock_unit_id,sale_order_id,after_sales_case_id,result,created_at
  ) values (
    p_store_id,p_idempotency_key,v_request_hash,v_command,p_actor_id,
    coalesce(v_item_id, (v_order.inventory_item_id)),
    coalesce(v_stock_unit_id, v_order.stock_unit_id),
    v_order_id, v_case_id, v_result, v_now
  );
  insert into public.audit_logs(id,actor_id,actor_name,store_id,action,entity_type,entity_id,metadata,created_at)
  values(gen_random_uuid()::text,p_actor_id,coalesce(v_actor_name,'Staff'),p_store_id,
    'inventory_lifecycle_' || replace(v_command,'.','_'), 'inventory_product',
    coalesce(
      v_item_id::text,
      v_order.inventory_item_id::text,
      v_case.inventory_item_id::text,
      p_store_id::text
    ),
    jsonb_build_object(
      'command', v_command,
      'idempotency_key', p_idempotency_key,
      'result_code', v_result ->> 'code'
    ) || case
      when v_command = 'pickup.confirm' and v_balance > 0 then
        jsonb_build_object(
          'override_reason', btrim(v_payload ->> 'override_reason'),
          'outstanding_balance', v_balance
        )
      else '{}'::jsonb
    end,
    v_now);
  return v_result;
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'conflict');
  when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  when others then
    return jsonb_build_object('ok', false, 'code', 'internal_error');
end;
$$;

-- Runtime EXECUTE is deliberately withheld in this expand migration. The
-- linked enable migration performs the production preflight and grants only
-- service_role after schema/RLS/recovery gates pass.
revoke all on function public.repairdesk_inventory_lifecycle_command(uuid, uuid, text, uuid, jsonb)
  from public, anon, authenticated, service_role;

comment on function public.repairdesk_inventory_lifecycle_command(uuid, uuid, text, uuid, jsonb)
  is 'Service-role-only atomic inventory lifecycle command boundary. Valid commands: acquisition.save, inspection.save, reservation.create, payment.append, sale.complete, pickup.confirm, reservation.cancel, warranty.adjust, after_sales.create, after_sales.update, after_sales.close. Browser callers must never supply actor/store identity.';

notify pgrst, 'reload schema';
reset statement_timeout;
reset lock_timeout;
