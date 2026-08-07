-- Authenticated toolkit library. This migration is additive and intentionally
-- remains unapplied in production until the Owner approves the data/storage gate.
set lock_timeout = '5s';
set statement_timeout = '2min';

create table if not exists public.toolkit_resources (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('file', 'link')),
  state text not null default 'draft' check (state in ('draft', 'published', 'archived')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  platform text not null default '' check (char_length(platform) <= 80),
  version text not null default '' check (char_length(version) <= 80),
  display_file_name text,
  mime_type text,
  size_bytes bigint,
  target_url text,
  storage_bucket text,
  storage_path text,
  upload_state text not null default 'not_applicable'
    check (upload_state in ('not_applicable', 'pending', 'ready', 'quarantined')),
  security_review_state text not null default 'not_required'
    check (security_review_state in ('not_required', 'pending', 'clean')),
  provenance_note text check (provenance_note is null or char_length(provenance_note) <= 1000),
  trust_attestation boolean not null default false,
  revision integer not null default 1 check (revision > 0),
  created_by uuid references auth.users(id) on update cascade on delete restrict,
  updated_by uuid references auth.users(id) on update cascade on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint toolkit_resources_kind_target_check check (
    (kind = 'link'
      and target_url is not null
      and display_file_name is null
      and mime_type is null
      and size_bytes is null
      and storage_bucket is null
      and storage_path is null
      and upload_state = 'not_applicable'
      and security_review_state = 'not_required')
    or
    (kind = 'file'
      and target_url is null
      and display_file_name is not null
      and mime_type is not null
      and size_bytes between 1 and 209715200
      and storage_bucket = 'repairdesk-toolkit-files'
      and storage_path is not null
      and upload_state in ('pending', 'ready', 'quarantined')
      and security_review_state in ('pending', 'clean'))
  ),
  constraint toolkit_resources_published_file_check check (
    kind = 'link' or state <> 'published' or
    (upload_state = 'ready' and security_review_state = 'clean')
  ),
  constraint toolkit_resources_storage_path_check check (
    storage_path is null or (
      char_length(storage_path) between 8 and 256
      and storage_path !~ '\.\.'
      and storage_path !~ '[[:cntrl:]]'
    )
  )
);

create index if not exists toolkit_resources_state_updated_idx
  on public.toolkit_resources (state, updated_at desc);
create index if not exists toolkit_resources_kind_state_idx
  on public.toolkit_resources (kind, state, updated_at desc);
create unique index if not exists toolkit_resources_storage_object_unique_idx
  on public.toolkit_resources (storage_bucket, storage_path)
  where storage_bucket is not null and storage_path is not null;

alter table public.toolkit_resources enable row level security;
revoke all on table public.toolkit_resources from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.toolkit_resources to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'repairdesk-toolkit-files',
  'repairdesk-toolkit-files',
  false,
  209715200,
  array[
    'application/zip', 'application/x-zip-compressed', 'application/x-7z-compressed',
    'application/vnd.rar', 'application/x-rar-compressed',
    'application/vnd.microsoft.portable-executable', 'application/x-msdownload',
    'application/x-msi', 'application/x-apple-diskimage',
    'application/x-newton-compatible-pkg', 'application/vnd.android.package-archive',
    'application/vnd.debian.binary-package', 'application/x-deb',
    'application/pdf', 'application/octet-stream'
  ]::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
