-- Phase 3A is additive and dormant by design. This migration creates no
-- enabled policy, sends no provider request, and stores no prompt, image, OCR,
-- order reference, IMEI, safety identifier, actor identity, or model output.

create table public.ai_assistant_usage_policies (
  policy_version text primary key,
  status text not null default 'disabled',
  quota_timezone text not null,
  pricing_version text not null,
  order_text_model text not null,
  inventory_vision_model text not null,
  order_text_max_input_tokens bigint not null,
  order_text_max_output_tokens bigint not null,
  inventory_vision_max_input_tokens bigint not null,
  inventory_vision_max_output_tokens bigint not null,
  order_text_per_store_day integer not null,
  inventory_vision_per_store_day integer not null,
  provider_requests_global_day integer not null,
  monthly_budget_microusd bigint not null,
  order_text_max_reservation_microusd bigint not null,
  inventory_vision_max_reservation_microusd bigint not null,
  order_text_input_rate_microusd_per_million bigint not null,
  order_text_cached_input_rate_microusd_per_million bigint not null,
  order_text_cache_write_rate_microusd_per_million bigint not null,
  order_text_output_rate_microusd_per_million bigint not null,
  inventory_vision_input_rate_microusd_per_million bigint not null,
  inventory_vision_cached_input_rate_microusd_per_million bigint not null,
  inventory_vision_cache_write_rate_microusd_per_million bigint not null,
  inventory_vision_output_rate_microusd_per_million bigint not null,
  max_provider_attempts smallint not null default 1,
  reservation_ttl_seconds integer not null default 600,
  effective_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint ai_usage_policy_version_check
    check (policy_version ~ '^[a-z0-9][a-z0-9._-]{2,79}$'),
  constraint ai_usage_policy_status_check
    check (status in ('disabled', 'enabled', 'superseded')),
  constraint ai_usage_policy_timezone_check
    check (char_length(btrim(quota_timezone)) between 1 and 80),
  constraint ai_usage_policy_pricing_check
    check (char_length(btrim(pricing_version)) between 3 and 80),
  constraint ai_usage_policy_models_check
    check (
      char_length(btrim(order_text_model)) between 3 and 120
      and char_length(btrim(inventory_vision_model)) between 3 and 120
    ),
  constraint ai_usage_policy_limits_check
    check (
      order_text_per_store_day > 0
      and inventory_vision_per_store_day > 0
      and provider_requests_global_day > 0
      and monthly_budget_microusd > 0
      and order_text_max_reservation_microusd > 0
      and inventory_vision_max_reservation_microusd > 0
      and order_text_max_input_tokens > 0
      and order_text_max_output_tokens > 0
      and inventory_vision_max_input_tokens > 0
      and inventory_vision_max_output_tokens > 0
    ),
  constraint ai_usage_policy_rates_check
    check (
      order_text_input_rate_microusd_per_million >= 0
      and order_text_cached_input_rate_microusd_per_million >= 0
      and order_text_cache_write_rate_microusd_per_million >= 0
      and order_text_output_rate_microusd_per_million >= 0
      and inventory_vision_input_rate_microusd_per_million >= 0
      and inventory_vision_cached_input_rate_microusd_per_million >= 0
      and inventory_vision_cache_write_rate_microusd_per_million >= 0
      and inventory_vision_output_rate_microusd_per_million >= 0
    ),
  constraint ai_usage_policy_attempts_check check (max_provider_attempts = 1),
  constraint ai_usage_policy_ttl_check check (reservation_ttl_seconds between 60 and 3600),
  constraint ai_usage_policy_reservation_floor_check
    check (
      order_text_max_reservation_microusd >=
        pg_catalog.ceil(
          order_text_max_input_tokens::numeric
          * greatest(
              order_text_input_rate_microusd_per_million,
              order_text_cached_input_rate_microusd_per_million,
              order_text_cache_write_rate_microusd_per_million
            )
          / 1000000
        )::bigint
        + pg_catalog.ceil(
            order_text_max_output_tokens::numeric
            * order_text_output_rate_microusd_per_million
            / 1000000
          )::bigint
      and inventory_vision_max_reservation_microusd >=
        pg_catalog.ceil(
          inventory_vision_max_input_tokens::numeric
          * greatest(
              inventory_vision_input_rate_microusd_per_million,
              inventory_vision_cached_input_rate_microusd_per_million,
              inventory_vision_cache_write_rate_microusd_per_million
            )
          / 1000000
        )::bigint
        + pg_catalog.ceil(
            inventory_vision_max_output_tokens::numeric
            * inventory_vision_output_rate_microusd_per_million
            / 1000000
          )::bigint
    )
);

create unique index ai_assistant_one_enabled_policy_idx
  on public.ai_assistant_usage_policies ((status))
  where status = 'enabled';

create table public.ai_assistant_usage_buckets (
  id uuid primary key default gen_random_uuid(),
  policy_version text not null,
  scope text not null,
  request_kind text not null,
  store_id uuid,
  store_scope_key uuid generated always as (
    coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) stored,
  period_start_at timestamptz not null,
  period_end_at timestamptz not null,
  quota_timezone text not null,
  request_limit bigint not null,
  cost_limit_microusd bigint not null,
  request_count bigint not null default 0,
  reserved_cost_microusd bigint not null default 0,
  settled_cost_microusd bigint not null default 0,
  input_token_count bigint not null default 0,
  cached_input_token_count bigint not null default 0,
  cache_write_token_count bigint not null default 0,
  output_token_count bigint not null default 0,
  overrun_count bigint not null default 0,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint ai_usage_buckets_policy_fkey
    foreign key (policy_version)
    references public.ai_assistant_usage_policies(policy_version)
    on update cascade on delete restrict,
  constraint ai_usage_buckets_store_fkey
    foreign key (store_id) references public.stores(id)
    on update cascade on delete restrict,
  constraint ai_usage_buckets_scope_check
    check (scope in ('store_day', 'global_day', 'global_month')),
  constraint ai_usage_buckets_kind_check
    check (request_kind in ('order_text', 'inventory_vision', 'all')),
  constraint ai_usage_buckets_scope_store_check
    check (
      (scope = 'store_day' and store_id is not null and request_kind <> 'all')
      or (scope in ('global_day', 'global_month') and store_id is null and request_kind = 'all')
    ),
  constraint ai_usage_buckets_period_check check (period_end_at > period_start_at),
  constraint ai_usage_buckets_limits_check
    check (request_limit >= 0 and cost_limit_microusd >= 0),
  constraint ai_usage_buckets_counts_check
    check (
      request_count >= 0
      and reserved_cost_microusd >= 0
      and settled_cost_microusd >= 0
      and input_token_count >= 0
      and cached_input_token_count >= 0
      and cache_write_token_count >= 0
      and output_token_count >= 0
      and overrun_count >= 0
    ),
  constraint ai_usage_buckets_id_store_unique unique (id, store_id)
);

create unique index ai_assistant_usage_bucket_identity_idx
  on public.ai_assistant_usage_buckets (
    scope,
    request_kind,
    store_scope_key,
    period_start_at
  );

create index ai_assistant_usage_bucket_period_idx
  on public.ai_assistant_usage_buckets (scope, period_start_at desc);

create table public.ai_assistant_usage_requests (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  client_request_id uuid not null,
  request_fingerprint_hmac text not null,
  request_kind text not null,
  policy_version text not null,
  pricing_version text not null,
  model text not null,
  store_day_bucket_id uuid not null,
  global_day_bucket_id uuid not null,
  global_month_bucket_id uuid not null,
  state text not null default 'reserved',
  reserved_cost_microusd bigint not null,
  estimated_cost_microusd bigint,
  input_token_count bigint,
  cached_input_token_count bigint,
  cache_write_token_count bigint,
  output_token_count bigint,
  provider_attempt_count smallint not null default 0,
  settlement_basis text,
  reserved_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  finalized_at timestamptz,
  constraint ai_usage_requests_store_fkey
    foreign key (store_id) references public.stores(id)
    on update cascade on delete restrict,
  constraint ai_usage_requests_policy_fkey
    foreign key (policy_version)
    references public.ai_assistant_usage_policies(policy_version)
    on update cascade on delete restrict,
  constraint ai_usage_requests_store_bucket_fkey
    foreign key (store_day_bucket_id, store_id)
    references public.ai_assistant_usage_buckets(id, store_id)
    on update cascade on delete restrict,
  constraint ai_usage_requests_global_day_bucket_fkey
    foreign key (global_day_bucket_id)
    references public.ai_assistant_usage_buckets(id)
    on update cascade on delete restrict,
  constraint ai_usage_requests_global_month_bucket_fkey
    foreign key (global_month_bucket_id)
    references public.ai_assistant_usage_buckets(id)
    on update cascade on delete restrict,
  constraint ai_usage_requests_store_client_unique unique (store_id, client_request_id),
  constraint ai_usage_requests_fingerprint_check
    check (request_fingerprint_hmac ~ '^[A-Za-z0-9_-]{43,96}$'),
  constraint ai_usage_requests_kind_check
    check (request_kind in ('order_text', 'inventory_vision')),
  constraint ai_usage_requests_state_check
    check (
      state in (
        'reserved',
        'succeeded',
        'failed_billable',
        'failed_pre_dispatch',
        'stale_charged',
        'overrun'
      )
    ),
  constraint ai_usage_requests_cost_check
    check (
      reserved_cost_microusd > 0
      and (estimated_cost_microusd is null or estimated_cost_microusd >= 0)
    ),
  constraint ai_usage_requests_token_check
    check (
      (input_token_count is null or input_token_count >= 0)
      and (cached_input_token_count is null or cached_input_token_count >= 0)
      and (cache_write_token_count is null or cache_write_token_count >= 0)
      and (output_token_count is null or output_token_count >= 0)
      and provider_attempt_count between 0 and 1
    ),
  constraint ai_usage_requests_settlement_check
    check (
      settlement_basis is null
      or settlement_basis in ('usage_reported', 'reserved_max', 'zero_pre_dispatch')
    ),
  constraint ai_usage_requests_expiry_check check (expires_at > reserved_at)
);

create index ai_assistant_usage_requests_store_created_idx
  on public.ai_assistant_usage_requests (store_id, reserved_at desc);

create index ai_assistant_usage_requests_stale_idx
  on public.ai_assistant_usage_requests (expires_at)
  where state = 'reserved';

alter table public.ai_assistant_usage_policies enable row level security;
alter table public.ai_assistant_usage_buckets enable row level security;
alter table public.ai_assistant_usage_requests enable row level security;

revoke all on table public.ai_assistant_usage_policies
  from public, anon, authenticated, service_role;
revoke all on table public.ai_assistant_usage_buckets
  from public, anon, authenticated, service_role;
revoke all on table public.ai_assistant_usage_requests
  from public, anon, authenticated, service_role;

grant select on table public.ai_assistant_usage_policies to service_role;
grant update (status) on table public.ai_assistant_usage_policies to service_role;
grant select, insert, update on table public.ai_assistant_usage_buckets to service_role;
grant select, insert, update on table public.ai_assistant_usage_requests to service_role;

create or replace function public.repairdesk_reserve_ai_usage(
  p_store_id uuid,
  p_actor_id uuid,
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
  v_expected_model text;
  v_store_limit bigint;
  v_max_reservation bigint;
  v_local_day date;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_month_local timestamp;
  v_month_start timestamptz;
  v_month_end timestamptz;
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

create or replace function public.repairdesk_finalize_ai_usage(
  p_store_id uuid,
  p_actor_id uuid,
  p_client_request_id uuid,
  p_request_fingerprint_hmac text,
  p_input_token_count bigint,
  p_cached_input_token_count bigint,
  p_cache_write_token_count bigint,
  p_output_token_count bigint,
  p_provider_attempt_count smallint
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_request public.ai_assistant_usage_requests%rowtype;
  v_policy public.ai_assistant_usage_policies%rowtype;
  v_input_rate bigint;
  v_cached_rate bigint;
  v_cache_write_rate bigint;
  v_output_rate bigint;
  v_uncached_input bigint;
  v_estimated_cost bigint;
  v_next_state text;
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

  if p_input_token_count is null or p_input_token_count < 0
     or p_cached_input_token_count is null or p_cached_input_token_count < 0
     or p_cache_write_token_count is null or p_cache_write_token_count < 0
     or p_output_token_count is null or p_output_token_count < 0
     or p_cached_input_token_count + p_cache_write_token_count > p_input_token_count then
    return jsonb_build_object('ok', false, 'code', 'invalid_usage');
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
    return jsonb_build_object(
      'ok', true,
      'code', 'idempotent_replay',
      'state', v_request.state,
      'estimated_cost_microusd', coalesce(v_request.estimated_cost_microusd, 0)::text
    );
  end if;

  select policy_row.*
    into v_policy
    from public.ai_assistant_usage_policies as policy_row
   where policy_row.policy_version = v_request.policy_version;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'policy_not_found');
  end if;
  if p_provider_attempt_count < 1
     or p_provider_attempt_count > v_policy.max_provider_attempts then
    return jsonb_build_object('ok', false, 'code', 'invalid_provider_attempts');
  end if;

  if v_request.request_kind = 'order_text' then
    v_input_rate := v_policy.order_text_input_rate_microusd_per_million;
    v_cached_rate := v_policy.order_text_cached_input_rate_microusd_per_million;
    v_cache_write_rate := v_policy.order_text_cache_write_rate_microusd_per_million;
    v_output_rate := v_policy.order_text_output_rate_microusd_per_million;
  else
    v_input_rate := v_policy.inventory_vision_input_rate_microusd_per_million;
    v_cached_rate := v_policy.inventory_vision_cached_input_rate_microusd_per_million;
    v_cache_write_rate := v_policy.inventory_vision_cache_write_rate_microusd_per_million;
    v_output_rate := v_policy.inventory_vision_output_rate_microusd_per_million;
  end if;

  v_uncached_input := p_input_token_count - p_cached_input_token_count - p_cache_write_token_count;
  v_estimated_cost :=
      pg_catalog.ceil(v_uncached_input::numeric * v_input_rate / 1000000)::bigint
    + pg_catalog.ceil(p_cached_input_token_count::numeric * v_cached_rate / 1000000)::bigint
    + pg_catalog.ceil(p_cache_write_token_count::numeric * v_cache_write_rate / 1000000)::bigint
    + pg_catalog.ceil(p_output_token_count::numeric * v_output_rate / 1000000)::bigint;
  v_next_state := case
    when v_estimated_cost > v_request.reserved_cost_microusd then 'overrun'
    else 'succeeded'
  end;

  update public.ai_assistant_usage_buckets
     set reserved_cost_microusd = reserved_cost_microusd - v_request.reserved_cost_microusd,
         settled_cost_microusd = settled_cost_microusd + v_estimated_cost,
         input_token_count = input_token_count + p_input_token_count,
         cached_input_token_count = cached_input_token_count + p_cached_input_token_count,
         cache_write_token_count = cache_write_token_count + p_cache_write_token_count,
         output_token_count = output_token_count + p_output_token_count,
         overrun_count = overrun_count + case when v_next_state = 'overrun' then 1 else 0 end,
         updated_at = v_now
   where id in (
     v_request.store_day_bucket_id,
     v_request.global_day_bucket_id,
     v_request.global_month_bucket_id
   );

  update public.ai_assistant_usage_requests
     set state = v_next_state,
         estimated_cost_microusd = v_estimated_cost,
         input_token_count = p_input_token_count,
         cached_input_token_count = p_cached_input_token_count,
         cache_write_token_count = p_cache_write_token_count,
         output_token_count = p_output_token_count,
         provider_attempt_count = p_provider_attempt_count,
         settlement_basis = 'usage_reported',
         finalized_at = v_now
   where id = v_request.id;

  if v_next_state = 'overrun' then
    update public.ai_assistant_usage_policies
       set status = 'disabled'
     where policy_version = v_request.policy_version
       and status = 'enabled';
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', v_next_state,
    'state', v_next_state,
    'estimated_cost_microusd', v_estimated_cost::text
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

create or replace function public.repairdesk_settle_stale_ai_usage(p_limit integer default 100)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_request public.ai_assistant_usage_requests%rowtype;
  v_settled integer := 0;
begin
  if p_limit is null or p_limit < 1 or p_limit > 500 then
    return jsonb_build_object('ok', false, 'code', 'invalid_limit');
  end if;

  for v_request in
    select request_row.*
      from public.ai_assistant_usage_requests as request_row
     where request_row.state = 'reserved'
       and request_row.expires_at <= v_now
     order by request_row.expires_at
     for update skip locked
     limit p_limit
  loop
    update public.ai_assistant_usage_buckets
       set reserved_cost_microusd = reserved_cost_microusd - v_request.reserved_cost_microusd,
           settled_cost_microusd = settled_cost_microusd + v_request.reserved_cost_microusd,
           updated_at = v_now
     where id in (
       v_request.store_day_bucket_id,
       v_request.global_day_bucket_id,
       v_request.global_month_bucket_id
     );

    update public.ai_assistant_usage_requests
       set state = 'stale_charged',
           estimated_cost_microusd = v_request.reserved_cost_microusd,
           settlement_basis = 'reserved_max',
           finalized_at = v_now
     where id = v_request.id;
    v_settled := v_settled + 1;
  end loop;

  return jsonb_build_object('ok', true, 'code', 'stale_settled', 'settled_count', v_settled);
end;
$$;

revoke all on function public.repairdesk_reserve_ai_usage(
  uuid, uuid, uuid, text, text, text, text, text, bigint
) from public, anon, authenticated, service_role;
revoke all on function public.repairdesk_finalize_ai_usage(
  uuid, uuid, uuid, text, bigint, bigint, bigint, bigint, smallint
) from public, anon, authenticated, service_role;
revoke all on function public.repairdesk_release_ai_usage_pre_dispatch(
  uuid, uuid, uuid, text
) from public, anon, authenticated, service_role;
revoke all on function public.repairdesk_settle_stale_ai_usage(integer)
  from public, anon, authenticated, service_role;

grant execute on function public.repairdesk_reserve_ai_usage(
  uuid, uuid, uuid, text, text, text, text, text, bigint
) to service_role;
grant execute on function public.repairdesk_finalize_ai_usage(
  uuid, uuid, uuid, text, bigint, bigint, bigint, bigint, smallint
) to service_role;
grant execute on function public.repairdesk_release_ai_usage_pre_dispatch(
  uuid, uuid, uuid, text
) to service_role;
grant execute on function public.repairdesk_settle_stale_ai_usage(integer)
  to service_role;

comment on table public.ai_assistant_usage_policies is
  'Versioned AI cost policy. This migration intentionally creates no enabled row.';
comment on table public.ai_assistant_usage_buckets is
  'Aggregate request/token/micro-USD buckets only; no customer or prompt content.';
comment on table public.ai_assistant_usage_requests is
  'Opaque idempotent provider reservations; no actor, prompt, image, OCR, order, or identifier content.';
