-- Complete customer read-model revisions, including embedded order identities.
set lock_timeout = '5s';
set statement_timeout = '60s';

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
  -- All customer paths share orders -> customers revision lock order with order writes.
  -- Activity-only writes lock an unchanged orders revision; they do not invalidate it.
  insert into public.repairdesk_store_domain_versions(store_id, domain, version, updated_at)
  values (v_store_id, 'orders', 0, pg_catalog.clock_timestamp())
  on conflict (store_id, domain) do nothing;
  perform 1 from public.repairdesk_store_domain_versions
    where store_id = v_store_id and domain = 'orders' for update;
  if tg_table_name in ('customers', 'devices') then
    insert into public.repairdesk_store_domain_versions(store_id, domain, version, updated_at)
    values (v_store_id, 'orders', 1, pg_catalog.clock_timestamp())
    on conflict (store_id, domain) do update set
      version = public.repairdesk_store_domain_versions.version + 1,
      updated_at = excluded.updated_at;
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

create trigger repairdesk_realtime_customer_followups_revision
 after insert or update or delete on public.customer_followups
 for each row execute function private.bump_repairdesk_customer_domain_version();
create trigger repairdesk_realtime_customer_interactions_revision
 after insert or update or delete on public.customer_interactions
 for each row execute function private.bump_repairdesk_customer_domain_version();
