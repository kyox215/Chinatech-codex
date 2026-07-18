-- Preview-first, bounded and compensating historical repair-cost backfill.
-- This migration installs the tool only. It never creates or applies a run automatically.

set lock_timeout = '5s';
set statement_timeout = '60s';

create table public.repair_cost_backfill_runs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on update cascade on delete restrict,
  state text not null default 'draft',
  start_date date not null,
  end_date date not null,
  max_candidates integer not null,
  fixture_hash text,
  candidate_count integer not null default 0,
  estimated_count integer not null default 0,
  unknown_count integer not null default 0,
  applied_count integer not null default 0,
  conflict_count integer not null default 0,
  failed_count integer not null default 0,
  reverted_count integer not null default 0,
  revert_conflict_count integer not null default 0,
  preview_idempotency_key uuid not null,
  apply_idempotency_key uuid,
  revert_idempotency_key uuid,
  created_by uuid references auth.users(id) on update cascade on delete set null,
  applied_by uuid references auth.users(id) on update cascade on delete set null,
  reverted_by uuid references auth.users(id) on update cascade on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  applied_at timestamptz,
  reverted_at timestamptz,
  unique (id, store_id),
  unique (store_id, preview_idempotency_key),
  constraint repair_cost_backfill_runs_state_check check (state in (
    'draft', 'previewed', 'applying', 'applied', 'partially_applied',
    'reverting', 'reverted', 'revert_partial', 'rejected'
  )),
  constraint repair_cost_backfill_runs_range_check check (
    end_date >= start_date and end_date - start_date <= 366
  ),
  constraint repair_cost_backfill_runs_max_check check (max_candidates between 1 and 5000),
  constraint repair_cost_backfill_runs_hash_check check (
    fixture_hash is null or fixture_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint repair_cost_backfill_runs_count_check check (
    candidate_count >= 0 and estimated_count >= 0 and unknown_count >= 0
    and applied_count >= 0 and conflict_count >= 0 and failed_count >= 0
    and reverted_count >= 0 and revert_conflict_count >= 0
  )
);

create index repair_cost_backfill_runs_store_created_idx
  on public.repair_cost_backfill_runs (store_id, created_at desc);

create table public.repair_cost_backfill_candidates (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  store_id uuid not null,
  order_id uuid not null,
  line_ordinal integer not null,
  planned_line_id uuid not null,
  line_id_was_missing boolean not null,
  line_fingerprint text not null,
  expected_fault_prices_hash text not null,
  expected_order_updated_at timestamptz not null,
  expected_order_cost_revision bigint not null,
  catalog_key text,
  line_name text not null,
  proposed_cost_amount numeric(12, 2),
  proposed_source text not null,
  proposed_evidence_status text not null,
  default_version_id uuid,
  status text not null default 'previewed',
  error_code text,
  applied_projection_revision bigint,
  applied_at timestamptz,
  reverted_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  unique (run_id, order_id, line_ordinal),
  unique (run_id, planned_line_id),
  constraint repair_cost_backfill_candidates_run_store_fkey
    foreign key (run_id, store_id) references public.repair_cost_backfill_runs(id, store_id)
    on update cascade on delete cascade,
  constraint repair_cost_backfill_candidates_order_store_fkey
    foreign key (order_id, store_id) references public.repair_orders(id, store_id)
    on update cascade on delete restrict,
  constraint repair_cost_backfill_candidates_default_version_fkey
    foreign key (default_version_id) references public.store_fault_cost_default_versions(id)
    on update cascade on delete restrict,
  constraint repair_cost_backfill_candidates_ordinal_check check (line_ordinal between 1 and 50),
  constraint repair_cost_backfill_candidates_fingerprint_check check (
    line_fingerprint ~ '^[a-f0-9]{32}$' and expected_fault_prices_hash ~ '^[a-f0-9]{32}$'
  ),
  constraint repair_cost_backfill_candidates_revision_check check (
    expected_order_cost_revision >= 0
    and (applied_projection_revision is null or applied_projection_revision >= 1)
  ),
  constraint repair_cost_backfill_candidates_catalog_check check (
    catalog_key is null
    or catalog_key ~ '^[a-z0-9][a-z0-9_-]{0,63}:[a-z0-9][a-z0-9_-]{0,63}$'
  ),
  constraint repair_cost_backfill_candidates_name_check check (
    char_length(btrim(line_name)) between 1 and 160
  ),
  constraint repair_cost_backfill_candidates_amount_check check (
    proposed_cost_amount is null
    or (
      proposed_cost_amount between 0 and 999999.99
      and proposed_cost_amount = round(proposed_cost_amount, 2)
    )
  ),
  constraint repair_cost_backfill_candidates_proposal_check check (
    (
      proposed_source = 'historical_unknown'
      and proposed_evidence_status = 'unknown'
      and proposed_cost_amount is null
      and default_version_id is null
    )
    or (
      proposed_source = 'backfill_estimate'
      and proposed_evidence_status = 'estimated'
      and proposed_cost_amount is not null
      and default_version_id is not null
    )
  ),
  constraint repair_cost_backfill_candidates_status_check check (status in (
    'previewed', 'applied', 'skipped_conflict', 'failed', 'reverted', 'revert_conflict'
  )),
  constraint repair_cost_backfill_candidates_error_check check (
    error_code is null or char_length(error_code) between 1 and 100
  )
);

create index repair_cost_backfill_candidates_run_status_idx
  on public.repair_cost_backfill_candidates (run_id, status, order_id, line_ordinal);
create index repair_cost_backfill_candidates_store_order_idx
  on public.repair_cost_backfill_candidates (store_id, order_id, created_at desc);

alter table public.repair_cost_backfill_runs enable row level security;
alter table public.repair_cost_backfill_candidates enable row level security;
revoke all on table public.repair_cost_backfill_runs
  from public, anon, authenticated, service_role;
revoke all on table public.repair_cost_backfill_candidates
  from public, anon, authenticated, service_role;
grant select on table public.repair_cost_backfill_runs to service_role;
grant select on table public.repair_cost_backfill_candidates to service_role;

-- Permit only a pre-inserted, run-bound historical-unknown sentinel to keep the
-- planned line ID while normalizing a legacy JSON line. Ordinary callers retain
-- all previous identity checks.
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
           v_matched_old_ordinal = v_ordinal
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
       and exists (
         select 1
         from public.repair_order_line_costs as historical_cost
         where historical_cost.store_id = new.store_id
           and historical_cost.order_id = new.id
           and historical_cost.line_id = v_requested_line_id
           and historical_cost.source = 'historical_unknown'
           and historical_cost.source_reference_type = 'cost_backfill_candidate'
       ) then
      v_candidate_line_id := v_requested_line_id;
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

    v_normalized_item := jsonb_build_object('line_id', v_candidate_line_id);
    if v_catalog_key is not null then
      v_normalized_item := v_normalized_item || jsonb_build_object('catalog_key', v_catalog_key);
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

revoke all on function public.repairdesk_normalize_order_fault_prices()
  from public, anon, authenticated, service_role;

-- Existing cost writes retain their original revision kind. Backfill RPCs set a
-- transaction-local override so applied/reverted compensation is explicit.
create or replace function public.repairdesk_append_cost_revision_v2()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_change_kind text;
  v_override text := nullif(pg_catalog.current_setting('repairdesk.cost_change_kind', true), '');
  v_reason text := nullif(pg_catalog.current_setting('repairdesk.cost_reason', true), '');
  v_actor_id uuid;
begin
  if tg_op = 'UPDATE'
     and row(
       old.catalog_key, old.cost_amount, old.source, old.evidence_status,
       old.original_amount, old.original_currency_code, old.fx_rate_to_eur,
       old.fx_rate_at, old.fx_rate_source, old.source_reference_type,
       old.source_reference_id, old.is_active
     ) is not distinct from row(
       new.catalog_key, new.cost_amount, new.source, new.evidence_status,
       new.original_amount, new.original_currency_code, new.fx_rate_to_eur,
       new.fx_rate_at, new.fx_rate_source, new.source_reference_type,
       new.source_reference_id, new.is_active
     ) then
    return new;
  end if;

  if v_override in ('backfill_applied', 'backfill_reverted') then
    v_change_kind := v_override;
  elsif tg_op = 'INSERT' then
    v_change_kind := 'created';
  elsif old.is_active is distinct from new.is_active then
    v_change_kind := case when new.is_active then 'activated' else 'deactivated' end;
  else
    v_change_kind := 'corrected';
  end if;

  v_actor_id := public.repairdesk_current_cost_actor_id(
    coalesce(new.updated_by, new.created_by)
  );

  insert into public.repair_order_line_cost_revisions (
    store_id, order_id, line_id, projection_revision, change_kind,
    catalog_key, cost_amount, currency_code, source, evidence_status,
    original_amount, original_currency_code, fx_rate_to_eur, fx_rate_at, fx_rate_source,
    source_reference_type, source_reference_id, is_active, actor_id, reason, created_at
  ) values (
    new.store_id, new.order_id, new.line_id, new.revision, v_change_kind,
    new.catalog_key, new.cost_amount, new.currency_code, new.source, new.evidence_status,
    new.original_amount, new.original_currency_code, new.fx_rate_to_eur,
    new.fx_rate_at, new.fx_rate_source, new.source_reference_type,
    new.source_reference_id, new.is_active, v_actor_id, left(v_reason, 500), clock_timestamp()
  );

  return new;
end;
$$;

revoke all on function public.repairdesk_append_cost_revision_v2()
  from public, anon, authenticated, service_role;

create or replace function public.repairdesk_cost_backfill_run_payload(p_run_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select jsonb_build_object(
      'id', run.id,
      'store_id', run.store_id,
      'state', run.state,
      'start_date', run.start_date,
      'end_date', run.end_date,
      'max_candidates', run.max_candidates,
      'fixture_hash', run.fixture_hash,
      'candidate_count', run.candidate_count,
      'estimated_count', run.estimated_count,
      'unknown_count', run.unknown_count,
      'applied_count', run.applied_count,
      'conflict_count', run.conflict_count,
      'failed_count', run.failed_count,
      'reverted_count', run.reverted_count,
      'revert_conflict_count', run.revert_conflict_count,
      'created_at', run.created_at,
      'applied_at', run.applied_at,
      'reverted_at', run.reverted_at,
      'candidates', coalesce((
        select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'id', candidate.id,
          'order_id', candidate.order_id,
          'line_ordinal', candidate.line_ordinal,
          'planned_line_id', candidate.planned_line_id,
          'line_id_was_missing', candidate.line_id_was_missing,
          'catalog_key', candidate.catalog_key,
          'line_name', candidate.line_name,
          'proposed_cost_amount', candidate.proposed_cost_amount,
          'proposed_source', candidate.proposed_source,
          'proposed_evidence_status', candidate.proposed_evidence_status,
          'status', candidate.status,
          'error_code', candidate.error_code,
          'applied_projection_revision', candidate.applied_projection_revision,
          'applied_at', candidate.applied_at,
          'reverted_at', candidate.reverted_at
        )) order by candidate.order_id, candidate.line_ordinal)
        from (
          select *
          from public.repair_cost_backfill_candidates as candidate_row
          where candidate_row.run_id = run.id
          order by candidate_row.order_id, candidate_row.line_ordinal
          limit 100
        ) as candidate
      ), '[]'::jsonb)
    )
    from public.repair_cost_backfill_runs as run
    where run.id = p_run_id
  ), '{}'::jsonb);
$$;

revoke all on function public.repairdesk_cost_backfill_run_payload(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.repairdesk_refresh_cost_backfill_counts(p_run_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.repair_cost_backfill_runs as run
  set
    candidate_count = counts.candidate_count,
    estimated_count = counts.estimated_count,
    unknown_count = counts.unknown_count,
    applied_count = counts.applied_count,
    conflict_count = counts.conflict_count,
    failed_count = counts.failed_count,
    reverted_count = counts.reverted_count,
    revert_conflict_count = counts.revert_conflict_count,
    updated_at = clock_timestamp()
  from (
    select
      count(*)::integer as candidate_count,
      count(*) filter (where proposed_source = 'backfill_estimate')::integer as estimated_count,
      count(*) filter (where proposed_source = 'historical_unknown')::integer as unknown_count,
      count(*) filter (where status = 'applied')::integer as applied_count,
      count(*) filter (where status = 'skipped_conflict')::integer as conflict_count,
      count(*) filter (where status = 'failed')::integer as failed_count,
      count(*) filter (where status = 'reverted')::integer as reverted_count,
      count(*) filter (where status = 'revert_conflict')::integer as revert_conflict_count
    from public.repair_cost_backfill_candidates
    where run_id = p_run_id
  ) as counts
  where run.id = p_run_id;
$$;

revoke all on function public.repairdesk_refresh_cost_backfill_counts(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.repairdesk_preview_cost_backfill_rpc(
  p_store_id uuid,
  p_actor_id uuid,
  p_start_date date,
  p_end_date date,
  p_max_candidates integer,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_timezone text;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_run public.repair_cost_backfill_runs%rowtype;
  v_count integer;
  v_hash text;
begin
  if not public.repairdesk_actor_has_phase2_cost_permission(
    p_store_id, p_actor_id, 'finance:cost_backfill_preview'
  ) then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date
     or p_end_date - p_start_date > 366
     or p_max_candidates is null or p_max_candidates < 1 or p_max_candidates > 5000
     or p_idempotency_key is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_preview_input');
  end if;

  select * into v_run
  from public.repair_cost_backfill_runs
  where store_id = p_store_id and preview_idempotency_key = p_idempotency_key;
  if found then
    if v_run.start_date <> p_start_date or v_run.end_date <> p_end_date
       or v_run.max_candidates <> p_max_candidates then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return jsonb_build_object('ok', true, 'code', 'idempotent_replay', 'replayed', true)
      || public.repairdesk_cost_backfill_run_payload(v_run.id);
  end if;

  select coalesce(nullif(btrim(store_row.timezone), ''), 'Europe/Rome') into v_timezone
  from public.stores as store_row
  where store_row.id = p_store_id and store_row.status::text = 'active';
  if v_timezone is null then
    return jsonb_build_object('ok', false, 'code', 'store_not_found');
  end if;
  v_start_at := p_start_date::timestamp at time zone v_timezone;
  v_end_at := (p_end_date + 1)::timestamp at time zone v_timezone;

  insert into public.repair_cost_backfill_runs (
    store_id, state, start_date, end_date, max_candidates,
    preview_idempotency_key, created_by
  ) values (
    p_store_id, 'draft', p_start_date, p_end_date, p_max_candidates,
    p_idempotency_key, p_actor_id
  ) returning * into v_run;

  with source_lines as (
    select
      order_row.id as order_id,
      order_row.updated_at as expected_order_updated_at,
      md5(order_row.fault_prices::text) as expected_fault_prices_hash,
      coalesce((
        select max(cost_row.revision)
        from public.repair_order_line_costs as cost_row
        where cost_row.store_id = order_row.store_id and cost_row.order_id = order_row.id
      ), 0) as expected_order_cost_revision,
      line.ordinality::integer as line_ordinal,
      line.value,
      case
        when coalesce(line.value ->> 'line_id', '')
          ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then (line.value ->> 'line_id')::uuid
        else null
      end as existing_line_id,
      case
        when coalesce(line.value ->> 'catalog_key', '')
          ~ '^[a-z0-9][a-z0-9_-]{0,63}:[a-z0-9][a-z0-9_-]{0,63}$'
          then line.value ->> 'catalog_key'
        else null
      end as catalog_key,
      coalesce(nullif(btrim(line.value ->> 'name'), ''), '未命名维修项目') as line_name,
      default_version.id as default_version_id,
      default_version.default_cost_amount
    from public.repair_orders as order_row
    cross join lateral jsonb_array_elements(order_row.fault_prices)
      with ordinality as line(value, ordinality)
    left join lateral (
      select version.id, version.default_cost_amount
      from public.store_fault_cost_default_versions as version
      where version.store_id = order_row.store_id
        and version.catalog_key = line.value ->> 'catalog_key'
        and version.default_cost_amount is not null
        and version.effective_from <= order_row.created_at
        and (version.effective_to is null or order_row.created_at < version.effective_to)
      order by version.effective_from desc, version.revision desc
      limit 1
    ) as default_version on true
    where order_row.store_id = p_store_id
      and order_row.record_state::text = 'active'
      and order_row.deleted_at is null
      and order_row.created_at >= v_start_at and order_row.created_at < v_end_at
  ), eligible as (
    select *
    from source_lines
    where existing_line_id is null
       or not exists (
         select 1
         from public.repair_order_line_costs as cost_row
         where cost_row.store_id = p_store_id
           and cost_row.order_id = source_lines.order_id
           and cost_row.line_id = source_lines.existing_line_id
       )
    order by order_id, line_ordinal
    limit p_max_candidates + 1
  )
  insert into public.repair_cost_backfill_candidates (
    run_id, store_id, order_id, line_ordinal, planned_line_id, line_id_was_missing,
    line_fingerprint, expected_fault_prices_hash, expected_order_updated_at,
    expected_order_cost_revision, catalog_key, line_name, proposed_cost_amount,
    proposed_source, proposed_evidence_status, default_version_id
  )
  select
    v_run.id, p_store_id, eligible.order_id, eligible.line_ordinal,
    coalesce(eligible.existing_line_id, gen_random_uuid()), eligible.existing_line_id is null,
    md5(eligible.value::text), eligible.expected_fault_prices_hash,
    eligible.expected_order_updated_at, eligible.expected_order_cost_revision,
    eligible.catalog_key, eligible.line_name, eligible.default_cost_amount,
    case when eligible.default_version_id is null then 'historical_unknown' else 'backfill_estimate' end,
    case when eligible.default_version_id is null then 'unknown' else 'estimated' end,
    eligible.default_version_id
  from eligible;

  select count(*) into v_count
  from public.repair_cost_backfill_candidates where run_id = v_run.id;
  if v_count > p_max_candidates then
    delete from public.repair_cost_backfill_runs where id = v_run.id;
    return jsonb_build_object(
      'ok', false, 'code', 'candidate_limit_exceeded', 'limit', p_max_candidates
    );
  end if;

  select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(coalesce(string_agg(
    concat_ws(':', candidate.order_id, candidate.line_ordinal, candidate.line_fingerprint,
      candidate.proposed_source, coalesce(candidate.proposed_cost_amount::text, 'unknown')),
    '|' order by candidate.order_id, candidate.line_ordinal
  ), ''), 'UTF8')), 'hex')
  into v_hash
  from public.repair_cost_backfill_candidates as candidate
  where candidate.run_id = v_run.id;

  update public.repair_cost_backfill_runs
  set state = 'previewed', fixture_hash = v_hash, updated_at = clock_timestamp()
  where id = v_run.id;
  perform public.repairdesk_refresh_cost_backfill_counts(v_run.id);

  return jsonb_build_object('ok', true, 'code', 'previewed', 'replayed', false)
    || public.repairdesk_cost_backfill_run_payload(v_run.id);
exception when invalid_parameter_value then
  return jsonb_build_object('ok', false, 'code', 'invalid_store_timezone');
end;
$$;

create or replace function public.repairdesk_read_cost_backfill_runs_rpc(
  p_store_id uuid,
  p_actor_id uuid,
  p_run_id uuid default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not public.repairdesk_actor_has_phase2_cost_permission(
      p_store_id, p_actor_id, 'finance:cost_backfill_preview'
    ) then jsonb_build_object('ok', false, 'code', 'actor_forbidden')
    when p_run_id is not null and not exists (
      select 1 from public.repair_cost_backfill_runs
      where id = p_run_id and store_id = p_store_id
    ) then jsonb_build_object('ok', false, 'code', 'run_not_found')
    else jsonb_build_object(
      'ok', true,
      'code', 'read',
      'selected', case when p_run_id is null then null
        else public.repairdesk_cost_backfill_run_payload(p_run_id) end,
      'runs', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', run.id, 'state', run.state, 'start_date', run.start_date,
          'end_date', run.end_date, 'fixture_hash', run.fixture_hash,
          'candidate_count', run.candidate_count, 'estimated_count', run.estimated_count,
          'unknown_count', run.unknown_count, 'applied_count', run.applied_count,
          'conflict_count', run.conflict_count, 'failed_count', run.failed_count,
          'reverted_count', run.reverted_count,
          'revert_conflict_count', run.revert_conflict_count,
          'created_at', run.created_at, 'applied_at', run.applied_at,
          'reverted_at', run.reverted_at
        ) order by run.created_at desc)
        from (
          select * from public.repair_cost_backfill_runs
          where store_id = p_store_id order by created_at desc limit 20
        ) as run
      ), '[]'::jsonb)
    )
  end;
$$;

create or replace function public.repairdesk_apply_cost_backfill_rpc(
  p_store_id uuid,
  p_run_id uuid,
  p_actor_id uuid,
  p_expected_fixture_hash text,
  p_batch_size integer,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_run public.repair_cost_backfill_runs%rowtype;
  v_order record;
  v_order_id uuid;
  v_candidate public.repair_cost_backfill_candidates%rowtype;
  v_line jsonb;
  v_next_faults jsonb;
  v_current_revision bigint;
  v_invalid boolean;
  v_batch_orders integer := 0;
  v_remaining integer;
  v_failed integer;
begin
  if not public.repairdesk_actor_has_phase2_cost_permission(
    p_store_id, p_actor_id, 'finance:cost_backfill_apply'
  ) then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;
  if p_run_id is null or p_actor_id is null or p_idempotency_key is null
     or p_expected_fixture_hash !~ '^[a-f0-9]{64}$'
     or p_batch_size is null or p_batch_size < 1 or p_batch_size > 100 then
    return jsonb_build_object('ok', false, 'code', 'invalid_apply_input');
  end if;

  select * into v_run
  from public.repair_cost_backfill_runs
  where id = p_run_id and store_id = p_store_id
  for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'run_not_found'); end if;
  if v_run.fixture_hash <> p_expected_fixture_hash then
    return jsonb_build_object('ok', false, 'code', 'fixture_hash_mismatch');
  end if;
  if v_run.apply_idempotency_key is not null
     and v_run.apply_idempotency_key <> p_idempotency_key then
    return jsonb_build_object('ok', false, 'code', 'apply_idempotency_conflict');
  end if;
  if v_run.state = 'applied' then
    return jsonb_build_object('ok', true, 'code', 'idempotent_replay', 'replayed', true)
      || public.repairdesk_cost_backfill_run_payload(v_run.id);
  end if;
  if v_run.state not in ('previewed', 'applying', 'partially_applied') then
    return jsonb_build_object('ok', false, 'code', 'run_not_applicable');
  end if;

  update public.repair_cost_backfill_runs
  set state = 'applying', apply_idempotency_key = p_idempotency_key,
      applied_by = p_actor_id, applied_at = coalesce(applied_at, clock_timestamp()),
      updated_at = clock_timestamp()
  where id = v_run.id;

  for v_order_id in
    select candidate.order_id
    from public.repair_cost_backfill_candidates as candidate
    where candidate.run_id = v_run.id and candidate.status in ('previewed', 'failed')
    group by candidate.order_id
    order by candidate.order_id
    limit p_batch_size
  loop
    begin
      select order_row.* into v_order
      from public.repair_orders as order_row
      where order_row.id = v_order_id and order_row.store_id = p_store_id
        and order_row.record_state::text = 'active' and order_row.deleted_at is null
      for update;
      if not found
         or v_order.updated_at is distinct from (
           select min(candidate.expected_order_updated_at)
           from public.repair_cost_backfill_candidates as candidate
           where candidate.run_id = v_run.id and candidate.order_id = v_order_id
         )
         or md5(v_order.fault_prices::text) is distinct from (
           select min(candidate.expected_fault_prices_hash)
           from public.repair_cost_backfill_candidates as candidate
           where candidate.run_id = v_run.id and candidate.order_id = v_order_id
         ) then
        update public.repair_cost_backfill_candidates
        set status = 'skipped_conflict', error_code = 'order_changed_after_preview'
        where run_id = v_run.id and order_id = v_order_id
          and status in ('previewed', 'failed');
        continue;
      end if;

      perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(p_store_id::text || ':order-costs', 0)
      );
      select coalesce(max(cost_row.revision), 0) into v_current_revision
      from public.repair_order_line_costs as cost_row
      where cost_row.store_id = p_store_id and cost_row.order_id = v_order_id;
      if v_current_revision is distinct from (
        select min(candidate.expected_order_cost_revision)
        from public.repair_cost_backfill_candidates as candidate
        where candidate.run_id = v_run.id and candidate.order_id = v_order_id
      ) then
        update public.repair_cost_backfill_candidates
        set status = 'skipped_conflict', error_code = 'cost_revision_changed_after_preview'
        where run_id = v_run.id and order_id = v_order_id
          and status in ('previewed', 'failed');
        continue;
      end if;

      v_invalid := false;
      for v_candidate in
        select * from public.repair_cost_backfill_candidates
        where run_id = v_run.id and order_id = v_order_id
          and status in ('previewed', 'failed')
        order by line_ordinal
      loop
        v_line := v_order.fault_prices -> (v_candidate.line_ordinal - 1);
        if v_line is null or md5(v_line::text) <> v_candidate.line_fingerprint
           or (
             not v_candidate.line_id_was_missing
             and v_line ->> 'line_id' <> v_candidate.planned_line_id::text
           )
           or exists (
             select 1 from public.repair_order_line_costs as existing_cost
             where existing_cost.store_id = p_store_id
               and existing_cost.order_id = v_order_id
               and existing_cost.line_id = v_candidate.planned_line_id
           ) then
          v_invalid := true;
          exit;
        end if;
      end loop;
      if v_invalid then
        update public.repair_cost_backfill_candidates
        set status = 'skipped_conflict', error_code = 'line_changed_after_preview'
        where run_id = v_run.id and order_id = v_order_id
          and status in ('previewed', 'failed');
        continue;
      end if;

      perform pg_catalog.set_config('repairdesk.cost_actor_id', p_actor_id::text, true);
      perform pg_catalog.set_config('repairdesk.cost_change_kind', 'backfill_applied', true);
      perform pg_catalog.set_config(
        'repairdesk.cost_reason', 'Historical cost backfill run ' || v_run.id::text, true
      );

      for v_candidate in
        select * from public.repair_cost_backfill_candidates
        where run_id = v_run.id and order_id = v_order_id
          and status in ('previewed', 'failed')
        order by line_ordinal
      loop
        insert into public.repair_order_line_costs (
          store_id, order_id, line_id, catalog_key, cost_amount, currency_code,
          source, evidence_status, source_reference_type, source_reference_id,
          is_active, revision, created_by, updated_by, created_at, updated_at
        ) values (
          p_store_id, v_order_id, v_candidate.planned_line_id, v_candidate.catalog_key,
          null, 'EUR', 'historical_unknown', 'unknown',
          'cost_backfill_candidate', v_candidate.id, true, v_current_revision + 1,
          p_actor_id, p_actor_id, clock_timestamp(), clock_timestamp()
        );
      end loop;

      v_next_faults := v_order.fault_prices;
      for v_candidate in
        select * from public.repair_cost_backfill_candidates
        where run_id = v_run.id and order_id = v_order_id
          and status in ('previewed', 'failed') and line_id_was_missing
        order by line_ordinal
      loop
        v_next_faults := jsonb_set(
          v_next_faults,
          array[(v_candidate.line_ordinal - 1)::text, 'line_id'],
          to_jsonb(v_candidate.planned_line_id::text),
          true
        );
      end loop;
      if v_next_faults is distinct from v_order.fault_prices then
        update public.repair_orders
        set fault_prices = v_next_faults
        where id = v_order_id and store_id = p_store_id;
      end if;

      select coalesce(max(cost_row.revision), 0) + 1 into v_current_revision
      from public.repair_order_line_costs as cost_row
      where cost_row.store_id = p_store_id and cost_row.order_id = v_order_id;
      update public.repair_order_line_costs as cost_row
      set
        cost_amount = candidate.proposed_cost_amount,
        source = candidate.proposed_source,
        evidence_status = candidate.proposed_evidence_status,
        original_amount = case when candidate.proposed_cost_amount is null then null
          else candidate.proposed_cost_amount end,
        original_currency_code = case when candidate.proposed_cost_amount is null then null
          else 'EUR' end,
        fx_rate_to_eur = case when candidate.proposed_cost_amount is null then null else 1 end,
        fx_rate_at = case when candidate.proposed_cost_amount is null then null
          else v_order.created_at end,
        fx_rate_source = case when candidate.proposed_cost_amount is null then null
          else 'historical_default_version' end,
        source_reference_type = 'cost_backfill_candidate',
        source_reference_id = candidate.id,
        revision = v_current_revision,
        updated_by = p_actor_id,
        updated_at = clock_timestamp()
      from public.repair_cost_backfill_candidates as candidate
      where candidate.run_id = v_run.id and candidate.order_id = v_order_id
        and candidate.status in ('previewed', 'failed')
        and cost_row.store_id = p_store_id and cost_row.order_id = v_order_id
        and cost_row.line_id = candidate.planned_line_id
        and candidate.proposed_source = 'backfill_estimate';

      update public.repair_cost_backfill_candidates as candidate
      set status = 'applied', error_code = null,
          applied_projection_revision = cost_row.revision,
          applied_at = clock_timestamp()
      from public.repair_order_line_costs as cost_row
      where candidate.run_id = v_run.id and candidate.order_id = v_order_id
        and candidate.status in ('previewed', 'failed')
        and cost_row.store_id = candidate.store_id and cost_row.order_id = candidate.order_id
        and cost_row.line_id = candidate.planned_line_id
        and cost_row.source_reference_type = 'cost_backfill_candidate'
        and cost_row.source_reference_id = candidate.id;
      v_batch_orders := v_batch_orders + 1;
    exception when others then
      update public.repair_cost_backfill_candidates
      set status = 'failed', error_code = left('apply_exception_' || sqlstate, 100)
      where run_id = v_run.id and order_id = v_order_id
        and status in ('previewed', 'failed');
    end;
  end loop;

  perform public.repairdesk_refresh_cost_backfill_counts(v_run.id);
  select
    count(*) filter (where status = 'previewed'),
    count(*) filter (where status = 'failed')
  into v_remaining, v_failed
  from public.repair_cost_backfill_candidates where run_id = v_run.id;
  update public.repair_cost_backfill_runs
  set state = case when v_remaining = 0 and v_failed = 0 then 'applied'
      else 'partially_applied' end,
      updated_at = clock_timestamp()
  where id = v_run.id;

  return jsonb_build_object(
    'ok', true,
    'code', case when v_remaining = 0 and v_failed = 0 then 'applied' else 'partial' end,
    'replayed', false,
    'batch_order_count', v_batch_orders,
    'has_more', v_remaining > 0 or v_failed > 0
  ) || public.repairdesk_cost_backfill_run_payload(v_run.id);
end;
$$;

create or replace function public.repairdesk_revert_cost_backfill_rpc(
  p_store_id uuid,
  p_run_id uuid,
  p_actor_id uuid,
  p_batch_size integer,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_run public.repair_cost_backfill_runs%rowtype;
  v_order_id uuid;
  v_candidate public.repair_cost_backfill_candidates%rowtype;
  v_current_revision bigint;
  v_invalid boolean;
  v_batch_orders integer := 0;
  v_remaining integer;
  v_conflicts integer;
begin
  if not public.repairdesk_actor_has_phase2_cost_permission(
    p_store_id, p_actor_id, 'finance:cost_backfill_apply'
  ) then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;
  if p_run_id is null or p_actor_id is null or p_idempotency_key is null
     or p_batch_size is null or p_batch_size < 1 or p_batch_size > 100 then
    return jsonb_build_object('ok', false, 'code', 'invalid_revert_input');
  end if;

  select * into v_run from public.repair_cost_backfill_runs
  where id = p_run_id and store_id = p_store_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'run_not_found'); end if;
  if v_run.revert_idempotency_key is not null
     and v_run.revert_idempotency_key <> p_idempotency_key then
    return jsonb_build_object('ok', false, 'code', 'revert_idempotency_conflict');
  end if;
  if v_run.state in ('reverted', 'revert_partial') then
    return jsonb_build_object('ok', true, 'code', 'idempotent_replay', 'replayed', true)
      || public.repairdesk_cost_backfill_run_payload(v_run.id);
  end if;
  if v_run.state not in ('applied', 'partially_applied', 'reverting') then
    return jsonb_build_object('ok', false, 'code', 'run_not_revertible');
  end if;

  update public.repair_cost_backfill_runs
  set state = 'reverting', revert_idempotency_key = p_idempotency_key,
      reverted_by = p_actor_id, reverted_at = coalesce(reverted_at, clock_timestamp()),
      updated_at = clock_timestamp()
  where id = v_run.id;

  for v_order_id in
    select candidate.order_id
    from public.repair_cost_backfill_candidates as candidate
    where candidate.run_id = v_run.id and candidate.status = 'applied'
    group by candidate.order_id order by candidate.order_id limit p_batch_size
  loop
    begin
      perform 1 from public.repair_orders as order_row
      where order_row.id = v_order_id and order_row.store_id = p_store_id
      for update;
      if not found then
        update public.repair_cost_backfill_candidates
        set status = 'revert_conflict', error_code = 'order_missing_during_revert'
        where run_id = v_run.id and order_id = v_order_id and status = 'applied';
        continue;
      end if;
      perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(p_store_id::text || ':order-costs', 0)
      );
      v_invalid := false;
      for v_candidate in
        select * from public.repair_cost_backfill_candidates
        where run_id = v_run.id and order_id = v_order_id and status = 'applied'
      loop
        if not exists (
          select 1 from public.repair_order_line_costs as cost_row
          where cost_row.store_id = p_store_id and cost_row.order_id = v_order_id
            and cost_row.line_id = v_candidate.planned_line_id and cost_row.is_active
            and cost_row.revision = v_candidate.applied_projection_revision
            and cost_row.source_reference_type = 'cost_backfill_candidate'
            and cost_row.source_reference_id = v_candidate.id
        ) then
          v_invalid := true;
          exit;
        end if;
      end loop;
      if v_invalid then
        update public.repair_cost_backfill_candidates
        set status = 'revert_conflict', error_code = 'later_cost_edit_detected'
        where run_id = v_run.id and order_id = v_order_id and status = 'applied';
        continue;
      end if;

      perform pg_catalog.set_config('repairdesk.cost_actor_id', p_actor_id::text, true);
      perform pg_catalog.set_config('repairdesk.cost_change_kind', 'backfill_reverted', true);
      perform pg_catalog.set_config(
        'repairdesk.cost_reason', 'Compensating revert for backfill run ' || v_run.id::text, true
      );
      select coalesce(max(cost_row.revision), 0) + 1 into v_current_revision
      from public.repair_order_line_costs as cost_row
      where cost_row.store_id = p_store_id and cost_row.order_id = v_order_id;
      update public.repair_order_line_costs as cost_row
      set cost_amount = null, source = 'historical_unknown', evidence_status = 'unknown',
          original_amount = null, original_currency_code = null, fx_rate_to_eur = null,
          fx_rate_at = null, fx_rate_source = null,
          source_reference_type = 'cost_backfill_revert',
          source_reference_id = candidate.id, revision = v_current_revision,
          updated_by = p_actor_id, updated_at = clock_timestamp()
      from public.repair_cost_backfill_candidates as candidate
      where candidate.run_id = v_run.id and candidate.order_id = v_order_id
        and candidate.status = 'applied'
        and cost_row.store_id = candidate.store_id and cost_row.order_id = candidate.order_id
        and cost_row.line_id = candidate.planned_line_id;
      update public.repair_cost_backfill_candidates
      set status = 'reverted', error_code = null, reverted_at = clock_timestamp()
      where run_id = v_run.id and order_id = v_order_id and status = 'applied';
      v_batch_orders := v_batch_orders + 1;
    exception when others then
      update public.repair_cost_backfill_candidates
      set status = 'revert_conflict', error_code = left('revert_exception_' || sqlstate, 100)
      where run_id = v_run.id and order_id = v_order_id and status = 'applied';
    end;
  end loop;

  perform public.repairdesk_refresh_cost_backfill_counts(v_run.id);
  select
    count(*) filter (where status = 'applied'),
    count(*) filter (where status = 'revert_conflict')
  into v_remaining, v_conflicts
  from public.repair_cost_backfill_candidates where run_id = v_run.id;
  update public.repair_cost_backfill_runs
  set state = case
      when v_remaining > 0 then 'reverting'
      when v_conflicts > 0 then 'revert_partial'
      else 'reverted'
    end,
    updated_at = clock_timestamp()
  where id = v_run.id;

  return jsonb_build_object(
    'ok', true,
    'code', case
      when v_remaining > 0 then 'partial'
      when v_conflicts > 0 then 'revert_partial'
      else 'reverted'
    end,
    'replayed', false,
    'batch_order_count', v_batch_orders,
    'has_more', v_remaining > 0
  ) || public.repairdesk_cost_backfill_run_payload(v_run.id);
end;
$$;

revoke all on function public.repairdesk_preview_cost_backfill_rpc(
  uuid, uuid, date, date, integer, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.repairdesk_read_cost_backfill_runs_rpc(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.repairdesk_apply_cost_backfill_rpc(
  uuid, uuid, uuid, text, integer, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.repairdesk_revert_cost_backfill_rpc(
  uuid, uuid, uuid, integer, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.repairdesk_preview_cost_backfill_rpc(
  uuid, uuid, date, date, integer, uuid
) to service_role;
grant execute on function public.repairdesk_read_cost_backfill_runs_rpc(uuid, uuid, uuid)
  to service_role;
grant execute on function public.repairdesk_apply_cost_backfill_rpc(
  uuid, uuid, uuid, text, integer, uuid
) to service_role;
grant execute on function public.repairdesk_revert_cost_backfill_rpc(
  uuid, uuid, uuid, integer, uuid
) to service_role;

reset statement_timeout;
reset lock_timeout;

notify pgrst, 'reload schema';
