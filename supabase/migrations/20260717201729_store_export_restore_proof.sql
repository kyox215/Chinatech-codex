set lock_timeout = '5s';

create table if not exists public.store_export_table_manifests (
  export_job_id uuid not null
    references public.store_export_jobs(id) on update cascade on delete cascade,
  table_name text not null,
  primary_key_columns jsonb not null default '[]'::jsonb,
  row_count bigint not null check (row_count >= 0),
  content_sha256 char(64) not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  completed_at timestamptz not null default now(),
  primary key (export_job_id, table_name),
  check (table_name ~ '^[a-z][a-z0-9_]{0,62}$'),
  check (jsonb_typeof(primary_key_columns) = 'array')
);

create table if not exists public.store_export_storage_objects (
  export_job_id uuid not null
    references public.store_export_jobs(id) on update cascade on delete cascade,
  bucket_id text not null,
  object_path text not null,
  byte_size bigint not null check (byte_size >= 0),
  content_sha256 char(64) not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  metadata_sha256 char(64) not null check (metadata_sha256 ~ '^[0-9a-f]{64}$'),
  completed_at timestamptz not null default now(),
  primary key (export_job_id, bucket_id, object_path),
  check (bucket_id in (
    'repairdesk-order-attachments',
    'repairdesk-inventory-attachments',
    'repairdesk-buyback-evidence'
  )),
  check (object_path !~ '(^|/)(\.\.|\.)($|/)')
);

create table if not exists public.store_restore_proofs (
  id uuid primary key,
  export_job_id uuid not null unique
    references public.store_export_jobs(id) on update cascade on delete restrict,
  store_id uuid not null
    references public.stores(id) on update cascade on delete restrict,
  isolated_environment_ref_hash char(64) not null
    check (isolated_environment_ref_hash ~ '^[0-9a-f]{64}$'),
  database_manifest_sha256 char(64) not null
    check (database_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  storage_manifest_sha256 char(64) not null
    check (storage_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  table_mismatches jsonb not null default '[]'::jsonb,
  storage_mismatches jsonb not null default '[]'::jsonb,
  smoke_checks jsonb not null default '{}'::jsonb,
  proof_sha256 char(64) not null check (proof_sha256 ~ '^[0-9a-f]{64}$'),
  verified_by uuid not null,
  verified_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(table_mismatches) = 'array'),
  check (jsonb_typeof(storage_mismatches) = 'array'),
  check (jsonb_typeof(smoke_checks) = 'object'),
  check (jsonb_array_length(table_mismatches) = 0),
  check (jsonb_array_length(storage_mismatches) = 0)
);

alter table public.store_export_table_manifests enable row level security;
alter table public.store_export_storage_objects enable row level security;
alter table public.store_restore_proofs enable row level security;

revoke all on table public.store_export_table_manifests from public, anon, authenticated;
revoke all on table public.store_export_storage_objects from public, anon, authenticated;
revoke all on table public.store_restore_proofs from public, anon, authenticated;
grant select, insert, update on table public.store_export_table_manifests to service_role;
grant select, insert, update on table public.store_export_storage_objects to service_role;
grant select, insert on table public.store_restore_proofs to service_role;

alter table public.store_export_jobs
  add column if not exists artifact_sha256 char(64);
alter table public.store_export_jobs
  drop constraint if exists store_export_jobs_artifact_sha256_check,
  add constraint store_export_jobs_artifact_sha256_check
    check (artifact_sha256 is null or artifact_sha256 ~ '^[0-9a-f]{64}$');

create or replace function public.repairdesk_store_data_catalog()
returns table (
  table_name text,
  primary_key_columns jsonb
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select
    table_info.table_name::text,
    coalesce(
      (
        select jsonb_agg(attribute.attname order by key_column.ordinality)
        from pg_catalog.pg_index index_info
        join lateral unnest(index_info.indkey) with ordinality as key_column(attnum, ordinality)
          on true
        join pg_catalog.pg_attribute attribute
          on attribute.attrelid = index_info.indrelid
         and attribute.attnum = key_column.attnum
        where index_info.indrelid = format('public.%I', table_info.table_name)::regclass
          and index_info.indisprimary
      ),
      '[]'::jsonb
    ) as primary_key_columns
  from information_schema.tables table_info
  where table_info.table_schema = 'public'
    and table_info.table_type = 'BASE TABLE'
    and (
      table_info.table_name = 'stores'
      or exists (
        select 1
        from information_schema.columns column_info
        where column_info.table_schema = table_info.table_schema
          and column_info.table_name = table_info.table_name
          and column_info.column_name = 'store_id'
          and column_info.udt_name = 'uuid'
      )
    )
    and table_info.table_name not in (
      'store_lifecycle_operations',
      'store_lifecycle_preflights',
      'store_lifecycle_challenges',
      'store_export_jobs',
      'store_restore_proofs',
      'store_purge_jobs'
    )
  order by table_info.table_name;
$$;

create or replace function public.repairdesk_store_row_counts(p_store_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_catalog record;
  v_count bigint;
  v_counts jsonb := '{}'::jsonb;
begin
  for v_catalog in select * from public.repairdesk_store_data_catalog() loop
    execute format(
      'select count(*) from public.%1$I where %2$I = $1',
      v_catalog.table_name,
      case when v_catalog.table_name = 'stores' then 'id' else 'store_id' end
    )
      into v_count using p_store_id;
    v_counts := v_counts || jsonb_build_object(v_catalog.table_name, v_count);
  end loop;
  return v_counts;
end;
$$;

drop function if exists public.repairdesk_complete_store_export_rpc(uuid, uuid, uuid, text, text);

create or replace function public.repairdesk_complete_store_export_rpc(
  p_export_job_id uuid,
  p_store_id uuid,
  p_actor_id uuid,
  p_encrypted_artifact_ref text,
  p_encryption_key_ref text,
  p_artifact_sha256 text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, extensions
as $$
declare
  v_now timestamptz := now();
  v_job public.store_export_jobs%rowtype;
  v_catalog_count integer;
  v_manifest_count integer;
  v_database_manifest_sha256 char(64);
  v_storage_manifest_sha256 char(64);
  v_row_counts jsonb;
  v_storage_count bigint;
  v_storage_bytes bigint;
begin
  if nullif(btrim(p_encrypted_artifact_ref), '') is null
     or nullif(btrim(p_encryption_key_ref), '') is null
     or p_artifact_sha256 !~ '^[0-9a-f]{64}$'
     or p_encrypted_artifact_ref ~* '(^|[?&])(token|signature|key)=' then
    raise exception using errcode = 'P0001', message = 'STORE_EXPORT_INVALID_ARTIFACT_REFERENCE';
  end if;
  select * into v_job
  from public.store_export_jobs
  where id = p_export_job_id and store_id = p_store_id
  for update;
  if v_job.id is null or v_job.state not in ('pending', 'exporting') then
    raise exception using errcode = 'P0001', message = 'STORE_EXPORT_INVALID_STATE';
  end if;
  if v_job.actor_id <> p_actor_id then
    raise exception using errcode = 'P0001', message = 'STORE_LIFECYCLE_FORBIDDEN';
  end if;

  select count(*) into v_catalog_count from public.repairdesk_store_data_catalog();
  select count(*) into v_manifest_count
  from public.store_export_table_manifests manifest
  where manifest.export_job_id = p_export_job_id;
  if v_manifest_count <> v_catalog_count or exists (
    select 1 from public.repairdesk_store_data_catalog() catalog
    left join public.store_export_table_manifests manifest
      on manifest.export_job_id = p_export_job_id
     and manifest.table_name = catalog.table_name
    where manifest.table_name is null
  ) then
    raise exception using errcode = 'P0001', message = 'STORE_EXPORT_DATABASE_MANIFEST_INCOMPLETE';
  end if;

  select
    encode(
      extensions.digest(
        convert_to(
          coalesce(string_agg(
            manifest.table_name || ':' || manifest.row_count::text || ':' || manifest.content_sha256,
            E'\n' order by manifest.table_name
          ), ''),
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    ),
    coalesce(jsonb_object_agg(manifest.table_name, manifest.row_count order by manifest.table_name), '{}'::jsonb)
  into v_database_manifest_sha256, v_row_counts
  from public.store_export_table_manifests manifest
  where manifest.export_job_id = p_export_job_id;

  select
    encode(
      extensions.digest(
        convert_to(
          coalesce(string_agg(
            storage_object.bucket_id || ':' || storage_object.object_path || ':' ||
            storage_object.byte_size::text || ':' || storage_object.content_sha256 || ':' ||
            storage_object.metadata_sha256,
            E'\n' order by storage_object.bucket_id, storage_object.object_path
          ), ''),
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    ),
    count(*),
    coalesce(sum(storage_object.byte_size), 0)
  into v_storage_manifest_sha256, v_storage_count, v_storage_bytes
  from public.store_export_storage_objects storage_object
  where storage_object.export_job_id = p_export_job_id;

  update public.store_export_jobs
     set state = 'completed',
         database_manifest_sha256 = v_database_manifest_sha256,
         storage_manifest_sha256 = v_storage_manifest_sha256,
         artifact_sha256 = p_artifact_sha256,
         database_row_counts = v_row_counts,
         storage_object_count = v_storage_count,
         storage_total_bytes = v_storage_bytes,
         encrypted_artifact_ref = btrim(p_encrypted_artifact_ref),
         encryption_key_ref = btrim(p_encryption_key_ref),
         completed_at = v_now,
         updated_at = v_now,
         error_code = null
   where id = p_export_job_id;

  return jsonb_build_object(
    'export_job_id', p_export_job_id,
    'database_manifest_sha256', v_database_manifest_sha256,
    'storage_manifest_sha256', v_storage_manifest_sha256,
    'artifact_sha256', p_artifact_sha256,
    'database_row_counts', v_row_counts,
    'storage_object_count', v_storage_count,
    'storage_total_bytes', v_storage_bytes
  );
end;
$$;

create or replace function public.repairdesk_record_store_restore_proof_rpc(
  p_proof_id uuid,
  p_export_job_id uuid,
  p_store_id uuid,
  p_verified_by uuid,
  p_isolated_environment_ref_hash text,
  p_database_manifest_sha256 text,
  p_storage_manifest_sha256 text,
  p_table_mismatches jsonb,
  p_storage_mismatches jsonb,
  p_smoke_checks jsonb,
  p_proof_sha256 text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := now();
  v_job public.store_export_jobs%rowtype;
begin
  select * into v_job
  from public.store_export_jobs
  where id = p_export_job_id and store_id = p_store_id
  for update;
  if v_job.id is null or v_job.state not in ('completed', 'restore_verified') then
    raise exception using errcode = 'P0001', message = 'STORE_RESTORE_PROOF_INVALID_EXPORT';
  end if;
  if v_job.database_manifest_sha256 <> p_database_manifest_sha256
     or v_job.storage_manifest_sha256 <> p_storage_manifest_sha256
     or jsonb_typeof(p_table_mismatches) <> 'array'
     or jsonb_typeof(p_storage_mismatches) <> 'array'
     or jsonb_array_length(p_table_mismatches) <> 0
     or jsonb_array_length(p_storage_mismatches) <> 0
     or jsonb_typeof(p_smoke_checks) <> 'object'
     or coalesce((p_smoke_checks ->> 'store_read')::boolean, false) is not true then
    raise exception using errcode = 'P0001', message = 'STORE_RESTORE_PROOF_MISMATCH';
  end if;

  insert into public.store_restore_proofs (
    id, export_job_id, store_id, isolated_environment_ref_hash,
    database_manifest_sha256, storage_manifest_sha256,
    table_mismatches, storage_mismatches, smoke_checks,
    proof_sha256, verified_by, verified_at
  ) values (
    p_proof_id, p_export_job_id, p_store_id, p_isolated_environment_ref_hash,
    p_database_manifest_sha256, p_storage_manifest_sha256,
    p_table_mismatches, p_storage_mismatches, p_smoke_checks,
    p_proof_sha256, p_verified_by, v_now
  ) on conflict (export_job_id) do nothing;

  update public.store_export_jobs
     set state = 'restore_verified', restore_verified_at = v_now,
         restore_verified_by = p_verified_by, restore_proof_sha256 = p_proof_sha256,
         updated_at = v_now
   where id = p_export_job_id;
  return jsonb_build_object(
    'export_job_id', p_export_job_id,
    'verified', true,
    'proof_sha256', p_proof_sha256,
    'verified_at', v_now
  );
end;
$$;

revoke all on function public.repairdesk_store_data_catalog() from public, anon, authenticated;
grant execute on function public.repairdesk_store_data_catalog() to service_role;
revoke all on function public.repairdesk_store_row_counts(uuid) from public, anon, authenticated;
grant execute on function public.repairdesk_store_row_counts(uuid) to service_role;
revoke all on function public.repairdesk_complete_store_export_rpc(uuid, uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.repairdesk_complete_store_export_rpc(uuid, uuid, uuid, text, text, text)
  to service_role;
revoke all on function public.repairdesk_record_store_restore_proof_rpc(
  uuid, uuid, uuid, uuid, text, text, text, jsonb, jsonb, jsonb, text
) from public, anon, authenticated;
grant execute on function public.repairdesk_record_store_restore_proof_rpc(
  uuid, uuid, uuid, uuid, text, text, text, jsonb, jsonb, jsonb, text
) to service_role;

select pg_notify('pgrst', 'reload schema');

reset lock_timeout;
