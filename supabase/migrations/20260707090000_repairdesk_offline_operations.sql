-- RepairDesk offline operation idempotency table.
--
-- Local approval draft only. Do not apply to a linked or production Supabase
-- project until the Owner approves the offline sync server write strategy,
-- migration window, rollback plan, and HMAC secret handling.
--
-- This table intentionally stores only replay metadata and digest values. It
-- must not store raw offline payloads, customer PII, device unlock values,
-- attachment paths, signed URLs, message bodies, or payment data.

create table if not exists public.repairdesk_offline_operations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null
    references public.stores(id) on delete cascade,
  actor_id uuid not null
    references public.staff_profiles(id) on delete restrict,
  operation_type text not null
    check (operation_type in ('order_create', 'order_update')),
  operation_id text not null
    check (
      length(operation_id) between 8 and 128
      and operation_id ~ '^[A-Za-z0-9:_-]+$'
    ),
  request_hash text not null
    check (request_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'started'
    check (status in ('started', 'succeeded', 'conflict', 'blocked', 'failed')),
  result_code text
    check (
      result_code is null
      or result_code in (
        'synced',
        'idempotent_replay',
        'idempotency_conflict',
        'stale_version',
        'needs_review',
        'blocked_operation',
        'unauthorized',
        'forbidden',
        'retryable_error'
      )
    ),
  target_entity_type text
    check (target_entity_type is null or target_entity_type = 'repair_order'),
  target_entity_id text,
  response_summary jsonb not null default '{}'::jsonb
    check (jsonb_typeof(response_summary) = 'object'),
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days'),
  constraint repairdesk_offline_operations_target_pair_check
    check (
      (target_entity_type is null and target_entity_id is null)
      or (target_entity_type is not null and target_entity_id is not null)
    )
);

create unique index if not exists repairdesk_offline_operations_unique_operation_idx
on public.repairdesk_offline_operations (
  store_id,
  actor_id,
  operation_type,
  operation_id
);

create index if not exists repairdesk_offline_operations_store_created_idx
on public.repairdesk_offline_operations (store_id, created_at desc);

create index if not exists repairdesk_offline_operations_expires_idx
on public.repairdesk_offline_operations (expires_at);

alter table public.repairdesk_offline_operations enable row level security;

revoke all on table public.repairdesk_offline_operations from public;
revoke all on table public.repairdesk_offline_operations from anon;
revoke all on table public.repairdesk_offline_operations from authenticated;
grant all on table public.repairdesk_offline_operations to service_role;

comment on table public.repairdesk_offline_operations is
  'Server-only offline sync idempotency ledger. Stores operation ids, HMAC request hashes, replay status, and minimal non-PII response metadata only.';
comment on column public.repairdesk_offline_operations.operation_id is
  'Client-generated operation id scoped by store, actor, and operation type.';
comment on column public.repairdesk_offline_operations.request_hash is
  'Server-generated HMAC-SHA256 digest of the strict canonical offline sync payload; never a raw payload.';
comment on column public.repairdesk_offline_operations.response_summary is
  'Minimal replay summary such as serverOrderId, publicNo, updatedAt, and resultCode. Do not store PII, unlock values, attachments, messages, or payment payloads.';
comment on column public.repairdesk_offline_operations.expires_at is
  'Retention marker for future approved cleanup jobs. No cleanup job is included in this draft.';
