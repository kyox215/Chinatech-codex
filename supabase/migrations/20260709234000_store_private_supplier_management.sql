-- Store-private supplier management metadata.
-- Suppliers remain store scoped; new stores are not seeded with supplier rows.

alter table public.suppliers
  add column if not exists contact_name text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists website text,
  add column if not exists notes text,
  add column if not exists archived_at timestamptz;

create index if not exists suppliers_store_active_name_idx
  on public.suppliers (store_id, lower(name))
  where archived_at is null;

create index if not exists suppliers_store_archived_idx
  on public.suppliers (store_id, archived_at, updated_at desc);
