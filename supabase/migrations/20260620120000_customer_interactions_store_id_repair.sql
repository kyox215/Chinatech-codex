-- Repair environments where customer_interactions was created before the
-- multi-store foundation migration added store_id.

alter table public.customer_interactions
  add column if not exists store_id uuid;

update public.customer_interactions ci
set store_id = c.store_id
from public.customers c
where ci.customer_id = c.id
  and ci.store_id is null
  and c.store_id is not null;

do $$
begin
  if exists (select 1 from public.customer_interactions where store_id is null) then
    raise exception 'customer_interactions.store_id backfill failed: unmatched customer_id rows remain';
  end if;
end $$;

alter table public.customer_interactions
  alter column store_id set not null;

create index if not exists customer_interactions_store_customer_created_idx
  on public.customer_interactions (store_id, customer_id, created_at desc);
