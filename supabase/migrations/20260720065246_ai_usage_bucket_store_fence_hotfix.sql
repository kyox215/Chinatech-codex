-- AI usage buckets contain both store-scoped rows and deliberately storeless
-- global quota rows. Replace the generic lifecycle fence on this table with a
-- table-specific fence that preserves both invariants.

begin;

set local lock_timeout = '5s';

create or replace function public.repairdesk_enforce_ai_usage_bucket_store_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_old_store_id uuid;
  v_new_store_id uuid;
  v_store_id uuid;
  v_scope text;
  v_request_kind text;
  v_store_status text;
  v_lifecycle_phase text;
begin
  if tg_table_schema <> 'public'
     or tg_table_name <> 'ai_assistant_usage_buckets' then
    raise exception using
      errcode = 'P0001',
      message = 'AI_USAGE_BUCKET_TRIGGER_MISBOUND';
  end if;

  if tg_op <> 'INSERT' then
    v_old_store_id := old.store_id;
  end if;
  if tg_op <> 'DELETE' then
    v_new_store_id := new.store_id;
  end if;

  if tg_op = 'UPDATE' and v_old_store_id is distinct from v_new_store_id then
    raise exception using
      errcode = 'P0001',
      message = 'STORE_LIFECYCLE_CROSS_STORE_WRITE_FORBIDDEN';
  end if;

  v_store_id := coalesce(v_new_store_id, v_old_store_id);

  if v_store_id is null then
    if tg_op = 'DELETE' then
      raise exception using
        errcode = 'P0001',
        message = 'AI_USAGE_BUCKET_GLOBAL_DELETE_FORBIDDEN';
    end if;

    v_scope := case when tg_op = 'DELETE' then old.scope else new.scope end;
    v_request_kind := case
      when tg_op = 'DELETE' then old.request_kind
      else new.request_kind
    end;

    if v_scope is null
       or v_scope not in ('global_day', 'global_month')
       or v_request_kind is distinct from 'all' then
      raise exception using
        errcode = 'P0001',
        message = 'STORE_LIFECYCLE_STORE_REQUIRED';
    end if;

    if tg_op = 'UPDATE' then
      if old.scope is null
         or old.scope not in ('global_day', 'global_month')
         or old.request_kind is distinct from 'all' then
        raise exception using
          errcode = 'P0001',
          message = 'STORE_LIFECYCLE_STORE_REQUIRED';
      end if;

      if old.id is distinct from new.id
         or old.policy_version is distinct from new.policy_version
         or old.scope is distinct from new.scope
         or old.request_kind is distinct from new.request_kind
         or old.store_id is distinct from new.store_id
         or old.period_start_at is distinct from new.period_start_at
         or old.period_end_at is distinct from new.period_end_at
         or old.quota_timezone is distinct from new.quota_timezone
         or old.created_at is distinct from new.created_at then
        raise exception using
          errcode = 'P0001',
          message = 'AI_USAGE_BUCKET_IDENTITY_CHANGE_FORBIDDEN';
      end if;
    end if;

    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock_shared(
    pg_catalog.hashtextextended(v_store_id::text, 0)
  );

  select store.status::text, lifecycle.phase::text
    into v_store_status, v_lifecycle_phase
    from public.stores store
    join public.store_lifecycles lifecycle on lifecycle.store_id = store.id
   where store.id = v_store_id;

  if v_store_status is distinct from 'active'
     or v_lifecycle_phase is distinct from 'active' then
    raise exception using
      errcode = 'P0001',
      message = 'STORE_LIFECYCLE_WRITE_BLOCKED';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.repairdesk_enforce_ai_usage_bucket_store_write()
  from public;
revoke all on function public.repairdesk_enforce_ai_usage_bucket_store_write()
  from anon;
revoke all on function public.repairdesk_enforce_ai_usage_bucket_store_write()
  from authenticated;

drop trigger if exists repairdesk_lifecycle_fence_ai_assistant_usage_buckets
  on public.ai_assistant_usage_buckets;

create trigger repairdesk_lifecycle_fence_ai_assistant_usage_buckets
before insert or update or delete on public.ai_assistant_usage_buckets
for each row
execute function public.repairdesk_enforce_ai_usage_bucket_store_write();

comment on function public.repairdesk_enforce_ai_usage_bucket_store_write() is
  'Allows only valid storeless global AI quota buckets; store-scoped AI usage buckets remain fenced to active stores and lifecycles.';

create or replace function public.repairdesk_block_store_transition_with_reserved_ai_usage()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_table_schema <> 'public' or tg_table_name <> 'store_lifecycles' then
    raise exception using
      errcode = 'P0001',
      message = 'AI_USAGE_LIFECYCLE_TRIGGER_MISBOUND';
  end if;

  if old.phase::text = 'active' and new.phase::text is distinct from 'active' then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(old.store_id::text, 0)
    );

    if exists (
      select 1
        from public.ai_assistant_usage_requests request_row
       where request_row.store_id = old.store_id
         and request_row.state = 'reserved'
       limit 1
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'STORE_LIFECYCLE_BLOCKED',
        detail = '{"ai_usage_reserved":true}';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.repairdesk_block_store_transition_with_reserved_ai_usage()
  from public;
revoke all on function public.repairdesk_block_store_transition_with_reserved_ai_usage()
  from anon;
revoke all on function public.repairdesk_block_store_transition_with_reserved_ai_usage()
  from authenticated;

drop trigger if exists repairdesk_00_reserved_ai_usage_transition_fence
  on public.store_lifecycles;

create trigger repairdesk_00_reserved_ai_usage_transition_fence
before update of phase on public.store_lifecycles
for each row
execute function public.repairdesk_block_store_transition_with_reserved_ai_usage();

comment on function public.repairdesk_block_store_transition_with_reserved_ai_usage() is
  'Serializes store lifecycle transitions with AI ledger writes and blocks leaving active while a provider reservation remains unsettled.';

commit;
