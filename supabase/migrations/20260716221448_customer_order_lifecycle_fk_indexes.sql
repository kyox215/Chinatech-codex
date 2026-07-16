-- Cover the lifecycle/CRM foreign-key column order used by PostgreSQL when
-- referenced rows are updated or deleted. Existing store-first indexes remain
-- available for tenant-scoped application queries.
create index if not exists customer_interactions_order_store_fk_idx
  on public.customer_interactions (order_id, store_id)
  where order_id is not null;

create index if not exists customer_followups_order_store_fk_idx
  on public.customer_followups (order_id, store_id)
  where order_id is not null;

create index if not exists order_terminal_operations_order_store_fk_idx
  on public.order_terminal_operations (order_id, store_id);

create index if not exists order_terminal_operations_actor_fk_idx
  on public.order_terminal_operations (actor_id)
  where actor_id is not null;

create index if not exists repair_orders_voided_by_fk_idx
  on public.repair_orders (voided_by)
  where voided_by is not null;
