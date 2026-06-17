insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
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

create table if not exists public.inventory_attachments (
  id text primary key,
  store_id uuid not null,
  item_id text not null,
  kind text not null default 'other',
  file_name text not null,
  mime_type text not null,
  file_size integer not null check (file_size >= 0 and file_size <= 8388608),
  storage_bucket text not null default 'repairdesk-inventory-attachments',
  storage_path text not null,
  public_url text,
  note text,
  uploaded_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_attachments_bucket_check
    check (storage_bucket = 'repairdesk-inventory-attachments'),
  constraint inventory_attachments_public_url_null_check
    check (public_url is null),
  constraint inventory_attachments_item_same_store_fkey
    foreign key (item_id, store_id)
    references public.inventory_items (id, store_id)
    on update cascade
    on delete cascade,
  constraint inventory_attachments_kind_check
    check (
      kind in (
        'device_photo',
        'id_front',
        'id_back',
        'signature',
        'invoice_photo',
        'box_photo',
        'other'
      )
    ),
  constraint inventory_attachments_storage_path_unique unique (storage_bucket, storage_path)
);

create index if not exists inventory_attachments_store_item_created_idx
  on public.inventory_attachments (store_id, item_id, created_at desc);

create index if not exists inventory_attachments_store_item_kind_idx
  on public.inventory_attachments (store_id, item_id, kind);

alter table public.inventory_attachments enable row level security;

revoke all on table public.inventory_attachments from anon, authenticated;
grant all on table public.inventory_attachments to service_role;

comment on table public.inventory_attachments is
  'Private inventory/buyback attachment metadata. Upload/read is routed through the server service-role API; direct client storage access is intentionally not enabled.';
