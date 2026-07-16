-- Restore tenant-coupled CRM references after the lifecycle migrations.
do $$
begin
  if exists (
    select 1
    from public.customer_interactions interaction
    left join public.repair_orders order_row on order_row.id = interaction.order_id
    where interaction.order_id is not null
      and (interaction.store_id is null or order_row.id is null or order_row.store_id <> interaction.store_id)
  ) then
    raise exception using
      message = 'customer_interactions contains null-store, orphan or cross-store order references',
      errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.customer_followups followup
    left join public.repair_orders order_row on order_row.id = followup.order_id
    where followup.order_id is not null
      and (followup.store_id is null or order_row.id is null or order_row.store_id <> followup.store_id)
  ) then
    raise exception using
      message = 'customer_followups contains null-store, orphan or cross-store order references',
      errcode = 'P0001';
  end if;

  if exists (select 1 from public.customer_followups where store_id is null) then
    raise exception using
      message = 'customer_followups contains rows without store_id',
      errcode = 'P0001';
  end if;
end;
$$;

alter table public.customer_followups alter column store_id set not null;

create index if not exists customer_interactions_store_order_idx
  on public.customer_interactions (store_id, order_id)
  where order_id is not null;

create index if not exists customer_followups_store_order_idx
  on public.customer_followups (store_id, order_id)
  where order_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'customer_interactions_order_same_store_fkey'
      and conrelid = 'public.customer_interactions'::regclass
  ) then
    alter table public.customer_interactions
      add constraint customer_interactions_order_same_store_fkey
      foreign key (order_id, store_id)
      references public.repair_orders(id, store_id)
      on update cascade
      on delete set null (order_id)
      not valid;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'customer_followups_order_same_store_fkey'
      and conrelid = 'public.customer_followups'::regclass
  ) then
    alter table public.customer_followups
      add constraint customer_followups_order_same_store_fkey
      foreign key (order_id, store_id)
      references public.repair_orders(id, store_id)
      on update cascade
      on delete set null (order_id)
      not valid;
  end if;
end;
$$;

alter table public.customer_interactions
  validate constraint customer_interactions_order_same_store_fkey;

alter table public.customer_followups
  validate constraint customer_followups_order_same_store_fkey;

notify pgrst, 'reload schema';
