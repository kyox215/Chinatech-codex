-- Minimal pre-migration schema for a disposable PostgreSQL 17 database.
create schema if not exists auth;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;

create table auth.users (id uuid primary key);
create table public.stores (id uuid primary key, status text not null default 'active');
create table public.store_lifecycles (
  store_id uuid primary key references public.stores(id) on delete cascade,
  phase text not null default 'active'
);
create table public.staff_profiles (
  id uuid primary key references auth.users(id), status text not null default 'active'
);
create table public.store_memberships (
  id uuid primary key, store_id uuid not null references public.stores(id),
  user_id uuid not null references auth.users(id), role text not null, status text not null default 'active',
  unique(id, store_id)
);
create table public.store_member_permission_grants (
  id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id),
  membership_id uuid not null, user_id uuid not null references auth.users(id),
  action text not null, revoked_at timestamptz,
  foreign key (membership_id, store_id) references public.store_memberships(id, store_id)
);
create table public.suppliers (
  id uuid primary key, store_id uuid not null references public.stores(id), name text not null,
  archived_at timestamptz, unique(id, store_id)
);
create table public.repair_orders (
  id uuid primary key, store_id uuid not null references public.stores(id),
  fault_prices jsonb not null default '[]', voided_at timestamptz,
  parts_status text not null default 'not_required', updated_at timestamptz not null default now(),
  unique(id, store_id)
);
create table public.audit_logs (
  id text primary key,
  actor_id uuid,
  actor_name text not null default 'system',
  store_id uuid references public.stores(id) on update cascade on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (before_data is null or jsonb_typeof(before_data) = 'object'),
  check (after_data is null or jsonb_typeof(after_data) = 'object'),
  check (jsonb_typeof(metadata) = 'object')
);

-- Sentinel legacy tables prove order purchasing has no inventory side effects.
create table public.parts_purchase_lots(id uuid primary key);
create table public.part_stock_movements(id uuid primary key);
create table public.repair_order_line_costs(id uuid primary key);

create or replace function public.repairdesk_actor_can_manage_order_costs(p_store_id uuid, p_actor_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff_profiles p
    join public.store_memberships m on m.user_id=p.id and m.store_id=p_store_id and m.status='active'
    join public.stores s on s.id=m.store_id and s.status='active'
    where p.id=p_actor_id and p.status='active' and (
      m.role='owner' or (m.role='manager' and exists (
        select 1 from public.store_member_permission_grants g
        where g.store_id=p_store_id and g.membership_id=m.id and g.user_id=p_actor_id
          and g.action='finance:cost_manage' and g.revoked_at is null
      ))
    )
  );
$$;

create or replace function public.repairdesk_enforce_active_store_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_store_id uuid;
begin
  v_store_id := coalesce(nullif(to_jsonb(new)->>'store_id','')::uuid,
                         nullif(to_jsonb(old)->>'store_id','')::uuid);
  if not exists (select 1 from public.stores s join public.store_lifecycles l on l.store_id=s.id
    where s.id=v_store_id and s.status='active' and l.phase='active') then
    raise exception 'STORE_LIFECYCLE_WRITE_BLOCKED';
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;

insert into auth.users(id) values
 ('10000000-0000-4000-8000-000000000001'), ('10000000-0000-4000-8000-000000000002'),
 ('10000000-0000-4000-8000-000000000003'), ('20000000-0000-4000-8000-000000000001');
insert into public.stores(id) values
 ('10000000-0000-4000-8000-000000000010'), ('20000000-0000-4000-8000-000000000010');
insert into public.store_lifecycles(store_id) values
 ('10000000-0000-4000-8000-000000000010'), ('20000000-0000-4000-8000-000000000010');
insert into public.staff_profiles(id) values
 ('10000000-0000-4000-8000-000000000001'), ('10000000-0000-4000-8000-000000000002'),
 ('10000000-0000-4000-8000-000000000003'), ('20000000-0000-4000-8000-000000000001');
insert into public.store_memberships(id,store_id,user_id,role) values
 ('10000000-0000-4000-8000-000000000101','10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001','owner'),
 ('10000000-0000-4000-8000-000000000102','10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000002','manager'),
 ('10000000-0000-4000-8000-000000000103','10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000003','technician'),
 ('20000000-0000-4000-8000-000000000101','20000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000001','owner');
insert into public.store_member_permission_grants(store_id,membership_id,user_id,action) values
 ('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000102','10000000-0000-4000-8000-000000000002','finance:cost_manage'),
 ('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000102','10000000-0000-4000-8000-000000000002','supplier:read'),
 ('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000102','10000000-0000-4000-8000-000000000002','supplier:assign');
insert into public.suppliers(id,store_id,name) values
 ('10000000-0000-4000-8000-000000000201','10000000-0000-4000-8000-000000000010','Supplier A'),
 ('10000000-0000-4000-8000-000000000202','10000000-0000-4000-8000-000000000010','Supplier C'),
 ('20000000-0000-4000-8000-000000000201','20000000-0000-4000-8000-000000000010','Supplier B');
insert into public.repair_orders(id,store_id,fault_prices) values
 ('10000000-0000-4000-8000-000000000301','10000000-0000-4000-8000-000000000010',
  '[{"line_id":"10000000-0000-4000-8000-000000000401","name":"Screen","price":100}]'),
 ('20000000-0000-4000-8000-000000000301','20000000-0000-4000-8000-000000000010','[]');
