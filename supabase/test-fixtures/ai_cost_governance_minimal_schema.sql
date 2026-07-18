\set ON_ERROR_STOP on

create role anon nologin;
create role authenticated nologin;
-- Supabase's service role bypasses RLS. Mirror that capability so the
-- security-invoker RPC tests match the production role model.
create role service_role nologin bypassrls;

create table public.stores (
  id uuid primary key,
  status text not null
);

create table public.staff_profiles (
  id uuid primary key,
  status text not null
);

create table public.store_memberships (
  id uuid primary key,
  user_id uuid not null references public.staff_profiles(id),
  store_id uuid not null references public.stores(id),
  status text not null,
  role text not null
);

insert into public.stores (id, status)
values ('00000000-0000-4000-8000-000000000001', 'active');

insert into public.staff_profiles (id, status)
values
  ('00000000-0000-4000-8000-000000000002', 'active'),
  ('00000000-0000-4000-8000-000000000003', 'active');

insert into public.store_memberships (id, user_id, store_id, status, role)
values
  (
    '00000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000001',
    'active',
    'owner'
  ),
  (
    '00000000-0000-4000-8000-000000000005',
    '00000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000001',
    'active',
    'technician'
  );

grant usage on schema public to service_role;
grant select on table public.stores, public.staff_profiles, public.store_memberships
  to service_role;
