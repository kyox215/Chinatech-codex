\set ON_ERROR_STOP on

begin;

do $$
declare
  v_bucket_function text;
  v_lifecycle_function text;
begin
  select function_row.proname
    into v_bucket_function
    from pg_catalog.pg_trigger trigger_row
    join pg_catalog.pg_proc function_row on function_row.oid = trigger_row.tgfoid
   where trigger_row.tgrelid = 'public.ai_assistant_usage_buckets'::regclass
     and trigger_row.tgname = 'repairdesk_lifecycle_fence_ai_assistant_usage_buckets'
     and not trigger_row.tgisinternal;
  if v_bucket_function is distinct from 'repairdesk_enforce_ai_usage_bucket_store_write' then
    raise exception 'AI usage bucket trigger is bound to %', v_bucket_function;
  end if;

  select function_row.proname
    into v_lifecycle_function
    from pg_catalog.pg_trigger trigger_row
    join pg_catalog.pg_proc function_row on function_row.oid = trigger_row.tgfoid
   where trigger_row.tgrelid = 'public.store_lifecycles'::regclass
     and trigger_row.tgname = 'repairdesk_00_reserved_ai_usage_transition_fence'
     and not trigger_row.tgisinternal;
  if v_lifecycle_function is distinct from
       'repairdesk_block_store_transition_with_reserved_ai_usage' then
    raise exception 'AI lifecycle trigger is bound to %', v_lifecycle_function;
  end if;

  if has_function_privilege(
       'anon',
       'public.repairdesk_enforce_ai_usage_bucket_store_write()',
       'execute'
     )
     or has_function_privilege(
       'authenticated',
       'public.repairdesk_enforce_ai_usage_bucket_store_write()',
       'execute'
     )
     or has_function_privilege(
       'anon',
       'public.repairdesk_block_store_transition_with_reserved_ai_usage()',
       'execute'
     )
     or has_function_privilege(
       'authenticated',
       'public.repairdesk_block_store_transition_with_reserved_ai_usage()',
       'execute'
     ) then
    raise exception 'AI lifecycle trigger function privilege widened';
  end if;
end;
$$;

insert into public.ai_assistant_usage_buckets (
  policy_version, scope, request_kind, store_id, period_start_at, period_end_at,
  quota_timezone, request_limit, cost_limit_microusd
) values
  (
    'ai-runtime-v1', 'global_day', 'all', null,
    '2037-01-01T00:00:00Z', '2037-01-02T00:00:00Z',
    'Europe/Rome', 100, 0
  ),
  (
    'ai-runtime-v1', 'global_month', 'all', null,
    '2037-01-01T00:00:00Z', '2037-02-01T00:00:00Z',
    'Europe/Rome', 0, 50000000
  );

update public.ai_assistant_usage_buckets
   set request_count = request_count + 1,
       updated_at = clock_timestamp()
 where period_start_at = '2037-01-01T00:00:00Z'
   and scope in ('global_day', 'global_month');

do $$
begin
  if (
    select count(*)
      from public.ai_assistant_usage_buckets
     where period_start_at = '2037-01-01T00:00:00Z'
       and store_id is null
       and request_count = 1
  ) <> 2 then
    raise exception 'valid storeless global buckets did not insert and update';
  end if;

  begin
    insert into public.ai_assistant_usage_buckets (
      policy_version, scope, request_kind, store_id,
      period_start_at, period_end_at, quota_timezone,
      request_limit, cost_limit_microusd
    ) values (
      'ai-runtime-v1', 'store_day', 'order_text', null,
      '2037-03-01T00:00:00Z', '2037-03-02T00:00:00Z', 'Europe/Rome', 1, 308
    );
    raise exception 'invalid storeless store bucket unexpectedly inserted';
  exception when others then
    if sqlerrm <> 'STORE_LIFECYCLE_STORE_REQUIRED' then
      raise;
    end if;
  end;

  begin
    update public.ai_assistant_usage_buckets
       set quota_timezone = 'UTC'
     where scope = 'global_day'
       and period_start_at = '2037-01-01T00:00:00Z';
    raise exception 'global bucket identity unexpectedly changed';
  exception when others then
    if sqlerrm <> 'AI_USAGE_BUCKET_IDENTITY_CHANGE_FORBIDDEN' then
      raise;
    end if;
  end;

  begin
    delete from public.ai_assistant_usage_buckets
     where scope = 'global_day'
       and period_start_at = '2037-01-01T00:00:00Z';
    raise exception 'global bucket unexpectedly deleted';
  exception when others then
    if sqlerrm <> 'AI_USAGE_BUCKET_GLOBAL_DELETE_FORBIDDEN' then
      raise;
    end if;
  end;

  begin
    update public.ai_assistant_usage_buckets
       set store_id = null
     where scope = 'store_day'
       and store_id = '00000000-0000-4000-8000-000000000001';
    raise exception 'store bucket unexpectedly changed scope identity';
  exception when others then
    if sqlerrm <> 'STORE_LIFECYCLE_CROSS_STORE_WRITE_FORBIDDEN' then
      raise;
    end if;
  end;
end;
$$;

insert into public.stores (id, status) values
  ('10000000-0000-4000-8000-000000000001', 'active'),
  ('20000000-0000-4000-8000-000000000001', 'active'),
  ('30000000-0000-4000-8000-000000000001', 'active'),
  ('40000000-0000-4000-8000-000000000001', 'active'),
  ('50000000-0000-4000-8000-000000000001', 'active');

insert into public.store_lifecycles (store_id, phase, revision) values
  ('10000000-0000-4000-8000-000000000001', 'active', 1),
  ('20000000-0000-4000-8000-000000000001', 'active', 1),
  ('30000000-0000-4000-8000-000000000001', 'active', 1),
  ('40000000-0000-4000-8000-000000000001', 'active', 1),
  ('50000000-0000-4000-8000-000000000001', 'active', 1);

insert into public.staff_profiles (id, status) values
  ('10000000-0000-4000-8000-000000000002', 'active'),
  ('20000000-0000-4000-8000-000000000002', 'active'),
  ('30000000-0000-4000-8000-000000000002', 'active'),
  ('40000000-0000-4000-8000-000000000002', 'active'),
  ('50000000-0000-4000-8000-000000000002', 'active');

insert into public.store_memberships (id, user_id, store_id, status, role) values
  (
    '10000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001', 'active', 'owner'
  ),
  (
    '20000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001', 'active', 'owner'
  ),
  (
    '30000000-0000-4000-8000-000000000004',
    '30000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000001', 'active', 'owner'
  ),
  (
    '40000000-0000-4000-8000-000000000004',
    '40000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000001', 'active', 'owner'
  ),
  (
    '50000000-0000-4000-8000-000000000004',
    '50000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000001', 'active', 'owner'
  );

set local role service_role;

do $$
declare
  v_result jsonb;
  v_request public.ai_assistant_usage_requests%rowtype;
  v_store_bucket public.ai_assistant_usage_buckets%rowtype;
begin
  v_result := public.repairdesk_reserve_ai_usage(
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    repeat('v', 43),
    '10000000-0000-4000-8000-000000000010',
    repeat('w', 43),
    'inventory_vision', 'ai-runtime-v1', 'openai-pricing-2026-07-18',
    'gpt-4o-mini-2024-07-18', 8115
  );
  if v_result ->> 'code' <> 'reserved' then
    raise exception 'vision reservation failed: %', v_result;
  end if;

  v_result := public.repairdesk_finalize_ai_usage(
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000010',
    repeat('w', 43), 100, 0, 0, 20, 1::smallint
  );
  if v_result ->> 'state' <> 'succeeded'
     or (v_result ->> 'estimated_cost_microusd')::bigint <> 27 then
    raise exception 'vision finalization failed: %', v_result;
  end if;

  select * into v_request
    from public.ai_assistant_usage_requests
   where store_id = '10000000-0000-4000-8000-000000000001'
     and client_request_id = '10000000-0000-4000-8000-000000000010';
  select * into v_store_bucket
    from public.ai_assistant_usage_buckets
   where id = v_request.store_day_bucket_id;
  if v_request.state <> 'succeeded'
     or v_request.estimated_cost_microusd <> 27
     or v_store_bucket.request_count <> 1
     or v_store_bucket.reserved_cost_microusd <> 0
     or v_store_bucket.settled_cost_microusd <> 27
     or v_store_bucket.input_token_count <> 100
     or v_store_bucket.output_token_count <> 20 then
    raise exception 'vision ledger did not settle exactly';
  end if;
end;
$$;

update public.store_lifecycles
   set phase = 'closing', revision = revision + 1
 where store_id = '20000000-0000-4000-8000-000000000001';

do $$
declare
  v_result jsonb;
  v_global_requests_before bigint;
  v_global_reserved_before bigint;
begin
  select sum(request_count), sum(reserved_cost_microusd)
    into v_global_requests_before, v_global_reserved_before
    from public.ai_assistant_usage_buckets
   where scope in ('global_day', 'global_month')
     and period_start_at < '2037-01-01T00:00:00Z';

  begin
    v_result := public.repairdesk_reserve_ai_usage(
      '20000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002',
      repeat('x', 43),
      '20000000-0000-4000-8000-000000000010',
      repeat('y', 43),
      'order_text', 'ai-runtime-v1', 'openai-pricing-2026-07-18',
      'gpt-5-nano-2025-08-07', 308
    );
    raise exception 'closing-store reservation unexpectedly returned: %', v_result;
  exception when others then
    if sqlerrm <> 'STORE_LIFECYCLE_WRITE_BLOCKED' then
      raise;
    end if;
  end;

  if exists (
       select 1 from public.ai_assistant_usage_requests
        where client_request_id = '20000000-0000-4000-8000-000000000010'
     )
     or exists (
       select 1 from public.ai_assistant_actor_rate_buckets
        where store_id = '20000000-0000-4000-8000-000000000001'
     )
     or exists (
       select 1 from public.ai_assistant_usage_buckets
        where store_id = '20000000-0000-4000-8000-000000000001'
     ) then
    raise exception 'closing-store reservation left a store-scoped partial write';
  end if;

  if (select sum(request_count) from public.ai_assistant_usage_buckets
       where scope in ('global_day', 'global_month')
         and period_start_at < '2037-01-01T00:00:00Z')
       is distinct from v_global_requests_before
     or (select sum(reserved_cost_microusd) from public.ai_assistant_usage_buckets
       where scope in ('global_day', 'global_month')
         and period_start_at < '2037-01-01T00:00:00Z')
       is distinct from v_global_reserved_before then
    raise exception 'closing-store reservation changed global counters';
  end if;
end;
$$;

update public.store_lifecycles
   set phase = 'active'
 where store_id = '20000000-0000-4000-8000-000000000001';

do $$
declare
  v_result jsonb;
begin
  v_result := public.repairdesk_reserve_ai_usage(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002', repeat('a', 43),
    '30000000-0000-4000-8000-000000000010', repeat('b', 43),
    'order_text', 'ai-runtime-v1', 'openai-pricing-2026-07-18',
    'gpt-5-nano-2025-08-07', 308
  );
  if v_result ->> 'code' <> 'reserved' then
    raise exception 'finalize-path reservation failed: %', v_result;
  end if;

  begin
    update public.store_lifecycles
       set phase = 'closing', revision = revision + 1
     where store_id = '30000000-0000-4000-8000-000000000001';
    raise exception 'store closed with a live AI reservation';
  exception when others then
    if sqlerrm <> 'STORE_LIFECYCLE_BLOCKED' then
      raise;
    end if;
  end;
  if (select phase from public.store_lifecycles
       where store_id = '30000000-0000-4000-8000-000000000001') <> 'active'
     or (select revision from public.store_lifecycles
       where store_id = '30000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'blocked close changed lifecycle state';
  end if;

  v_result := public.repairdesk_finalize_ai_usage(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000010', repeat('b', 43),
    100, 0, 0, 20, 1::smallint
  );
  if v_result ->> 'state' <> 'succeeded' then
    raise exception 'finalize-path settlement failed: %', v_result;
  end if;

  update public.store_lifecycles
     set phase = 'closing', revision = revision + 1
   where store_id = '30000000-0000-4000-8000-000000000001';
end;
$$;

do $$
declare
  v_result jsonb;
begin
  v_result := public.repairdesk_reserve_ai_usage(
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000002', repeat('c', 43),
    '40000000-0000-4000-8000-000000000010', repeat('d', 43),
    'order_text', 'ai-runtime-v1', 'openai-pricing-2026-07-18',
    'gpt-5-nano-2025-08-07', 308
  );
  if v_result ->> 'code' <> 'reserved' then
    raise exception 'release-path reservation failed: %', v_result;
  end if;

  begin
    update public.store_lifecycles
       set phase = 'closing', revision = revision + 1
     where store_id = '40000000-0000-4000-8000-000000000001';
    raise exception 'store closed before pre-dispatch release';
  exception when others then
    if sqlerrm <> 'STORE_LIFECYCLE_BLOCKED' then
      raise;
    end if;
  end;

  v_result := public.repairdesk_release_ai_usage_pre_dispatch(
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000010', repeat('d', 43)
  );
  if v_result ->> 'state' <> 'failed_pre_dispatch' then
    raise exception 'pre-dispatch release failed: %', v_result;
  end if;

  update public.store_lifecycles
     set phase = 'closing', revision = revision + 1
   where store_id = '40000000-0000-4000-8000-000000000001';
end;
$$;

do $$
declare
  v_result jsonb;
begin
  v_result := public.repairdesk_reserve_ai_usage(
    '50000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000002', repeat('e', 43),
    '50000000-0000-4000-8000-000000000010', repeat('f', 43),
    'order_text', 'ai-runtime-v1', 'openai-pricing-2026-07-18',
    'gpt-5-nano-2025-08-07', 308
  );
  if v_result ->> 'code' <> 'reserved' then
    raise exception 'stale-path reservation failed: %', v_result;
  end if;

  update public.ai_assistant_usage_requests
     set reserved_at = clock_timestamp() - interval '601 seconds',
         expires_at = clock_timestamp() - interval '1 second'
   where store_id = '50000000-0000-4000-8000-000000000001'
     and client_request_id = '50000000-0000-4000-8000-000000000010';

  v_result := public.repairdesk_settle_stale_ai_usage(25);
  if v_result ->> 'code' <> 'stale_settled'
     or (v_result ->> 'settled_count')::integer < 1 then
    raise exception 'stale settlement failed: %', v_result;
  end if;

  update public.store_lifecycles
     set phase = 'closing', revision = revision + 1
   where store_id = '50000000-0000-4000-8000-000000000001';
end;
$$;

reset role;

do $$
begin
  if (select phase from public.store_lifecycles
       where store_id = '20000000-0000-4000-8000-000000000001') <> 'active'
     or exists (
       select 1 from public.ai_assistant_usage_requests
        where store_id = '30000000-0000-4000-8000-000000000001'
          and state = 'reserved'
     )
     or (select phase from public.store_lifecycles
       where store_id = '30000000-0000-4000-8000-000000000001') <> 'closing'
     or (select phase from public.store_lifecycles
       where store_id = '40000000-0000-4000-8000-000000000001') <> 'closing'
     or (select phase from public.store_lifecycles
       where store_id = '50000000-0000-4000-8000-000000000001') <> 'closing' then
    raise exception 'AI lifecycle fence final state mismatch';
  end if;
end;
$$;

select 'ai_usage_lifecycle_fence_harness_passed' as result;

rollback;
