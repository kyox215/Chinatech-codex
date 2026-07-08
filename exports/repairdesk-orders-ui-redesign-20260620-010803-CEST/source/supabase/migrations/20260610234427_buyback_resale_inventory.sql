do $$
begin
  create type public.staff_role as enum ('owner', 'manager', 'technician', 'sales', 'viewer');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.staff_status as enum ('active', 'inactive');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.inventory_item_status as enum (
    'intake',
    'evaluating',
    'offer_made',
    'purchased',
    'data_wipe',
    'refurbishing',
    'ready_for_sale',
    'listed',
    'reserved',
    'sold',
    'cancelled',
    'returned',
    'recycled'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.inventory_cosmetic_grade as enum (
    'unknown',
    'new',
    'mint',
    'good',
    'fair',
    'poor',
    'for_parts'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.inventory_functional_grade as enum (
    'untested',
    'passed',
    'needs_repair',
    'failed',
    'for_parts'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.inventory_check_status as enum ('unchecked', 'pass', 'fail', 'unknown');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.inventory_transaction_type as enum (
    'buyback_payment',
    'sale_payment',
    'refund',
    'repair_cost',
    'fee',
    'adjustment'
  );
exception when duplicate_object then null;
end $$;

create sequence if not exists public.inventory_item_public_no_seq start with 1000;

create table if not exists public.staff_profiles (
  id uuid primary key,
  email text not null unique,
  display_name text not null,
  role public.staff_role not null default 'viewer',
  status public.staff_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_profiles_user_fkey
    foreign key (id) references auth.users(id)
    on update cascade on delete cascade
);

create table if not exists public.audit_logs (
  id text primary key,
  actor_id uuid,
  actor_email text,
  actor_name text not null default 'system',
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_before_object
    check (before_data is null or jsonb_typeof(before_data) = 'object'),
  constraint audit_logs_after_object
    check (after_data is null or jsonb_typeof(after_data) = 'object'),
  constraint audit_logs_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.inventory_items (
  id text primary key,
  public_no text not null unique default (
    'I' || lpad(nextval('public.inventory_item_public_no_seq')::text, 6, '0')
  ),
  status public.inventory_item_status not null default 'intake',
  source_type text not null default 'buyback',
  source_ref text,
  legacy_source text,
  customer_id text,
  buyer_customer_id text,
  category text not null default 'phone',
  brand text not null default '',
  model text not null default '',
  color text,
  storage_capacity text,
  serial_or_imei text,
  imei_check_status public.inventory_check_status not null default 'unchecked',
  activation_lock_status public.inventory_check_status not null default 'unchecked',
  data_wipe_status public.inventory_check_status not null default 'unchecked',
  cosmetic_grade public.inventory_cosmetic_grade not null default 'unknown',
  functional_grade public.inventory_functional_grade not null default 'untested',
  battery_health numeric(5, 2) check (battery_health is null or (battery_health >= 0 and battery_health <= 100)),
  buyback_price numeric(12, 2) not null default 0 check (buyback_price >= 0),
  list_price numeric(12, 2) not null default 0 check (list_price >= 0),
  sale_price numeric(12, 2) not null default 0 check (sale_price >= 0),
  deposit_amount numeric(12, 2) not null default 0 check (deposit_amount >= 0),
  repair_cost_amount numeric(12, 2) not null default 0 check (repair_cost_amount >= 0),
  fees_amount numeric(12, 2) not null default 0 check (fees_amount >= 0),
  currency_code text not null default 'EUR',
  payment_method text,
  sale_channel text,
  warranty_months integer not null default 12 check (warranty_months >= 0),
  warranty_until timestamptz,
  purchased_at timestamptz,
  listed_at timestamptz,
  sold_at timestamptz,
  returned_at timestamptz,
  recycled_at timestamptz,
  cancelled_at timestamptz,
  notes text,
  legacy_payload jsonb not null default '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_items_customer_id_fkey
    foreign key (customer_id) references public.customers(id)
    on update cascade on delete set null,
  constraint inventory_items_buyer_customer_id_fkey
    foreign key (buyer_customer_id) references public.customers(id)
    on update cascade on delete set null,
  constraint inventory_items_created_by_fkey
    foreign key (created_by) references public.staff_profiles(id)
    on update cascade on delete set null,
  constraint inventory_items_updated_by_fkey
    foreign key (updated_by) references public.staff_profiles(id)
    on update cascade on delete set null,
  constraint inventory_items_currency_eur check (currency_code = 'EUR'),
  constraint inventory_items_legacy_payload_object check (jsonb_typeof(legacy_payload) = 'object')
);

create table if not exists public.inventory_quality_checks (
  id text primary key,
  item_id text not null,
  screen_status public.inventory_check_status not null default 'unchecked',
  touch_status public.inventory_check_status not null default 'unchecked',
  camera_status public.inventory_check_status not null default 'unchecked',
  buttons_status public.inventory_check_status not null default 'unchecked',
  ports_status public.inventory_check_status not null default 'unchecked',
  speaker_status public.inventory_check_status not null default 'unchecked',
  microphone_status public.inventory_check_status not null default 'unchecked',
  wifi_status public.inventory_check_status not null default 'unchecked',
  bluetooth_status public.inventory_check_status not null default 'unchecked',
  cellular_status public.inventory_check_status not null default 'unchecked',
  battery_health numeric(5, 2) check (battery_health is null or (battery_health >= 0 and battery_health <= 100)),
  cosmetic_grade public.inventory_cosmetic_grade not null default 'unknown',
  functional_grade public.inventory_functional_grade not null default 'untested',
  imei_check_status public.inventory_check_status not null default 'unchecked',
  activation_lock_status public.inventory_check_status not null default 'unchecked',
  data_wipe_status public.inventory_check_status not null default 'unchecked',
  notes text,
  checked_by uuid,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint inventory_quality_checks_item_id_fkey
    foreign key (item_id) references public.inventory_items(id)
    on update cascade on delete cascade,
  constraint inventory_quality_checks_checked_by_fkey
    foreign key (checked_by) references public.staff_profiles(id)
    on update cascade on delete set null
);

create table if not exists public.inventory_transactions (
  id text primary key,
  item_id text not null,
  transaction_type public.inventory_transaction_type not null,
  amount numeric(12, 2) not null default 0 check (amount >= 0),
  currency_code text not null default 'EUR',
  method text,
  note text,
  actor_id uuid,
  created_at timestamptz not null default now(),
  constraint inventory_transactions_item_id_fkey
    foreign key (item_id) references public.inventory_items(id)
    on update cascade on delete cascade,
  constraint inventory_transactions_actor_id_fkey
    foreign key (actor_id) references public.staff_profiles(id)
    on update cascade on delete set null,
  constraint inventory_transactions_currency_eur check (currency_code = 'EUR')
);

create table if not exists public.inventory_events (
  id text primary key,
  item_id text not null,
  event_type text not null,
  from_status public.inventory_item_status,
  to_status public.inventory_item_status,
  payload jsonb not null default '{}'::jsonb,
  operator_user_id uuid,
  operator_name text not null default 'system',
  operator_email text,
  created_at timestamptz not null default now(),
  constraint inventory_events_item_id_fkey
    foreign key (item_id) references public.inventory_items(id)
    on update cascade on delete cascade,
  constraint inventory_events_operator_user_id_fkey
    foreign key (operator_user_id) references public.staff_profiles(id)
    on update cascade on delete set null,
  constraint inventory_events_payload_object check (jsonb_typeof(payload) = 'object')
);

create index if not exists staff_profiles_email_idx on public.staff_profiles (lower(email));
create index if not exists staff_profiles_status_idx on public.staff_profiles (status);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index if not exists audit_logs_actor_created_idx on public.audit_logs (actor_id, created_at desc);
create index if not exists inventory_items_status_idx on public.inventory_items (status);
create index if not exists inventory_items_customer_id_idx on public.inventory_items (customer_id);
create index if not exists inventory_items_buyer_customer_id_idx on public.inventory_items (buyer_customer_id);
create index if not exists inventory_items_updated_at_idx on public.inventory_items (updated_at desc);
create index if not exists inventory_items_public_no_idx on public.inventory_items (public_no);
create index if not exists inventory_items_serial_idx on public.inventory_items (serial_or_imei);
create index if not exists inventory_quality_checks_item_created_idx
  on public.inventory_quality_checks (item_id, created_at desc);
create index if not exists inventory_transactions_item_created_idx
  on public.inventory_transactions (item_id, created_at desc);
create index if not exists inventory_events_item_created_idx
  on public.inventory_events (item_id, created_at desc);

alter table public.staff_profiles enable row level security;
alter table public.audit_logs enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_quality_checks enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.inventory_events enable row level security;

revoke all on table public.staff_profiles from anon, authenticated;
revoke all on table public.audit_logs from anon, authenticated;
revoke all on table public.inventory_items from anon, authenticated;
revoke all on table public.inventory_quality_checks from anon, authenticated;
revoke all on table public.inventory_transactions from anon, authenticated;
revoke all on table public.inventory_events from anon, authenticated;
revoke all on sequence public.inventory_item_public_no_seq from anon, authenticated;

grant usage on schema public to service_role;
grant all on table public.staff_profiles to service_role;
grant all on table public.audit_logs to service_role;
grant all on table public.inventory_items to service_role;
grant all on table public.inventory_quality_checks to service_role;
grant all on table public.inventory_transactions to service_role;
grant all on table public.inventory_events to service_role;
grant usage, select on sequence public.inventory_item_public_no_seq to service_role;
