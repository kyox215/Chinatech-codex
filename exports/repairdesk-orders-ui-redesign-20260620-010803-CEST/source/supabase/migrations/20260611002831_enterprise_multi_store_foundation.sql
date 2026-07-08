create extension if not exists pgcrypto with schema extensions;

do $$
begin
  create type public.store_status as enum ('active', 'suspended', 'deleted');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.store_plan as enum ('starter', 'pro', 'enterprise');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.store_membership_status as enum ('active', 'invited', 'inactive');
exception when duplicate_object then null;
end $$;

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_user_id uuid,
  status public.store_status not null default 'active',
  plan public.store_plan not null default 'starter',
  timezone text not null default 'Europe/Rome',
  currency_code text not null default 'EUR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stores_owner_user_fkey
    foreign key (owner_user_id) references auth.users(id)
    on update cascade on delete set null,
  constraint stores_slug_format
    check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$')
);

create table if not exists public.store_memberships (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  user_id uuid not null,
  email text not null,
  display_name text,
  role public.staff_role not null default 'viewer',
  status public.store_membership_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_memberships_store_fkey
    foreign key (store_id) references public.stores(id)
    on update cascade on delete cascade,
  constraint store_memberships_user_fkey
    foreign key (user_id) references auth.users(id)
    on update cascade on delete cascade,
  constraint store_memberships_store_user_unique unique (store_id, user_id)
);

create table if not exists public.store_invitations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  email text not null,
  role public.staff_role not null default 'viewer',
  token_hash text not null unique,
  status public.store_membership_status not null default 'invited',
  invited_by uuid,
  accepted_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_invitations_store_fkey
    foreign key (store_id) references public.stores(id)
    on update cascade on delete cascade,
  constraint store_invitations_invited_by_fkey
    foreign key (invited_by) references auth.users(id)
    on update cascade on delete set null
);

insert into public.stores (id, name, slug, status, plan)
values (
  '00000000-0000-0000-0000-000000000001',
  'ChinaTech',
  'chinatech-default',
  'active',
  'starter'
)
on conflict (id) do nothing;

insert into public.store_memberships (store_id, user_id, email, display_name, role, status)
select
  '00000000-0000-0000-0000-000000000001'::uuid,
  sp.id,
  sp.email,
  sp.display_name,
  sp.role,
  case when sp.status = 'active' then 'active'::public.store_membership_status else 'inactive'::public.store_membership_status end
from public.staff_profiles sp
on conflict (store_id, user_id) do nothing;

alter table public.customers add column if not exists store_id uuid;
alter table public.devices add column if not exists store_id uuid;
alter table public.suppliers add column if not exists store_id uuid;
alter table public.repair_orders add column if not exists store_id uuid;
alter table public.order_events add column if not exists store_id uuid;
alter table public.message_logs add column if not exists store_id uuid;
alter table public.customer_tags add column if not exists store_id uuid;
alter table public.customer_tag_assignments add column if not exists store_id uuid;
alter table public.customer_interactions add column if not exists store_id uuid;
alter table public.customer_followups add column if not exists store_id uuid;
alter table public.inventory_items add column if not exists store_id uuid;
alter table public.inventory_quality_checks add column if not exists store_id uuid;
alter table public.inventory_transactions add column if not exists store_id uuid;
alter table public.inventory_events add column if not exists store_id uuid;
alter table public.audit_logs add column if not exists store_id uuid;
alter table public.store_settings add column if not exists store_id uuid;
alter table public.message_templates add column if not exists store_id uuid;

update public.customers set store_id = '00000000-0000-0000-0000-000000000001' where store_id is null;
update public.devices set store_id = '00000000-0000-0000-0000-000000000001' where store_id is null;
update public.suppliers set store_id = '00000000-0000-0000-0000-000000000001' where store_id is null;
update public.repair_orders set store_id = '00000000-0000-0000-0000-000000000001' where store_id is null;
update public.order_events set store_id = '00000000-0000-0000-0000-000000000001' where store_id is null;
update public.message_logs set store_id = '00000000-0000-0000-0000-000000000001' where store_id is null;
update public.customer_tags set store_id = '00000000-0000-0000-0000-000000000001' where store_id is null;
update public.customer_tag_assignments set store_id = '00000000-0000-0000-0000-000000000001' where store_id is null;
update public.customer_interactions set store_id = '00000000-0000-0000-0000-000000000001' where store_id is null;
update public.customer_followups set store_id = '00000000-0000-0000-0000-000000000001' where store_id is null;
update public.inventory_items set store_id = '00000000-0000-0000-0000-000000000001' where store_id is null;
update public.inventory_quality_checks set store_id = '00000000-0000-0000-0000-000000000001' where store_id is null;
update public.inventory_transactions set store_id = '00000000-0000-0000-0000-000000000001' where store_id is null;
update public.inventory_events set store_id = '00000000-0000-0000-0000-000000000001' where store_id is null;
update public.audit_logs set store_id = '00000000-0000-0000-0000-000000000001' where store_id is null;
update public.store_settings set store_id = '00000000-0000-0000-0000-000000000001' where store_id is null;
update public.message_templates set store_id = '00000000-0000-0000-0000-000000000001' where store_id is null;

do $$
begin
  alter table public.store_settings drop constraint if exists store_settings_singleton;
exception when undefined_object then null;
end $$;

do $$
begin
  alter table public.message_templates drop constraint if exists message_templates_unique_kind;
exception when undefined_object then null;
end $$;

create unique index if not exists store_settings_store_id_unique
  on public.store_settings (store_id)
  where store_id is not null;

create unique index if not exists message_templates_store_kind_unique
  on public.message_templates (store_id, domain, kind, channel, language)
  where store_id is not null;

create index if not exists stores_owner_idx on public.stores (owner_user_id);
create index if not exists store_memberships_user_status_idx
  on public.store_memberships (user_id, status);
create index if not exists store_memberships_store_role_idx
  on public.store_memberships (store_id, role, status);
create index if not exists store_invitations_store_email_idx
  on public.store_invitations (store_id, lower(email));

create index if not exists customers_store_phone_idx on public.customers (store_id, phone_raw);
create index if not exists devices_store_customer_idx on public.devices (store_id, customer_id);
create index if not exists suppliers_store_name_idx on public.suppliers (store_id, lower(name));
create index if not exists repair_orders_store_status_updated_idx
  on public.repair_orders (store_id, status, updated_at desc);
create index if not exists repair_orders_store_customer_updated_idx
  on public.repair_orders (store_id, customer_id, updated_at desc);
create index if not exists repair_orders_store_public_no_idx
  on public.repair_orders (store_id, public_no);
create index if not exists order_events_store_order_created_idx
  on public.order_events (store_id, order_id, created_at desc);
create index if not exists message_logs_store_order_sent_idx
  on public.message_logs (store_id, order_id, sent_at desc);
create index if not exists customer_interactions_store_customer_created_idx
  on public.customer_interactions (store_id, customer_id, created_at desc);
create index if not exists customer_followups_store_due_idx
  on public.customer_followups (store_id, status, due_at asc);
create index if not exists inventory_items_store_status_updated_idx
  on public.inventory_items (store_id, status, updated_at desc);
create index if not exists inventory_items_store_imei_idx
  on public.inventory_items (store_id, serial_or_imei);
create index if not exists audit_logs_store_entity_idx
  on public.audit_logs (store_id, entity_type, entity_id, created_at desc);

alter table public.stores enable row level security;
alter table public.store_memberships enable row level security;
alter table public.store_invitations enable row level security;

revoke all on table public.stores from anon, authenticated;
revoke all on table public.store_memberships from anon, authenticated;
revoke all on table public.store_invitations from anon, authenticated;

grant all on table public.stores to service_role;
grant all on table public.store_memberships to service_role;
grant all on table public.store_invitations to service_role;
