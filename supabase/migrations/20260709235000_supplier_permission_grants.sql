-- Store-scoped supplier permission grants.
-- Supplier lists and supplier markers are owner-only by default; non-owners need explicit grants.

create table if not exists public.store_member_permission_grants (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  membership_id uuid not null references public.store_memberships(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  granted_by uuid references auth.users(id) on delete set null,
  revoked_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_member_permission_grants_supplier_action_check
    check (action in ('supplier:read', 'supplier:assign', 'supplier:manage')),
  constraint store_member_permission_grants_revoke_pair_check
    check (
      (revoked_at is null and revoked_by is null)
      or (revoked_at is not null)
    )
);

create unique index if not exists store_member_permission_grants_active_unique_idx
  on public.store_member_permission_grants (store_id, membership_id, action)
  where revoked_at is null;

create index if not exists store_member_permission_grants_user_active_idx
  on public.store_member_permission_grants (store_id, user_id, action)
  where revoked_at is null;

create index if not exists store_member_permission_grants_store_membership_idx
  on public.store_member_permission_grants (store_id, membership_id, updated_at desc);

create unique index if not exists store_memberships_id_store_id_unique_idx
  on public.store_memberships (id, store_id);

do $$
begin
  alter table public.store_member_permission_grants
    add constraint store_member_permission_grants_membership_store_fkey
    foreign key (membership_id, store_id)
    references public.store_memberships(id, store_id)
    on update cascade
    on delete cascade;
exception when duplicate_object then
  null;
end;
$$;

alter table public.store_member_permission_grants enable row level security;

revoke all on table public.store_member_permission_grants from anon, authenticated;
grant all on table public.store_member_permission_grants to service_role;

notify pgrst, 'reload schema';
