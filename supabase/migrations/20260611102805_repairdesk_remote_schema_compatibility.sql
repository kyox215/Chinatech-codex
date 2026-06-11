-- Align the partially migrated remote database with the current RepairDesk
-- application contract. The remote project already contains newer inventory
-- and message tables, but the current app expects the buyback/resale and
-- template/settings columns introduced in the local migrations.

create extension if not exists pgcrypto with schema extensions;

create sequence if not exists public.inventory_item_public_no_seq start with 1000;

alter table public.inventory_items
  alter column public_no set default (
    'I' || lpad(nextval('public.inventory_item_public_no_seq')::text, 6, '0')
  );

alter table public.inventory_items
  alter column product_channel set default 'trade_in',
  alter column lifecycle_status set default 'draft';

alter table public.inventory_items
  add column if not exists status text not null default 'intake',
  add column if not exists source_type text not null default 'buyback',
  add column if not exists source_ref text,
  add column if not exists legacy_source text,
  add column if not exists customer_id uuid,
  add column if not exists category text not null default 'phone',
  add column if not exists color text,
  add column if not exists storage_capacity text,
  add column if not exists serial_or_imei text,
  add column if not exists imei_check_status text not null default 'unchecked',
  add column if not exists activation_lock_status text not null default 'unchecked',
  add column if not exists data_wipe_status text not null default 'unchecked',
  add column if not exists cosmetic_grade text not null default 'unknown',
  add column if not exists functional_grade text not null default 'untested',
  add column if not exists battery_health numeric(5, 2),
  add column if not exists buyback_price numeric(12, 2) not null default 0,
  add column if not exists sale_price numeric(12, 2) not null default 0,
  add column if not exists deposit_amount numeric(12, 2) not null default 0,
  add column if not exists repair_cost_amount numeric(12, 2) not null default 0,
  add column if not exists fees_amount numeric(12, 2) not null default 0,
  add column if not exists currency_code text not null default 'EUR',
  add column if not exists payment_method text,
  add column if not exists sale_channel text,
  add column if not exists warranty_months integer not null default 12,
  add column if not exists warranty_until timestamptz,
  add column if not exists purchased_at timestamptz,
  add column if not exists listed_at timestamptz,
  add column if not exists sold_at timestamptz,
  add column if not exists returned_at timestamptz,
  add column if not exists recycled_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists legacy_payload jsonb not null default '{}'::jsonb,
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid;

update public.inventory_items
set
  status = case lifecycle_status
    when 'reserved' then 'reserved'
    when 'sold' then 'sold'
    when 'cancelled' then 'cancelled'
    when 'in_stock' then 'listed'
    else status
  end,
  source_type = coalesce(nullif(source_type, ''), 'buyback'),
  category = coalesce(nullif(category, ''), 'phone'),
  serial_or_imei = coalesce(serial_or_imei, imei_or_serial),
  buyback_price = coalesce(buyback_price, purchase_cost, 0),
  sale_price = coalesce(sale_price, sold_price, 0),
  legacy_payload = coalesce(legacy_payload, '{}'::jsonb);

do $$
begin
  alter table public.inventory_items
    add constraint inventory_items_customer_id_fkey
    foreign key (customer_id) references public.customers(id)
    on update cascade on delete set null;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.inventory_items
    add constraint inventory_items_created_by_fkey
    foreign key (created_by) references public.staff_profiles(id)
    on update cascade on delete set null;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.inventory_items
    add constraint inventory_items_updated_by_fkey
    foreign key (updated_by) references public.staff_profiles(id)
    on update cascade on delete set null;
exception when duplicate_object then null;
end $$;

create unique index if not exists inventory_items_id_store_id_uidx
  on public.inventory_items (id, store_id);
create index if not exists inventory_items_status_idx on public.inventory_items (status);
create index if not exists inventory_items_customer_id_idx on public.inventory_items (customer_id);
create index if not exists inventory_items_buyer_customer_id_idx
  on public.inventory_items (buyer_customer_id);
create index if not exists inventory_items_serial_idx on public.inventory_items (serial_or_imei);

create table if not exists public.inventory_quality_checks (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  item_id uuid not null,
  screen_status text not null default 'unchecked',
  touch_status text not null default 'unchecked',
  camera_status text not null default 'unchecked',
  buttons_status text not null default 'unchecked',
  ports_status text not null default 'unchecked',
  speaker_status text not null default 'unchecked',
  microphone_status text not null default 'unchecked',
  wifi_status text not null default 'unchecked',
  bluetooth_status text not null default 'unchecked',
  cellular_status text not null default 'unchecked',
  battery_health numeric(5, 2),
  cosmetic_grade text not null default 'unknown',
  functional_grade text not null default 'untested',
  imei_check_status text not null default 'unchecked',
  activation_lock_status text not null default 'unchecked',
  data_wipe_status text not null default 'unchecked',
  notes text,
  checked_by uuid,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint inventory_quality_checks_store_id_fkey
    foreign key (store_id) references public.stores(id)
    on update cascade on delete restrict,
  constraint inventory_quality_checks_item_id_fkey
    foreign key (item_id) references public.inventory_items(id)
    on update cascade on delete cascade,
  constraint inventory_quality_checks_checked_by_fkey
    foreign key (checked_by) references public.staff_profiles(id)
    on update cascade on delete set null
);

create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  item_id uuid not null,
  transaction_type text not null,
  amount numeric(12, 2) not null default 0,
  currency_code text not null default 'EUR',
  method text,
  note text,
  actor_id uuid,
  created_at timestamptz not null default now(),
  constraint inventory_transactions_store_id_fkey
    foreign key (store_id) references public.stores(id)
    on update cascade on delete restrict,
  constraint inventory_transactions_item_id_fkey
    foreign key (item_id) references public.inventory_items(id)
    on update cascade on delete cascade,
  constraint inventory_transactions_actor_id_fkey
    foreign key (actor_id) references public.staff_profiles(id)
    on update cascade on delete set null,
  constraint inventory_transactions_currency_eur check (currency_code = 'EUR')
);

alter table public.inventory_events
  add column if not exists item_id uuid,
  add column if not exists from_status text,
  add column if not exists to_status text,
  add column if not exists operator_user_id uuid,
  add column if not exists operator_email text;

update public.inventory_events
set item_id = coalesce(item_id, inventory_item_id);

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

drop trigger if exists repairdesk_sync_inventory_event_item_id_trg on public.inventory_events;
create trigger repairdesk_sync_inventory_event_item_id_trg
before insert or update on public.inventory_events
for each row execute function public.repairdesk_sync_inventory_event_item_id();

do $$
begin
  alter table public.inventory_events
    add constraint inventory_events_item_id_fkey
    foreign key (item_id) references public.inventory_items(id)
    on update cascade on delete cascade;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.inventory_events
    add constraint inventory_events_operator_user_id_fkey
    foreign key (operator_user_id) references public.staff_profiles(id)
    on update cascade on delete set null;
exception when duplicate_object then null;
end $$;

create index if not exists inventory_quality_checks_item_created_idx
  on public.inventory_quality_checks (item_id, created_at desc);
create index if not exists inventory_transactions_item_created_idx
  on public.inventory_transactions (item_id, created_at desc);
create index if not exists inventory_events_item_created_idx
  on public.inventory_events (item_id, created_at desc);

alter table public.inventory_quality_checks enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.inventory_events enable row level security;

revoke all on table public.inventory_quality_checks from anon, authenticated;
revoke all on table public.inventory_transactions from anon, authenticated;
revoke all on table public.inventory_events from anon, authenticated;

grant all on table public.inventory_quality_checks to service_role;
grant all on table public.inventory_transactions to service_role;
grant all on table public.inventory_events to service_role;
grant usage, select on sequence public.inventory_item_public_no_seq to service_role;

create table if not exists public.store_settings (
  id text primary key default 'default',
  store_id uuid not null,
  store_name text not null default 'ChinaTech',
  store_address text not null default 'Viale Vittorio Veneto, 7, Floridia (SR)',
  store_phone text not null default '',
  store_whatsapp text not null default '',
  store_email text not null default '',
  default_order_warranty_text text not null default '6个月',
  default_inventory_warranty_months integer not null default 12,
  print_footer text not null default 'Grazie per aver scelto ChinaTech.',
  message_signature text not null default 'ChinaTech - Viale Vittorio Veneto, 7, Floridia (SR)',
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_settings_store_id_fkey
    foreign key (store_id) references public.stores(id)
    on update cascade on delete restrict,
  constraint store_settings_updated_by_fkey
    foreign key (updated_by) references public.staff_profiles(id)
    on delete set null,
  constraint store_settings_inventory_warranty_check
    check (default_inventory_warranty_months >= 0)
);

create unique index if not exists store_settings_store_id_unique
  on public.store_settings (store_id);

insert into public.store_settings (id, store_id, store_name)
select
  case
    when id = '00000000-0000-0000-0000-000000000001'::uuid then 'default'
    else 'store-settings:' || id::text
  end,
  id,
  name
from public.stores
on conflict (id) do nothing;

alter table public.store_settings enable row level security;
revoke all on table public.store_settings from anon, authenticated;
grant all on table public.store_settings to service_role;

alter table public.message_templates
  alter column id drop default;

alter table public.message_templates
  alter column id type text using id::text,
  alter column id set default gen_random_uuid()::text,
  alter column language set default 'it';

alter table public.message_templates
  add column if not exists domain text not null default 'order',
  add column if not exists kind text not null default 'general',
  add column if not exists channel text not null default 'whatsapp',
  add column if not exists label text not null default '',
  add column if not exists body_template text not null default '',
  add column if not exists enabled boolean not null default true,
  add column if not exists sort_order integer not null default 0,
  add column if not exists updated_by uuid;

update public.message_templates
set
  domain = coalesce(nullif(domain, ''), case when type = 'customer' then 'customer' else 'order' end),
  kind = coalesce(nullif(kind, ''), code),
  channel = coalesce(nullif(channel, ''), 'whatsapp'),
  label = coalesce(nullif(label, ''), code),
  body_template = coalesce(nullif(body_template, ''), body),
  enabled = coalesce(enabled, is_active, true),
  language = lower(language);

do $$
begin
  alter table public.message_templates
    add constraint message_templates_updated_by_fkey
    foreign key (updated_by) references public.staff_profiles(id)
    on update cascade on delete set null;
exception when duplicate_object then null;
end $$;

create unique index if not exists message_templates_store_kind_unique
  on public.message_templates (store_id, domain, kind, channel, language)
  where deleted_at is null;
create index if not exists message_templates_domain_sort_idx
  on public.message_templates (store_id, domain, sort_order, label);

grant all on table public.message_templates to service_role;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'message_templates'
      and column_name = 'code'
  ) then
    execute $sql$
      create or replace function public.repairdesk_sync_message_template_legacy_columns()
      returns trigger
      language plpgsql
      as $fn$
      begin
        new.domain := coalesce(nullif(new.domain, ''), case when new.type = 'customer' then 'customer' else 'order' end);
        new.kind := coalesce(nullif(new.kind, ''), nullif(new.code, ''), 'general');
        new.channel := coalesce(nullif(new.channel, ''), 'whatsapp');
        new.language := lower(coalesce(nullif(new.language, ''), 'it'));
        new.label := coalesce(nullif(new.label, ''), new.kind);
        new.body_template := coalesce(nullif(new.body_template, ''), nullif(new.body, ''), '');
        new.enabled := coalesce(new.enabled, new.is_active, true);
        new.code := coalesce(nullif(new.code, ''), concat_ws('_', new.domain, new.channel, new.kind, new.language));
        new.type := coalesce(nullif(new.type, ''), new.domain);
        new.body := coalesce(nullif(new.body, ''), new.body_template);
        new.is_active := coalesce(new.is_active, new.enabled, true);
        return new;
      end;
      $fn$;
    $sql$;

    drop trigger if exists repairdesk_sync_message_template_legacy_columns_trg
      on public.message_templates;
    create trigger repairdesk_sync_message_template_legacy_columns_trg
    before insert or update on public.message_templates
    for each row execute function public.repairdesk_sync_message_template_legacy_columns();
  end if;
end $$;
