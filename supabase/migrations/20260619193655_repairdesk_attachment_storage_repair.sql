-- RepairDesk attachment storage compatibility repair.
--
-- Production drift found on 2026-06-19:
-- - repairdesk-order-attachments bucket missing
-- - public.order_attachments missing
-- - public.inventory_attachments existed in an older shape, but the
--   repairdesk-inventory-attachments bucket was missing
--
-- This migration is intentionally idempotent and compatible with both the
-- historical local text IDs and the production UUID IDs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'repairdesk-order-attachments',
    'repairdesk-order-attachments',
    false,
    8388608,
    array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
      'application/pdf'
    ]
  ),
  (
    'repairdesk-inventory-attachments',
    'repairdesk-inventory-attachments',
    false,
    8388608,
    array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
      'application/pdf'
    ]
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
declare
  order_id_type text;
begin
  select format_type(attribute.atttypid, attribute.atttypmod)
  into order_id_type
  from pg_attribute attribute
  join pg_class table_class on table_class.oid = attribute.attrelid
  join pg_namespace namespace on namespace.oid = table_class.relnamespace
  where namespace.nspname = 'public'
    and table_class.relname = 'repair_orders'
    and attribute.attname = 'id'
    and not attribute.attisdropped;

  if order_id_type is null then
    raise exception 'public.repair_orders.id is required before creating order attachments';
  end if;

  if to_regclass('public.order_attachments') is null then
    execute format(
      $sql$
      create table public.order_attachments (
        id text primary key,
        store_id uuid not null,
        order_id %s not null,
        kind text not null default 'other',
        file_name text not null,
        mime_type text not null,
        file_size integer not null default 0,
        storage_bucket text not null default 'repairdesk-order-attachments',
        storage_path text not null,
        public_url text,
        note text,
        uploaded_by text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
      $sql$,
      order_id_type
    );
  end if;
end $$;

alter table public.order_attachments
  add column if not exists store_id uuid,
  add column if not exists kind text not null default 'other',
  add column if not exists file_name text not null default 'attachment',
  add column if not exists mime_type text not null default 'image/jpeg',
  add column if not exists file_size integer not null default 0,
  add column if not exists storage_bucket text not null default 'repairdesk-order-attachments',
  add column if not exists storage_path text,
  add column if not exists public_url text,
  add column if not exists note text,
  add column if not exists uploaded_by text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.order_attachments
  alter column store_id set not null,
  alter column storage_path set not null;

alter table public.order_attachments
  drop constraint if exists order_attachments_kind_check,
  drop constraint if exists order_attachments_file_size_check,
  drop constraint if exists order_attachments_bucket_check,
  drop constraint if exists order_attachments_public_url_null_check;

alter table public.order_attachments
  add constraint order_attachments_kind_check
    check (kind in ('device_front', 'device_back', 'screen_on', 'fault_photo', 'signature', 'other')) not valid,
  add constraint order_attachments_file_size_check
    check (file_size >= 0 and file_size <= 8388608) not valid,
  add constraint order_attachments_bucket_check
    check (storage_bucket = 'repairdesk-order-attachments') not valid,
  add constraint order_attachments_public_url_null_check
    check (public_url is null) not valid;

create unique index if not exists repair_orders_id_store_id_uidx
  on public.repair_orders (id, store_id);

do $$
begin
  alter table public.order_attachments
    add constraint order_attachments_order_same_store_fkey
      foreign key (order_id, store_id)
      references public.repair_orders (id, store_id)
      on update cascade
      on delete cascade
      not valid;
exception
  when duplicate_object then null;
end $$;

create unique index if not exists order_attachments_storage_path_uidx
  on public.order_attachments (storage_bucket, storage_path);

create index if not exists order_attachments_store_order_created_idx
  on public.order_attachments (store_id, order_id, created_at desc);

alter table public.order_attachments enable row level security;
drop policy if exists order_attachments_read on public.order_attachments;
revoke all on table public.order_attachments from anon, authenticated;
grant all on table public.order_attachments to service_role;

comment on table public.order_attachments is
  'Private order attachment metadata. Upload/read is routed through the server service-role API; direct client storage access is intentionally not enabled.';

do $$
declare
  item_id_type text;
begin
  select format_type(attribute.atttypid, attribute.atttypmod)
  into item_id_type
  from pg_attribute attribute
  join pg_class table_class on table_class.oid = attribute.attrelid
  join pg_namespace namespace on namespace.oid = table_class.relnamespace
  where namespace.nspname = 'public'
    and table_class.relname = 'inventory_items'
    and attribute.attname = 'id'
    and not attribute.attisdropped;

  if item_id_type is null then
    raise exception 'public.inventory_items.id is required before creating inventory attachments';
  end if;

  if to_regclass('public.inventory_attachments') is null then
    execute format(
      $sql$
      create table public.inventory_attachments (
        id text primary key,
        store_id uuid not null,
        item_id %s not null,
        kind text not null default 'other',
        file_name text not null default 'attachment',
        mime_type text not null default 'image/jpeg',
        file_size integer not null default 0,
        storage_bucket text not null default 'repairdesk-inventory-attachments',
        storage_path text not null,
        public_url text,
        note text,
        uploaded_by text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
      $sql$,
      item_id_type
    );
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'inventory_attachments'
      and column_name = 'inventory_item_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'inventory_attachments'
      and column_name = 'item_id'
  ) then
    alter table public.inventory_attachments
      rename column inventory_item_id to item_id;
  end if;
end $$;

alter table public.inventory_attachments
  add column if not exists store_id uuid,
  add column if not exists kind text not null default 'other',
  add column if not exists file_name text not null default 'attachment',
  add column if not exists mime_type text not null default 'image/jpeg',
  add column if not exists file_size integer not null default 0,
  add column if not exists storage_bucket text not null default 'repairdesk-inventory-attachments',
  add column if not exists storage_path text,
  add column if not exists public_url text,
  add column if not exists note text,
  add column if not exists uploaded_by text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.inventory_attachments
  alter column store_id set not null,
  alter column item_id set not null,
  alter column storage_path set not null;

alter table public.inventory_attachments
  drop constraint if exists inventory_attachments_kind_check,
  drop constraint if exists inventory_attachments_file_size_check,
  drop constraint if exists inventory_attachments_bucket_check,
  drop constraint if exists inventory_attachments_public_url_null_check;

alter table public.inventory_attachments
  add constraint inventory_attachments_kind_check
    check (
      kind in (
        'device_photo',
        'id_front',
        'id_back',
        'signature',
        'invoice_photo',
        'box_photo',
        'other',
        'invoice',
        'box'
      )
    ) not valid,
  add constraint inventory_attachments_file_size_check
    check (file_size >= 0 and file_size <= 8388608) not valid,
  add constraint inventory_attachments_bucket_check
    check (storage_bucket = 'repairdesk-inventory-attachments') not valid,
  add constraint inventory_attachments_public_url_null_check
    check (public_url is null) not valid;

create unique index if not exists inventory_items_id_store_id_uidx
  on public.inventory_items (id, store_id);

do $$
begin
  alter table public.inventory_attachments
    add constraint inventory_attachments_item_same_store_fkey
      foreign key (item_id, store_id)
      references public.inventory_items (id, store_id)
      on update cascade
      on delete cascade
      not valid;
exception
  when duplicate_object then null;
end $$;

create unique index if not exists inventory_attachments_storage_path_uidx
  on public.inventory_attachments (storage_bucket, storage_path);

create index if not exists inventory_attachments_store_item_created_idx
  on public.inventory_attachments (store_id, item_id, created_at desc);

create index if not exists inventory_attachments_store_item_kind_idx
  on public.inventory_attachments (store_id, item_id, kind);

alter table public.inventory_attachments enable row level security;
drop policy if exists inventory_attachments_read on public.inventory_attachments;
revoke all on table public.inventory_attachments from anon, authenticated;
grant all on table public.inventory_attachments to service_role;

comment on table public.inventory_attachments is
  'Private inventory/buyback attachment metadata. Upload/read is routed through the server service-role API; direct client storage access is intentionally not enabled.';
