-- Minimal Phase 1 schema used only to syntax/behavior-test the additive Phase 2 migration
-- when the repository's known legacy replay blocker prevents a full `supabase start`.

create extension if not exists pgcrypto;
create schema if not exists auth;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$$;

create type public.staff_role as enum ('owner', 'manager', 'technician', 'sales', 'viewer');

create table if not exists auth.users (
  id uuid primary key,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stores (
  id uuid primary key,
  name text not null,
  status text not null default 'active'
);

create table public.staff_profiles (
  id uuid primary key references auth.users(id),
  email text,
  display_name text,
  role public.staff_role not null,
  status text not null default 'active'
);

create table public.store_memberships (
  id uuid primary key,
  store_id uuid not null references public.stores(id),
  user_id uuid not null references auth.users(id),
  email text,
  display_name text,
  role public.staff_role not null,
  status text not null default 'active',
  updated_at timestamptz not null default now(),
  unique (id, store_id)
);

create table public.store_member_permission_grants (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  membership_id uuid not null,
  user_id uuid not null references auth.users(id),
  action text not null,
  granted_by uuid references auth.users(id),
  revoked_by uuid references auth.users(id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_member_permission_grants_membership_store_fkey
    foreign key (membership_id, store_id)
    references public.store_memberships(id, store_id),
  constraint store_member_permission_grants_action_check
    check (action in (
      'supplier:read', 'supplier:assign', 'supplier:manage', 'order:archive_browse',
      'finance:aggregate_read', 'finance:profit_read', 'finance:cost_manage'
    ))
);

create unique index store_member_permission_grants_active_unique_idx
  on public.store_member_permission_grants (store_id, membership_id, action)
  where revoked_at is null;

create table public.repair_orders (
  id uuid primary key,
  store_id uuid not null references public.stores(id),
  fault_prices jsonb not null default '[]'::jsonb,
  record_state text not null default 'active',
  deleted_at timestamptz,
  unique (id, store_id)
);

create table public.audit_logs (
  id text primary key,
  actor_id uuid,
  actor_email text,
  actor_name text,
  store_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table public.store_fault_cost_defaults (
  store_id uuid not null,
  catalog_key text not null,
  catalog_name text not null,
  default_cost_amount numeric(12, 2),
  currency_code text not null default 'EUR',
  revision bigint not null,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (store_id, catalog_key),
  foreign key (store_id) references public.stores(id),
  constraint store_fault_cost_defaults_catalog_key_check
    check (catalog_key ~ '^[a-z0-9][a-z0-9_-]{0,63}:[a-z0-9][a-z0-9_-]{0,63}$'),
  constraint store_fault_cost_defaults_catalog_name_check
    check (char_length(btrim(catalog_name)) between 1 and 120),
  constraint store_fault_cost_defaults_amount_check
    check (default_cost_amount is null or default_cost_amount between 0 and 999999.99),
  constraint store_fault_cost_defaults_currency_check check (currency_code = 'EUR'),
  constraint store_fault_cost_defaults_revision_check check (revision >= 1)
);

create table public.repair_order_line_costs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  order_id uuid not null,
  line_id uuid not null,
  catalog_key text,
  cost_amount numeric(12, 2),
  currency_code text not null default 'EUR',
  source text not null default 'store_default',
  is_active boolean not null default true,
  revision bigint not null,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, order_id, line_id),
  foreign key (order_id, store_id) references public.repair_orders(id, store_id),
  constraint repair_order_line_costs_catalog_key_check
    check (catalog_key is null or catalog_key ~ '^[a-z0-9][a-z0-9_-]{0,63}:[a-z0-9][a-z0-9_-]{0,63}$'),
  constraint repair_order_line_costs_amount_check
    check (cost_amount is null or cost_amount between 0 and 999999.99),
  constraint repair_order_line_costs_currency_check check (currency_code = 'EUR'),
  constraint repair_order_line_costs_source_check
    check (source in ('store_default', 'manual', 'manual_blank')),
  constraint repair_order_line_costs_source_amount_check
    check (
      (source = 'manual' and cost_amount is not null)
      or (source = 'manual_blank' and cost_amount is null)
      or source = 'store_default'
    ),
  constraint repair_order_line_costs_revision_check check (revision >= 1)
);

create or replace function public.repairdesk_actor_can_manage_order_costs(
  p_store_id uuid,
  p_actor_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_profiles as profile
    join public.store_memberships as membership
      on membership.user_id = profile.id
     and membership.store_id = p_store_id
     and membership.status = 'active'
    join public.stores as store_row
      on store_row.id = membership.store_id
     and store_row.status = 'active'
    where profile.id = p_actor_id
      and profile.status = 'active'
      and (
        membership.role = 'owner'
        or (
          membership.role = 'manager'
          and exists (
            select 1 from public.store_member_permission_grants as grant_row
            where grant_row.store_id = p_store_id
              and grant_row.membership_id = membership.id
              and grant_row.user_id = p_actor_id
              and grant_row.action = 'finance:cost_manage'
              and grant_row.revoked_at is null
          )
        )
      )
  );
$$;

create or replace function public.repairdesk_actor_can_read_order_costs(
  p_store_id uuid,
  p_actor_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.repairdesk_actor_can_manage_order_costs(p_store_id, p_actor_id)
    or exists (
      select 1
      from public.staff_profiles as profile
      join public.store_memberships as membership
        on membership.user_id = profile.id
       and membership.store_id = p_store_id
       and membership.status = 'active'
      join public.store_member_permission_grants as grant_row
        on grant_row.store_id = membership.store_id
       and grant_row.membership_id = membership.id
       and grant_row.user_id = profile.id
       and grant_row.action = 'finance:profit_read'
       and grant_row.revoked_at is null
      where profile.id = p_actor_id
        and profile.status = 'active'
        and membership.role = 'manager'
    );
$$;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000008001', 'owner@example.test'),
  ('00000000-0000-4000-8000-000000008002', 'manager@example.test'),
  ('00000000-0000-4000-8000-000000008003', 'tech@example.test');

insert into public.stores (id, name) values
  ('00000000-0000-4000-8000-000000008000', 'Cost Phase 2');

insert into public.staff_profiles (id, email, display_name, role) values
  ('00000000-0000-4000-8000-000000008001', 'owner@example.test', 'Owner', 'owner'),
  ('00000000-0000-4000-8000-000000008002', 'manager@example.test', 'Manager', 'manager'),
  ('00000000-0000-4000-8000-000000008003', 'tech@example.test', 'Tech', 'technician');

insert into public.store_memberships (id, store_id, user_id, email, display_name, role) values
  ('00000000-0000-4000-8000-000000008011', '00000000-0000-4000-8000-000000008000', '00000000-0000-4000-8000-000000008001', 'owner@example.test', 'Owner', 'owner'),
  ('00000000-0000-4000-8000-000000008012', '00000000-0000-4000-8000-000000008000', '00000000-0000-4000-8000-000000008002', 'manager@example.test', 'Manager', 'manager'),
  ('00000000-0000-4000-8000-000000008013', '00000000-0000-4000-8000-000000008000', '00000000-0000-4000-8000-000000008003', 'tech@example.test', 'Tech', 'technician');

insert into public.repair_orders (id, store_id, fault_prices) values (
  '00000000-0000-4000-8000-000000008101',
  '00000000-0000-4000-8000-000000008000',
  '[{"line_id":"00000000-0000-4000-8000-000000008201","catalog_key":"phone:screen","name":"Screen","price":100,"currency_code":"EUR"}]'::jsonb
);

insert into public.store_fault_cost_defaults (
  store_id, catalog_key, catalog_name, default_cost_amount, revision, updated_by
) values (
  '00000000-0000-4000-8000-000000008000',
  'phone:screen', 'Screen', 15, 1,
  '00000000-0000-4000-8000-000000008001'
);

insert into public.repair_order_line_costs (
  store_id, order_id, line_id, catalog_key, cost_amount, source,
  is_active, revision, created_by, updated_by
) values (
  '00000000-0000-4000-8000-000000008000',
  '00000000-0000-4000-8000-000000008101',
  '00000000-0000-4000-8000-000000008201',
  'phone:screen', 15, 'store_default', true, 1,
  '00000000-0000-4000-8000-000000008001',
  '00000000-0000-4000-8000-000000008001'
);
