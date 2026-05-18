alter table public.customers
  add column if not exists email text,
  add column if not exists preferred_channel public.message_channel not null default 'whatsapp',
  add column if not exists language text not null default 'it',
  add column if not exists last_contacted_at timestamptz,
  add column if not exists marketing_notes text,
  add column if not exists blacklisted_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customers_language_supported'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_language_supported
      check (language in ('it', 'zh', 'en'));
  end if;
end $$;

create unique index if not exists customers_phone_raw_unique_idx
  on public.customers (phone_raw);

alter table public.repair_orders
  add column if not exists device_snapshot jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'repair_orders_device_snapshot_object'
      and conrelid = 'public.repair_orders'::regclass
  ) then
    alter table public.repair_orders
      add constraint repair_orders_device_snapshot_object
      check (jsonb_typeof(device_snapshot) = 'object');
  end if;
end $$;

update public.repair_orders ro
set device_snapshot = jsonb_build_object(
  'brand', d.brand,
  'model', d.model,
  'serial_or_imei', d.serial_or_imei,
  'device_notes', d.device_notes
)
from public.devices d
where ro.device_id = d.id
  and ro.device_snapshot = '{}'::jsonb;

create table if not exists public.customer_tags (
  id text primary key,
  name text not null unique,
  color text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_tag_assignments (
  customer_id text not null,
  tag_id text not null,
  created_at timestamptz not null default now(),
  primary key (customer_id, tag_id),
  constraint customer_tag_assignments_customer_id_fkey
    foreign key (customer_id) references public.customers(id)
    on update cascade on delete cascade,
  constraint customer_tag_assignments_tag_id_fkey
    foreign key (tag_id) references public.customer_tags(id)
    on update cascade on delete cascade
);

create table if not exists public.customer_interactions (
  id text primary key,
  customer_id text not null,
  order_id text,
  channel public.message_channel not null,
  direction text not null default 'outbound',
  message_body text not null,
  status public.message_status not null default 'sent',
  operator_name text not null default '前台',
  created_at timestamptz not null default now(),
  constraint customer_interactions_customer_id_fkey
    foreign key (customer_id) references public.customers(id)
    on update cascade on delete cascade,
  constraint customer_interactions_order_id_fkey
    foreign key (order_id) references public.repair_orders(id)
    on update cascade on delete set null,
  constraint customer_interactions_direction_check
    check (direction in ('outbound', 'inbound', 'note'))
);

create table if not exists public.customer_followups (
  id text primary key,
  customer_id text not null,
  order_id text,
  title text not null,
  note text,
  due_at timestamptz not null,
  owner_name text,
  status text not null default 'open',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_followups_customer_id_fkey
    foreign key (customer_id) references public.customers(id)
    on update cascade on delete cascade,
  constraint customer_followups_order_id_fkey
    foreign key (order_id) references public.repair_orders(id)
    on update cascade on delete set null,
  constraint customer_followups_status_check
    check (status in ('open', 'done', 'cancelled'))
);

create index if not exists customer_tag_assignments_tag_id_idx
  on public.customer_tag_assignments (tag_id);
create index if not exists customer_interactions_customer_created_idx
  on public.customer_interactions (customer_id, created_at desc);
create index if not exists customer_interactions_order_id_idx
  on public.customer_interactions (order_id);
create index if not exists customer_followups_customer_due_idx
  on public.customer_followups (customer_id, due_at asc);
create index if not exists customer_followups_status_due_idx
  on public.customer_followups (status, due_at asc);
create index if not exists repair_orders_device_snapshot_gin_idx
  on public.repair_orders using gin (device_snapshot);

alter table public.customer_tags enable row level security;
alter table public.customer_tag_assignments enable row level security;
alter table public.customer_interactions enable row level security;
alter table public.customer_followups enable row level security;

revoke all on table public.customer_tags from anon, authenticated;
revoke all on table public.customer_tag_assignments from anon, authenticated;
revoke all on table public.customer_interactions from anon, authenticated;
revoke all on table public.customer_followups from anon, authenticated;

grant all on table public.customer_tags to service_role;
grant all on table public.customer_tag_assignments to service_role;
grant all on table public.customer_interactions to service_role;
grant all on table public.customer_followups to service_role;

insert into public.customer_tags (id, name, color, description)
values
  ('tag_vip', 'VIP', '#8b5cf6', '高价值客户'),
  ('tag_repeat', '复购', '#10b981', '多次维修客户'),
  ('tag_business', '企业', '#0ea5e9', '企业或批量客户'),
  ('tag_price_sensitive', '价格敏感', '#f59e0b', '需要提前明确报价'),
  ('tag_followup', '需回访', '#ef4444', '需要主动回访')
on conflict (id) do update
set name = excluded.name,
    color = excluded.color,
    description = excluded.description,
    updated_at = now();
