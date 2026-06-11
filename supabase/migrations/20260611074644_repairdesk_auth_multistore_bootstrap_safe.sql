create extension if not exists pgcrypto with schema extensions;

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

alter table public.stores add column if not exists slug text;
alter table public.stores add column if not exists owner_user_id uuid;
alter table public.stores add column if not exists status public.store_status not null default 'active';
alter table public.stores add column if not exists plan public.store_plan not null default 'starter';
alter table public.stores add column if not exists currency_code text not null default 'EUR';
alter table public.stores add column if not exists updated_at timestamptz not null default now();

update public.stores
set slug = 'chinatech-default'
where slug is null
  and lower(name) = 'chinatech';

update public.stores
set slug = 'store-' || left(replace(id::text, '-', ''), 12)
where slug is null
   or length(trim(slug)) < 3;

create unique index if not exists stores_slug_unique_idx on public.stores (slug);
create index if not exists stores_owner_idx on public.stores (owner_user_id);

do $$
begin
  alter table public.stores
    add constraint stores_owner_user_fkey
    foreign key (owner_user_id) references auth.users(id)
    on update cascade on delete set null;
exception when duplicate_object then null;
end $$;

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

create table if not exists public.audit_logs (
  id text primary key,
  actor_id uuid,
  actor_email text,
  actor_name text not null default 'system',
  store_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_store_id_fkey
    foreign key (store_id) references public.stores(id)
    on update cascade on delete set null,
  constraint audit_logs_before_object
    check (before_data is null or jsonb_typeof(before_data) = 'object'),
  constraint audit_logs_after_object
    check (after_data is null or jsonb_typeof(after_data) = 'object'),
  constraint audit_logs_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists staff_profiles_email_idx on public.staff_profiles (lower(email));
create index if not exists staff_profiles_status_idx on public.staff_profiles (status);
create index if not exists store_memberships_user_status_idx
  on public.store_memberships (user_id, status);
create index if not exists store_memberships_store_role_idx
  on public.store_memberships (store_id, role, status);
create index if not exists store_invitations_store_email_idx
  on public.store_invitations (store_id, lower(email));
create unique index if not exists store_invitations_pending_email_unique
  on public.store_invitations (store_id, lower(email))
  where status = 'invited';
create index if not exists audit_logs_store_entity_idx
  on public.audit_logs (store_id, entity_type, entity_id, created_at desc);
create index if not exists audit_logs_actor_created_idx on public.audit_logs (actor_id, created_at desc);

alter table public.staff_profiles enable row level security;
alter table public.store_memberships enable row level security;
alter table public.store_invitations enable row level security;
alter table public.audit_logs enable row level security;

grant all on table public.staff_profiles to service_role;
grant all on table public.store_memberships to service_role;
grant all on table public.store_invitations to service_role;
grant all on table public.audit_logs to service_role;

select pg_notify('pgrst', 'reload schema');
