-- Hard tenant guardrails for the shared-database SaaS model.
-- Application code still filters by store_id, but these constraints make
-- missing or cross-store writes fail at the database boundary too.

alter table public.customer_tag_assignments
  drop constraint if exists customer_tag_assignments_customer_id_fkey;
alter table public.customer_interactions
  drop constraint if exists customer_interactions_customer_id_fkey;
alter table public.customer_interactions
  drop constraint if exists customer_interactions_order_id_fkey;
alter table public.customer_followups
  drop constraint if exists customer_followups_customer_id_fkey;
alter table public.customer_followups
  drop constraint if exists customer_followups_order_id_fkey;

alter table public.customer_tag_assignments
  alter column customer_id type text using customer_id::text;
alter table public.customer_interactions
  alter column customer_id type text using customer_id::text,
  alter column order_id type text using order_id::text;
alter table public.customer_followups
  alter column customer_id type text using customer_id::text,
  alter column order_id type text using order_id::text;

alter table public.customer_tags
  drop constraint if exists customer_tags_name_key;

alter table public.customers alter column store_id set not null;
alter table public.devices alter column store_id set not null;
alter table public.suppliers alter column store_id set not null;
alter table public.repair_orders alter column store_id set not null;
alter table public.order_events alter column store_id set not null;
alter table public.message_logs alter column store_id set not null;
alter table public.customer_tags alter column store_id set not null;
alter table public.customer_tag_assignments alter column store_id set not null;
alter table public.customer_interactions alter column store_id set not null;
alter table public.customer_followups alter column store_id set not null;
alter table public.inventory_items alter column store_id set not null;
alter table public.inventory_quality_checks alter column store_id set not null;
alter table public.inventory_transactions alter column store_id set not null;
alter table public.inventory_events alter column store_id set not null;
alter table public.audit_logs alter column store_id set not null;
alter table public.store_settings alter column store_id set not null;
alter table public.message_templates alter column store_id set not null;

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

create unique index if not exists customer_tags_store_name_unique
  on public.customer_tags (store_id, lower(name));
create unique index if not exists store_invitations_pending_email_unique
  on public.store_invitations (store_id, lower(email))
  where status = 'invited';

create or replace function pg_temp.add_store_fk(table_name text, constraint_name text)
returns void
language plpgsql
as $$
begin
  execute format(
    'alter table public.%I add constraint %I foreign key (store_id) references public.stores(id) on update cascade on delete restrict not valid',
    table_name,
    constraint_name
  );
exception when duplicate_object then
  null;
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
  execute format(
    'alter table public.%I add constraint %I foreign key (%s) references public.%I (%s) on update cascade on delete %s not valid',
    table_name,
    constraint_name,
    columns_sql,
    ref_table_name,
    ref_columns_sql,
    delete_action
  );
exception when duplicate_object then
  null;
end;
$$;

create or replace function pg_temp.validate_constraint_if_present(
  table_name text,
  constraint_name text
)
returns void
language plpgsql
as $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = format('public.%I', table_name)::regclass
      and conname = constraint_name
  ) then
    execute format('alter table public.%I validate constraint %I', table_name, constraint_name);
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
select pg_temp.add_same_store_fk(
  'customer_tag_assignments',
  'customer_tag_assignments_tag_same_store_fkey',
  'tag_id, store_id',
  'customer_tags',
  'id, store_id',
  'cascade'
);
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

select pg_temp.validate_constraint_if_present('customers', 'customers_store_id_fkey');
select pg_temp.validate_constraint_if_present('devices', 'devices_store_id_fkey');
select pg_temp.validate_constraint_if_present('suppliers', 'suppliers_store_id_fkey');
select pg_temp.validate_constraint_if_present('repair_orders', 'repair_orders_store_id_fkey');
select pg_temp.validate_constraint_if_present('order_events', 'order_events_store_id_fkey');
select pg_temp.validate_constraint_if_present('message_logs', 'message_logs_store_id_fkey');
select pg_temp.validate_constraint_if_present('customer_tags', 'customer_tags_store_id_fkey');
select pg_temp.validate_constraint_if_present(
  'customer_tag_assignments',
  'customer_tag_assignments_store_id_fkey'
);
select pg_temp.validate_constraint_if_present(
  'customer_interactions',
  'customer_interactions_store_id_fkey'
);
select pg_temp.validate_constraint_if_present('customer_followups', 'customer_followups_store_id_fkey');
select pg_temp.validate_constraint_if_present('inventory_items', 'inventory_items_store_id_fkey');
select pg_temp.validate_constraint_if_present(
  'inventory_quality_checks',
  'inventory_quality_checks_store_id_fkey'
);
select pg_temp.validate_constraint_if_present(
  'inventory_transactions',
  'inventory_transactions_store_id_fkey'
);
select pg_temp.validate_constraint_if_present('inventory_events', 'inventory_events_store_id_fkey');
select pg_temp.validate_constraint_if_present('audit_logs', 'audit_logs_store_id_fkey');
select pg_temp.validate_constraint_if_present('store_settings', 'store_settings_store_id_fkey');
select pg_temp.validate_constraint_if_present('message_templates', 'message_templates_store_id_fkey');

select pg_temp.validate_constraint_if_present('devices', 'devices_customer_same_store_fkey');
select pg_temp.validate_constraint_if_present(
  'repair_orders',
  'repair_orders_customer_same_store_fkey'
);
select pg_temp.validate_constraint_if_present('repair_orders', 'repair_orders_device_same_store_fkey');
select pg_temp.validate_constraint_if_present(
  'repair_orders',
  'repair_orders_supplier_same_store_fkey'
);
select pg_temp.validate_constraint_if_present(
  'repair_orders',
  'repair_orders_original_same_store_fkey'
);
select pg_temp.validate_constraint_if_present('order_events', 'order_events_order_same_store_fkey');
select pg_temp.validate_constraint_if_present('message_logs', 'message_logs_order_same_store_fkey');
select pg_temp.validate_constraint_if_present(
  'customer_tag_assignments',
  'customer_tag_assignments_customer_same_store_fkey'
);
select pg_temp.validate_constraint_if_present(
  'customer_tag_assignments',
  'customer_tag_assignments_tag_same_store_fkey'
);
select pg_temp.validate_constraint_if_present(
  'customer_interactions',
  'customer_interactions_customer_same_store_fkey'
);
select pg_temp.validate_constraint_if_present(
  'customer_followups',
  'customer_followups_customer_same_store_fkey'
);
select pg_temp.validate_constraint_if_present(
  'inventory_items',
  'inventory_items_customer_same_store_fkey'
);
select pg_temp.validate_constraint_if_present('inventory_items', 'inventory_items_buyer_same_store_fkey');
select pg_temp.validate_constraint_if_present(
  'inventory_quality_checks',
  'inventory_quality_checks_item_same_store_fkey'
);
select pg_temp.validate_constraint_if_present(
  'inventory_transactions',
  'inventory_transactions_item_same_store_fkey'
);
select pg_temp.validate_constraint_if_present('inventory_events', 'inventory_events_item_same_store_fkey');

create or replace function pg_temp.add_store_member_select_policy(
  table_name text,
  policy_name text
)
returns void
language plpgsql
as $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = table_name
      and policyname = policy_name
  ) then
    execute format(
      $policy$
      create policy %I
      on public.%I
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.store_memberships sm
          where sm.store_id = %I.store_id
            and sm.user_id = (select auth.uid())
            and sm.status = 'active'
        )
      )
      $policy$,
      policy_name,
      table_name,
      table_name
    );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'staff_profiles'
      and policyname = 'staff_profiles_self_select'
  ) then
    create policy staff_profiles_self_select
    on public.staff_profiles
    for select
    to authenticated
    using (id = (select auth.uid()));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'store_memberships'
      and policyname = 'store_memberships_self_select'
  ) then
    create policy store_memberships_self_select
    on public.store_memberships
    for select
    to authenticated
    using (user_id = (select auth.uid()));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'stores'
      and policyname = 'stores_member_select'
  ) then
    create policy stores_member_select
    on public.stores
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.store_memberships sm
        where sm.store_id = stores.id
          and sm.user_id = (select auth.uid())
          and sm.status = 'active'
      )
    );
  end if;
end $$;

select pg_temp.add_store_member_select_policy('store_invitations', 'store_invitations_store_member_select');
select pg_temp.add_store_member_select_policy('customers', 'customers_store_member_select');
select pg_temp.add_store_member_select_policy('devices', 'devices_store_member_select');
select pg_temp.add_store_member_select_policy('suppliers', 'suppliers_store_member_select');
select pg_temp.add_store_member_select_policy('repair_orders', 'repair_orders_store_member_select');
select pg_temp.add_store_member_select_policy('order_events', 'order_events_store_member_select');
select pg_temp.add_store_member_select_policy('message_logs', 'message_logs_store_member_select');
select pg_temp.add_store_member_select_policy('customer_tags', 'customer_tags_store_member_select');
select pg_temp.add_store_member_select_policy(
  'customer_tag_assignments',
  'customer_tag_assignments_store_member_select'
);
select pg_temp.add_store_member_select_policy(
  'customer_interactions',
  'customer_interactions_store_member_select'
);
select pg_temp.add_store_member_select_policy('customer_followups', 'customer_followups_store_member_select');
select pg_temp.add_store_member_select_policy('inventory_items', 'inventory_items_store_member_select');
select pg_temp.add_store_member_select_policy(
  'inventory_quality_checks',
  'inventory_quality_checks_store_member_select'
);
select pg_temp.add_store_member_select_policy(
  'inventory_transactions',
  'inventory_transactions_store_member_select'
);
select pg_temp.add_store_member_select_policy('inventory_events', 'inventory_events_store_member_select');
select pg_temp.add_store_member_select_policy('audit_logs', 'audit_logs_store_member_select');
select pg_temp.add_store_member_select_policy('store_settings', 'store_settings_store_member_select');
select pg_temp.add_store_member_select_policy('message_templates', 'message_templates_store_member_select');
