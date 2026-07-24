-- Stable one-per-order customer status QR identities.
--
-- The database stores only a random public locator and generation metadata.
-- The application derives the bearer token with a dedicated versioned HMAC
-- keyring, so neither order/store UUIDs nor a reusable raw bearer are stored.
-- Legacy hash-only links remain untouched and continue to resolve.

set lock_timeout = '5s';

create table public.customer_status_qr_key_config (
  singleton boolean primary key default true check (singleton),
  active_key_version smallint not null check (active_key_version > 0),
  updated_at timestamptz not null default now()
);

insert into public.customer_status_qr_key_config (singleton, active_key_version)
values (true, 1);

alter table public.customer_status_qr_key_config enable row level security;
revoke all on table public.customer_status_qr_key_config
  from public, anon, authenticated, service_role;
grant select on table public.customer_status_qr_key_config to service_role;

comment on table public.customer_status_qr_key_config is
  'Service-role-only active QR signing key version. Key material remains exclusively in the application secret store.';

create table public.repair_order_customer_status_identities (
  order_id uuid primary key,
  store_id uuid not null,
  public_id uuid not null default gen_random_uuid(),
  generation bigint not null default 1,
  key_version smallint not null,
  lifecycle_revision bigint not null,
  public_access_state text not null default 'enabled',
  disabled_at timestamptz,
  disabled_by uuid,
  disable_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint repair_order_customer_status_identities_public_id_unique unique (public_id),
  constraint repair_order_customer_status_identities_order_same_store_fkey
    foreign key (order_id, store_id)
    references public.repair_orders (id, store_id)
    on update cascade on delete cascade,
  constraint repair_order_customer_status_identities_disabled_by_fkey
    foreign key (disabled_by) references auth.users (id)
    on update cascade on delete set null,
  constraint repair_order_customer_status_identities_updated_by_fkey
    foreign key (updated_by) references auth.users (id)
    on update cascade on delete set null,
  constraint repair_order_customer_status_identities_generation_check
    check (generation > 0),
  constraint repair_order_customer_status_identities_key_version_check
    check (key_version > 0),
  constraint repair_order_customer_status_identities_lifecycle_revision_check
    check (lifecycle_revision >= 1),
  constraint repair_order_customer_status_identities_state_check
    check (public_access_state in ('enabled', 'disabled')),
  constraint repair_order_customer_status_identities_disable_state_check
    check (
      (
        public_access_state = 'enabled'
        and disabled_at is null
        and disabled_by is null
        and disable_reason is null
      )
      or (
        public_access_state = 'disabled'
        and disabled_at is not null
        and char_length(coalesce(disable_reason, '')) between 1 and 240
      )
    )
);

create index repair_order_customer_status_identities_store_order_idx
  on public.repair_order_customer_status_identities (store_id, order_id);

alter table public.repair_order_customer_status_identities enable row level security;

revoke all on table public.repair_order_customer_status_identities
  from public, anon, authenticated, service_role;
grant select on table public.repair_order_customer_status_identities to service_role;

comment on table public.repair_order_customer_status_identities is
  'One stable, service-role-only customer status QR identity per repair order. Stores no raw bearer token, customer PII, order UUID in the QR payload, IP address or user agent.';

do $$
declare
  v_missing_lifecycle bigint;
begin
  select count(*)
    into v_missing_lifecycle
    from public.repair_orders order_row
    left join public.store_lifecycles lifecycle
      on lifecycle.store_id = order_row.store_id
   where lifecycle.store_id is null
      or lifecycle.revision is null
      or lifecycle.revision < 1;

  if v_missing_lifecycle <> 0 then
    raise exception 'customer_status_identity_missing_lifecycle:%', v_missing_lifecycle
      using errcode = '23514';
  end if;
end;
$$;

insert into public.repair_order_customer_status_identities (
  order_id,
  store_id,
  lifecycle_revision,
  key_version
)
select
  order_row.id,
  order_row.store_id,
  lifecycle.revision,
  key_config.active_key_version
from public.repair_orders order_row
join public.store_lifecycles lifecycle
  on lifecycle.store_id = order_row.store_id
cross join public.customer_status_qr_key_config key_config
where key_config.singleton
on conflict (order_id) do nothing;

create or replace function public.repairdesk_create_customer_status_identity_v2()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lifecycle_revision bigint;
  v_active_key_version smallint;
begin
  select lifecycle.revision, key_config.active_key_version
    into v_lifecycle_revision, v_active_key_version
    from public.store_lifecycles lifecycle
    cross join public.customer_status_qr_key_config key_config
   where lifecycle.store_id = new.store_id;

  if v_lifecycle_revision is null or v_lifecycle_revision < 1 then
    raise exception 'customer_status_identity_missing_lifecycle'
      using errcode = '23514';
  end if;

  insert into public.repair_order_customer_status_identities (
    order_id,
    store_id,
    lifecycle_revision,
    key_version
  ) values (
    new.id,
    new.store_id,
    v_lifecycle_revision,
    v_active_key_version
  )
  on conflict (order_id) do nothing;

  return new;
end;
$$;

revoke all on function public.repairdesk_create_customer_status_identity_v2()
  from public, anon, authenticated, service_role;

drop trigger if exists repairdesk_create_customer_status_identity_v2
  on public.repair_orders;
create trigger repairdesk_create_customer_status_identity_v2
after insert on public.repair_orders
for each row execute function public.repairdesk_create_customer_status_identity_v2();

-- Catch orders committed between the first backfill scan and trigger creation.
insert into public.repair_order_customer_status_identities (
  order_id,
  store_id,
  lifecycle_revision,
  key_version
)
select
  order_row.id,
  order_row.store_id,
  lifecycle.revision,
  key_config.active_key_version
from public.repair_orders order_row
join public.store_lifecycles lifecycle
  on lifecycle.store_id = order_row.store_id
cross join public.customer_status_qr_key_config key_config
left join public.repair_order_customer_status_identities identity
  on identity.order_id = order_row.id
where key_config.singleton
  and identity.order_id is null
on conflict (order_id) do nothing;

create or replace function public.repairdesk_ensure_customer_status_identities_v2(
  p_store_id uuid,
  p_order_ids uuid[],
  p_key_version smallint,
  p_actor_id uuid,
  p_actor_email text,
  p_actor_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_input_count integer;
  v_distinct_count integer;
  v_order_count integer;
  v_lifecycle_revision bigint;
  v_store_status text;
  v_lifecycle_phase text;
  v_inserted_count integer;
  v_identities jsonb;
  v_active_key_version smallint;
begin
  if p_store_id is null
     or p_actor_id is null
     or p_key_version is null
     or p_key_version < 1
     or p_order_ids is null then
    raise exception 'customer_status_identity_invalid_input' using errcode = '22023';
  end if;

  v_input_count := cardinality(p_order_ids);
  select count(distinct order_id)
    into v_distinct_count
    from unnest(p_order_ids) order_id
   where order_id is not null;
  if v_input_count < 1 or v_input_count > 50 or v_distinct_count <> v_input_count then
    raise exception 'customer_status_identity_invalid_input' using errcode = '22023';
  end if;

  select key_config.active_key_version
    into v_active_key_version
    from public.customer_status_qr_key_config key_config
   where key_config.singleton;
  if v_active_key_version is null or p_key_version <> v_active_key_version then
    raise exception 'customer_status_identity_key_version_mismatch' using errcode = '55000';
  end if;

  select store_row.status::text, lifecycle.phase::text, lifecycle.revision
    into v_store_status, v_lifecycle_phase, v_lifecycle_revision
    from public.stores store_row
    join public.store_lifecycles lifecycle
      on lifecycle.store_id = store_row.id
   where store_row.id = p_store_id;

  if v_store_status is distinct from 'active'
     or v_lifecycle_phase is distinct from 'active'
     or v_lifecycle_revision is null
     or v_lifecycle_revision < 1 then
    raise exception 'customer_status_identity_store_inactive' using errcode = '55000';
  end if;

  perform order_row.id
    from public.repair_orders order_row
   where order_row.store_id = p_store_id
     and order_row.id = any(p_order_ids)
   order by order_row.id
   for update;

  select count(*)
    into v_order_count
    from public.repair_orders order_row
   where order_row.store_id = p_store_id
     and order_row.id = any(p_order_ids);
  if v_order_count <> v_input_count then
    raise exception 'customer_status_identity_order_unavailable' using errcode = '55000';
  end if;

  insert into public.repair_order_customer_status_identities (
    order_id,
    store_id,
    lifecycle_revision,
    key_version,
    created_at,
    updated_at,
    updated_by
  )
  select
    order_row.id,
    order_row.store_id,
    v_lifecycle_revision,
    p_key_version,
    v_now,
    v_now,
    p_actor_id
  from public.repair_orders order_row
  where order_row.store_id = p_store_id
    and order_row.id = any(p_order_ids)
  on conflict (order_id) do nothing;
  get diagnostics v_inserted_count = row_count;

  select jsonb_agg(
    jsonb_build_object(
      'order_id', identity.order_id,
      'public_id', identity.public_id,
      'generation', identity.generation,
      'key_version', identity.key_version,
      'lifecycle_revision', identity.lifecycle_revision,
      'public_access_state', identity.public_access_state
    ) order by identity.order_id
  )
  into v_identities
  from public.repair_order_customer_status_identities identity
  where identity.store_id = p_store_id
    and identity.order_id = any(p_order_ids);

  if jsonb_array_length(coalesce(v_identities, '[]'::jsonb)) <> v_input_count then
    raise exception 'customer_status_identity_incomplete' using errcode = '55000';
  end if;

  if v_inserted_count > 0 then
    insert into public.audit_logs (
      id,
      actor_id,
      actor_email,
      actor_name,
      store_id,
      action,
      entity_type,
      entity_id,
      metadata,
      created_at
    ) values (
      gen_random_uuid()::text,
      p_actor_id,
      nullif(trim(coalesce(p_actor_email, '')), ''),
      coalesce(nullif(trim(coalesce(p_actor_name, '')), ''), 'staff'),
      p_store_id,
      'repair',
      'customer_status_identity_batch',
      p_store_id::text,
      jsonb_build_object('inserted_count', v_inserted_count, 'requested_count', v_input_count),
      v_now
    );
  end if;

  return jsonb_build_object('identities', coalesce(v_identities, '[]'::jsonb));
end;
$$;

revoke all on function public.repairdesk_ensure_customer_status_identities_v2(
  uuid, uuid[], smallint, uuid, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.repairdesk_ensure_customer_status_identities_v2(
  uuid, uuid[], smallint, uuid, text, text
) to service_role;

create or replace function public.repairdesk_rotate_customer_status_identity_v2(
  p_store_id uuid,
  p_order_id uuid,
  p_key_version smallint,
  p_actor_id uuid,
  p_actor_email text,
  p_actor_name text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_lifecycle_revision bigint;
  v_store_status text;
  v_lifecycle_phase text;
  v_generation bigint;
  v_legacy_revoked_count integer;
  v_active_key_version smallint;
begin
  if p_store_id is null
     or p_order_id is null
     or p_actor_id is null
     or p_key_version is null
     or p_key_version < 1
     or p_reason not in ('operator_reset', 'lost_print', 'support_revoke') then
    raise exception 'customer_status_rotate_invalid_input' using errcode = '22023';
  end if;

  select key_config.active_key_version
    into v_active_key_version
    from public.customer_status_qr_key_config key_config
   where key_config.singleton;
  if v_active_key_version is null or p_key_version <> v_active_key_version then
    raise exception 'customer_status_rotate_key_version_mismatch' using errcode = '55000';
  end if;

  select store_row.status::text, lifecycle.phase::text, lifecycle.revision
    into v_store_status, v_lifecycle_phase, v_lifecycle_revision
    from public.stores store_row
    join public.store_lifecycles lifecycle
      on lifecycle.store_id = store_row.id
   where store_row.id = p_store_id
   for update of store_row, lifecycle;

  if v_store_status is distinct from 'active'
     or v_lifecycle_phase is distinct from 'active'
     or v_lifecycle_revision is null then
    raise exception 'customer_status_rotate_store_inactive' using errcode = '55000';
  end if;

  perform order_row.id
    from public.repair_orders order_row
   where order_row.store_id = p_store_id
     and order_row.id = p_order_id
   for update;
  if not found then
    raise exception 'customer_status_rotate_order_unavailable' using errcode = '55000';
  end if;

  update public.repair_order_customer_status_identities identity
     set public_id = gen_random_uuid(),
         generation = identity.generation + 1,
         key_version = p_key_version,
         lifecycle_revision = v_lifecycle_revision,
         public_access_state = 'enabled',
         disabled_at = null,
         disabled_by = null,
         disable_reason = null,
         updated_at = v_now,
         updated_by = p_actor_id
   where identity.store_id = p_store_id
     and identity.order_id = p_order_id
  returning generation into v_generation;
  if v_generation is null then
    raise exception 'customer_status_rotate_identity_unavailable' using errcode = '55000';
  end if;

  update public.repair_order_customer_status_links legacy
     set revoked_at = v_now,
         revoked_by = p_actor_id,
         revoke_reason = p_reason,
         updated_at = v_now
   where legacy.store_id = p_store_id
     and legacy.order_id = p_order_id
     and legacy.revoked_at is null;
  get diagnostics v_legacy_revoked_count = row_count;

  insert into public.audit_logs (
    id,
    actor_id,
    actor_email,
    actor_name,
    store_id,
    action,
    entity_type,
    entity_id,
    metadata,
    created_at
  ) values (
    gen_random_uuid()::text,
    p_actor_id,
    nullif(trim(coalesce(p_actor_email, '')), ''),
    coalesce(nullif(trim(coalesce(p_actor_name, '')), ''), 'staff'),
    p_store_id,
    'rotate',
    'customer_status_identity',
    p_order_id::text,
    jsonb_build_object(
      'reason', p_reason,
      'generation', v_generation,
      'key_version', p_key_version,
      'legacy_revoked_count', v_legacy_revoked_count
    ),
    v_now
  );

  return jsonb_build_object(
    'rotated_count', 1,
    'generation', v_generation,
    'legacy_revoked_count', v_legacy_revoked_count
  );
end;
$$;

revoke all on function public.repairdesk_rotate_customer_status_identity_v2(
  uuid, uuid, smallint, uuid, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.repairdesk_rotate_customer_status_identity_v2(
  uuid, uuid, smallint, uuid, text, text, text
) to service_role;

create or replace function public.repairdesk_rotate_customer_status_identities_on_restore_v2()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.phase::text = 'active'
     and (
       old.phase::text is distinct from 'active'
       or old.revision is distinct from new.revision
     ) then
    update public.repair_order_customer_status_identities identity
       set public_id = gen_random_uuid(),
           generation = identity.generation + 1,
           lifecycle_revision = new.revision,
           public_access_state = 'enabled',
           disabled_at = null,
           disabled_by = null,
           disable_reason = null,
           updated_at = clock_timestamp(),
           updated_by = null
     where identity.store_id = new.store_id;
  end if;
  return new;
end;
$$;

revoke all on function public.repairdesk_rotate_customer_status_identities_on_restore_v2()
  from public, anon, authenticated, service_role;

drop trigger if exists repairdesk_rotate_customer_status_identities_on_restore_v2
  on public.store_lifecycles;
create trigger repairdesk_rotate_customer_status_identities_on_restore_v2
after update of phase, revision on public.store_lifecycles
for each row execute function public.repairdesk_rotate_customer_status_identities_on_restore_v2();

drop trigger if exists repairdesk_lifecycle_fence_repair_order_customer_status_identities
  on public.repair_order_customer_status_identities;
create trigger repairdesk_lifecycle_fence_repair_order_customer_status_identities
before insert or update or delete on public.repair_order_customer_status_identities
for each row execute function public.repairdesk_enforce_active_store_write();

do $$
declare
  v_order_count bigint;
  v_identity_count bigint;
  v_missing_count bigint;
  v_cross_store_count bigint;
begin
  select count(*) into v_order_count from public.repair_orders;
  select count(*) into v_identity_count
    from public.repair_order_customer_status_identities;
  select count(*) into v_missing_count
    from public.repair_orders order_row
    left join public.repair_order_customer_status_identities identity
      on identity.order_id = order_row.id
   where identity.order_id is null;
  select count(*) into v_cross_store_count
    from public.repair_order_customer_status_identities identity
    join public.repair_orders order_row
      on order_row.id = identity.order_id
   where identity.store_id <> order_row.store_id;

  if v_identity_count <> v_order_count
     or v_missing_count <> 0
     or v_cross_store_count <> 0 then
    raise exception
      'customer_status_identity_backfill_invalid:orders=%,identities=%,missing=%,cross_store=%',
      v_order_count, v_identity_count, v_missing_count, v_cross_store_count
      using errcode = '23514';
  end if;
end;
$$;
