insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
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
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.order_attachments (
  id text primary key,
  store_id uuid not null,
  order_id text not null,
  kind text not null default 'other',
  file_name text not null,
  mime_type text not null,
  file_size integer not null check (file_size >= 0 and file_size <= 8388608),
  storage_bucket text not null default 'repairdesk-order-attachments',
  storage_path text not null,
  public_url text,
  note text,
  uploaded_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_attachments_order_same_store_fkey
    foreign key (order_id, store_id)
    references public.repair_orders (id, store_id)
    on update cascade
    on delete cascade,
  constraint order_attachments_kind_check
    check (kind in ('device_front', 'device_back', 'screen_on', 'fault_photo', 'signature', 'other')),
  constraint order_attachments_storage_path_unique unique (storage_bucket, storage_path)
);

create index if not exists order_attachments_store_order_created_idx
  on public.order_attachments (store_id, order_id, created_at desc);

alter table public.order_attachments enable row level security;

revoke all on table public.order_attachments from anon, authenticated;
grant all on table public.order_attachments to service_role;

comment on table public.order_attachments is
  'Private order attachment metadata. Upload/read is routed through the server service-role API; direct client storage access is intentionally not enabled.';
