-- RepairDesk internal-cost Phase 2 foundation.
--
-- Expand-only guarantees:
-- - Phase 1 repair_order_line_costs stays the current EUR projection.
-- - append-only revisions begin at this migration; they do not pretend to be older history.
-- - current defaults receive a migration snapshot effective now, never retroactively.
-- - browser roles keep no direct cost-table access.

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
      'finance:cost_manage',
      'finance:cost_export',
      'finance:cost_backfill_preview',
      'inventory:cost_allocate'
    )
  ) not valid;

alter table public.store_member_permission_grants
  validate constraint store_member_permission_grants_action_check;

alter table public.repair_order_line_costs
  add column evidence_status text not null default 'estimated',
  add column original_amount numeric(18, 6),
  add column original_currency_code text,
  add column fx_rate_to_eur numeric(20, 10),
  add column fx_rate_at timestamptz,
  add column fx_rate_source text,
  add column source_reference_type text,
  add column source_reference_id uuid,
  add column confirmed_by uuid,
  add column confirmed_at timestamptz;

alter table public.repair_order_line_costs
  add constraint repair_order_line_costs_confirmed_by_fkey
    foreign key (confirmed_by) references auth.users(id)
    on update cascade on delete set null;

alter table public.repair_order_line_costs
  drop constraint if exists repair_order_line_costs_source_check,
  drop constraint if exists repair_order_line_costs_source_amount_check;

alter table public.repair_order_line_costs
  add constraint repair_order_line_costs_source_check
  check (
    source in (
      'store_default',
      'manual',
      'manual_blank',
      'historical_unknown',
      'purchase_lot',
      'supplier_document',
      'backfill_estimate'
    )
  ) not valid,
  add constraint repair_order_line_costs_source_amount_check
  check (
    (source in ('manual', 'purchase_lot', 'supplier_document', 'backfill_estimate')
      and cost_amount is not null)
    or (source in ('manual_blank', 'historical_unknown') and cost_amount is null)
    or source = 'store_default'
  ) not valid,
  add constraint repair_order_line_costs_evidence_status_check
  check (evidence_status in ('unknown', 'estimated', 'confirmed', 'reconciled')) not valid,
  add constraint repair_order_line_costs_evidence_amount_check
  check (
    (evidence_status = 'unknown' and cost_amount is null)
    or (evidence_status <> 'unknown' and cost_amount is not null)
  ) not valid,
  add constraint repair_order_line_costs_original_amount_check
  check (
    original_amount is null
    or (
      original_amount between 0 and 999999999999.999999
      and original_amount = round(original_amount, 6)
    )
  ) not valid,
  add constraint repair_order_line_costs_original_currency_check
  check (
    original_currency_code is null
    or original_currency_code ~ '^[A-Z]{3}$'
  ) not valid,
  add constraint repair_order_line_costs_fx_rate_check
  check (
    fx_rate_to_eur is null
    or (
      fx_rate_to_eur > 0
      and fx_rate_to_eur <= 1000000
      and fx_rate_to_eur = round(fx_rate_to_eur, 10)
    )
  ) not valid,
  add constraint repair_order_line_costs_currency_snapshot_check
  check (
    (
      cost_amount is null
      and original_amount is null
      and original_currency_code is null
      and fx_rate_to_eur is null
      and fx_rate_at is null
      and fx_rate_source is null
    )
    or (
      cost_amount is not null
      and original_amount is not null
      and original_currency_code is not null
      and fx_rate_to_eur is not null
      and char_length(btrim(coalesce(fx_rate_source, ''))) between 1 and 80
      and cost_amount = round(original_amount * fx_rate_to_eur, 2)
      and (
        original_currency_code <> 'EUR'
        or (
          original_amount = cost_amount
          and fx_rate_to_eur = 1
        )
      )
    )
  ) not valid,
  add constraint repair_order_line_costs_source_reference_check
  check (
    source_reference_type is null
    or char_length(btrim(source_reference_type)) between 1 and 64
  ) not valid,
  add constraint repair_order_line_costs_confirmation_check
  check (
    (confirmed_by is null and confirmed_at is null)
    or (confirmed_by is not null and confirmed_at is not null)
  ) not valid;

update public.repair_order_line_costs
set
  evidence_status = case
    when cost_amount is null then 'unknown'
    when source = 'store_default' then 'estimated'
    else 'confirmed'
  end,
  original_amount = cost_amount,
  original_currency_code = case when cost_amount is null then null else 'EUR' end,
  fx_rate_to_eur = case when cost_amount is null then null else 1 end,
  fx_rate_at = case when cost_amount is null then null else created_at end,
  fx_rate_source = case when cost_amount is null then null else 'store_base' end,
  confirmed_by = case
    when cost_amount is not null and source <> 'store_default' then coalesce(updated_by, created_by)
    else null
  end,
  confirmed_at = case
    when cost_amount is not null and source <> 'store_default' then updated_at
    else null
  end;

alter table public.repair_order_line_costs
  validate constraint repair_order_line_costs_source_check,
  validate constraint repair_order_line_costs_source_amount_check,
  validate constraint repair_order_line_costs_evidence_status_check,
  validate constraint repair_order_line_costs_evidence_amount_check,
  validate constraint repair_order_line_costs_original_amount_check,
  validate constraint repair_order_line_costs_original_currency_check,
  validate constraint repair_order_line_costs_fx_rate_check,
  validate constraint repair_order_line_costs_currency_snapshot_check,
  validate constraint repair_order_line_costs_source_reference_check,
  validate constraint repair_order_line_costs_confirmation_check;

create table public.repair_order_line_cost_revisions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  order_id uuid not null,
  line_id uuid not null,
  projection_revision bigint not null,
  change_kind text not null,
  catalog_key text,
  cost_amount numeric(12, 2),
  currency_code text not null default 'EUR',
  source text not null,
  evidence_status text not null,
  original_amount numeric(18, 6),
  original_currency_code text,
  fx_rate_to_eur numeric(20, 10),
  fx_rate_at timestamptz,
  fx_rate_source text,
  source_reference_type text,
  source_reference_id uuid,
  is_active boolean not null,
  actor_id uuid,
  idempotency_key uuid,
  reason text,
  created_at timestamptz not null default clock_timestamp(),
  constraint repair_order_line_cost_revisions_order_store_fkey
    foreign key (order_id, store_id) references public.repair_orders(id, store_id)
    on update cascade on delete cascade,
  constraint repair_order_line_cost_revisions_actor_fkey
    foreign key (actor_id) references auth.users(id)
    on update cascade on delete set null,
  constraint repair_order_line_cost_revisions_projection_revision_check
    check (projection_revision >= 1),
  constraint repair_order_line_cost_revisions_change_kind_check
    check (change_kind in (
      'migration_snapshot', 'created', 'corrected', 'activated', 'deactivated',
      'allocated', 'reversed', 'backfill_applied', 'backfill_reverted', 'reconciled'
    )),
  constraint repair_order_line_cost_revisions_catalog_key_check
    check (
      catalog_key is null
      or catalog_key ~ '^[a-z0-9][a-z0-9_-]{0,63}:[a-z0-9][a-z0-9_-]{0,63}$'
    ),
  constraint repair_order_line_cost_revisions_amount_check
    check (
      cost_amount is null
      or (
        cost_amount between 0 and 999999.99
        and cost_amount = round(cost_amount, 2)
      )
    ),
  constraint repair_order_line_cost_revisions_currency_check check (currency_code = 'EUR'),
  constraint repair_order_line_cost_revisions_source_check
    check (source in (
      'store_default', 'manual', 'manual_blank', 'historical_unknown',
      'purchase_lot', 'supplier_document', 'backfill_estimate'
    )),
  constraint repair_order_line_cost_revisions_evidence_check
    check (evidence_status in ('unknown', 'estimated', 'confirmed', 'reconciled')),
  constraint repair_order_line_cost_revisions_evidence_amount_check
    check (
      (evidence_status = 'unknown' and cost_amount is null)
      or (evidence_status <> 'unknown' and cost_amount is not null)
    ),
  constraint repair_order_line_cost_revisions_reason_check
    check (reason is null or char_length(btrim(reason)) between 1 and 500)
);

create index repair_order_line_cost_revisions_order_idx
  on public.repair_order_line_cost_revisions
  (store_id, order_id, line_id, created_at desc);

create unique index repair_order_line_cost_revisions_idempotency_idx
  on public.repair_order_line_cost_revisions (store_id, idempotency_key)
  where idempotency_key is not null;

create table public.store_fault_cost_default_versions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  catalog_key text not null,
  catalog_name text not null,
  default_cost_amount numeric(12, 2),
  currency_code text not null default 'EUR',
  revision bigint not null,
  change_kind text not null,
  effective_from timestamptz not null,
  effective_to timestamptz,
  actor_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  constraint store_fault_cost_default_versions_store_fkey
    foreign key (store_id) references public.stores(id)
    on update cascade on delete cascade,
  constraint store_fault_cost_default_versions_actor_fkey
    foreign key (actor_id) references auth.users(id)
    on update cascade on delete set null,
  constraint store_fault_cost_default_versions_catalog_key_check
    check (catalog_key ~ '^[a-z0-9][a-z0-9_-]{0,63}:[a-z0-9][a-z0-9_-]{0,63}$'),
  constraint store_fault_cost_default_versions_catalog_name_check
    check (char_length(btrim(catalog_name)) between 1 and 120),
  constraint store_fault_cost_default_versions_amount_check
    check (
      default_cost_amount is null
      or (
        default_cost_amount between 0 and 999999.99
        and default_cost_amount = round(default_cost_amount, 2)
      )
    ),
  constraint store_fault_cost_default_versions_currency_check check (currency_code = 'EUR'),
  constraint store_fault_cost_default_versions_revision_check check (revision >= 1),
  constraint store_fault_cost_default_versions_change_kind_check
    check (change_kind in ('migration_snapshot', 'set', 'cleared', 'removed')),
  constraint store_fault_cost_default_versions_range_check
    check (effective_to is null or effective_to >= effective_from)
);

create unique index store_fault_cost_default_versions_open_idx
  on public.store_fault_cost_default_versions (store_id, catalog_key)
  where effective_to is null;

create index store_fault_cost_default_versions_effective_idx
  on public.store_fault_cost_default_versions
  (store_id, catalog_key, effective_from desc, effective_to);

alter table public.repair_order_line_cost_revisions enable row level security;
alter table public.store_fault_cost_default_versions enable row level security;

revoke all on table public.repair_order_line_cost_revisions
  from public, anon, authenticated, service_role;
revoke all on table public.store_fault_cost_default_versions
  from public, anon, authenticated, service_role;
grant select on table public.repair_order_line_cost_revisions to service_role;
grant select on table public.store_fault_cost_default_versions to service_role;

insert into public.repair_order_line_cost_revisions (
  store_id, order_id, line_id, projection_revision, change_kind,
  catalog_key, cost_amount, currency_code, source, evidence_status,
  original_amount, original_currency_code, fx_rate_to_eur, fx_rate_at, fx_rate_source,
  source_reference_type, source_reference_id, is_active, actor_id, created_at
)
select
  store_id, order_id, line_id, revision, 'migration_snapshot',
  catalog_key, cost_amount, currency_code, source, evidence_status,
  original_amount, original_currency_code, fx_rate_to_eur, fx_rate_at, fx_rate_source,
  source_reference_type, source_reference_id, is_active,
  coalesce(updated_by, created_by), clock_timestamp()
from public.repair_order_line_costs;

insert into public.store_fault_cost_default_versions (
  store_id, catalog_key, catalog_name, default_cost_amount, currency_code,
  revision, change_kind, effective_from, actor_id, created_at
)
select
  store_id, catalog_key, catalog_name, default_cost_amount, currency_code,
  revision, 'migration_snapshot', clock_timestamp(), updated_by, clock_timestamp()
from public.store_fault_cost_defaults;

create or replace function public.repairdesk_current_cost_actor_id(p_fallback uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_value text;
begin
  v_value := nullif(pg_catalog.current_setting('repairdesk.cost_actor_id', true), '');
  if v_value is null then
    return p_fallback;
  end if;
  return v_value::uuid;
exception when invalid_text_representation then
  return p_fallback;
end;
$$;

revoke all on function public.repairdesk_current_cost_actor_id(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.repairdesk_normalize_cost_projection_v2()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  if new.cost_amount is null then
    new.evidence_status := 'unknown';
    new.original_amount := null;
    new.original_currency_code := null;
    new.fx_rate_to_eur := null;
    new.fx_rate_at := null;
    new.fx_rate_source := null;
    new.confirmed_by := null;
    new.confirmed_at := null;
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.cost_amount is distinct from old.cost_amount
     and row(
       new.original_amount,
       new.original_currency_code,
       new.fx_rate_to_eur,
       new.fx_rate_at,
       new.fx_rate_source
     ) is not distinct from row(
       old.original_amount,
       old.original_currency_code,
       old.fx_rate_to_eur,
       old.fx_rate_at,
       old.fx_rate_source
     ) then
    new.original_amount := new.cost_amount;
    new.original_currency_code := 'EUR';
    new.fx_rate_to_eur := 1;
    new.fx_rate_at := v_now;
    new.fx_rate_source := 'store_base';
  end if;

  if new.source in ('store_default', 'backfill_estimate') then
    new.evidence_status := 'estimated';
    new.confirmed_by := null;
    new.confirmed_at := null;
  elsif new.evidence_status <> 'reconciled' then
    new.evidence_status := 'confirmed';
  end if;

  if new.original_currency_code is null then
    new.original_amount := new.cost_amount;
    new.original_currency_code := 'EUR';
    new.fx_rate_to_eur := 1;
    new.fx_rate_at := coalesce(new.fx_rate_at, v_now);
    new.fx_rate_source := 'store_base';
  end if;

  if new.evidence_status in ('confirmed', 'reconciled')
     and new.confirmed_by is null then
    new.confirmed_by := coalesce(new.updated_by, new.created_by);
    new.confirmed_at := case
      when coalesce(new.updated_by, new.created_by) is null then null
      else v_now
    end;
  end if;

  return new;
end;
$$;

revoke all on function public.repairdesk_normalize_cost_projection_v2()
  from public, anon, authenticated, service_role;

create trigger repairdesk_normalize_cost_projection_v2_trigger
before insert or update on public.repair_order_line_costs
for each row execute function public.repairdesk_normalize_cost_projection_v2();

create or replace function public.repairdesk_append_cost_revision_v2()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_change_kind text;
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

  if tg_op = 'INSERT' then
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
    source_reference_type, source_reference_id, is_active, actor_id, created_at
  ) values (
    new.store_id, new.order_id, new.line_id, new.revision, v_change_kind,
    new.catalog_key, new.cost_amount, new.currency_code, new.source, new.evidence_status,
    new.original_amount, new.original_currency_code, new.fx_rate_to_eur,
    new.fx_rate_at, new.fx_rate_source, new.source_reference_type,
    new.source_reference_id, new.is_active, v_actor_id, clock_timestamp()
  );

  return new;
end;
$$;

revoke all on function public.repairdesk_append_cost_revision_v2()
  from public, anon, authenticated, service_role;

create trigger repairdesk_append_cost_revision_v2_trigger
after insert or update on public.repair_order_line_costs
for each row execute function public.repairdesk_append_cost_revision_v2();

create or replace function public.repairdesk_version_cost_default_v2()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid := case when tg_op = 'DELETE' then old.store_id else new.store_id end;
  v_catalog_key text := case when tg_op = 'DELETE' then old.catalog_key else new.catalog_key end;
  v_now timestamptz := clock_timestamp();
  v_actor_id uuid;
begin
  v_actor_id := public.repairdesk_current_cost_actor_id(
    case when tg_op = 'DELETE' then old.updated_by else new.updated_by end
  );

  update public.store_fault_cost_default_versions
  set effective_to = v_now
  where store_id = v_store_id
    and catalog_key = v_catalog_key
    and effective_to is null;

  if tg_op = 'DELETE' then
    insert into public.store_fault_cost_default_versions (
      store_id, catalog_key, catalog_name, default_cost_amount, currency_code,
      revision, change_kind, effective_from, actor_id, created_at
    ) values (
      old.store_id, old.catalog_key, old.catalog_name, null, 'EUR',
      old.revision + 1, 'removed', v_now, v_actor_id, v_now
    );
    return old;
  end if;

  insert into public.store_fault_cost_default_versions (
    store_id, catalog_key, catalog_name, default_cost_amount, currency_code,
    revision, change_kind, effective_from, actor_id, created_at
  ) values (
    new.store_id,
    new.catalog_key,
    new.catalog_name,
    new.default_cost_amount,
    'EUR',
    new.revision,
    case when new.default_cost_amount is null then 'cleared' else 'set' end,
    v_now,
    v_actor_id,
    v_now
  );

  return new;
end;
$$;

revoke all on function public.repairdesk_version_cost_default_v2()
  from public, anon, authenticated, service_role;

create trigger repairdesk_version_cost_default_v2_trigger
after insert or update or delete on public.store_fault_cost_defaults
for each row execute function public.repairdesk_version_cost_default_v2();

create or replace function public.repairdesk_actor_has_phase2_cost_permission(
  p_store_id uuid,
  p_actor_id uuid,
  p_action text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_action in (
      'finance:profit_read',
      'finance:cost_manage',
      'finance:cost_export',
      'finance:cost_backfill_preview',
      'finance:cost_backfill_apply',
      'finance:currency_manage',
      'inventory:cost_allocate'
    )
    and exists (
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
            and p_action not in ('finance:cost_backfill_apply', 'finance:currency_manage')
            and exists (
              select 1
              from public.store_member_permission_grants as grant_row
              where grant_row.store_id = p_store_id
                and grant_row.membership_id = membership.id
                and grant_row.user_id = p_actor_id
                and grant_row.action = p_action
                and grant_row.revoked_at is null
            )
          )
        )
    );
$$;

revoke all on function public.repairdesk_actor_has_phase2_cost_permission(uuid, uuid, text)
  from public, anon, authenticated, service_role;

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
          jsonb_strip_nulls(jsonb_build_object(
            'line_id', cost_row.line_id,
            'catalog_key', cost_row.catalog_key,
            'cost_amount', cost_row.cost_amount,
            'source', cost_row.source,
            'evidence_status', cost_row.evidence_status,
            'original_amount', cost_row.original_amount,
            'original_currency_code', cost_row.original_currency_code,
            'fx_rate_to_eur', cost_row.fx_rate_to_eur,
            'fx_rate_at', cost_row.fx_rate_at,
            'fx_rate_source', cost_row.fx_rate_source,
            'source_reference_type', cost_row.source_reference_type,
            'source_reference_id', cost_row.source_reference_id,
            'revision', cost_row.revision
          )) order by cost_row.line_id
        )
        from public.repair_order_line_costs as cost_row
        where cost_row.store_id = p_store_id
          and cost_row.order_id = p_order_id
          and cost_row.is_active
      ), '[]'::jsonb)
    )
  end;
$$;

create or replace function public.repairdesk_read_order_cost_history_rpc(
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
        and order_row.deleted_at is null
    ) then jsonb_build_object('ok', false, 'code', 'order_not_found')
    else jsonb_build_object(
      'ok', true,
      'code', 'read',
      'items', coalesce((
        select jsonb_agg(to_jsonb(history_row) order by history_row.created_at desc)
        from (
          select
            revision_row.id,
            revision_row.line_id,
            revision_row.projection_revision,
            revision_row.change_kind,
            revision_row.catalog_key,
            revision_row.cost_amount,
            revision_row.source,
            revision_row.evidence_status,
            revision_row.original_amount,
            revision_row.original_currency_code,
            revision_row.fx_rate_to_eur,
            revision_row.fx_rate_at,
            revision_row.fx_rate_source,
            revision_row.source_reference_type,
            revision_row.source_reference_id,
            revision_row.is_active,
            revision_row.reason,
            revision_row.created_at
          from public.repair_order_line_cost_revisions as revision_row
          where revision_row.store_id = p_store_id
            and revision_row.order_id = p_order_id
          order by revision_row.created_at desc
          limit 200
        ) as history_row
      ), '[]'::jsonb)
    )
  end;
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
  v_now timestamptz := clock_timestamp();
  v_role public.staff_role;
  v_user_id uuid;
  v_actions text[];
  v_before text[];
  v_actor_email text;
  v_actor_name text;
begin
  select actor_profile.email,
         coalesce(actor_membership.display_name, actor_profile.display_name)
  into v_actor_email, v_actor_name
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
  limit 1;

  if p_actor_id is null or v_actor_email is null then
    raise exception 'actor_forbidden';
  end if;

  select membership.role, membership.user_id
  into v_role, v_user_id
  from public.store_memberships as membership
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
  ) as normalized;

  if exists (
    select 1
    from unnest(v_actions) as action
    where action not in (
      'supplier:read',
      'supplier:assign',
      'supplier:manage',
      'order:archive_browse',
      'finance:aggregate_read',
      'finance:profit_read',
      'finance:cost_manage',
      'finance:cost_export',
      'finance:cost_backfill_preview',
      'inventory:cost_allocate'
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
    'finance:cost_manage',
    'finance:cost_export',
    'finance:cost_backfill_preview',
    'inventory:cost_allocate'
  ]::text[] then
    raise exception 'role_cannot_receive_manager_grants';
  end if;

  if ('finance:cost_export' = any(v_actions)
      and not ('finance:profit_read' = any(v_actions)))
     or ('finance:cost_backfill_preview' = any(v_actions)
      and not ('finance:cost_manage' = any(v_actions)))
     or ('inventory:cost_allocate' = any(v_actions)
      and not ('finance:cost_manage' = any(v_actions))) then
    raise exception 'permission_dependency_missing';
  end if;

  select coalesce(array_agg(grant_row.action order by grant_row.action), array[]::text[])
  into v_before
  from public.store_member_permission_grants as grant_row
  where grant_row.store_id = p_store_id
    and grant_row.membership_id = p_membership_id
    and grant_row.revoked_at is null;

  update public.store_member_permission_grants
  set revoked_at = v_now, revoked_by = p_actor_id, updated_at = v_now
  where store_id = p_store_id
    and membership_id = p_membership_id
    and revoked_at is null;

  insert into public.store_member_permission_grants (
    store_id, membership_id, user_id, action, granted_by, created_at, updated_at
  )
  select
    p_store_id, p_membership_id, v_user_id, action, p_actor_id, v_now, v_now
  from unnest(v_actions) as action;

  update public.store_memberships
  set updated_at = v_now
  where id = p_membership_id
    and store_id = p_store_id;

  insert into public.audit_logs (
    id, actor_id, actor_email, actor_name, store_id,
    action, entity_type, entity_id, before_data, after_data, metadata, created_at
  ) values (
    gen_random_uuid()::text,
    p_actor_id,
    v_actor_email,
    coalesce(v_actor_name, 'unknown'),
    p_store_id,
    'update_member_permissions',
    'store_membership',
    p_membership_id::text,
    jsonb_build_object('permission_grants', to_jsonb(v_before)),
    jsonb_build_object('permission_grants', to_jsonb(v_actions)),
    jsonb_build_object('target_user_id', v_user_id),
    v_now
  );

  return jsonb_build_object('before', to_jsonb(v_before), 'after', to_jsonb(v_actions));
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

  perform pg_catalog.set_config('repairdesk.cost_actor_id', p_actor_id::text, true);

  delete from public.store_fault_cost_defaults as default_row
  where default_row.store_id = p_store_id
    and not exists (
      select 1
      from jsonb_array_elements(v_normalized) as desired(value)
      where desired.value ->> 'catalog_key' = default_row.catalog_key
    );

  insert into public.store_fault_cost_defaults (
    store_id, catalog_key, catalog_name, default_cost_amount, currency_code,
    revision, updated_by, created_at, updated_at
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

  perform pg_catalog.set_config('repairdesk.cost_actor_id', '', true);

  return jsonb_build_object(
    'ok', true,
    'code', 'updated',
    'version', v_next_version,
    'item_count', jsonb_array_length(v_normalized)
  );
end;
$$;

revoke all on function public.repairdesk_read_order_line_costs_rpc(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.repairdesk_read_order_line_costs_rpc(uuid, uuid, uuid)
  to service_role;

revoke all on function public.repairdesk_read_order_cost_history_rpc(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.repairdesk_read_order_cost_history_rpc(uuid, uuid, uuid)
  to service_role;

revoke all on function public.repairdesk_replace_member_permission_grants_rpc(
  uuid, uuid, text[], uuid
) from public, anon, authenticated, service_role;
grant execute on function public.repairdesk_replace_member_permission_grants_rpc(
  uuid, uuid, text[], uuid
) to service_role;

revoke all on function public.repairdesk_replace_store_fault_cost_defaults_rpc(
  uuid, uuid, bigint, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.repairdesk_replace_store_fault_cost_defaults_rpc(
  uuid, uuid, bigint, jsonb
) to service_role;

reset statement_timeout;
reset lock_timeout;

notify pgrst, 'reload schema';
