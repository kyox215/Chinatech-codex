set lock_timeout = '5s';

create table if not exists public.store_lifecycles (
  store_id uuid primary key
    references public.stores(id) on update cascade on delete restrict,
  phase text not null default 'active'
    check (phase in (
      'active',
      'closing',
      'archived',
      'purge_scheduled',
      'purging',
      'purge_failed',
      'purged'
    )),
  revision bigint not null default 1 check (revision >= 1),
  close_requested_at timestamptz,
  access_cutoff_at timestamptz,
  archive_eligible_at timestamptz,
  archived_at timestamptz,
  purge_after timestamptz,
  retention_until timestamptz,
  legal_hold_until timestamptz,
  close_reason_code text,
  last_operation_id uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (archive_eligible_at is null or access_cutoff_at is not null),
  check (purge_after is null or phase in ('archived', 'purge_scheduled', 'purging', 'purge_failed'))
);

comment on table public.store_lifecycles is
  'Owner-requested store lifecycle. Platform risk status remains in stores.status.';

create table if not exists public.store_lifecycle_operations (
  operation_id uuid primary key,
  store_id uuid not null
    references public.stores(id) on update cascade on delete restrict,
  kind text not null
    check (kind in (
      'rename',
      'request_close',
      'cancel_close',
      'finalize_archive',
      'restore',
      'schedule_purge',
      'cancel_purge'
    )),
  request_hash char(64) not null check (request_hash ~ '^[0-9a-f]{64}$'),
  expected_revision bigint not null check (expected_revision >= 1),
  result_revision bigint check (result_revision >= 1),
  state text not null default 'running'
    check (state in ('running', 'completed', 'failed')),
  current_step text not null default 'accepted',
  result_summary jsonb not null default '{}'::jsonb,
  actor_id uuid not null,
  lease_owner text,
  lease_expires_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, operation_id)
);

create unique index if not exists store_lifecycle_one_running_operation_idx
  on public.store_lifecycle_operations (store_id)
  where state = 'running';

create index if not exists store_lifecycle_operations_store_created_idx
  on public.store_lifecycle_operations (store_id, created_at desc);

create table if not exists public.store_lifecycle_preflights (
  id uuid primary key,
  store_id uuid not null
    references public.stores(id) on update cascade on delete restrict,
  lifecycle_revision bigint not null check (lifecycle_revision >= 1),
  catalog_fingerprint char(64) not null
    check (catalog_fingerprint ~ '^[0-9a-f]{64}$'),
  snapshot_hash char(64) not null unique
    check (snapshot_hash ~ '^[0-9a-f]{64}$'),
  state text not null check (state in ('eligible', 'blocked')),
  counts jsonb not null default '{}'::jsonb,
  blockers jsonb not null default '[]'::jsonb,
  holds jsonb not null default '[]'::jsonb,
  storage_summary jsonb not null default '{}'::jsonb,
  actor_id uuid not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(counts) = 'object'),
  check (jsonb_typeof(blockers) = 'array'),
  check (jsonb_typeof(holds) = 'array'),
  check (jsonb_typeof(storage_summary) = 'object')
);

create index if not exists store_lifecycle_preflights_store_created_idx
  on public.store_lifecycle_preflights (store_id, created_at desc);

create table if not exists public.store_lifecycle_challenges (
  id uuid primary key,
  store_id uuid not null
    references public.stores(id) on update cascade on delete restrict,
  actor_id uuid not null,
  operation_kind text not null
    check (operation_kind in ('rename', 'request_close', 'cancel_close', 'restore', 'schedule_purge')),
  lifecycle_revision bigint not null check (lifecycle_revision >= 1),
  preflight_snapshot_hash char(64)
    check (preflight_snapshot_hash is null or preflight_snapshot_hash ~ '^[0-9a-f]{64}$'),
  assurance_level text not null check (assurance_level in ('aal2')),
  status text not null default 'issued' check (status in ('issued', 'consumed', 'expired')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'consumed') = (consumed_at is not null))
);

create index if not exists store_lifecycle_challenges_actor_expiry_idx
  on public.store_lifecycle_challenges (actor_id, expires_at desc)
  where status = 'issued';

insert into public.store_lifecycles (store_id, phase, revision)
select id, 'active', 1
from public.stores
on conflict (store_id) do nothing;

create or replace function public.repairdesk_initialize_store_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.store_lifecycles (store_id, phase, revision)
  values (new.id, 'active', 1)
  on conflict (store_id) do nothing;
  return new;
end;
$$;

drop trigger if exists repairdesk_initialize_store_lifecycle_trigger on public.stores;
create trigger repairdesk_initialize_store_lifecycle_trigger
after insert on public.stores
for each row execute function public.repairdesk_initialize_store_lifecycle();

alter table public.store_lifecycles enable row level security;
alter table public.store_lifecycle_operations enable row level security;
alter table public.store_lifecycle_preflights enable row level security;
alter table public.store_lifecycle_challenges enable row level security;

revoke all on table public.store_lifecycles from public, anon, authenticated;
revoke all on table public.store_lifecycle_operations from public, anon, authenticated;
revoke all on table public.store_lifecycle_preflights from public, anon, authenticated;
revoke all on table public.store_lifecycle_challenges from public, anon, authenticated;
grant select, insert, update, delete on table public.store_lifecycles to service_role;
grant select, insert, update, delete on table public.store_lifecycle_operations to service_role;
grant select, insert on table public.store_lifecycle_preflights to service_role;
grant select, insert, update on table public.store_lifecycle_challenges to service_role;

revoke all on function public.repairdesk_initialize_store_lifecycle() from public, anon, authenticated;

reset lock_timeout;
