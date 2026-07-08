do $$
begin
  create type public.repair_order_status as enum (
    'new',
    'rework',
    'mail_in_progress',
    'diagnosing',
    'quoted',
    'waiting_approval',
    'parts_ordered',
    'parts_arrived',
    'repairing',
    'repaired',
    'notified',
    'unfixed_pickup',
    'waiting_pickup',
    'completed',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.repair_order_type as enum ('quick_repair', 'dropoff_repair');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.approval_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.message_channel as enum ('whatsapp', 'sms');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.message_status as enum ('sent', 'delivered', 'read', 'failed');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.order_event_type as enum (
    'created',
    'status_changed',
    'quoted',
    'approval_sent',
    'approval_result',
    'payment',
    'note',
    'message_sent',
    'delivered'
  );
exception when duplicate_object then null;
end $$;

create sequence if not exists public.repair_order_public_no_seq start with 2027000;

create table if not exists public.customers (
  id text primary key,
  name text not null,
  phone_e164 text not null,
  phone_raw text not null,
  contact_phones text[] not null default '{}',
  consent_marketing boolean not null default false,
  consent_sms boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.devices (
  id text primary key,
  customer_id text not null,
  brand text not null,
  model text not null,
  serial_or_imei text not null default '',
  device_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint devices_customer_id_fkey
    foreign key (customer_id) references public.customers(id)
    on update cascade on delete restrict
);

create table if not exists public.suppliers (
  id text primary key,
  name text not null,
  short_name text not null,
  color text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.repair_orders (
  id text primary key,
  public_no text not null unique default (
    'R' || lpad(nextval('public.repair_order_public_no_seq')::text, 7, '0')
  ),
  order_type public.repair_order_type not null,
  status public.repair_order_status not null,
  customer_id text not null,
  device_id text not null,
  issue_description text not null,
  diagnosis_result text,
  quotation_amount numeric(12, 2) not null default 0 check (quotation_amount >= 0),
  deposit_amount numeric(12, 2) not null default 0 check (deposit_amount >= 0),
  balance_amount numeric(12, 2) not null default 0 check (balance_amount >= 0),
  is_paid boolean not null default false,
  approval_status public.approval_status not null default 'pending',
  approval_sent_at timestamptz,
  approval_confirmed_at timestamptz,
  technician_name text not null,
  internal_tag text,
  warranty_text text,
  completed_at timestamptz,
  delivered_at timestamptz,
  pause_reason text,
  cancel_reason text,
  supplier_id text,
  original_order_id text,
  contact_phones text[] not null default '{}',
  fault_prices jsonb not null default '[]'::jsonb,
  customer_signature text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint repair_orders_customer_id_fkey
    foreign key (customer_id) references public.customers(id)
    on update cascade on delete restrict,
  constraint repair_orders_device_id_fkey
    foreign key (device_id) references public.devices(id)
    on update cascade on delete restrict,
  constraint repair_orders_supplier_id_fkey
    foreign key (supplier_id) references public.suppliers(id)
    on update cascade on delete set null,
  constraint repair_orders_original_order_id_fkey
    foreign key (original_order_id) references public.repair_orders(id)
    on update cascade on delete set null,
  constraint repair_orders_fault_prices_array
    check (jsonb_typeof(fault_prices) = 'array')
);

create table if not exists public.order_events (
  id text primary key,
  order_id text not null,
  event_type public.order_event_type not null,
  payload jsonb not null default '{}'::jsonb,
  operator_name text not null,
  created_at timestamptz not null default now(),
  constraint order_events_order_id_fkey
    foreign key (order_id) references public.repair_orders(id)
    on update cascade on delete cascade,
  constraint order_events_payload_object
    check (jsonb_typeof(payload) = 'object')
);

create table if not exists public.message_logs (
  id text primary key,
  order_id text not null,
  channel public.message_channel not null,
  message_body text not null,
  status public.message_status not null default 'sent',
  sent_at timestamptz not null default now(),
  opened_at timestamptz,
  constraint message_logs_order_id_fkey
    foreign key (order_id) references public.repair_orders(id)
    on update cascade on delete cascade
);

create index if not exists customers_phone_raw_idx on public.customers (phone_raw);
create index if not exists devices_customer_id_idx on public.devices (customer_id);
create index if not exists repair_orders_customer_id_idx on public.repair_orders (customer_id);
create index if not exists repair_orders_device_id_idx on public.repair_orders (device_id);
create index if not exists repair_orders_supplier_id_idx on public.repair_orders (supplier_id);
create index if not exists repair_orders_status_idx on public.repair_orders (status);
create index if not exists repair_orders_updated_at_idx on public.repair_orders (updated_at desc);
create index if not exists repair_orders_public_no_idx on public.repair_orders (public_no);
create index if not exists order_events_order_id_created_at_idx
  on public.order_events (order_id, created_at desc);
create index if not exists message_logs_order_id_sent_at_idx
  on public.message_logs (order_id, sent_at desc);

alter table public.customers enable row level security;
alter table public.devices enable row level security;
alter table public.suppliers enable row level security;
alter table public.repair_orders enable row level security;
alter table public.order_events enable row level security;
alter table public.message_logs enable row level security;

revoke all on table public.customers from anon, authenticated;
revoke all on table public.devices from anon, authenticated;
revoke all on table public.suppliers from anon, authenticated;
revoke all on table public.repair_orders from anon, authenticated;
revoke all on table public.order_events from anon, authenticated;
revoke all on table public.message_logs from anon, authenticated;
revoke all on sequence public.repair_order_public_no_seq from anon, authenticated;

grant usage on schema public to service_role;
grant all on table public.customers to service_role;
grant all on table public.devices to service_role;
grant all on table public.suppliers to service_role;
grant all on table public.repair_orders to service_role;
grant all on table public.order_events to service_role;
grant all on table public.message_logs to service_role;
grant usage, select on sequence public.repair_order_public_no_seq to service_role;
