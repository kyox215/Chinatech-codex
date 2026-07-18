set lock_timeout = '5s';

create table if not exists public.store_export_jobs (
  id uuid primary key,
  store_id uuid not null
    references public.stores(id) on update cascade on delete restrict,
  preflight_id uuid not null
    references public.store_lifecycle_preflights(id) on update cascade on delete restrict,
  state text not null default 'pending'
    check (state in ('pending', 'exporting', 'completed', 'restore_verified', 'failed')),
  schema_version text not null,
  app_version text not null,
  database_manifest_sha256 char(64)
    check (database_manifest_sha256 is null or database_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  storage_manifest_sha256 char(64)
    check (storage_manifest_sha256 is null or storage_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  artifact_sha256 char(64)
    check (artifact_sha256 is null or artifact_sha256 ~ '^[0-9a-f]{64}$'),
  database_row_counts jsonb not null default '{}'::jsonb,
  storage_object_count bigint not null default 0 check (storage_object_count >= 0),
  storage_total_bytes bigint not null default 0 check (storage_total_bytes >= 0),
  encrypted_artifact_ref text,
  encryption_key_ref text,
  actor_id uuid not null,
  owner_ack_at timestamptz,
  restore_verified_at timestamptz,
  restore_verified_by uuid,
  restore_proof_sha256 char(64)
    check (restore_proof_sha256 is null or restore_proof_sha256 ~ '^[0-9a-f]{64}$'),
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  check (jsonb_typeof(database_row_counts) = 'object'),
  check (encrypted_artifact_ref is null or encrypted_artifact_ref !~* '(^|[?&])(token|signature|key)=')
);

comment on column public.store_export_jobs.encrypted_artifact_ref is
  'Opaque durable object reference only. Never store signed URLs or credentials.';

create index if not exists store_export_jobs_store_created_idx
  on public.store_export_jobs (store_id, created_at desc);

create table if not exists public.store_purge_jobs (
  id uuid primary key,
  store_id uuid not null
    references public.stores(id) on update cascade on delete restrict,
  export_job_id uuid not null
    references public.store_export_jobs(id) on update cascade on delete restrict,
  preflight_id uuid not null
    references public.store_lifecycle_preflights(id) on update cascade on delete restrict,
  operation_id uuid not null unique,
  approval_ref_hash char(64) not null check (approval_ref_hash ~ '^[0-9a-f]{64}$'),
  state text not null default 'scheduled'
    check (state in ('scheduled', 'queued', 'running', 'retry', 'failed', 'completed', 'cancelled')),
  destructive_step_started boolean not null default false,
  current_step text not null default 'prepare',
  next_attempt_at timestamptz not null default now(),
  lease_owner text,
  lease_expires_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  purge_after timestamptz not null,
  actor_id uuid not null,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  check (state <> 'completed' or completed_at is not null),
  check (state <> 'cancelled' or destructive_step_started = false)
);

create unique index if not exists store_purge_jobs_one_active_store_idx
  on public.store_purge_jobs (store_id)
  where state in ('scheduled', 'queued', 'running', 'retry');

create index if not exists store_purge_jobs_worker_claim_idx
  on public.store_purge_jobs (state, next_attempt_at, created_at)
  where state in ('queued', 'retry');

create table if not exists public.store_purge_steps (
  purge_job_id uuid not null
    references public.store_purge_jobs(id) on update cascade on delete cascade,
  step_key text not null,
  state text not null default 'pending'
    check (state in ('pending', 'running', 'completed', 'failed', 'skipped')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  cursor jsonb not null default '{}'::jsonb,
  progress jsonb not null default '{}'::jsonb,
  row_count bigint check (row_count is null or row_count >= 0),
  result_sha256 char(64) check (result_sha256 is null or result_sha256 ~ '^[0-9a-f]{64}$'),
  error_code text,
  next_attempt_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (purge_job_id, step_key),
  check (jsonb_typeof(cursor) = 'object'),
  check (jsonb_typeof(progress) = 'object')
);

create index if not exists store_purge_steps_retry_idx
  on public.store_purge_steps (state, next_attempt_at)
  where state in ('pending', 'failed');

create table if not exists public.store_tombstones (
  store_id_hash char(64) primary key check (store_id_hash ~ '^[0-9a-f]{64}$'),
  purge_operation_id uuid not null unique,
  approval_ref_hash char(64) not null check (approval_ref_hash ~ '^[0-9a-f]{64}$'),
  database_manifest_sha256 char(64) not null
    check (database_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  storage_manifest_sha256 char(64) not null
    check (storage_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  artifact_sha256 char(64) not null
    check (artifact_sha256 ~ '^[0-9a-f]{64}$'),
  zero_residual_proof_sha256 char(64) not null
    check (zero_residual_proof_sha256 ~ '^[0-9a-f]{64}$'),
  completed_at timestamptz not null,
  created_at timestamptz not null default now()
);

comment on table public.store_tombstones is
  'Minimal non-PII proof that a store purge completed. It intentionally has no stores FK.';

alter table public.onboarding_requests
  add column if not exists target_store_tombstone_hash char(64);

alter table public.onboarding_requests
  drop constraint if exists onboarding_requests_target_store_tombstone_hash_check,
  add constraint onboarding_requests_target_store_tombstone_hash_check
    check (
      target_store_tombstone_hash is null
      or target_store_tombstone_hash ~ '^[0-9a-f]{64}$'
    );

alter table public.onboarding_requests
  drop constraint if exists onboarding_requests_join_store_private_target_check,
  add constraint onboarding_requests_join_store_private_target_check
    check (
      request_type <> 'join_store'
      or target_store_id is not null
      or target_owner_email is not null
      or (
        status <> 'pending'::public.onboarding_request_status
        and target_store_tombstone_hash is not null
      )
    );

alter table public.onboarding_requests
  drop constraint if exists onboarding_requests_kind_data,
  add constraint onboarding_requests_kind_data
    check (
      (request_type = 'create_store' and desired_store_name is not null)
      or (
        request_type = 'join_store'
        and (
          target_store_id is not null
          or nullif(btrim(target_owner_email), '') is not null
          or (
            status <> 'pending'::public.onboarding_request_status
            and target_store_tombstone_hash is not null
          )
        )
      )
    );

alter table public.store_export_jobs enable row level security;
alter table public.store_purge_jobs enable row level security;
alter table public.store_purge_steps enable row level security;
alter table public.store_tombstones enable row level security;

revoke all on table public.store_export_jobs from public, anon, authenticated;
revoke all on table public.store_purge_jobs from public, anon, authenticated;
revoke all on table public.store_purge_steps from public, anon, authenticated;
revoke all on table public.store_tombstones from public, anon, authenticated;
grant select, insert, update on table public.store_export_jobs to service_role;
grant select, insert, update on table public.store_purge_jobs to service_role;
grant select, insert, update on table public.store_purge_steps to service_role;
grant select, insert on table public.store_tombstones to service_role;

create or replace function public.repairdesk_claim_store_purge_job(
  p_worker_id text,
  p_lease_seconds integer default 60
)
returns setof public.store_purge_jobs
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_job_id uuid;
begin
  if nullif(btrim(p_worker_id), '') is null
     or p_lease_seconds < 15
     or p_lease_seconds > 300 then
    raise exception using errcode = 'P0001', message = 'STORE_PURGE_INVALID_WORKER_LEASE';
  end if;

  select id into v_job_id
  from public.store_purge_jobs
  where state in ('queued', 'retry')
    and next_attempt_at <= now()
    and (lease_expires_at is null or lease_expires_at <= now())
  order by next_attempt_at asc, created_at asc
  for update skip locked
  limit 1;

  if v_job_id is null then
    return;
  end if;

  return query
  update public.store_purge_jobs
     set state = 'running',
         lease_owner = btrim(p_worker_id),
         lease_expires_at = now() + make_interval(secs => p_lease_seconds),
         attempt_count = attempt_count + 1,
         started_at = coalesce(started_at, now()),
         updated_at = now()
   where id = v_job_id
   returning *;
end;
$$;

revoke all on function public.repairdesk_claim_store_purge_job(text, integer)
  from public, anon, authenticated;
grant execute on function public.repairdesk_claim_store_purge_job(text, integer) to service_role;

select pg_notify('pgrst', 'reload schema');

reset lock_timeout;
