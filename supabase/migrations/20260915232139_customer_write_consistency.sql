-- Customer-domain CAS and atomic tag replacement. Forward-only, no data removal.
set lock_timeout = '5s';
set statement_timeout = '60s';

create or replace function private.advance_customer_entity_version()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at := greatest(pg_catalog.clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end;
$$;
revoke all on function private.advance_customer_entity_version() from public, anon, authenticated;

create trigger repairdesk_customer_monotonic_version
before update on public.customers
for each row execute function private.advance_customer_entity_version();
create trigger repairdesk_device_monotonic_version
before update on public.devices
for each row execute function private.advance_customer_entity_version();

create or replace function private.bump_repairdesk_customer_domain_version()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_store_id uuid := case when tg_op = 'DELETE' then old.store_id else new.store_id end;
  v_phase text;
begin
  if v_store_id is null then return case when tg_op = 'DELETE' then old else new end; end if;
  -- No revision may be recreated by verified purge or an inactive tenant cleanup.
  select phase::text into v_phase from public.store_lifecycles where store_id = v_store_id;
  if v_phase is distinct from 'active' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  insert into public.repairdesk_store_domain_versions(store_id, domain, version, updated_at)
  values (v_store_id, 'customers', 1, pg_catalog.clock_timestamp())
  on conflict (store_id, domain) do update set
    version = public.repairdesk_store_domain_versions.version + 1,
    updated_at = excluded.updated_at;
  -- Existing BFF customer broadcasts remain the fast path. This durable revision
  -- is committed with the mutation and reconciles a missed broadcast.
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
alter function private.bump_repairdesk_customer_domain_version() owner to postgres;
revoke all on function private.bump_repairdesk_customer_domain_version() from public, anon, authenticated;

create trigger repairdesk_realtime_customers_revision
after insert or update or delete on public.customers
for each row execute function private.bump_repairdesk_customer_domain_version();
create trigger repairdesk_realtime_devices_revision
after insert or update or delete on public.devices
for each row execute function private.bump_repairdesk_customer_domain_version();
create trigger repairdesk_realtime_customer_tags_revision
after insert or update or delete on public.customer_tags
for each row execute function private.bump_repairdesk_customer_domain_version();
create trigger repairdesk_realtime_customer_tag_assignments_revision
after insert or update or delete on public.customer_tag_assignments
for each row execute function private.bump_repairdesk_customer_domain_version();

create or replace function public.repairdesk_replace_customer_tags(
  p_store_id uuid,
  p_actor_id uuid,
  p_customer_id uuid,
  p_expected_updated_at timestamptz,
  p_tag_ids text[]
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_customer public.customers%rowtype;
  v_tag_ids text[];
  v_version timestamptz;
begin
  perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended(p_store_id::text, 0));
  -- Matches BFF customer:tag: owner/manager/sales. Technician requires a scope
  -- which this endpoint does not grant; customer:tag is not a grantable override.
  if not exists (
    select 1 from public.store_memberships membership
    join public.staff_profiles staff on staff.id = membership.user_id
    join public.stores store_row on store_row.id = membership.store_id
    join public.store_lifecycles lifecycle on lifecycle.store_id = store_row.id
    where membership.store_id = p_store_id and membership.user_id = p_actor_id
      and membership.status::text = 'active' and staff.status::text = 'active'
      and store_row.status::text = 'active' and lifecycle.phase::text = 'active'
      and membership.role::text in ('owner', 'manager', 'sales')
  ) then raise exception using errcode = 'P0001', message = 'CUSTOMER_FORBIDDEN'; end if;

  if p_expected_updated_at is null or p_tag_ids is null
     or cardinality(p_tag_ids) > 64 or array_position(p_tag_ids, null) is not null then
    raise exception using errcode = 'P0001', message = 'CUSTOMER_TAGS_INVALID';
  end if;
  select * into v_customer from public.customers
    where store_id = p_store_id and id = p_customer_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'CUSTOMER_NOT_FOUND'; end if;
  if v_customer.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = 'P0001', message = 'CUSTOMER_STALE_VERSION';
  end if;
  select coalesce(array_agg(distinct id), '{}'::text[]) into v_tag_ids from unnest(p_tag_ids) as ids(id);
  if exists (
    select 1 from unnest(v_tag_ids) as ids(id)
    where not exists (select 1 from public.customer_tags tag where tag.store_id = p_store_id and tag.id = ids.id)
  ) then raise exception using errcode = 'P0001', message = 'CUSTOMER_TAGS_INVALID'; end if;

  delete from public.customer_tag_assignments where store_id = p_store_id and customer_id = p_customer_id;
  insert into public.customer_tag_assignments(store_id, customer_id, tag_id)
    select p_store_id, p_customer_id, id from unnest(v_tag_ids) as ids(id);
  update public.customers set updated_at = greatest(pg_catalog.clock_timestamp(), updated_at + interval '1 microsecond')
    where store_id = p_store_id and id = p_customer_id returning updated_at into v_version;
  return jsonb_build_object('ok', true, 'updated_at', v_version);
end;
$$;
revoke all on function public.repairdesk_replace_customer_tags(uuid, uuid, uuid, timestamptz, text[])
  from public, anon, authenticated;
grant execute on function public.repairdesk_replace_customer_tags(uuid, uuid, uuid, timestamptz, text[])
  to service_role;
