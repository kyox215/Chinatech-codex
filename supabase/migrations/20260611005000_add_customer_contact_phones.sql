alter table public.customers
  add column if not exists contact_phones text[] not null default '{}';

create index if not exists customers_contact_phones_gin_idx
  on public.customers using gin (contact_phones);
