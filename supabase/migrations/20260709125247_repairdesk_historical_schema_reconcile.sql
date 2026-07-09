-- Reconcile production schema drift from historical migrations that were
-- already partially applied outside of the current remote migration history.
--
-- Scope:
-- - customer list performance indexes
-- - owner email lookup hardening
-- - store-scoped reference indexes and NOT VALID tenant FKs
-- - inventory event item_id sync trigger
-- - private realtime broadcast receive policy
--
-- Explicitly out of scope:
-- - offline sync operation table/RPC drafts
-- - migration history repair rows for older versions

create extension if not exists pg_trgm with schema extensions;

set search_path = public, extensions;

create index if not exists customers_store_updated_idx
  on public.customers (store_id, updated_at desc);

create index if not exists customers_name_trgm_idx
  on public.customers using gin (lower(name) gin_trgm_ops);

create index if not exists customers_email_trgm_idx
  on public.customers using gin (lower(coalesce(email, '')) gin_trgm_ops);

create index if not exists devices_search_trgm_idx
  on public.devices using gin (
    lower(
      coalesce(brand, '')
      || ' '
      || coalesce(model, '')
      || ' '
      || coalesce(serial_or_imei, '')
      || ' '
      || coalesce(device_notes, '')
    ) gin_trgm_ops
  );

create index if not exists repair_orders_store_customer_created_idx
  on public.repair_orders (store_id, customer_id, created_at desc);

create index if not exists customer_tag_assignments_store_customer_idx
  on public.customer_tag_assignments (store_id, customer_id);

update public.staff_profiles
set email = lower(email)
where email is not null
  and email <> lower(email);

update public.store_memberships
set email = lower(email)
where email is not null
  and email <> lower(email);

update public.store_invitations
set email = lower(email)
where email is not null
  and email <> lower(email);

alter table public.staff_profiles
  drop constraint if exists staff_profiles_email_lowercase_check,
  add constraint staff_profiles_email_lowercase_check
  check (email is null or email = lower(email));

alter table public.store_memberships
  drop constraint if exists store_memberships_email_lowercase_check,
  add constraint store_memberships_email_lowercase_check
  check (email is null or email = lower(email));

alter table public.store_invitations
  drop constraint if exists store_invitations_email_lowercase_check,
  add constraint store_invitations_email_lowercase_check
  check (email is null or email = lower(email));

create index if not exists store_memberships_owner_email_lookup_idx
  on public.store_memberships (email, role, status, store_id)
  where role in ('owner', 'manager') and status = 'active';

create unique index if not exists customers_id_store_id_uidx
  on public.customers (id, store_id);

create unique index if not exists devices_id_store_id_uidx
  on public.devices (id, store_id);

create unique index if not exists suppliers_id_store_id_uidx
  on public.suppliers (id, store_id);

create unique index if not exists repair_orders_id_store_id_uidx
  on public.repair_orders (id, store_id);

create unique index if not exists customer_tags_id_store_id_uidx
  on public.customer_tags (id, store_id);

create unique index if not exists inventory_items_id_store_id_uidx
  on public.inventory_items (id, store_id);

create or replace function pg_temp.add_store_fk(
  table_name text,
  constraint_name text
)
returns void
language plpgsql
as $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = format('public.%I', table_name)::regclass
      and conname = constraint_name
  ) then
    execute format(
      'alter table public.%I add constraint %I foreign key (store_id) references public.stores(id) on update cascade on delete restrict not valid',
      table_name,
      constraint_name
    );
  end if;
end;
$$;

create or replace function pg_temp.add_same_store_fk(
  table_name text,
  constraint_name text,
  columns_sql text,
  ref_table_name text,
  ref_columns_sql text,
  delete_action text
)
returns void
language plpgsql
as $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = format('public.%I', table_name)::regclass
      and conname = constraint_name
  ) then
    execute format(
      'alter table public.%I add constraint %I foreign key (%s) references public.%I (%s) on update cascade on delete %s not valid',
      table_name,
      constraint_name,
      columns_sql,
      ref_table_name,
      ref_columns_sql,
      delete_action
    );
  end if;
end;
$$;

select pg_temp.add_store_fk('customers', 'customers_store_id_fkey');
select pg_temp.add_store_fk('devices', 'devices_store_id_fkey');
select pg_temp.add_store_fk('suppliers', 'suppliers_store_id_fkey');
select pg_temp.add_store_fk('repair_orders', 'repair_orders_store_id_fkey');
select pg_temp.add_store_fk('order_events', 'order_events_store_id_fkey');
select pg_temp.add_store_fk('message_logs', 'message_logs_store_id_fkey');
select pg_temp.add_store_fk('customer_tags', 'customer_tags_store_id_fkey');
select pg_temp.add_store_fk('customer_tag_assignments', 'customer_tag_assignments_store_id_fkey');
select pg_temp.add_store_fk('customer_interactions', 'customer_interactions_store_id_fkey');
select pg_temp.add_store_fk('customer_followups', 'customer_followups_store_id_fkey');
select pg_temp.add_store_fk('inventory_items', 'inventory_items_store_id_fkey');
select pg_temp.add_store_fk('inventory_quality_checks', 'inventory_quality_checks_store_id_fkey');
select pg_temp.add_store_fk('inventory_transactions', 'inventory_transactions_store_id_fkey');
select pg_temp.add_store_fk('inventory_events', 'inventory_events_store_id_fkey');
select pg_temp.add_store_fk('audit_logs', 'audit_logs_store_id_fkey');
select pg_temp.add_store_fk('store_settings', 'store_settings_store_id_fkey');
select pg_temp.add_store_fk('message_templates', 'message_templates_store_id_fkey');

select pg_temp.add_same_store_fk(
  'devices',
  'devices_customer_same_store_fkey',
  'customer_id, store_id',
  'customers',
  'id, store_id',
  'restrict'
);

select pg_temp.add_same_store_fk(
  'repair_orders',
  'repair_orders_customer_same_store_fkey',
  'customer_id, store_id',
  'customers',
  'id, store_id',
  'restrict'
);

select pg_temp.add_same_store_fk(
  'repair_orders',
  'repair_orders_device_same_store_fkey',
  'device_id, store_id',
  'devices',
  'id, store_id',
  'restrict'
);

select pg_temp.add_same_store_fk(
  'repair_orders',
  'repair_orders_supplier_same_store_fkey',
  'supplier_id, store_id',
  'suppliers',
  'id, store_id',
  'restrict'
);

select pg_temp.add_same_store_fk(
  'repair_orders',
  'repair_orders_original_same_store_fkey',
  'original_order_id, store_id',
  'repair_orders',
  'id, store_id',
  'restrict'
);

select pg_temp.add_same_store_fk(
  'order_events',
  'order_events_order_same_store_fkey',
  'order_id, store_id',
  'repair_orders',
  'id, store_id',
  'cascade'
);

select pg_temp.add_same_store_fk(
  'message_logs',
  'message_logs_order_same_store_fkey',
  'order_id, store_id',
  'repair_orders',
  'id, store_id',
  'cascade'
);

select pg_temp.add_same_store_fk(
  'customer_tag_assignments',
  'customer_tag_assignments_customer_same_store_fkey',
  'customer_id, store_id',
  'customers',
  'id, store_id',
  'cascade'
);

-- Do not add customer_tag_assignments_tag_same_store_fkey here.
-- Production has historical tag assignment rows whose tag_id values do not
-- match customer_tags yet; that cleanup needs a separate data repair.

select pg_temp.add_same_store_fk(
  'customer_interactions',
  'customer_interactions_customer_same_store_fkey',
  'customer_id, store_id',
  'customers',
  'id, store_id',
  'cascade'
);

select pg_temp.add_same_store_fk(
  'customer_followups',
  'customer_followups_customer_same_store_fkey',
  'customer_id, store_id',
  'customers',
  'id, store_id',
  'cascade'
);

select pg_temp.add_same_store_fk(
  'inventory_items',
  'inventory_items_customer_same_store_fkey',
  'customer_id, store_id',
  'customers',
  'id, store_id',
  'restrict'
);

select pg_temp.add_same_store_fk(
  'inventory_items',
  'inventory_items_buyer_same_store_fkey',
  'buyer_customer_id, store_id',
  'customers',
  'id, store_id',
  'restrict'
);

select pg_temp.add_same_store_fk(
  'inventory_quality_checks',
  'inventory_quality_checks_item_same_store_fkey',
  'item_id, store_id',
  'inventory_items',
  'id, store_id',
  'cascade'
);

select pg_temp.add_same_store_fk(
  'inventory_transactions',
  'inventory_transactions_item_same_store_fkey',
  'item_id, store_id',
  'inventory_items',
  'id, store_id',
  'cascade'
);

select pg_temp.add_same_store_fk(
  'inventory_events',
  'inventory_events_item_same_store_fkey',
  'item_id, store_id',
  'inventory_items',
  'id, store_id',
  'cascade'
);

update public.inventory_events
set item_id = coalesce(item_id, inventory_item_id)
where item_id is null
  and inventory_item_id is not null;

create or replace function public.repairdesk_sync_inventory_event_item_id()
returns trigger
language plpgsql
as $$
begin
  if new.inventory_item_id is null then
    new.inventory_item_id := new.item_id;
  end if;
  if new.item_id is null then
    new.item_id := new.inventory_item_id;
  end if;
  return new;
end;
$$;

drop trigger if exists repairdesk_sync_inventory_event_item_id_trg
  on public.inventory_events;

create trigger repairdesk_sync_inventory_event_item_id_trg
before insert or update on public.inventory_events
for each row execute function public.repairdesk_sync_inventory_event_item_id();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.inventory_events'::regclass
      and conname = 'inventory_events_item_id_fkey'
  ) then
    alter table public.inventory_events
      add constraint inventory_events_item_id_fkey
      foreign key (item_id) references public.inventory_items(id)
      on update cascade on delete cascade
      not valid;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.inventory_events'::regclass
      and conname = 'inventory_events_operator_user_id_fkey'
  ) then
    alter table public.inventory_events
      add constraint inventory_events_operator_user_id_fkey
      foreign key (operator_user_id) references public.staff_profiles(id)
      on update cascade on delete set null
      not valid;
  end if;
end;
$$;

alter table realtime.messages enable row level security;

revoke all on table realtime.messages from anon;
revoke insert, update, delete on table realtime.messages from public;
revoke insert, update, delete on table realtime.messages from authenticated;
grant select on table realtime.messages to authenticated;

drop policy if exists repairdesk_realtime_store_broadcast_receive
  on realtime.messages;

create policy repairdesk_realtime_store_broadcast_receive
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (select realtime.topic()) ~* '^repairdesk:v1:store:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}:(orders|customers|inventory|settings)$'
  and exists (
    select 1
    from public.store_memberships sm
    join public.stores s on s.id = sm.store_id
    where sm.user_id = (select auth.uid())
      and sm.status = 'active'
      and s.status = 'active'
      and sm.store_id = substring(
        (select realtime.topic())
        from '^repairdesk:v1:store:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}):[a-z]+$'
      )::uuid
  )
);

select pg_notify('pgrst', 'reload schema');
