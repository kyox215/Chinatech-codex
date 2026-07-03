-- Add an independent parts-purchase supplier marker for repair orders.
-- Existing repair_orders.supplier_id keeps its external repair / mail-in meaning.

alter table public.repair_orders
  add column if not exists parts_supplier_id text;

do $$
begin
  alter table public.repair_orders
    add constraint repair_orders_parts_supplier_same_store_fkey
    foreign key (parts_supplier_id, store_id)
    references public.suppliers(id, store_id)
    on update cascade
    on delete set null (parts_supplier_id)
    not valid;
exception when duplicate_object then
  null;
end;
$$;

alter table public.repair_orders
  validate constraint repair_orders_parts_supplier_same_store_fkey;

create index if not exists repair_orders_store_parts_supplier_idx
  on public.repair_orders (store_id, parts_supplier_id, updated_at desc)
  where parts_supplier_id is not null;
