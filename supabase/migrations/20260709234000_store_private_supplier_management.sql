-- Store-private supplier management metadata.
-- Suppliers remain store scoped; new stores are not seeded with supplier rows.

alter table public.suppliers
  add column if not exists contact_name text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists website text,
  add column if not exists notes text,
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at timestamptz;

update public.suppliers
set contact_name = contact
where contact_name is null
  and contact is not null;

update public.suppliers
set updated_at = created_at
where updated_at is null;

alter table public.suppliers
  alter column updated_at set default now(),
  alter column updated_at set not null;

create index if not exists suppliers_store_active_name_idx
  on public.suppliers (store_id, lower(name))
  where archived_at is null;

create index if not exists suppliers_store_archived_idx
  on public.suppliers (store_id, archived_at, updated_at desc);
