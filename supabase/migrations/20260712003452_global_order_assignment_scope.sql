alter table public.repair_orders
  add column if not exists assignee_membership_id uuid;

create unique index if not exists store_memberships_id_store_id_unique_idx
  on public.store_memberships (id, store_id);

do $$
begin
  alter table public.repair_orders
    add constraint repair_orders_assignee_membership_store_fkey
    foreign key (assignee_membership_id, store_id)
    references public.store_memberships(id, store_id)
    on update cascade
    on delete restrict;
exception
  when duplicate_object then null;
end $$;

create index if not exists repair_orders_store_assignee_updated_idx
  on public.repair_orders (store_id, assignee_membership_id, updated_at desc);

-- Preserve legacy technician ownership when a display snapshot identifies exactly one
-- active same-store member. Ambiguous names are intentionally not guessed.
with unique_name_matches as (
  select
    repair_order.id as order_id,
    min(membership.id::text)::uuid as membership_id
  from public.repair_orders repair_order
  join public.store_memberships membership
    on membership.store_id = repair_order.store_id
   and membership.status = 'active'
   and lower(btrim(coalesce(membership.display_name, ''))) =
       lower(btrim(coalesce(repair_order.technician_name, '')))
   and btrim(coalesce(repair_order.technician_name, '')) <> ''
  where repair_order.assignee_membership_id is null
  group by repair_order.id
  having count(*) = 1
)
update public.repair_orders repair_order
set assignee_membership_id = match.membership_id
from unique_name_matches match
where repair_order.id = match.order_id
  and repair_order.assignee_membership_id is null;

-- Keep every remaining legacy order reachable under stable authorization. The store
-- owner becomes the conservative fallback and can reassign it from the order detail.
with unique_store_owners as (
  select membership.store_id, min(membership.id::text)::uuid as membership_id
  from public.store_memberships membership
  where membership.role = 'owner'
    and membership.status = 'active'
  group by membership.store_id
  having count(*) = 1
)
update public.repair_orders repair_order
set assignee_membership_id = owner_membership.membership_id
from unique_store_owners owner_membership
where repair_order.store_id = owner_membership.store_id
  and repair_order.assignee_membership_id is null;

comment on column public.repair_orders.assignee_membership_id is
  'Stable same-store membership assignment used for technician object authorization. technician_name remains a display snapshot.';

notify pgrst, 'reload schema';
