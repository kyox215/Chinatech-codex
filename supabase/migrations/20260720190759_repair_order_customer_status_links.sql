-- Privacy-safe customer repair-status links used by printed repair tickets.
--
-- The raw bearer token is never stored. Application code stores only a
-- SHA-256 digest and serves a strict customer-safe projection through a
-- server-only endpoint. This migration is additive and performs no backfill.

set lock_timeout = '5s';

create table public.repair_order_customer_status_links (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  order_id uuid not null,
  lifecycle_revision bigint not null,
  token_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid,
  revoke_reason text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint repair_order_customer_status_links_token_hash_unique unique (token_hash),
  constraint repair_order_customer_status_links_order_same_store_fkey
    foreign key (order_id, store_id)
    references public.repair_orders (id, store_id)
    on update cascade on delete cascade,
  constraint repair_order_customer_status_links_created_by_fkey
    foreign key (created_by) references auth.users (id)
    on update cascade on delete set null,
  constraint repair_order_customer_status_links_revoked_by_fkey
    foreign key (revoked_by) references auth.users (id)
    on update cascade on delete set null,
  constraint repair_order_customer_status_links_token_hash_check
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint repair_order_customer_status_links_lifecycle_revision_check
    check (lifecycle_revision >= 1),
  constraint repair_order_customer_status_links_expiry_check
    check (
      expires_at > created_at
      and expires_at <= created_at + interval '2 years'
    ),
  constraint repair_order_customer_status_links_revocation_check
    check (
      (revoked_at is null and revoked_by is null and revoke_reason is null)
      or (
        revoked_at is not null
        and revoked_at >= created_at
        and char_length(coalesce(revoke_reason, '')) between 1 and 240
      )
    )
);

create index repair_order_customer_status_links_order_created_idx
  on public.repair_order_customer_status_links (store_id, order_id, created_at desc);

create index repair_order_customer_status_links_active_expiry_idx
  on public.repair_order_customer_status_links (expires_at)
  where revoked_at is null;

create unique index repair_order_customer_status_links_one_unrevoked_idx
  on public.repair_order_customer_status_links (store_id, order_id)
  where revoked_at is null;

create index repair_order_customer_status_links_retention_idx
  on public.repair_order_customer_status_links ((coalesce(revoked_at, expires_at)));

alter table public.repair_order_customer_status_links enable row level security;

revoke all on table public.repair_order_customer_status_links
  from public, anon, authenticated, service_role;
grant select, insert, update, delete
  on table public.repair_order_customer_status_links
  to service_role;

comment on table public.repair_order_customer_status_links is
  'Hash-only bearer links for the customer-safe repair status projection. Raw tokens, customer PII, IP addresses and user agents are intentionally not stored.';

create or replace function public.repairdesk_issue_customer_status_links_v1(
  p_store_id uuid,
  p_lifecycle_revision bigint,
  p_links jsonb,
  p_expires_at timestamptz,
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
  v_distinct_order_count integer;
  v_distinct_hash_count integer;
  v_order_count integer;
  v_active_order_count integer;
  v_rotated_count integer;
  v_store_status text;
  v_lifecycle_phase text;
  v_lifecycle_revision bigint;
  v_inserted jsonb;
  v_order_ids jsonb;
begin
  if p_store_id is null
     or p_lifecycle_revision is null
     or p_actor_id is null
     or p_expires_at is null
     or jsonb_typeof(p_links) <> 'array' then
    raise exception 'customer_status_issue_invalid_input' using errcode = '22023';
  end if;

  v_input_count := jsonb_array_length(p_links);
  if v_input_count < 1 or v_input_count > 50
     or p_expires_at <= v_now
     or p_expires_at > v_now + interval '2 years' then
    raise exception 'customer_status_issue_invalid_input' using errcode = '22023';
  end if;

  select
    count(distinct link.order_id),
    count(distinct lower(link.token_hash)),
    jsonb_agg(to_jsonb(link.order_id) order by link.order_id)
  into v_distinct_order_count, v_distinct_hash_count, v_order_ids
  from jsonb_to_recordset(p_links) as link(order_id uuid, token_hash text)
  where link.order_id is not null
    and lower(coalesce(link.token_hash, '')) ~ '^[0-9a-f]{64}$';

  if v_distinct_order_count <> v_input_count or v_distinct_hash_count <> v_input_count then
    raise exception 'customer_status_issue_invalid_input' using errcode = '22023';
  end if;

  select store_row.status::text, lifecycle_row.phase::text, lifecycle_row.revision
  into v_store_status, v_lifecycle_phase, v_lifecycle_revision
  from public.stores as store_row
  join public.store_lifecycles as lifecycle_row
    on lifecycle_row.store_id = store_row.id
  where store_row.id = p_store_id
  for update of store_row, lifecycle_row;

  if v_store_status is distinct from 'active'
     or v_lifecycle_phase is distinct from 'active'
     or v_lifecycle_revision is distinct from p_lifecycle_revision then
    raise exception 'customer_status_issue_store_inactive' using errcode = '55000';
  end if;

  perform order_row.id
  from public.repair_orders as order_row
  where order_row.store_id = p_store_id
    and order_row.id in (
      select link.order_id
      from jsonb_to_recordset(p_links) as link(order_id uuid, token_hash text)
    )
  order by order_row.id
  for update;

  select
    count(*),
    count(*) filter (
      where order_row.record_state = 'active'
        and order_row.deleted_at is null
    )
  into v_order_count, v_active_order_count
  from public.repair_orders as order_row
  where order_row.store_id = p_store_id
    and order_row.id in (
      select link.order_id
      from jsonb_to_recordset(p_links) as link(order_id uuid, token_hash text)
    );

  if v_order_count <> v_input_count or v_active_order_count <> v_input_count then
    raise exception 'customer_status_issue_order_unavailable' using errcode = '55000';
  end if;

  update public.repair_order_customer_status_links as existing_link
  set revoked_at = v_now,
      revoked_by = p_actor_id,
      revoke_reason = 'reissued',
      updated_at = v_now
  where existing_link.store_id = p_store_id
    and existing_link.order_id in (
      select link.order_id
      from jsonb_to_recordset(p_links) as link(order_id uuid, token_hash text)
    )
    and existing_link.revoked_at is null;
  get diagnostics v_rotated_count = row_count;

  with inserted as (
    insert into public.repair_order_customer_status_links (
      store_id,
      order_id,
      lifecycle_revision,
      token_hash,
      expires_at,
      created_by,
      created_at,
      updated_at
    )
    select
      p_store_id,
      link.order_id,
      p_lifecycle_revision,
      lower(link.token_hash),
      p_expires_at,
      p_actor_id,
      v_now,
      v_now
    from jsonb_to_recordset(p_links) as link(order_id uuid, token_hash text)
    returning id, order_id, expires_at
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', inserted.id,
        'order_id', inserted.order_id,
        'expires_at', inserted.expires_at
      )
      order by inserted.order_id
    ),
    '[]'::jsonb
  )
  into v_inserted
  from inserted;

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
    'issue',
    'customer_status_link_batch',
    case when v_input_count = 1 then v_order_ids ->> 0 else p_store_id::text end,
    jsonb_build_object(
      'order_ids', v_order_ids,
      'issued_count', v_input_count,
      'rotated_count', v_rotated_count,
      'expires_at', p_expires_at,
      'lifecycle_revision', p_lifecycle_revision
    ),
    v_now
  );

  return jsonb_build_object(
    'links', v_inserted,
    'rotated_count', v_rotated_count
  );
end;
$$;

revoke all on function public.repairdesk_issue_customer_status_links_v1(
  uuid, bigint, jsonb, timestamptz, uuid, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.repairdesk_issue_customer_status_links_v1(
  uuid, bigint, jsonb, timestamptz, uuid, text, text
) to service_role;

comment on function public.repairdesk_issue_customer_status_links_v1(
  uuid, bigint, jsonb, timestamptz, uuid, text, text
) is
  'Atomically locks orders, rotates prior links, inserts one unrevoked hash-only link per order and writes a redacted audit record. Service role only.';

create or replace function public.repairdesk_revoke_customer_status_links_v1(
  p_store_id uuid,
  p_order_id uuid,
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
  v_revoked_count integer;
begin
  if p_store_id is null
     or p_actor_id is null
     or p_order_id is null
     or p_reason not in ('operator_reset', 'lost_print', 'support_revoke') then
    raise exception 'customer_status_revoke_invalid_input' using errcode = '22023';
  end if;

  perform order_row.id
  from public.repair_orders as order_row
  where order_row.store_id = p_store_id
    and order_row.id = p_order_id
  for update;
  if not found then
    raise exception 'customer_status_revoke_order_unavailable' using errcode = '55000';
  end if;

  update public.repair_order_customer_status_links
  set revoked_at = v_now,
      revoked_by = p_actor_id,
      revoke_reason = p_reason,
      updated_at = v_now
  where store_id = p_store_id
    and order_id = p_order_id
    and revoked_at is null;
  get diagnostics v_revoked_count = row_count;

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
    'revoke',
    'customer_status_link_batch',
    p_order_id::text,
    jsonb_build_object(
      'reason', p_reason,
      'revoked_count', v_revoked_count,
      'revoked_at', v_now
    ),
    v_now
  );

  return jsonb_build_object('revoked_count', v_revoked_count);
end;
$$;

revoke all on function public.repairdesk_revoke_customer_status_links_v1(
  uuid, uuid, uuid, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.repairdesk_revoke_customer_status_links_v1(
  uuid, uuid, uuid, text, text, text
) to service_role;

comment on function public.repairdesk_revoke_customer_status_links_v1(
  uuid, uuid, uuid, text, text, text
) is
  'Atomically revokes one order''s active customer-status link and writes a redacted audit record. Service role only.';

create table public.customer_status_rate_limits (
  scope_key text primary key,
  window_started_at timestamptz not null,
  attempt_count integer not null,
  updated_at timestamptz not null default now(),
  constraint customer_status_rate_limits_scope_key_check
    check (scope_key ~ '^(ip|token|global):[0-9a-f]{64}$'),
  constraint customer_status_rate_limits_attempt_count_check
    check (attempt_count > 0)
);

alter table public.customer_status_rate_limits enable row level security;

create index customer_status_rate_limits_updated_idx
  on public.customer_status_rate_limits (updated_at);

revoke all on table public.customer_status_rate_limits
  from public, anon, authenticated, service_role;

comment on table public.customer_status_rate_limits is
  'Bounded distributed counters keyed only by HMAC pseudonyms. Raw IP addresses and customer-status tokens are never stored.';

create or replace function public.repairdesk_consume_customer_status_rate_limit_v1(
  p_scope_key text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_row public.customer_status_rate_limits%rowtype;
  v_retry_after integer;
begin
  if p_scope_key is null
     or p_limit is null
     or p_window_seconds is null
     or p_scope_key !~ '^(ip|token|global):[0-9a-f]{64}$'
     or p_limit < 1
     or p_limit > 10000
     or p_window_seconds < 1
     or p_window_seconds > 86400 then
    raise exception 'customer_status_rate_limit_invalid_input' using errcode = '22023';
  end if;

  insert into public.customer_status_rate_limits as rate_limit (
    scope_key,
    window_started_at,
    attempt_count,
    updated_at
  )
  values (p_scope_key, v_now, 1, v_now)
  on conflict (scope_key) do update
  set
    window_started_at = case
      when rate_limit.window_started_at + make_interval(secs => p_window_seconds) <= v_now
        then v_now
      else rate_limit.window_started_at
    end,
    attempt_count = case
      when rate_limit.window_started_at + make_interval(secs => p_window_seconds) <= v_now
        then 1
      else least(rate_limit.attempt_count + 1, p_limit + 1)
    end,
    updated_at = v_now
  returning * into v_row;

  if p_scope_key like 'global:%' and v_row.attempt_count = 1 then
    delete from public.customer_status_rate_limits
    where ctid in (
      select stale_rate.ctid
      from public.customer_status_rate_limits as stale_rate
      where stale_rate.updated_at < v_now - interval '24 hours'
        and stale_rate.scope_key <> p_scope_key
      order by stale_rate.updated_at
      limit 1000
    );

    delete from public.repair_order_customer_status_links
    where ctid in (
      select stale_link.ctid
      from public.repair_order_customer_status_links as stale_link
      where coalesce(stale_link.revoked_at, stale_link.expires_at) < v_now - interval '90 days'
      order by coalesce(stale_link.revoked_at, stale_link.expires_at)
      limit 1000
    );
  end if;

  v_retry_after := greatest(
    1,
    ceil(
      extract(
        epoch from (
          v_row.window_started_at
          + make_interval(secs => p_window_seconds)
          - v_now
        )
      )
    )::integer
  );

  return jsonb_build_object(
    'allowed', v_row.attempt_count <= p_limit,
    'retry_after_seconds', case when v_row.attempt_count <= p_limit then 0 else v_retry_after end
  );
end;
$$;

revoke all on function public.repairdesk_consume_customer_status_rate_limit_v1(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.repairdesk_consume_customer_status_rate_limit_v1(text, integer, integer)
  to service_role;

comment on function public.repairdesk_consume_customer_status_rate_limit_v1(text, integer, integer) is
  'Atomically consumes a saturated distributed customer-status request counter. A reset global window also removes stale counters and links past their retention period. Callers must pass only HMAC-derived scope keys.';

create or replace function public.repairdesk_consume_customer_status_public_request_v1(
  p_ip_scope_key text,
  p_global_scope_key text,
  p_ip_limit integer,
  p_global_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_global public.customer_status_rate_limits%rowtype;
  v_retry_after integer;
  v_ip_result jsonb;
  v_global_result jsonb;
begin
  if p_ip_scope_key is null
     or p_global_scope_key is null
     or p_ip_limit is null
     or p_global_limit is null
     or p_window_seconds is null
     or p_ip_scope_key !~ '^ip:[0-9a-f]{64}$'
     or p_global_scope_key !~ '^global:[0-9a-f]{64}$'
     or p_ip_limit < 1
     or p_ip_limit > 10000
     or p_global_limit < 1
     or p_global_limit > 10000
     or p_window_seconds < 1
     or p_window_seconds > 86400 then
    raise exception 'customer_status_public_rate_limit_invalid_input' using errcode = '22023';
  end if;

  select * into v_global
  from public.customer_status_rate_limits
  where scope_key = p_global_scope_key
  for update;

  if found
     and v_global.window_started_at + make_interval(secs => p_window_seconds) > v_now
     and v_global.attempt_count >= p_global_limit then
    v_retry_after := greatest(
      1,
      ceil(
        extract(
          epoch from (
            v_global.window_started_at
            + make_interval(secs => p_window_seconds)
            - v_now
          )
        )
      )::integer
    );
    return jsonb_build_object(
      'allowed', false,
      'retry_after_seconds', v_retry_after,
      'scope', 'global'
    );
  end if;

  v_ip_result := public.repairdesk_consume_customer_status_rate_limit_v1(
    p_ip_scope_key,
    p_ip_limit,
    p_window_seconds
  );
  if (v_ip_result ->> 'allowed')::boolean is not true then
    return v_ip_result || jsonb_build_object('scope', 'ip');
  end if;

  v_global_result := public.repairdesk_consume_customer_status_rate_limit_v1(
    p_global_scope_key,
    p_global_limit,
    p_window_seconds
  );
  return v_global_result || jsonb_build_object('scope', 'global');
end;
$$;

revoke all on function public.repairdesk_consume_customer_status_public_request_v1(
  text, text, integer, integer, integer
) from public, anon, authenticated, service_role;
grant execute on function public.repairdesk_consume_customer_status_public_request_v1(
  text, text, integer, integer, integer
) to service_role;

comment on function public.repairdesk_consume_customer_status_public_request_v1(
  text, text, integer, integer, integer
) is
  'Atomically prechecks a saturated global window, then consumes the trusted-IP and global counters. IP-blocked requests do not consume global capacity; global-blocked requests do not create IP rows. Service role only.';

select pg_notify('pgrst', 'reload schema');

reset lock_timeout;
