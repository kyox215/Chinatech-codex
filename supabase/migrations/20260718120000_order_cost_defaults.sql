-- Internal repair-line costs and store-scoped default costs.
--
-- This migration is intentionally expand-only. Existing orders are not backfilled:
-- a line receives a stable identity and a cost snapshot only when that order's
-- fault_prices value is created or changed after this migration.

set lock_timeout = '5s';
set statement_timeout = '60s';

alter table public.store_member_permission_grants
  drop constraint if exists store_member_permission_grants_action_check;

alter table public.store_member_permission_grants
  add constraint store_member_permission_grants_action_check
  check (
    action in (
      'supplier:read',
      'supplier:assign',
      'supplier:manage',
      'order:archive_browse',
      'finance:aggregate_read',
      'finance:profit_read',
      'finance:cost_manage'
    )
  ) not valid;

alter table public.store_member_permission_grants
  validate constraint store_member_permission_grants_action_check;

create table public.store_fault_cost_defaults (
  store_id uuid not null,
  catalog_key text not null,
  catalog_name text not null,
  default_cost_amount numeric(12, 2),
  currency_code text not null default 'EUR',
  revision bigint not null,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_fault_cost_defaults_pkey primary key (store_id, catalog_key),
  constraint store_fault_cost_defaults_store_fkey
    foreign key (store_id) references public.stores(id)
    on update cascade on delete cascade,
  constraint store_fault_cost_defaults_updated_by_fkey
    foreign key (updated_by) references auth.users(id)
    on update cascade on delete set null,
  constraint store_fault_cost_defaults_catalog_key_check
    check (
      catalog_key ~ '^[a-z0-9][a-z0-9_-]{0,63}:[a-z0-9][a-z0-9_-]{0,63}$'
    ),
  constraint store_fault_cost_defaults_catalog_name_check
    check (char_length(btrim(catalog_name)) between 1 and 120),
  constraint store_fault_cost_defaults_amount_check
    check (
      default_cost_amount is null
      or (
        default_cost_amount between 0 and 999999.99
        and default_cost_amount = round(default_cost_amount, 2)
      )
    ),
  constraint store_fault_cost_defaults_currency_check
    check (currency_code = 'EUR'),
  constraint store_fault_cost_defaults_revision_check
    check (revision >= 1)
);

create table public.repair_order_line_costs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  order_id uuid not null,
  line_id uuid not null,
  catalog_key text,
  cost_amount numeric(12, 2),
  currency_code text not null default 'EUR',
  source text not null default 'store_default',
  is_active boolean not null default true,
  revision bigint not null,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint repair_order_line_costs_order_store_line_unique
    unique (store_id, order_id, line_id),
  constraint repair_order_line_costs_order_store_fkey
    foreign key (order_id, store_id) references public.repair_orders(id, store_id)
    on update cascade on delete cascade,
  constraint repair_order_line_costs_created_by_fkey
    foreign key (created_by) references auth.users(id)
    on update cascade on delete set null,
  constraint repair_order_line_costs_updated_by_fkey
    foreign key (updated_by) references auth.users(id)
    on update cascade on delete set null,
  constraint repair_order_line_costs_catalog_key_check
    check (
      catalog_key is null
      or catalog_key ~ '^[a-z0-9][a-z0-9_-]{0,63}:[a-z0-9][a-z0-9_-]{0,63}$'
    ),
  constraint repair_order_line_costs_amount_check
    check (
      cost_amount is null
      or (
        cost_amount between 0 and 999999.99
        and cost_amount = round(cost_amount, 2)
      )
    ),
  constraint repair_order_line_costs_currency_check
    check (currency_code = 'EUR'),
  constraint repair_order_line_costs_source_check
    check (source in ('store_default', 'manual', 'manual_blank')),
  constraint repair_order_line_costs_source_amount_check
    check (
      (source = 'manual' and cost_amount is not null)
      or (source = 'manual_blank' and cost_amount is null)
      or source = 'store_default'
    ),
  constraint repair_order_line_costs_revision_check
    check (revision >= 1)
);

create index repair_order_line_costs_order_active_idx
  on public.repair_order_line_costs (store_id, order_id, is_active, line_id);

alter table public.store_fault_cost_defaults enable row level security;
alter table public.repair_order_line_costs enable row level security;

revoke all on table public.store_fault_cost_defaults
  from public, anon, authenticated, service_role;
revoke all on table public.repair_order_line_costs
  from public, anon, authenticated, service_role;
grant select on table public.store_fault_cost_defaults to service_role;
grant select on table public.repair_order_line_costs to service_role;

create or replace function public.repairdesk_actor_can_manage_order_costs(
  p_store_id uuid,
  p_actor_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
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
      and (
        membership.role::text = 'owner'
        or (
          membership.role::text = 'manager'
          and exists (
            select 1
            from public.store_member_permission_grants as grant_row
            where grant_row.store_id = p_store_id
              and grant_row.membership_id = membership.id
              and grant_row.user_id = p_actor_id
              and grant_row.action = 'finance:cost_manage'
              and grant_row.revoked_at is null
          )
        )
      )
  );
$$;

revoke all on function public.repairdesk_actor_can_manage_order_costs(uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.repairdesk_actor_can_read_order_costs(
  p_store_id uuid,
  p_actor_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
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
      and (
        membership.role::text = 'owner'
        or (
          membership.role::text = 'manager'
          and exists (
            select 1
            from public.store_member_permission_grants as grant_row
            where grant_row.store_id = p_store_id
              and grant_row.membership_id = membership.id
              and grant_row.user_id = p_actor_id
              and grant_row.action in ('finance:profit_read', 'finance:cost_manage')
              and grant_row.revoked_at is null
          )
        )
      )
  );
$$;

revoke all on function public.repairdesk_actor_can_read_order_costs(uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.repairdesk_read_store_fault_cost_defaults_rpc(
  p_store_id uuid,
  p_actor_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not public.repairdesk_actor_can_manage_order_costs(p_store_id, p_actor_id)
      then jsonb_build_object('ok', false, 'code', 'actor_forbidden')
    else jsonb_build_object(
      'ok', true,
      'code', 'read',
      'version', coalesce((
        select max(default_row.revision)
        from public.store_fault_cost_defaults as default_row
        where default_row.store_id = p_store_id
      ), 0),
      'items', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'catalog_key', default_row.catalog_key,
            'catalog_name', default_row.catalog_name,
            'default_cost_amount', default_row.default_cost_amount,
            'currency_code', default_row.currency_code,
            'revision', default_row.revision
          ) order by default_row.catalog_key
        )
        from public.store_fault_cost_defaults as default_row
        where default_row.store_id = p_store_id
      ), '[]'::jsonb)
    )
  end;
$$;

create or replace function public.repairdesk_read_order_line_costs_rpc(
  p_store_id uuid,
  p_order_id uuid,
  p_actor_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not public.repairdesk_actor_can_read_order_costs(p_store_id, p_actor_id)
      then jsonb_build_object('ok', false, 'code', 'actor_forbidden')
    when not exists (
      select 1
      from public.repair_orders as order_row
      where order_row.store_id = p_store_id
        and order_row.id = p_order_id
        and coalesce(order_row.record_state::text, 'active') = 'active'
        and order_row.deleted_at is null
    ) then jsonb_build_object('ok', false, 'code', 'order_not_found')
    else jsonb_build_object(
      'ok', true,
      'code', 'read',
      'fault_prices', (
        select order_row.fault_prices
        from public.repair_orders as order_row
        where order_row.store_id = p_store_id
          and order_row.id = p_order_id
      ),
      'version', coalesce((
        select max(cost_row.revision)
        from public.repair_order_line_costs as cost_row
        where cost_row.store_id = p_store_id
          and cost_row.order_id = p_order_id
      ), 0),
      'items', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'line_id', cost_row.line_id,
            'catalog_key', cost_row.catalog_key,
            'cost_amount', cost_row.cost_amount,
            'source', cost_row.source,
            'revision', cost_row.revision
          ) order by cost_row.line_id
        )
        from public.repair_order_line_costs as cost_row
        where cost_row.store_id = p_store_id
          and cost_row.order_id = p_order_id
          and cost_row.is_active
      ), '[]'::jsonb)
    )
  end;
$$;

create or replace function public.repairdesk_replace_store_fault_cost_defaults_rpc(
  p_store_id uuid,
  p_actor_id uuid,
  p_expected_version bigint,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_catalog_key text;
  v_catalog_name text;
  v_amount numeric(12, 2);
  v_seen_keys text[] := array[]::text[];
  v_normalized jsonb := '[]'::jsonb;
  v_current_version bigint := 0;
  v_next_version bigint;
  v_actor_email text;
  v_actor_name text;
  v_now timestamptz := clock_timestamp();
begin
  if p_store_id is null or p_actor_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_target');
  end if;
  if not public.repairdesk_actor_can_manage_order_costs(p_store_id, p_actor_id) then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;
  if p_expected_version is null or p_expected_version < 0 then
    return jsonb_build_object('ok', false, 'code', 'missing_expected_version');
  end if;
  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 200 then
    return jsonb_build_object('ok', false, 'code', 'invalid_cost_defaults');
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) is distinct from 'object'
       or exists (
         select 1
         from jsonb_object_keys(v_item) as item_key(key_name)
         where key_name not in ('catalog_key', 'catalog_name', 'default_cost_amount')
       )
       or jsonb_typeof(v_item -> 'catalog_key') is distinct from 'string'
       or jsonb_typeof(v_item -> 'catalog_name') is distinct from 'string'
       or (
         v_item ? 'default_cost_amount'
         and jsonb_typeof(v_item -> 'default_cost_amount') not in ('number', 'null')
       ) then
      return jsonb_build_object('ok', false, 'code', 'invalid_cost_defaults');
    end if;

    v_catalog_key := lower(btrim(v_item ->> 'catalog_key'));
    v_catalog_name := btrim(v_item ->> 'catalog_name');
    v_amount := case
      when jsonb_typeof(v_item -> 'default_cost_amount') = 'number'
        then (v_item ->> 'default_cost_amount')::numeric
      else null
    end;

    if v_catalog_key !~ '^[a-z0-9][a-z0-9_-]{0,63}:[a-z0-9][a-z0-9_-]{0,63}$'
       or char_length(v_catalog_name) < 1
       or char_length(v_catalog_name) > 120
       or v_catalog_key = any(v_seen_keys)
       or (
         v_amount is not null
         and (
           v_amount < 0
           or v_amount > 999999.99
           or v_amount <> round(v_amount, 2)
         )
       ) then
      return jsonb_build_object('ok', false, 'code', 'invalid_cost_defaults');
    end if;

    v_seen_keys := array_append(v_seen_keys, v_catalog_key);
    v_normalized := v_normalized || jsonb_build_array(
      jsonb_build_object(
        'catalog_key', v_catalog_key,
        'catalog_name', v_catalog_name,
        'default_cost_amount', v_amount
      )
    );
  end loop;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_store_id::text || ':order-costs', 0)
  );

  select coalesce(max(default_row.revision), 0)
  into v_current_version
  from public.store_fault_cost_defaults as default_row
  where default_row.store_id = p_store_id;

  if v_current_version <> p_expected_version then
    return jsonb_build_object(
      'ok', false,
      'code', 'stale_version',
      'current_version', v_current_version
    );
  end if;
  v_next_version := v_current_version + 1;

  delete from public.store_fault_cost_defaults as default_row
  where default_row.store_id = p_store_id
    and not exists (
      select 1
      from jsonb_array_elements(v_normalized) as desired(value)
      where desired.value ->> 'catalog_key' = default_row.catalog_key
    );

  insert into public.store_fault_cost_defaults (
    store_id,
    catalog_key,
    catalog_name,
    default_cost_amount,
    currency_code,
    revision,
    updated_by,
    created_at,
    updated_at
  )
  select
    p_store_id,
    desired.value ->> 'catalog_key',
    desired.value ->> 'catalog_name',
    case
      when jsonb_typeof(desired.value -> 'default_cost_amount') = 'number'
        then (desired.value ->> 'default_cost_amount')::numeric
      else null
    end,
    'EUR',
    v_next_version,
    p_actor_id,
    v_now,
    v_now
  from jsonb_array_elements(v_normalized) as desired(value)
  on conflict (store_id, catalog_key) do update
  set
    catalog_name = excluded.catalog_name,
    default_cost_amount = excluded.default_cost_amount,
    currency_code = 'EUR',
    revision = excluded.revision,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;

  select profile.email, coalesce(membership.display_name, profile.display_name)
  into v_actor_email, v_actor_name
  from public.staff_profiles as profile
  join public.store_memberships as membership
    on membership.user_id = profile.id
   and membership.store_id = p_store_id
  where profile.id = p_actor_id
  limit 1;

  insert into public.audit_logs (
    id, actor_id, actor_email, actor_name, store_id,
    action, entity_type, entity_id, metadata, created_at
  ) values (
    gen_random_uuid()::text,
    p_actor_id,
    v_actor_email,
    coalesce(v_actor_name, 'unknown'),
    p_store_id,
    'order_cost_defaults_replace',
    'store',
    p_store_id::text,
    jsonb_build_object(
      'version_before', v_current_version,
      'version_after', v_next_version,
      'item_count', jsonb_array_length(v_normalized),
      'configured_count', (
        select count(*)
        from jsonb_array_elements(v_normalized) as configured(value)
        where jsonb_typeof(configured.value -> 'default_cost_amount') = 'number'
      )
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'code', 'updated',
    'version', v_next_version,
    'item_count', jsonb_array_length(v_normalized)
  );
end;
$$;

create or replace function public.repairdesk_normalize_order_fault_prices()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_old_item jsonb;
  v_mapped_item jsonb;
  v_quote_line_map jsonb;
  v_normalized_item jsonb;
  v_normalized jsonb := '[]'::jsonb;
  v_candidate_line_id uuid;
  v_requested_line_id uuid;
  v_requested_server_generated boolean;
  v_catalog_key text;
  v_matched_old_item jsonb;
  v_matched_old_ordinal bigint;
  v_used_line_ids uuid[] := array[]::uuid[];
  v_ordinal bigint;
  v_same_position_name boolean;
begin
  if tg_op = 'UPDATE' and new.fault_prices is not distinct from old.fault_prices then
    return new;
  end if;
  if jsonb_typeof(new.fault_prices) is distinct from 'array' then
    raise exception 'invalid_fault_prices' using errcode = '22023';
  end if;

  begin
    v_quote_line_map := nullif(
      pg_catalog.current_setting('repairdesk.quote_line_map', true),
      ''
    )::jsonb;
    if jsonb_typeof(v_quote_line_map) is distinct from 'array' then
      v_quote_line_map := null;
    end if;
  exception when others then
    v_quote_line_map := null;
  end;

  for v_item, v_ordinal in
    select value, ordinality
    from jsonb_array_elements(new.fault_prices) with ordinality
  loop
    if jsonb_typeof(v_item) is distinct from 'object' then
      raise exception 'invalid_fault_prices' using errcode = '22023';
    end if;

    v_old_item := null;
    v_mapped_item := null;
    v_same_position_name := false;
    if tg_op = 'UPDATE'
       and jsonb_typeof(old.fault_prices) = 'array'
       and jsonb_array_length(old.fault_prices) >= v_ordinal then
      v_old_item := old.fault_prices -> (v_ordinal - 1)::integer;
      v_same_position_name :=
        jsonb_typeof(v_old_item) = 'object'
        and coalesce(v_old_item ->> 'name', '') = coalesce(v_item ->> 'name', '');
    end if;
    if tg_op = 'UPDATE'
       and v_quote_line_map is not null
       and jsonb_array_length(v_quote_line_map) >= v_ordinal then
      v_mapped_item := v_quote_line_map -> (v_ordinal - 1)::integer;
    end if;

    v_catalog_key := null;
    if coalesce(v_item ->> 'catalog_key', '')
         ~ '^[a-z0-9][a-z0-9_-]{0,63}:[a-z0-9][a-z0-9_-]{0,63}$' then
      v_catalog_key := v_item ->> 'catalog_key';
    elsif coalesce(v_mapped_item ->> 'catalog_key', '')
         ~ '^[a-z0-9][a-z0-9_-]{0,63}:[a-z0-9][a-z0-9_-]{0,63}$' then
      v_catalog_key := v_mapped_item ->> 'catalog_key';
    end if;

    v_candidate_line_id := null;
    v_requested_line_id := null;
    v_requested_server_generated := coalesce(
      (v_mapped_item ->> '_server_generated_line_id')::boolean,
      false
    );
    if coalesce(v_item ->> 'line_id', '')
         ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      v_requested_line_id := (v_item ->> 'line_id')::uuid;
    elsif coalesce(v_mapped_item ->> 'line_id', '')
         ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      v_requested_line_id := (v_mapped_item ->> 'line_id')::uuid;
    end if;
    if tg_op = 'INSERT' then
      v_candidate_line_id := v_requested_line_id;
    elsif v_requested_line_id is not null then
      v_matched_old_item := null;
      v_matched_old_ordinal := null;
      select old_item.value, old_item.ordinality
      into v_matched_old_item, v_matched_old_ordinal
      from jsonb_array_elements(old.fault_prices) with ordinality as old_item(value, ordinality)
      where old_item.value ->> 'line_id' = v_requested_line_id::text
      limit 1;

      if v_matched_old_item is not null
         and (
           (
             v_matched_old_ordinal = v_ordinal
           )
           or (
             coalesce(v_matched_old_item ->> 'name', '') = coalesce(v_item ->> 'name', '')
             and coalesce(v_matched_old_item ->> 'catalog_key', '') = coalesce(v_catalog_key, '')
           )
         ) then
        v_candidate_line_id := v_requested_line_id;
      end if;
    end if;
    if v_candidate_line_id is null
       and v_requested_line_id is not null
       and v_requested_server_generated
       and not exists (
         select 1
         from public.repair_order_line_costs as historical_cost
         where historical_cost.store_id = new.store_id
           and historical_cost.order_id = new.id
           and historical_cost.line_id = v_requested_line_id
       ) then
      v_candidate_line_id := v_requested_line_id;
    end if;
    if v_candidate_line_id is null
       and v_same_position_name
       and (
         v_catalog_key is null
         or coalesce(v_old_item ->> 'catalog_key', '') = v_catalog_key
       )
       and coalesce(v_old_item ->> 'line_id', '')
         ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      v_candidate_line_id := (v_old_item ->> 'line_id')::uuid;
    end if;
    if v_candidate_line_id is null or v_candidate_line_id = any(v_used_line_ids) then
      v_candidate_line_id := gen_random_uuid();
    end if;
    v_used_line_ids := array_append(v_used_line_ids, v_candidate_line_id);

    if v_catalog_key is null
       and v_same_position_name
       and coalesce(v_old_item ->> 'catalog_key', '')
         ~ '^[a-z0-9][a-z0-9_-]{0,63}:[a-z0-9][a-z0-9_-]{0,63}$' then
      v_catalog_key := v_old_item ->> 'catalog_key';
    end if;

    -- Rebuild the object from an allowlist. In particular, cost fields can
    -- never be smuggled into repair_orders.fault_prices.
    v_normalized_item := jsonb_build_object('line_id', v_candidate_line_id);
    if v_catalog_key is not null then
      v_normalized_item := v_normalized_item
        || jsonb_build_object('catalog_key', v_catalog_key);
    end if;
    if v_item ? 'name' then
      v_normalized_item := v_normalized_item || jsonb_build_object('name', v_item -> 'name');
    end if;
    if v_item ? 'price' then
      v_normalized_item := v_normalized_item || jsonb_build_object('price', v_item -> 'price');
    end if;
    if v_item ? 'currency_code' then
      v_normalized_item := v_normalized_item
        || jsonb_build_object('currency_code', v_item -> 'currency_code');
    end if;
    if v_item ? 'note' then
      v_normalized_item := v_normalized_item || jsonb_build_object('note', v_item -> 'note');
    end if;
    v_normalized := v_normalized || jsonb_build_array(v_normalized_item);
  end loop;

  new.fault_prices := v_normalized;
  return new;
end;
$$;

create trigger repairdesk_normalize_order_fault_prices_trigger
before insert or update of fault_prices on public.repair_orders
for each row execute function public.repairdesk_normalize_order_fault_prices();

create or replace function public.repairdesk_sync_order_line_costs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_line_id uuid;
  v_catalog_key text;
  v_default_amount numeric(12, 2);
  v_current_version bigint := 0;
  v_next_version bigint;
  v_now timestamptz := clock_timestamp();
begin
  if tg_op = 'UPDATE' and new.fault_prices is not distinct from old.fault_prices then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.store_id::text || ':order-costs', 0)
  );

  select coalesce(max(cost_row.revision), 0)
  into v_current_version
  from public.repair_order_line_costs as cost_row
  where cost_row.store_id = new.store_id
    and cost_row.order_id = new.id;
  v_next_version := v_current_version + 1;

  update public.repair_order_line_costs
  set
    is_active = false,
    revision = v_next_version,
    updated_at = v_now
  where store_id = new.store_id
    and order_id = new.id;

  for v_item in select value from jsonb_array_elements(new.fault_prices)
  loop
    v_line_id := (v_item ->> 'line_id')::uuid;
    v_catalog_key := nullif(v_item ->> 'catalog_key', '');
    v_default_amount := null;
    if v_catalog_key is not null then
      select default_row.default_cost_amount
      into v_default_amount
      from public.store_fault_cost_defaults as default_row
      where default_row.store_id = new.store_id
        and default_row.catalog_key = v_catalog_key;
    end if;

    insert into public.repair_order_line_costs (
      store_id,
      order_id,
      line_id,
      catalog_key,
      cost_amount,
      currency_code,
      source,
      is_active,
      revision,
      created_at,
      updated_at
    ) values (
      new.store_id,
      new.id,
      v_line_id,
      v_catalog_key,
      v_default_amount,
      'EUR',
      'store_default',
      true,
      v_next_version,
      v_now,
      v_now
    )
    on conflict (store_id, order_id, line_id) do update
    set
      catalog_key = excluded.catalog_key,
      is_active = true,
      revision = excluded.revision,
      updated_at = excluded.updated_at;
  end loop;

  return new;
end;
$$;

create trigger repairdesk_sync_order_line_costs_trigger
after insert or update of fault_prices on public.repair_orders
for each row execute function public.repairdesk_sync_order_line_costs();

create or replace function public.repairdesk_replace_order_line_costs_rpc(
  p_store_id uuid,
  p_order_id uuid,
  p_actor_id uuid,
  p_expected_version bigint,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_line_id uuid;
  v_amount numeric(12, 2);
  v_seen_line_ids uuid[] := array[]::uuid[];
  v_normalized jsonb := '[]'::jsonb;
  v_current_version bigint := 0;
  v_next_version bigint;
  v_active_count integer := 0;
  v_blank_count integer := 0;
  v_actor_email text;
  v_actor_name text;
  v_now timestamptz := clock_timestamp();
begin
  if p_store_id is null or p_order_id is null or p_actor_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_target');
  end if;
  if not public.repairdesk_actor_can_manage_order_costs(p_store_id, p_actor_id) then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;
  if p_expected_version is null or p_expected_version < 0 then
    return jsonb_build_object('ok', false, 'code', 'missing_expected_version');
  end if;
  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) > 50 then
    return jsonb_build_object('ok', false, 'code', 'invalid_cost_items');
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) is distinct from 'object'
       or exists (
         select 1
         from jsonb_object_keys(v_item) as item_key(key_name)
         where key_name not in ('line_id', 'cost_amount')
       )
       or coalesce(v_item ->> 'line_id', '')
         !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or not (v_item ? 'cost_amount')
       or jsonb_typeof(v_item -> 'cost_amount') not in ('number', 'null') then
      return jsonb_build_object('ok', false, 'code', 'invalid_cost_items');
    end if;

    v_line_id := (v_item ->> 'line_id')::uuid;
    v_amount := case
      when jsonb_typeof(v_item -> 'cost_amount') = 'number'
        then (v_item ->> 'cost_amount')::numeric
      else null
    end;
    if v_line_id = any(v_seen_line_ids)
       or (
         v_amount is not null
         and (
           v_amount < 0
           or v_amount > 999999.99
           or v_amount <> round(v_amount, 2)
         )
       ) then
      return jsonb_build_object('ok', false, 'code', 'invalid_cost_items');
    end if;
    v_seen_line_ids := array_append(v_seen_line_ids, v_line_id);
    v_normalized := v_normalized || jsonb_build_array(
      jsonb_build_object('line_id', v_line_id, 'cost_amount', v_amount)
    );
  end loop;

  perform 1
  from public.repair_orders as order_row
  where order_row.id = p_order_id
    and order_row.store_id = p_store_id
    and coalesce(order_row.record_state::text, 'active') = 'active'
    and order_row.deleted_at is null
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'order_not_found');
  end if;

  -- Keep the same lock order as repair_orders writes: order row first, then
  -- the store cost lock acquired by the AFTER fault_prices trigger.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_store_id::text || ':order-costs', 0)
  );

  select coalesce(max(cost_row.revision), 0),
         count(*) filter (where cost_row.is_active)
  into v_current_version, v_active_count
  from public.repair_order_line_costs as cost_row
  where cost_row.store_id = p_store_id
    and cost_row.order_id = p_order_id;

  if v_current_version <> p_expected_version then
    return jsonb_build_object(
      'ok', false,
      'code', 'stale_version',
      'current_version', v_current_version
    );
  end if;
  if exists (
       select 1
       from jsonb_array_elements(v_normalized) as desired(value)
       where not exists (
         select 1
         from public.repair_order_line_costs as cost_row
         where cost_row.store_id = p_store_id
           and cost_row.order_id = p_order_id
           and cost_row.is_active
           and cost_row.line_id = (desired.value ->> 'line_id')::uuid
       )
     ) or exists (
       select 1
       from public.repair_order_line_costs as cost_row
       where cost_row.store_id = p_store_id
         and cost_row.order_id = p_order_id
         and cost_row.is_active = false
         and cost_row.line_id = any(v_seen_line_ids)
     ) then
    return jsonb_build_object('ok', false, 'code', 'line_set_mismatch');
  end if;
  if jsonb_array_length(v_normalized) = 0 then
    return jsonb_build_object(
      'ok', true,
      'code', 'unchanged',
      'version', v_current_version,
      'item_count', 0
    );
  end if;

  select count(*)
  into v_blank_count
  from jsonb_array_elements(v_normalized) as blank_item(value)
  where jsonb_typeof(blank_item.value -> 'cost_amount') = 'null';

  if not exists (
    select 1
    from public.repair_order_line_costs as cost_row
    join jsonb_array_elements(v_normalized) as desired(value)
      on cost_row.line_id = (desired.value ->> 'line_id')::uuid
    where cost_row.store_id = p_store_id
      and cost_row.order_id = p_order_id
      and cost_row.is_active
      and cost_row.cost_amount is distinct from case
        when jsonb_typeof(desired.value -> 'cost_amount') = 'number'
          then (desired.value ->> 'cost_amount')::numeric
        else null
      end
  ) then
    return jsonb_build_object(
      'ok', true,
      'code', 'unchanged',
      'version', v_current_version,
      'item_count', jsonb_array_length(v_normalized)
    );
  end if;

  v_next_version := v_current_version + 1;
  update public.repair_order_line_costs as cost_row
  set
    cost_amount = case
      when jsonb_typeof(desired.value -> 'cost_amount') = 'number'
        then (desired.value ->> 'cost_amount')::numeric
      else null
    end,
    source = case
      when cost_row.cost_amount is not distinct from case
        when jsonb_typeof(desired.value -> 'cost_amount') = 'number'
          then (desired.value ->> 'cost_amount')::numeric
        else null
      end then cost_row.source
      when jsonb_typeof(desired.value -> 'cost_amount') = 'number' then 'manual'
      else 'manual_blank'
    end,
    revision = v_next_version,
    updated_by = p_actor_id,
    updated_at = v_now
  from jsonb_array_elements(v_normalized) as desired(value)
  where cost_row.store_id = p_store_id
    and cost_row.order_id = p_order_id
    and cost_row.is_active
    and cost_row.line_id = (desired.value ->> 'line_id')::uuid;

  update public.repair_order_line_costs
  set revision = v_next_version, updated_at = v_now
  where store_id = p_store_id
    and order_id = p_order_id
    and not is_active;

  select profile.email, coalesce(membership.display_name, profile.display_name)
  into v_actor_email, v_actor_name
  from public.staff_profiles as profile
  join public.store_memberships as membership
    on membership.user_id = profile.id
   and membership.store_id = p_store_id
  where profile.id = p_actor_id
  limit 1;

  insert into public.audit_logs (
    id, actor_id, actor_email, actor_name, store_id,
    action, entity_type, entity_id, metadata, created_at
  ) values (
    gen_random_uuid()::text,
    p_actor_id,
    v_actor_email,
    coalesce(v_actor_name, 'unknown'),
    p_store_id,
    'order_costs_replace',
    'repair_order',
    p_order_id::text,
    jsonb_build_object(
      'version_before', v_current_version,
      'version_after', v_next_version,
      'item_count', jsonb_array_length(v_normalized),
      'blank_count', v_blank_count
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'code', 'updated',
    'version', v_next_version,
    'item_count', jsonb_array_length(v_normalized)
  );
end;
$$;

create or replace function public.repairdesk_apply_order_cost_inputs_rpc(
  p_store_id uuid,
  p_order_id uuid,
  p_actor_id uuid,
  p_expected_version bigint,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_line_id uuid;
  v_mode text;
  v_amount numeric(12, 2);
  v_seen_line_ids uuid[] := array[]::uuid[];
  v_normalized jsonb := '[]'::jsonb;
  v_current_version bigint := 0;
  v_next_version bigint;
  v_blank_count integer := 0;
  v_actor_email text;
  v_actor_name text;
  v_now timestamptz := clock_timestamp();
begin
  if p_store_id is null or p_order_id is null or p_actor_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_target');
  end if;
  if not public.repairdesk_actor_can_manage_order_costs(p_store_id, p_actor_id) then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;
  if p_expected_version is null or p_expected_version < 0 then
    return jsonb_build_object('ok', false, 'code', 'missing_expected_version');
  end if;
  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) > 50 then
    return jsonb_build_object('ok', false, 'code', 'invalid_cost_items');
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) is distinct from 'object'
       or exists (
         select 1
         from jsonb_object_keys(v_item) as item_key(key_name)
         where key_name not in ('line_id', 'mode', 'amount')
       )
       or coalesce(v_item ->> 'line_id', '')
         !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or jsonb_typeof(v_item -> 'mode') is distinct from 'string'
       or (v_item ? 'amount' and jsonb_typeof(v_item -> 'amount') not in ('number', 'null')) then
      return jsonb_build_object('ok', false, 'code', 'invalid_cost_items');
    end if;

    v_line_id := (v_item ->> 'line_id')::uuid;
    v_mode := v_item ->> 'mode';
    v_amount := case
      when jsonb_typeof(v_item -> 'amount') = 'number'
        then (v_item ->> 'amount')::numeric
      else null
    end;
    if v_line_id = any(v_seen_line_ids)
       or v_mode not in ('manual', 'blank')
       or (v_mode = 'manual' and v_amount is null)
       or (v_mode = 'blank' and v_amount is not null)
       or (
         v_amount is not null
         and (
           v_amount < 0
           or v_amount > 999999.99
           or v_amount <> round(v_amount, 2)
         )
       ) then
      return jsonb_build_object('ok', false, 'code', 'invalid_cost_items');
    end if;
    v_seen_line_ids := array_append(v_seen_line_ids, v_line_id);
    v_normalized := v_normalized || jsonb_build_array(
      jsonb_build_object(
        'line_id', v_line_id,
        'mode', v_mode,
        'amount', v_amount
      )
    );
  end loop;

  perform 1
  from public.repair_orders as order_row
  where order_row.id = p_order_id
    and order_row.store_id = p_store_id
    and coalesce(order_row.record_state::text, 'active') = 'active'
    and order_row.deleted_at is null
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'order_not_found');
  end if;

  -- Match the order-row -> cost-lock sequence used by fault_prices updates.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_store_id::text || ':order-costs', 0)
  );

  select coalesce(max(cost_row.revision), 0)
  into v_current_version
  from public.repair_order_line_costs as cost_row
  where cost_row.store_id = p_store_id
    and cost_row.order_id = p_order_id;

  if v_current_version <> p_expected_version then
    return jsonb_build_object(
      'ok', false,
      'code', 'stale_version',
      'current_version', v_current_version
    );
  end if;
  if jsonb_array_length(v_normalized) = 0 then
    return jsonb_build_object(
      'ok', true,
      'code', 'unchanged',
      'version', v_current_version,
      'item_count', 0
    );
  end if;
  if exists (
    select 1
    from jsonb_array_elements(v_normalized) as desired(value)
    where not exists (
      select 1
      from public.repair_order_line_costs as cost_row
      where cost_row.store_id = p_store_id
        and cost_row.order_id = p_order_id
        and cost_row.line_id = (desired.value ->> 'line_id')::uuid
        and cost_row.is_active
    )
  ) then
    return jsonb_build_object('ok', false, 'code', 'line_set_mismatch');
  end if;

  select count(*)
  into v_blank_count
  from jsonb_array_elements(v_normalized) as blank_item(value)
  where blank_item.value ->> 'mode' = 'blank';

  v_next_version := v_current_version + 1;
  update public.repair_order_line_costs as cost_row
  set
    cost_amount = case
      when desired.value ->> 'mode' = 'manual'
        then (desired.value ->> 'amount')::numeric
      else null
    end,
    source = case
      when desired.value ->> 'mode' = 'manual' then 'manual'
      else 'manual_blank'
    end,
    revision = v_next_version,
    updated_by = p_actor_id,
    updated_at = v_now
  from jsonb_array_elements(v_normalized) as desired(value)
  where cost_row.store_id = p_store_id
    and cost_row.order_id = p_order_id
    and cost_row.is_active
    and cost_row.line_id = (desired.value ->> 'line_id')::uuid;

  update public.repair_order_line_costs
  set revision = v_next_version, updated_at = v_now
  where store_id = p_store_id
    and order_id = p_order_id
    and line_id <> all(v_seen_line_ids);

  select profile.email, coalesce(membership.display_name, profile.display_name)
  into v_actor_email, v_actor_name
  from public.staff_profiles as profile
  join public.store_memberships as membership
    on membership.user_id = profile.id
   and membership.store_id = p_store_id
  where profile.id = p_actor_id
  limit 1;

  insert into public.audit_logs (
    id, actor_id, actor_email, actor_name, store_id,
    action, entity_type, entity_id, metadata, created_at
  ) values (
    gen_random_uuid()::text,
    p_actor_id,
    v_actor_email,
    coalesce(v_actor_name, 'unknown'),
    p_store_id,
    'order_cost_inputs_apply',
    'repair_order',
    p_order_id::text,
    jsonb_build_object(
      'version_before', v_current_version,
      'version_after', v_next_version,
      'item_count', jsonb_array_length(v_normalized),
      'blank_count', v_blank_count
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'code', 'updated',
    'version', v_next_version,
    'item_count', jsonb_array_length(v_normalized)
  );
end;
$$;

create or replace function public.repairdesk_sync_quote_event_fault_prices_hash()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fault_prices jsonb;
begin
  if new.event_type::text = 'quoted'
     and new.payload ->> 'action' = 'quote_published' then
    select order_row.fault_prices
    into v_fault_prices
    from public.repair_orders as order_row
    where order_row.id::text = new.order_id::text
      and order_row.store_id = new.store_id;

    if found then
      new.payload := jsonb_set(
        new.payload,
        '{fault_prices_hash}',
        to_jsonb(pg_catalog.md5(v_fault_prices::text)),
        true
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger repairdesk_sync_quote_event_fault_prices_hash_trigger
before insert on public.order_events
for each row execute function public.repairdesk_sync_quote_event_fault_prices_hash();

alter function public.repairdesk_publish_order_quote(
  uuid, text, uuid, timestamptz, uuid, text, jsonb, text, text
) rename to repairdesk_publish_order_quote_legacy;

create or replace function public.repairdesk_publish_order_quote_v2(
  p_store_id uuid,
  p_order_id text,
  p_actor_id uuid,
  p_expected_updated_at timestamptz,
  p_idempotency_key uuid,
  p_diagnosis_result text,
  p_fault_prices jsonb,
  p_price_exception_kind text default null,
  p_price_exception_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_name text;
  v_note text;
  v_price numeric(12, 2);
  v_line_id uuid;
  v_catalog_key text;
  v_used_line_ids uuid[] := array[]::uuid[];
  v_legacy_fault_prices jsonb := '[]'::jsonb;
  v_extended_fault_prices jsonb := '[]'::jsonb;
  v_result jsonb;
  v_persisted_fault_prices jsonb;
  v_actor_role text;
  v_order public.repair_orders%rowtype;
  v_existing public.order_events%rowtype;
  v_latest_quote public.order_events%rowtype;
  v_current_legacy_fault_prices jsonb := '[]'::jsonb;
  v_diagnosis text := btrim(coalesce(p_diagnosis_result, ''));
  v_exception_kind text := nullif(btrim(coalesce(p_price_exception_kind, '')), '');
  v_exception_reason text := nullif(btrim(coalesce(p_price_exception_reason, '')), '');
  v_has_zero boolean := false;
  v_quotation numeric(12, 2) := 0;
  v_current_bucket text;
  v_quote_fingerprint text;
  v_current_has_stable_line_ids boolean := false;
  v_map_item jsonb;
  v_map_old_item jsonb;
  v_map_ordinal bigint;
  v_map_line_id uuid;
begin
  if jsonb_typeof(p_fault_prices) is distinct from 'array'
     or jsonb_array_length(p_fault_prices) < 1
     or jsonb_array_length(p_fault_prices) > 50 then
    return jsonb_build_object('ok', false, 'code', 'invalid_quote_items');
  end if;

  for v_item in select value from jsonb_array_elements(p_fault_prices)
  loop
    if jsonb_typeof(v_item) is distinct from 'object'
       or exists (
         select 1
         from jsonb_object_keys(v_item) as item_key(key_name)
         where key_name not in (
           'name', 'price', 'currency_code', 'note', 'line_id', 'catalog_key'
         )
       )
       or jsonb_typeof(v_item -> 'name') is distinct from 'string'
       or jsonb_typeof(v_item -> 'price') is distinct from 'number'
       or (
         v_item ? 'currency_code'
         and jsonb_typeof(v_item -> 'currency_code') is distinct from 'string'
       )
       or (
         v_item ? 'note'
         and jsonb_typeof(v_item -> 'note') not in ('string', 'null')
       )
       or (
         v_item ? 'line_id'
         and jsonb_typeof(v_item -> 'line_id') is distinct from 'string'
       )
       or (
         v_item ? 'catalog_key'
         and jsonb_typeof(v_item -> 'catalog_key') not in ('string', 'null')
       ) then
      return jsonb_build_object('ok', false, 'code', 'invalid_quote_items');
    end if;

    v_name := btrim(v_item ->> 'name');
    v_note := nullif(btrim(coalesce(v_item ->> 'note', '')), '');
    v_price := (v_item ->> 'price')::numeric;
    if char_length(v_name) < 1
       or char_length(v_name) > 120
       or coalesce(char_length(v_note), 0) > 500
       or coalesce(v_item ->> 'currency_code', 'EUR') <> 'EUR'
       or v_price < 0
       or v_price > 999999.99
       or v_price <> round(v_price, 2) then
      return jsonb_build_object('ok', false, 'code', 'invalid_quote_items');
    end if;

    v_line_id := null;
    if coalesce(v_item ->> 'line_id', '')
         ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      v_line_id := (v_item ->> 'line_id')::uuid;
    end if;
    if v_line_id is not null and v_line_id = any(v_used_line_ids) then
      v_line_id := null;
    end if;
    if v_line_id is not null then
      v_used_line_ids := array_append(v_used_line_ids, v_line_id);
    end if;

    v_catalog_key := null;
    if coalesce(v_item ->> 'catalog_key', '')
         ~ '^[a-z0-9][a-z0-9_-]{0,63}:[a-z0-9][a-z0-9_-]{0,63}$' then
      v_catalog_key := v_item ->> 'catalog_key';
    end if;

    v_legacy_fault_prices := v_legacy_fault_prices || jsonb_build_array(
      jsonb_strip_nulls(
        jsonb_build_object(
          'name', v_name,
          'price', v_price,
          'currency_code', 'EUR',
          'note', v_note
        )
      )
    );
    v_extended_fault_prices := v_extended_fault_prices || jsonb_build_array(
      jsonb_strip_nulls(
        jsonb_build_object(
          'line_id', v_line_id,
          'catalog_key', v_catalog_key,
          'name', v_name,
          'price', v_price,
          'currency_code', 'EUR',
          'note', v_note
        )
      )
    );
    v_quotation := v_quotation + v_price;
    v_has_zero := v_has_zero or v_price = 0;
  end loop;

  v_quote_fingerprint := pg_catalog.md5(
    jsonb_build_object(
      'diagnosis_result', v_diagnosis,
      'fault_prices', v_legacy_fault_prices,
      'price_exception_kind', v_exception_kind,
      'price_exception_reason', v_exception_reason
    )::text
  );

  -- Preserve the original idempotency-key replay semantics. The logical
  -- already-published shortcut below is only for a fresh request key.
  select event_row.*
  into v_existing
  from public.order_events as event_row
  where event_row.store_id = p_store_id
    and event_row.event_type::text = 'quoted'
    and event_row.payload ->> 'idempotency_key' = p_idempotency_key::text
  order by event_row.created_at desc
  limit 1;

  if not found
     and char_length(v_diagnosis) between 1 and 8000
     and (
       (
         not v_has_zero
         and v_exception_kind is null
         and v_exception_reason is null
       )
       or (
         v_has_zero
         and v_exception_kind in ('free', 'warranty', 'diagnostic_only')
         and char_length(v_exception_reason) between 4 and 1000
       )
     ) then
    select membership.role::text
    into v_actor_role
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
    limit 1;

    if v_actor_role in ('owner', 'manager', 'sales') then
      select order_row.*
      into v_order
      from public.repair_orders as order_row
      where order_row.store_id = p_store_id
        and order_row.id::text = p_order_id
      for update;

      if found
         and v_order.updated_at = p_expected_updated_at
         and coalesce(v_order.record_state::text, 'active') <> 'voided'
         and v_order.deleted_at is null then
        select status_row.bucket
        into v_current_bucket
        from public.order_workflow_statuses as status_row
        where status_row.store_id = p_store_id
          and status_row.code = v_order.status::text
          and status_row.enabled = true
        limit 1;

        select event_row.*
        into v_latest_quote
        from public.order_events as event_row
        where event_row.store_id = p_store_id
          and event_row.order_id::text = p_order_id
          and event_row.event_type::text = 'quoted'
          and event_row.payload ->> 'action' = 'quote_published'
        order by event_row.created_at desc
        limit 1;

        select coalesce(
          jsonb_agg(
            jsonb_strip_nulls(
              jsonb_build_object(
                'name', btrim(item.value ->> 'name'),
                'price', (item.value ->> 'price')::numeric,
                'currency_code', 'EUR',
                'note', nullif(btrim(coalesce(item.value ->> 'note', '')), '')
              )
            ) order by item.ordinality
          ),
          '[]'::jsonb
        )
        into v_current_legacy_fault_prices
        from jsonb_array_elements(v_order.fault_prices) with ordinality as item(value, ordinality);

        select
          count(*) = jsonb_array_length(v_order.fault_prices)
          and count(*) = count(distinct item.value ->> 'line_id')
          and bool_and(
            coalesce(item.value ->> 'line_id', '')
              ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          )
        into v_current_has_stable_line_ids
        from jsonb_array_elements(v_order.fault_prices) as item(value);

        if v_latest_quote.id is not null
           and v_current_has_stable_line_ids
           and v_current_bucket = 'quote'
           and v_latest_quote.payload ->> 'quote_fingerprint' = v_quote_fingerprint
           and btrim(coalesce(v_order.diagnosis_result, '')) = v_diagnosis
           and v_current_legacy_fault_prices = v_legacy_fault_prices
           and v_order.quotation_amount = v_quotation then
          return jsonb_build_object(
            'ok', true,
            'code', 'already_published',
            'quote_event_id', v_latest_quote.id,
            'updated_at', v_order.updated_at,
            'quotation_amount', v_order.quotation_amount,
            'deposit_amount', v_order.deposit_amount,
            'paid_amount', greatest(
              0,
              v_order.quotation_amount - v_order.deposit_amount - v_order.balance_amount
            ),
            'balance_amount', v_order.balance_amount,
            'is_paid', v_order.is_paid,
            'payment_status', v_order.payment_status,
            'status', v_order.status,
            'approval_status', v_order.approval_status,
            'approval_flow_status', v_order.approval_flow_status,
            'approval_reset', false
          );
        end if;
      end if;
    end if;
  end if;

  -- Legacy/flag-off clients do not send line IDs. Match the whole request by
  -- semantic name first. Ordinal fallback is safe only when cardinality is
  -- unchanged; otherwise an inserted line could steal a later line's cost.
  if v_existing.id is null and v_order.id is not null then
    for v_map_item, v_map_ordinal in
      select value, ordinality
      from jsonb_array_elements(v_extended_fault_prices) with ordinality
    loop
      if coalesce(v_map_item ->> 'line_id', '') = '' then
        v_map_old_item := null;
        select old_item.value
        into v_map_old_item
        from jsonb_array_elements(v_order.fault_prices) with ordinality as old_item(value, ordinality)
        where old_item.value ->> 'line_id'
                ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          and (old_item.value ->> 'line_id')::uuid <> all(v_used_line_ids)
          and coalesce(old_item.value ->> 'name', '') = coalesce(v_map_item ->> 'name', '')
        order by (old_item.ordinality = v_map_ordinal) desc, old_item.ordinality
        limit 1;
        if v_map_old_item is not null then
          v_map_line_id := (v_map_old_item ->> 'line_id')::uuid;
          v_used_line_ids := array_append(v_used_line_ids, v_map_line_id);
          v_extended_fault_prices := jsonb_set(
            v_extended_fault_prices,
            array[(v_map_ordinal - 1)::text, 'line_id'],
            to_jsonb(v_map_line_id),
            true
          );
          if coalesce(v_map_item ->> 'catalog_key', '') = ''
             and coalesce(v_map_old_item ->> 'catalog_key', '')
               ~ '^[a-z0-9][a-z0-9_-]{0,63}:[a-z0-9][a-z0-9_-]{0,63}$' then
            v_extended_fault_prices := jsonb_set(
              v_extended_fault_prices,
              array[(v_map_ordinal - 1)::text, 'catalog_key'],
              to_jsonb(v_map_old_item ->> 'catalog_key'),
              true
            );
          end if;
        end if;
      end if;
    end loop;

    if jsonb_array_length(v_order.fault_prices) = jsonb_array_length(v_extended_fault_prices) then
      for v_map_item, v_map_ordinal in
        select value, ordinality
        from jsonb_array_elements(v_extended_fault_prices) with ordinality
      loop
        if coalesce(v_map_item ->> 'line_id', '') = '' then
          v_map_old_item := v_order.fault_prices -> (v_map_ordinal - 1)::integer;
          if coalesce(v_map_old_item ->> 'line_id', '')
               ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             and (v_map_old_item ->> 'line_id')::uuid <> all(v_used_line_ids) then
            v_map_line_id := (v_map_old_item ->> 'line_id')::uuid;
            v_used_line_ids := array_append(v_used_line_ids, v_map_line_id);
            v_extended_fault_prices := jsonb_set(
              v_extended_fault_prices,
              array[(v_map_ordinal - 1)::text, 'line_id'],
              to_jsonb(v_map_line_id),
              true
            );
            if coalesce(v_map_item ->> 'catalog_key', '') = ''
               and coalesce(v_map_old_item ->> 'catalog_key', '')
                 ~ '^[a-z0-9][a-z0-9_-]{0,63}:[a-z0-9][a-z0-9_-]{0,63}$' then
              v_extended_fault_prices := jsonb_set(
                v_extended_fault_prices,
                array[(v_map_ordinal - 1)::text, 'catalog_key'],
                to_jsonb(v_map_old_item ->> 'catalog_key'),
                true
              );
            end if;
          end if;
        end if;
      end loop;
    end if;
  end if;

  -- Every persisted quote line must leave this RPC with an identity, including
  -- legacy quoted orders whose JSON has never passed through the new trigger.
  for v_map_item, v_map_ordinal in
    select value, ordinality
    from jsonb_array_elements(v_extended_fault_prices) with ordinality
  loop
    if coalesce(v_map_item ->> 'line_id', '') = '' then
      v_map_line_id := gen_random_uuid();
      while v_map_line_id = any(v_used_line_ids) loop
        v_map_line_id := gen_random_uuid();
      end loop;
      v_used_line_ids := array_append(v_used_line_ids, v_map_line_id);
      v_extended_fault_prices := jsonb_set(
        v_extended_fault_prices,
        array[(v_map_ordinal - 1)::text, 'line_id'],
        to_jsonb(v_map_line_id),
        true
      );
      v_extended_fault_prices := jsonb_set(
        v_extended_fault_prices,
        array[(v_map_ordinal - 1)::text, '_server_generated_line_id'],
        'true'::jsonb,
        true
      );
    end if;
  end loop;

  perform pg_catalog.set_config(
    'repairdesk.quote_line_map',
    v_extended_fault_prices::text,
    true
  );

  v_result := public.repairdesk_publish_order_quote_legacy(
    p_store_id,
    p_order_id,
    p_actor_id,
    p_expected_updated_at,
    p_idempotency_key,
    p_diagnosis_result,
    v_legacy_fault_prices,
    p_price_exception_kind,
    p_price_exception_reason
  );
  perform pg_catalog.set_config('repairdesk.quote_line_map', '', true);

  if coalesce(v_result ->> 'code', '') in ('published', 'already_published') then
    update public.repair_orders
    set fault_prices = v_extended_fault_prices
    where store_id = p_store_id
      and id::text = p_order_id;

    select order_row.fault_prices
    into v_persisted_fault_prices
    from public.repair_orders as order_row
    where order_row.store_id = p_store_id
      and order_row.id::text = p_order_id;

    update public.order_events
    set payload = jsonb_set(
      payload,
      '{fault_prices_hash}',
      to_jsonb(pg_catalog.md5(v_persisted_fault_prices::text)),
      true
    )
    where store_id = p_store_id
      and id::text = v_result ->> 'quote_event_id'
      and event_type::text = 'quoted';
  end if;

  return v_result;
end;
$$;

create or replace function public.repairdesk_publish_order_quote(
  p_store_id uuid,
  p_order_id text,
  p_actor_id uuid,
  p_expected_updated_at timestamptz,
  p_idempotency_key uuid,
  p_diagnosis_result text,
  p_fault_prices jsonb,
  p_price_exception_kind text default null,
  p_price_exception_reason text default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.repairdesk_publish_order_quote_v2(
    p_store_id,
    p_order_id,
    p_actor_id,
    p_expected_updated_at,
    p_idempotency_key,
    p_diagnosis_result,
    p_fault_prices,
    p_price_exception_kind,
    p_price_exception_reason
  );
$$;

create or replace function public.repairdesk_replace_member_permission_grants_rpc(
  p_store_id uuid,
  p_membership_id uuid,
  p_actions text[] default array[]::text[],
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_role public.staff_role;
  v_user_id uuid;
  v_actions text[];
  v_before text[];
begin
  if p_actor_id is null or not exists (
    select 1
    from public.staff_profiles as actor_profile
    join public.store_memberships as actor_membership
      on actor_membership.user_id = actor_profile.id
     and actor_membership.store_id = p_store_id
     and actor_membership.status::text = 'active'
     and actor_membership.role::text = 'owner'
    join public.stores as actor_store
      on actor_store.id = actor_membership.store_id
     and actor_store.status::text = 'active'
    where actor_profile.id = p_actor_id
      and actor_profile.status::text = 'active'
  ) then
    raise exception 'actor_forbidden';
  end if;

  select membership.role, membership.user_id
  into v_role, v_user_id
  from public.store_memberships membership
  where membership.id = p_membership_id
    and membership.store_id = p_store_id
  for update;

  if not found or v_role = 'owner' then
    raise exception 'membership_not_grantable';
  end if;

  select coalesce(array_agg(action order by action), array[]::text[])
  into v_actions
  from (
    select distinct btrim(raw_action) as action
    from unnest(coalesce(p_actions, array[]::text[])) as raw_action
    where btrim(raw_action) <> ''
  ) normalized;

  if exists (
    select 1
    from unnest(v_actions) action
    where action not in (
      'supplier:read',
      'supplier:assign',
      'supplier:manage',
      'order:archive_browse',
      'finance:aggregate_read',
      'finance:profit_read',
      'finance:cost_manage'
    )
  ) then
    raise exception 'invalid_permission_action';
  end if;

  if v_role = 'viewer' and cardinality(v_actions) > 0 then
    raise exception 'role_cannot_receive_grants';
  end if;

  if v_role <> 'manager' and v_actions && array[
    'order:archive_browse',
    'finance:aggregate_read',
    'finance:profit_read',
    'finance:cost_manage'
  ]::text[] then
    raise exception 'role_cannot_receive_manager_grants';
  end if;

  select coalesce(array_agg(grant_row.action order by grant_row.action), array[]::text[])
  into v_before
  from public.store_member_permission_grants grant_row
  where grant_row.store_id = p_store_id
    and grant_row.membership_id = p_membership_id
    and grant_row.revoked_at is null;

  update public.store_member_permission_grants
  set revoked_at = v_now, revoked_by = p_actor_id, updated_at = v_now
  where store_id = p_store_id
    and membership_id = p_membership_id
    and revoked_at is null;

  insert into public.store_member_permission_grants (
    store_id,
    membership_id,
    user_id,
    action,
    granted_by,
    created_at,
    updated_at
  )
  select
    p_store_id,
    p_membership_id,
    v_user_id,
    action,
    p_actor_id,
    v_now,
    v_now
  from unnest(v_actions) action;

  update public.store_memberships
  set updated_at = v_now
  where id = p_membership_id
    and store_id = p_store_id;

  return jsonb_build_object(
    'before', to_jsonb(v_before),
    'after', to_jsonb(v_actions)
  );
end;
$$;

revoke all on function public.repairdesk_normalize_order_fault_prices()
  from public, anon, authenticated, service_role;
revoke all on function public.repairdesk_sync_order_line_costs()
  from public, anon, authenticated, service_role;
revoke all on function public.repairdesk_sync_quote_event_fault_prices_hash()
  from public, anon, authenticated, service_role;

revoke all on function public.repairdesk_replace_store_fault_cost_defaults_rpc(
  uuid, uuid, bigint, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.repairdesk_replace_store_fault_cost_defaults_rpc(
  uuid, uuid, bigint, jsonb
) to service_role;

revoke all on function public.repairdesk_read_store_fault_cost_defaults_rpc(
  uuid, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.repairdesk_read_store_fault_cost_defaults_rpc(
  uuid, uuid
) to service_role;

revoke all on function public.repairdesk_read_order_line_costs_rpc(
  uuid, uuid, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.repairdesk_read_order_line_costs_rpc(
  uuid, uuid, uuid
) to service_role;

revoke all on function public.repairdesk_replace_order_line_costs_rpc(
  uuid, uuid, uuid, bigint, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.repairdesk_replace_order_line_costs_rpc(
  uuid, uuid, uuid, bigint, jsonb
) to service_role;

revoke all on function public.repairdesk_apply_order_cost_inputs_rpc(
  uuid, uuid, uuid, bigint, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.repairdesk_apply_order_cost_inputs_rpc(
  uuid, uuid, uuid, bigint, jsonb
) to service_role;

revoke all on function public.repairdesk_publish_order_quote_v2(
  uuid, text, uuid, timestamptz, uuid, text, jsonb, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.repairdesk_publish_order_quote_v2(
  uuid, text, uuid, timestamptz, uuid, text, jsonb, text, text
) to service_role;

revoke all on function public.repairdesk_publish_order_quote_legacy(
  uuid, text, uuid, timestamptz, uuid, text, jsonb, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.repairdesk_publish_order_quote(
  uuid, text, uuid, timestamptz, uuid, text, jsonb, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.repairdesk_publish_order_quote(
  uuid, text, uuid, timestamptz, uuid, text, jsonb, text, text
) to service_role;

revoke all on function public.repairdesk_replace_member_permission_grants_rpc(
  uuid, uuid, text[], uuid
) from public, anon, authenticated, service_role;
grant execute on function public.repairdesk_replace_member_permission_grants_rpc(
  uuid, uuid, text[], uuid
) to service_role;

reset statement_timeout;
reset lock_timeout;

notify pgrst, 'reload schema';
