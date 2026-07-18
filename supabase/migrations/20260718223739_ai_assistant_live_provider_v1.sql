-- Phase 3B live-provider database contract. This migration upgrades the
-- already-applied dormant Phase 3A schema without editing its migration history.
-- It creates no policy row and therefore enables no paid provider call.

set lock_timeout = '5s';

begin;

lock table public.ai_assistant_usage_policies in access exclusive mode;
lock table public.ai_assistant_usage_buckets in access exclusive mode;
lock table public.ai_assistant_usage_requests in access exclusive mode;

do $$
begin
  if exists (select 1 from public.ai_assistant_usage_policies)
     or exists (select 1 from public.ai_assistant_usage_buckets)
     or exists (select 1 from public.ai_assistant_usage_requests) then
    raise exception
      'AI live-provider schema upgrade requires empty dormant policy, bucket, and request tables';
  end if;
end;
$$;

alter table public.ai_assistant_usage_policies
  add column requests_per_actor_minute integer not null;

alter table public.ai_assistant_usage_policies
  add constraint ai_usage_policy_actor_rate_check
  check (requests_per_actor_minute > 0);

create table public.ai_assistant_actor_rate_buckets (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  actor_fingerprint_hmac text not null,
  period_start_at timestamptz not null,
  period_end_at timestamptz not null,
  request_limit integer not null,
  request_count integer not null default 0,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint ai_actor_rate_store_fkey
    foreign key (store_id) references public.stores(id)
    on update cascade on delete restrict,
  constraint ai_actor_rate_fingerprint_check
    check (actor_fingerprint_hmac ~ '^[A-Za-z0-9_-]{43}$'),
  constraint ai_actor_rate_period_check check (period_end_at > period_start_at),
  constraint ai_actor_rate_counts_check
    check (request_limit > 0 and request_count >= 0),
  constraint ai_actor_rate_id_store_unique unique (id, store_id),
  constraint ai_actor_rate_identity_unique
    unique (store_id, actor_fingerprint_hmac, period_start_at)
);

create index ai_assistant_actor_rate_period_idx
  on public.ai_assistant_actor_rate_buckets (period_end_at);

alter table public.ai_assistant_usage_requests
  add column actor_minute_bucket_id uuid not null;

alter table public.ai_assistant_usage_requests
  add constraint ai_usage_requests_actor_minute_bucket_fkey
  foreign key (actor_minute_bucket_id, store_id)
  references public.ai_assistant_actor_rate_buckets(id, store_id)
  on update cascade on delete restrict;

alter table public.ai_assistant_actor_rate_buckets enable row level security;

revoke all on table public.ai_assistant_actor_rate_buckets
  from public, anon, authenticated, service_role;
grant select, insert, update, delete
  on table public.ai_assistant_actor_rate_buckets to service_role;
grant delete on table public.ai_assistant_usage_requests to service_role;

revoke all on function public.repairdesk_reserve_ai_usage(
  uuid, uuid, uuid, text, text, text, text, text, bigint
) from public, anon, authenticated, service_role;
drop function public.repairdesk_reserve_ai_usage(
  uuid, uuid, uuid, text, text, text, text, text, bigint
);

create or replace function public.repairdesk_attest_ai_usage_policy(p_expected jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_policy public.ai_assistant_usage_policies%rowtype;
  v_actual jsonb;
begin
  if p_expected is null or jsonb_typeof(p_expected) <> 'object' then
    return jsonb_build_object('ok', false, 'code', 'invalid_policy_attestation');
  end if;

  select policy_row.*
    into v_policy
    from public.ai_assistant_usage_policies as policy_row
   where policy_row.status = 'enabled'
     and policy_row.effective_at <= v_now;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'budget_not_configured');
  end if;

  v_actual := jsonb_build_object(
    'policy_version', v_policy.policy_version,
    'pricing_version', v_policy.pricing_version,
    'quota_timezone', v_policy.quota_timezone,
    'order_text_model', v_policy.order_text_model,
    'inventory_vision_model', v_policy.inventory_vision_model,
    'order_text_max_input_tokens', v_policy.order_text_max_input_tokens,
    'order_text_max_output_tokens', v_policy.order_text_max_output_tokens,
    'inventory_vision_max_input_tokens', v_policy.inventory_vision_max_input_tokens,
    'inventory_vision_max_output_tokens', v_policy.inventory_vision_max_output_tokens,
    'order_text_per_store_day', v_policy.order_text_per_store_day,
    'inventory_vision_per_store_day', v_policy.inventory_vision_per_store_day,
    'requests_per_actor_minute', v_policy.requests_per_actor_minute,
    'provider_requests_global_day', v_policy.provider_requests_global_day,
    'monthly_budget_microusd', v_policy.monthly_budget_microusd,
    'order_text_max_reservation_microusd', v_policy.order_text_max_reservation_microusd,
    'inventory_vision_max_reservation_microusd', v_policy.inventory_vision_max_reservation_microusd,
    'order_text_input_rate_microusd_per_million',
      v_policy.order_text_input_rate_microusd_per_million,
    'order_text_cached_input_rate_microusd_per_million',
      v_policy.order_text_cached_input_rate_microusd_per_million,
    'order_text_cache_write_rate_microusd_per_million',
      v_policy.order_text_cache_write_rate_microusd_per_million,
    'order_text_output_rate_microusd_per_million',
      v_policy.order_text_output_rate_microusd_per_million,
    'inventory_vision_input_rate_microusd_per_million',
      v_policy.inventory_vision_input_rate_microusd_per_million,
    'inventory_vision_cached_input_rate_microusd_per_million',
      v_policy.inventory_vision_cached_input_rate_microusd_per_million,
    'inventory_vision_cache_write_rate_microusd_per_million',
      v_policy.inventory_vision_cache_write_rate_microusd_per_million,
    'inventory_vision_output_rate_microusd_per_million',
      v_policy.inventory_vision_output_rate_microusd_per_million,
    'max_provider_attempts', v_policy.max_provider_attempts,
    'reservation_ttl_seconds', v_policy.reservation_ttl_seconds
  );

  if v_actual <> p_expected then
    return jsonb_build_object('ok', false, 'code', 'policy_configuration_mismatch');
  end if;
  return jsonb_build_object('ok', true, 'code', 'policy_ready');
end;
$$;

create or replace function public.repairdesk_reserve_ai_usage(
  p_store_id uuid,
  p_actor_id uuid,
  p_actor_fingerprint_hmac text,
  p_client_request_id uuid,
  p_request_fingerprint_hmac text,
  p_request_kind text,
  p_policy_version text,
  p_pricing_version text,
  p_model text,
  p_reserved_cost_microusd bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_policy public.ai_assistant_usage_policies%rowtype;
  v_existing public.ai_assistant_usage_requests%rowtype;
  v_store_bucket public.ai_assistant_usage_buckets%rowtype;
  v_global_day_bucket public.ai_assistant_usage_buckets%rowtype;
  v_global_month_bucket public.ai_assistant_usage_buckets%rowtype;
  v_actor_bucket public.ai_assistant_actor_rate_buckets%rowtype;
  v_expected_model text;
  v_store_limit bigint;
  v_max_reservation bigint;
  v_local_day date;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_month_local timestamp;
  v_month_start timestamptz;
  v_month_end timestamptz;
  v_minute_start timestamptz := pg_catalog.date_trunc('minute', v_now);
  v_minute_end timestamptz := pg_catalog.date_trunc('minute', v_now) + interval '1 minute';
  v_request_id uuid := gen_random_uuid();
  v_actor_allowed boolean := false;
begin
  if p_store_id is null or p_actor_id is null or p_client_request_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_identity');
  end if;
  if p_request_fingerprint_hmac is null
     or p_request_fingerprint_hmac !~ '^[A-Za-z0-9_-]{43,96}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_request_fingerprint');
  end if;
  if p_actor_fingerprint_hmac is null
     or p_actor_fingerprint_hmac !~ '^[A-Za-z0-9_-]{43}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_actor_fingerprint');
  end if;
  if p_request_kind not in ('order_text', 'inventory_vision') then
    return jsonb_build_object('ok', false, 'code', 'invalid_request_kind');
  end if;
  if p_request_kind is null
     or p_policy_version is null or btrim(p_policy_version) = ''
     or p_pricing_version is null or btrim(p_pricing_version) = ''
     or p_model is null or btrim(p_model) = '' then
    return jsonb_build_object('ok', false, 'code', 'invalid_policy_binding');
  end if;
  if p_reserved_cost_microusd is null or p_reserved_cost_microusd <= 0 then
    return jsonb_build_object('ok', false, 'code', 'invalid_reservation');
  end if;

  select exists (
    select 1
      from public.staff_profiles as profile
      join public.store_memberships as membership
        on membership.user_id = profile.id
       and membership.store_id = p_store_id
       and membership.status::text = 'active'
      join public.stores as store_row
        on store_row.id = membership.store_id
       and store_row.status::text = 'active'
     where profile.id = p_actor_id
       and profile.status::text = 'active'
       and membership.role::text <> 'viewer'
  ) into v_actor_allowed;

  if not v_actor_allowed then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_store_id::text || ':' || p_client_request_id::text, 0)
  );

  select request_row.*
    into v_existing
    from public.ai_assistant_usage_requests as request_row
   where request_row.store_id = p_store_id
     and request_row.client_request_id = p_client_request_id;

  if found then
    if v_existing.request_fingerprint_hmac <> p_request_fingerprint_hmac
       or v_existing.request_kind <> p_request_kind
       or v_existing.policy_version <> p_policy_version
       or v_existing.pricing_version <> p_pricing_version
       or v_existing.model <> p_model
       or v_existing.reserved_cost_microusd <> p_reserved_cost_microusd then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return jsonb_build_object(
      'ok', true,
      'code', 'idempotent_replay',
      'reservation_id', v_existing.id,
      'state', v_existing.state,
      'reserved_cost_microusd', v_existing.reserved_cost_microusd::text,
      'expires_at', v_existing.expires_at
    );
  end if;

  select policy_row.*
    into v_policy
    from public.ai_assistant_usage_policies as policy_row
   where policy_row.policy_version = p_policy_version
     and policy_row.status = 'enabled'
     and policy_row.effective_at <= v_now
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'budget_not_configured');
  end if;
  if v_policy.pricing_version <> p_pricing_version then
    return jsonb_build_object('ok', false, 'code', 'pricing_version_mismatch');
  end if;
  if exists (
    select 1
      from public.ai_assistant_usage_policies as historical_policy
     where historical_policy.policy_version <> v_policy.policy_version
       and historical_policy.quota_timezone <> v_policy.quota_timezone
  ) then
    return jsonb_build_object('ok', false, 'code', 'quota_timezone_rotation_forbidden');
  end if;

  if p_request_kind = 'order_text' then
    v_expected_model := v_policy.order_text_model;
    v_store_limit := v_policy.order_text_per_store_day;
    v_max_reservation := v_policy.order_text_max_reservation_microusd;
  else
    v_expected_model := v_policy.inventory_vision_model;
    v_store_limit := v_policy.inventory_vision_per_store_day;
    v_max_reservation := v_policy.inventory_vision_max_reservation_microusd;
  end if;

  if p_model <> v_expected_model then
    return jsonb_build_object('ok', false, 'code', 'model_mismatch');
  end if;
  if p_reserved_cost_microusd <> v_max_reservation then
    return jsonb_build_object('ok', false, 'code', 'reservation_mismatch');
  end if;

  begin
    v_local_day := (v_now at time zone v_policy.quota_timezone)::date;
    v_day_start := v_local_day::timestamp at time zone v_policy.quota_timezone;
    v_day_end := (v_local_day + 1)::timestamp at time zone v_policy.quota_timezone;
    v_month_local := pg_catalog.date_trunc('month', v_now at time zone v_policy.quota_timezone);
    v_month_start := v_month_local at time zone v_policy.quota_timezone;
    v_month_end := (v_month_local + interval '1 month') at time zone v_policy.quota_timezone;
  exception when invalid_parameter_value then
    return jsonb_build_object('ok', false, 'code', 'invalid_quota_timezone');
  end;

  -- Stable lock order prevents the last global/month/store slot from being
  -- double-reserved by concurrent Vercel instances.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('global_month:' || v_month_start::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('global_day:' || v_day_start::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'store_day:' || p_store_id::text || ':' || p_request_kind || ':' || v_day_start::text,
      0
    )
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'actor_minute:' || p_store_id::text || ':' || p_actor_fingerprint_hmac || ':'
        || v_minute_start::text,
      0
    )
  );

  insert into public.ai_assistant_usage_buckets (
    policy_version,
    scope,
    request_kind,
    store_id,
    period_start_at,
    period_end_at,
    quota_timezone,
    request_limit,
    cost_limit_microusd
  ) values (
    p_policy_version,
    'global_month',
    'all',
    null,
    v_month_start,
    v_month_end,
    v_policy.quota_timezone,
    0,
    v_policy.monthly_budget_microusd
  ) on conflict (
    scope, request_kind, store_scope_key, period_start_at
  ) do nothing;

  insert into public.ai_assistant_actor_rate_buckets (
    store_id,
    actor_fingerprint_hmac,
    period_start_at,
    period_end_at,
    request_limit
  ) values (
    p_store_id,
    p_actor_fingerprint_hmac,
    v_minute_start,
    v_minute_end,
    v_policy.requests_per_actor_minute
  ) on conflict (store_id, actor_fingerprint_hmac, period_start_at) do nothing;

  insert into public.ai_assistant_usage_buckets (
    policy_version,
    scope,
    request_kind,
    store_id,
    period_start_at,
    period_end_at,
    quota_timezone,
    request_limit,
    cost_limit_microusd
  ) values (
    p_policy_version,
    'global_day',
    'all',
    null,
    v_day_start,
    v_day_end,
    v_policy.quota_timezone,
    v_policy.provider_requests_global_day,
    0
  ) on conflict (
    scope, request_kind, store_scope_key, period_start_at
  ) do nothing;

  insert into public.ai_assistant_usage_buckets (
    policy_version,
    scope,
    request_kind,
    store_id,
    period_start_at,
    period_end_at,
    quota_timezone,
    request_limit,
    cost_limit_microusd
  ) values (
    p_policy_version,
    'store_day',
    p_request_kind,
    p_store_id,
    v_day_start,
    v_day_end,
    v_policy.quota_timezone,
    v_store_limit,
    v_max_reservation * v_store_limit
  ) on conflict (
    scope, request_kind, store_scope_key, period_start_at
  ) do nothing;

  select bucket_row.*
    into v_global_month_bucket
    from public.ai_assistant_usage_buckets as bucket_row
   where bucket_row.scope = 'global_month'
     and bucket_row.request_kind = 'all'
     and bucket_row.period_start_at = v_month_start
   for update;

  select bucket_row.*
    into v_global_day_bucket
    from public.ai_assistant_usage_buckets as bucket_row
   where bucket_row.scope = 'global_day'
     and bucket_row.request_kind = 'all'
     and bucket_row.period_start_at = v_day_start
   for update;

  select bucket_row.*
    into v_actor_bucket
    from public.ai_assistant_actor_rate_buckets as bucket_row
   where bucket_row.store_id = p_store_id
     and bucket_row.actor_fingerprint_hmac = p_actor_fingerprint_hmac
     and bucket_row.period_start_at = v_minute_start
   for update;

  select bucket_row.*
    into v_store_bucket
    from public.ai_assistant_usage_buckets as bucket_row
   where bucket_row.scope = 'store_day'
     and bucket_row.request_kind = p_request_kind
     and bucket_row.store_id = p_store_id
     and bucket_row.period_start_at = v_day_start
   for update;

  -- A policy rotation may tighten an already-open period, but it may never
  -- enlarge the existing hard limit until the next day/month bucket starts.
  update public.ai_assistant_usage_buckets
     set cost_limit_microusd = least(
           cost_limit_microusd,
           v_policy.monthly_budget_microusd
         ),
         updated_at = v_now
   where id = v_global_month_bucket.id
  returning * into v_global_month_bucket;

  update public.ai_assistant_usage_buckets
     set request_limit = least(
           request_limit,
           v_policy.provider_requests_global_day::bigint
         ),
         updated_at = v_now
   where id = v_global_day_bucket.id
  returning * into v_global_day_bucket;

  update public.ai_assistant_usage_buckets
     set request_limit = least(request_limit, v_store_limit),
         cost_limit_microusd = least(
           cost_limit_microusd,
           v_max_reservation * v_store_limit
         ),
         updated_at = v_now
   where id = v_store_bucket.id
  returning * into v_store_bucket;

  update public.ai_assistant_actor_rate_buckets
     set request_limit = least(request_limit, v_policy.requests_per_actor_minute),
         updated_at = v_now
   where id = v_actor_bucket.id
  returning * into v_actor_bucket;

  if v_actor_bucket.request_count >= v_actor_bucket.request_limit then
    return jsonb_build_object('ok', false, 'code', 'actor_minute_limit_reached');
  end if;
  if v_store_bucket.request_count >= v_store_bucket.request_limit then
    return jsonb_build_object('ok', false, 'code', 'store_daily_limit_reached');
  end if;
  if v_global_day_bucket.request_count >= v_global_day_bucket.request_limit then
    return jsonb_build_object('ok', false, 'code', 'global_daily_limit_reached');
  end if;
  if v_global_month_bucket.reserved_cost_microusd
       + v_global_month_bucket.settled_cost_microusd
       + p_reserved_cost_microusd
     > v_global_month_bucket.cost_limit_microusd then
    return jsonb_build_object('ok', false, 'code', 'monthly_budget_reached');
  end if;

  update public.ai_assistant_usage_buckets
     set request_count = request_count + 1,
         reserved_cost_microusd = reserved_cost_microusd + p_reserved_cost_microusd,
         updated_at = v_now
   where id in (v_store_bucket.id, v_global_day_bucket.id, v_global_month_bucket.id);

  update public.ai_assistant_actor_rate_buckets
     set request_count = request_count + 1,
         updated_at = v_now
   where id = v_actor_bucket.id;

  insert into public.ai_assistant_usage_requests (
    id,
    store_id,
    client_request_id,
    request_fingerprint_hmac,
    request_kind,
    policy_version,
    pricing_version,
    model,
    store_day_bucket_id,
    global_day_bucket_id,
    global_month_bucket_id,
    actor_minute_bucket_id,
    reserved_cost_microusd,
    reserved_at,
    expires_at
  ) values (
    v_request_id,
    p_store_id,
    p_client_request_id,
    p_request_fingerprint_hmac,
    p_request_kind,
    p_policy_version,
    p_pricing_version,
    p_model,
    v_store_bucket.id,
    v_global_day_bucket.id,
    v_global_month_bucket.id,
    v_actor_bucket.id,
    p_reserved_cost_microusd,
    v_now,
    v_now + pg_catalog.make_interval(secs => v_policy.reservation_ttl_seconds)
  );

  return jsonb_build_object(
    'ok', true,
    'code', 'reserved',
    'reservation_id', v_request_id,
    'reserved_cost_microusd', p_reserved_cost_microusd::text,
    'expires_at', v_now + pg_catalog.make_interval(secs => v_policy.reservation_ttl_seconds)
  );
end;
$$;

create or replace function public.repairdesk_release_ai_usage_pre_dispatch(
  p_store_id uuid,
  p_actor_id uuid,
  p_client_request_id uuid,
  p_request_fingerprint_hmac text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_request public.ai_assistant_usage_requests%rowtype;
  v_actor_allowed boolean := false;
begin
  if p_store_id is null or p_actor_id is null or p_client_request_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_identity');
  end if;
  if p_request_fingerprint_hmac is null
     or p_request_fingerprint_hmac !~ '^[A-Za-z0-9_-]{43,96}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_request_fingerprint');
  end if;

  select exists (
    select 1
      from public.staff_profiles as profile
      join public.store_memberships as membership
        on membership.user_id = profile.id
       and membership.store_id = p_store_id
       and membership.status::text = 'active'
      join public.stores as store_row
        on store_row.id = membership.store_id
       and store_row.status::text = 'active'
     where profile.id = p_actor_id
       and profile.status::text = 'active'
       and membership.role::text <> 'viewer'
  ) into v_actor_allowed;

  if not v_actor_allowed then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_store_id::text || ':' || p_client_request_id::text, 0)
  );

  select request_row.*
    into v_request
    from public.ai_assistant_usage_requests as request_row
   where request_row.store_id = p_store_id
     and request_row.client_request_id = p_client_request_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'reservation_not_found');
  end if;
  if v_request.request_fingerprint_hmac <> p_request_fingerprint_hmac then
    return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
  end if;
  if v_request.state <> 'reserved' then
    return jsonb_build_object('ok', true, 'code', 'idempotent_replay', 'state', v_request.state);
  end if;

  update public.ai_assistant_usage_buckets
     set request_count = greatest(request_count - 1, 0),
         reserved_cost_microusd = reserved_cost_microusd - v_request.reserved_cost_microusd,
         updated_at = v_now
   where id in (
     v_request.store_day_bucket_id,
     v_request.global_day_bucket_id,
     v_request.global_month_bucket_id
   );

  update public.ai_assistant_actor_rate_buckets
     set request_count = greatest(request_count - 1, 0),
         updated_at = v_now
   where id = v_request.actor_minute_bucket_id;

  update public.ai_assistant_usage_requests
     set state = 'failed_pre_dispatch',
         estimated_cost_microusd = 0,
         settlement_basis = 'zero_pre_dispatch',
         finalized_at = v_now
   where id = v_request.id;

  return jsonb_build_object(
    'ok', true,
    'code', 'released_pre_dispatch',
    'state', 'failed_pre_dispatch'
  );
end;
$$;

create or replace function public.repairdesk_maintain_ai_usage(
  p_stale_limit integer default 100,
  p_retention_before timestamptz default clock_timestamp() - interval '90 days',
  p_delete_limit integer default 500
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_stale_result jsonb;
  v_request_deleted integer := 0;
  v_rate_deleted integer := 0;
begin
  if p_stale_limit is null or p_stale_limit < 1 or p_stale_limit > 500
     or p_delete_limit is null or p_delete_limit < 1 or p_delete_limit > 5000
     or p_retention_before is null or p_retention_before > v_now - interval '1 day' then
    return jsonb_build_object('ok', false, 'code', 'invalid_maintenance_policy');
  end if;

  select public.repairdesk_settle_stale_ai_usage(p_stale_limit) into v_stale_result;
  if coalesce((v_stale_result ->> 'ok')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'code', 'stale_settlement_failed');
  end if;

  with targets as (
    select request_row.id
      from public.ai_assistant_usage_requests as request_row
     where request_row.state <> 'reserved'
       and request_row.finalized_at < p_retention_before
     order by request_row.finalized_at
     for update skip locked
     limit p_delete_limit
  )
  delete from public.ai_assistant_usage_requests as request_row
  using targets
  where request_row.id = targets.id;
  get diagnostics v_request_deleted = row_count;

  with targets as (
    select rate_row.id
      from public.ai_assistant_actor_rate_buckets as rate_row
     where rate_row.period_end_at < p_retention_before
       and not exists (
         select 1
           from public.ai_assistant_usage_requests as request_row
          where request_row.actor_minute_bucket_id = rate_row.id
       )
     order by rate_row.period_end_at
     for update skip locked
     limit p_delete_limit
  )
  delete from public.ai_assistant_actor_rate_buckets as rate_row
  using targets
  where rate_row.id = targets.id;
  get diagnostics v_rate_deleted = row_count;

  return jsonb_build_object(
    'ok', true,
    'code', 'maintenance_completed',
    'stale_settled_count', coalesce((v_stale_result ->> 'settled_count')::integer, 0),
    'request_deleted_count', v_request_deleted,
    'rate_bucket_deleted_count', v_rate_deleted
  );
end;
$$;

revoke all on function public.repairdesk_attest_ai_usage_policy(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.repairdesk_reserve_ai_usage(
  uuid, uuid, text, uuid, text, text, text, text, text, bigint
) from public, anon, authenticated, service_role;
revoke all on function public.repairdesk_release_ai_usage_pre_dispatch(
  uuid, uuid, uuid, text
) from public, anon, authenticated, service_role;
revoke all on function public.repairdesk_maintain_ai_usage(integer, timestamptz, integer)
  from public, anon, authenticated, service_role;

grant execute on function public.repairdesk_attest_ai_usage_policy(jsonb)
  to service_role;
grant execute on function public.repairdesk_reserve_ai_usage(
  uuid, uuid, text, uuid, text, text, text, text, text, bigint
) to service_role;
grant execute on function public.repairdesk_release_ai_usage_pre_dispatch(
  uuid, uuid, uuid, text
) to service_role;
grant execute on function public.repairdesk_maintain_ai_usage(integer, timestamptz, integer)
  to service_role;

comment on table public.ai_assistant_actor_rate_buckets is
  'Short-lived HMAC actor rate-limit buckets; no raw actor identity or customer content.';
comment on table public.ai_assistant_usage_requests is
  'Opaque idempotent provider reservations; no actor, prompt, image, OCR, order, or identifier content.';

commit;
