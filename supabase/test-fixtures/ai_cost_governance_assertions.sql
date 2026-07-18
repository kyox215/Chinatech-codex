\set ON_ERROR_STOP on

insert into public.ai_assistant_usage_policies (
  policy_version,
  status,
  quota_timezone,
  pricing_version,
  order_text_model,
  inventory_vision_model,
  order_text_max_input_tokens,
  order_text_max_output_tokens,
  inventory_vision_max_input_tokens,
  inventory_vision_max_output_tokens,
  order_text_per_store_day,
  inventory_vision_per_store_day,
  requests_per_actor_minute,
  provider_requests_global_day,
  monthly_budget_microusd,
  order_text_max_reservation_microusd,
  inventory_vision_max_reservation_microusd,
  order_text_input_rate_microusd_per_million,
  order_text_cached_input_rate_microusd_per_million,
  order_text_cache_write_rate_microusd_per_million,
  order_text_output_rate_microusd_per_million,
  inventory_vision_input_rate_microusd_per_million,
  inventory_vision_cached_input_rate_microusd_per_million,
  inventory_vision_cache_write_rate_microusd_per_million,
  inventory_vision_output_rate_microusd_per_million,
  max_provider_attempts,
  reservation_ttl_seconds,
  effective_at
) values (
  'ai-runtime-v1',
  'enabled',
  'Europe/Rome',
  'openai-pricing-2026-07-18',
  'gpt-5-nano-2025-08-07',
  'gpt-4o-mini-2024-07-18',
  4096,
  256,
  50000,
  1024,
  10,
  10,
  2,
  100,
  50000000,
  308,
  8115,
  50000,
  5000,
  50000,
  400000,
  150000,
  75000,
  150000,
  600000,
  1,
  600,
  clock_timestamp() - interval '1 minute'
) on conflict (policy_version) do nothing;

set role service_role;

do $$
declare
  v_result jsonb;
begin
  v_result := public.repairdesk_attest_ai_usage_policy(
    jsonb_build_object(
      'policy_version', 'ai-runtime-v1',
      'pricing_version', 'openai-pricing-2026-07-18',
      'quota_timezone', 'Europe/Rome',
      'order_text_model', 'gpt-5-nano-2025-08-07',
      'inventory_vision_model', 'gpt-4o-mini-2024-07-18',
      'order_text_max_input_tokens', 4096,
      'order_text_max_output_tokens', 256,
      'inventory_vision_max_input_tokens', 50000,
      'inventory_vision_max_output_tokens', 1024,
      'order_text_per_store_day', 10,
      'inventory_vision_per_store_day', 10,
      'requests_per_actor_minute', 2,
      'provider_requests_global_day', 100,
      'monthly_budget_microusd', 50000000,
      'order_text_max_reservation_microusd', 308,
      'inventory_vision_max_reservation_microusd', 8115,
      'order_text_input_rate_microusd_per_million', 50000,
      'order_text_cached_input_rate_microusd_per_million', 5000,
      'order_text_cache_write_rate_microusd_per_million', 50000,
      'order_text_output_rate_microusd_per_million', 400000,
      'inventory_vision_input_rate_microusd_per_million', 150000,
      'inventory_vision_cached_input_rate_microusd_per_million', 75000,
      'inventory_vision_cache_write_rate_microusd_per_million', 150000,
      'inventory_vision_output_rate_microusd_per_million', 600000,
      'max_provider_attempts', 1,
      'reservation_ttl_seconds', 600
    )
  );
  if v_result ->> 'code' <> 'policy_ready' then
    raise exception 'policy attestation failed: %', v_result;
  end if;

  v_result := public.repairdesk_reserve_ai_usage(
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    repeat('b', 43),
    '00000000-0000-4000-8000-000000000010',
    repeat('a', 43),
    'order_text',
    'ai-runtime-v1',
    'openai-pricing-2026-07-18',
    'gpt-5-nano-2025-08-07',
    308
  );
  if v_result ->> 'code' <> 'reserved' then
    raise exception 'first reservation failed: %', v_result;
  end if;

  v_result := public.repairdesk_reserve_ai_usage(
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    repeat('b', 43),
    '00000000-0000-4000-8000-000000000010',
    repeat('a', 43),
    'order_text',
    'ai-runtime-v1',
    'openai-pricing-2026-07-18',
    'gpt-5-nano-2025-08-07',
    308
  );
  if v_result ->> 'code' <> 'idempotent_replay' then
    raise exception 'idempotency replay failed: %', v_result;
  end if;

  v_result := public.repairdesk_release_ai_usage_pre_dispatch(
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000010',
    repeat('a', 43)
  );
  if v_result ->> 'state' <> 'failed_pre_dispatch' then
    raise exception 'pre-dispatch release failed: %', v_result;
  end if;

  v_result := public.repairdesk_reserve_ai_usage(
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    repeat('b', 43),
    '00000000-0000-4000-8000-000000000011',
    repeat('c', 43),
    'order_text',
    'ai-runtime-v1',
    'openai-pricing-2026-07-18',
    'gpt-5-nano-2025-08-07',
    308
  );
  if v_result ->> 'code' <> 'reserved' then
    raise exception 'second reservation failed: %', v_result;
  end if;

  v_result := public.repairdesk_finalize_ai_usage(
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000011',
    repeat('c', 43),
    100,
    10,
    0,
    20,
    1::smallint
  );
  if v_result ->> 'state' <> 'succeeded'
     or (v_result ->> 'estimated_cost_microusd')::bigint <> 14 then
    raise exception 'authoritative finalization failed: %', v_result;
  end if;

  v_result := public.repairdesk_reserve_ai_usage(
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    repeat('b', 43),
    '00000000-0000-4000-8000-000000000012',
    repeat('d', 43),
    'order_text',
    'ai-runtime-v1',
    'openai-pricing-2026-07-18',
    'gpt-5-nano-2025-08-07',
    308
  );
  if v_result ->> 'code' <> 'reserved' then
    raise exception 'stale-test reservation failed: %', v_result;
  end if;

  v_result := public.repairdesk_reserve_ai_usage(
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    repeat('b', 43),
    '00000000-0000-4000-8000-000000000013',
    repeat('e', 43),
    'order_text',
    'ai-runtime-v1',
    'openai-pricing-2026-07-18',
    'gpt-5-nano-2025-08-07',
    308
  );
  if v_result ->> 'code' <> 'actor_minute_limit_reached' then
    raise exception 'actor rate limit failed: %', v_result;
  end if;

  v_result := public.repairdesk_reserve_ai_usage(
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000003',
    repeat('f', 43),
    '00000000-0000-4000-8000-000000000014',
    repeat('g', 43),
    'order_text',
    'ai-runtime-v1',
    'openai-pricing-2026-07-18',
    'gpt-5-nano-2025-08-07',
    308
  );
  if v_result ->> 'code' <> 'reserved' then
    raise exception 'second actor reservation failed: %', v_result;
  end if;
end;
$$;

update public.ai_assistant_usage_requests
   set finalized_at = clock_timestamp() - interval '91 days'
 where client_request_id = '00000000-0000-4000-8000-000000000010';

update public.ai_assistant_usage_requests
   set reserved_at = clock_timestamp() - interval '601 seconds',
       expires_at = clock_timestamp() - interval '1 second'
 where client_request_id = '00000000-0000-4000-8000-000000000012';

do $$
declare
  v_result jsonb;
  v_count bigint;
begin
  v_result := public.repairdesk_maintain_ai_usage(
    100,
    clock_timestamp() - interval '90 days',
    500
  );
  if (v_result ->> 'stale_settled_count')::integer <> 1
     or (v_result ->> 'request_deleted_count')::integer <> 1 then
    raise exception 'maintenance lifecycle failed: %', v_result;
  end if;

  select count(*) into v_count
    from public.ai_assistant_usage_requests
   where client_request_id = '00000000-0000-4000-8000-000000000014'
     and state = 'reserved';
  if v_count <> 1 then
    raise exception 'maintenance deleted an active reservation';
  end if;

  select settled_cost_microusd into v_count
    from public.ai_assistant_usage_buckets
   where scope = 'global_month';
  if v_count <> 322 then
    raise exception 'unexpected authoritative monthly cost: %', v_count;
  end if;
end;
$$;

reset role;
set role anon;

do $$
begin
  begin
    perform public.repairdesk_attest_ai_usage_policy('{}'::jsonb);
    raise exception 'anon unexpectedly executed the private AI policy RPC';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;
