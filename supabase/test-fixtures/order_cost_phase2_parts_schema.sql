create table public.suppliers (
  id uuid primary key,
  store_id uuid not null references public.stores(id),
  name text not null,
  archived_at timestamptz,
  unique (id, store_id)
);

insert into public.suppliers (id, store_id, name) values (
  '00000000-0000-4000-8000-000000008301',
  '00000000-0000-4000-8000-000000008000',
  'UTOPYA'
);

insert into public.store_member_permission_grants (
  store_id, membership_id, user_id, action, granted_by
) values (
  '00000000-0000-4000-8000-000000008000',
  '00000000-0000-4000-8000-000000008012',
  '00000000-0000-4000-8000-000000008002',
  'inventory:cost_allocate',
  '00000000-0000-4000-8000-000000008001'
);
