begin;

set local role service_role;

do $$
declare
  v_store_id uuid;
  v_actor_id uuid;
  v_result jsonb;
  v_row_total bigint;
begin
  select store_row.id, membership.user_id
    into v_store_id, v_actor_id
    from public.stores store_row
    join public.store_memberships membership
      on membership.store_id = store_row.id
     and membership.status::text = 'active'
     and membership.role::text in ('owner', 'manager')
   where lower(btrim(store_row.name)) = 'chinatech'
     and store_row.status::text = 'active'
   order by case membership.role::text when 'owner' then 0 else 1 end
   limit 1;

  if v_store_id is null or v_actor_id is null then
    raise exception 'Canary store or authorized actor is unavailable';
  end if;

  v_result := public.repairdesk_reserve_ai_usage(
    v_store_id,
    v_actor_id,
    gen_random_uuid(),
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    'order_text',
    'recovery-drill-v1',
    'recovery-pricing-v1',
    'recovery-model',
    1
  );

  if v_result ->> 'code' <> 'budget_not_configured' then
    raise exception 'Dormant AI fail-closed result mismatch: %', v_result ->> 'code';
  end if;

  select count(*) into v_row_total
    from public.ai_assistant_usage_policies;
  if v_row_total <> 0 then
    raise exception 'AI policy table must remain empty after migration';
  end if;

  select count(*) into v_row_total
    from public.ai_assistant_usage_buckets;
  if v_row_total <> 0 then
    raise exception 'AI usage bucket table must remain empty while dormant';
  end if;

  select count(*) into v_row_total
    from public.ai_assistant_usage_requests;
  if v_row_total <> 0 then
    raise exception 'AI request table must remain empty while dormant';
  end if;

  raise notice 'AI migration dormant guard passed: no policy, request, bucket or provider activation';
end;
$$;

rollback;

select
  (select count(*) from public.ai_assistant_usage_policies) as residual_ai_policies,
  (select count(*) from public.ai_assistant_usage_buckets) as residual_ai_buckets,
  (select count(*) from public.ai_assistant_usage_requests) as residual_ai_requests;
