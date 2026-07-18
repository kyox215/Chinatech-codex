-- Owner-managed, offline FX rates for internal procurement costs.
-- Customer quotes and all reporting base amounts remain EUR.

set lock_timeout = '5s';
set statement_timeout = '60s';

create table public.store_cost_currency_configs (
  store_id uuid primary key references public.stores(id) on update cascade on delete cascade,
  revision bigint not null default 1,
  updated_by uuid references auth.users(id) on update cascade on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint store_cost_currency_configs_revision_check check (revision >= 1)
);

create table public.store_cost_currency_rates (
  store_id uuid not null references public.store_cost_currency_configs(store_id)
    on update cascade on delete cascade,
  currency_code text not null,
  enabled boolean not null,
  rate_to_eur numeric(20, 10),
  rate_at timestamptz,
  rate_source text,
  revision bigint not null,
  updated_by uuid references auth.users(id) on update cascade on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (store_id, currency_code),
  constraint store_cost_currency_rates_code_check
    check (currency_code in ('EUR', 'USD', 'GBP', 'CNY', 'CHF')),
  constraint store_cost_currency_rates_revision_check check (revision >= 1),
  constraint store_cost_currency_rates_value_check check (
    (
      currency_code = 'EUR'
      and enabled
      and rate_to_eur = 1
      and rate_at is not null
      and rate_source = 'store_base'
    )
    or (
      currency_code <> 'EUR'
      and not enabled
      and rate_to_eur is null
      and rate_at is null
      and rate_source is null
    )
    or (
      currency_code <> 'EUR'
      and enabled
      and rate_to_eur > 0
      and rate_to_eur <= 1000000
      and rate_to_eur = round(rate_to_eur, 10)
      and rate_at is not null
      and rate_source = 'owner_manual'
    )
  )
);

create index store_cost_currency_rates_enabled_idx
  on public.store_cost_currency_rates (store_id, enabled, currency_code);

create table public.store_cost_currency_rate_revisions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on update cascade on delete cascade,
  currency_code text not null,
  config_revision bigint not null,
  enabled boolean not null,
  rate_to_eur numeric(20, 10),
  rate_at timestamptz,
  rate_source text,
  change_kind text not null,
  actor_id uuid references auth.users(id) on update cascade on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  constraint store_cost_currency_rate_revisions_code_check
    check (currency_code in ('EUR', 'USD', 'GBP', 'CNY', 'CHF')),
  constraint store_cost_currency_rate_revisions_revision_check check (config_revision >= 1),
  constraint store_cost_currency_rate_revisions_kind_check
    check (change_kind in ('migration_snapshot', 'enabled', 'rate_changed', 'disabled')),
  constraint store_cost_currency_rate_revisions_value_check check (
    (not enabled and rate_to_eur is null and rate_at is null and rate_source is null)
    or (
      enabled and rate_to_eur > 0 and rate_to_eur <= 1000000
      and rate_to_eur = round(rate_to_eur, 10)
      and rate_at is not null and rate_source in ('store_base', 'owner_manual')
    )
  )
);

create index store_cost_currency_rate_revisions_store_idx
  on public.store_cost_currency_rate_revisions
  (store_id, currency_code, config_revision desc, created_at desc);

alter table public.store_cost_currency_configs enable row level security;
alter table public.store_cost_currency_rates enable row level security;
alter table public.store_cost_currency_rate_revisions enable row level security;
revoke all on table public.store_cost_currency_configs
  from public, anon, authenticated, service_role;
revoke all on table public.store_cost_currency_rates
  from public, anon, authenticated, service_role;
revoke all on table public.store_cost_currency_rate_revisions
  from public, anon, authenticated, service_role;
grant select on table public.store_cost_currency_configs to service_role;
grant select on table public.store_cost_currency_rates to service_role;
grant select on table public.store_cost_currency_rate_revisions to service_role;

insert into public.store_cost_currency_configs (store_id)
select id from public.stores
on conflict (store_id) do nothing;

insert into public.store_cost_currency_rates (
  store_id, currency_code, enabled, rate_to_eur, rate_at, rate_source, revision
)
select
  config.store_id,
  code.currency_code,
  code.currency_code = 'EUR',
  case when code.currency_code = 'EUR' then 1 else null end,
  case when code.currency_code = 'EUR' then clock_timestamp() else null end,
  case when code.currency_code = 'EUR' then 'store_base' else null end,
  config.revision
from public.store_cost_currency_configs as config
cross join (values ('EUR'), ('USD'), ('GBP'), ('CNY'), ('CHF')) as code(currency_code)
on conflict (store_id, currency_code) do nothing;

insert into public.store_cost_currency_rate_revisions (
  store_id, currency_code, config_revision, enabled, rate_to_eur,
  rate_at, rate_source, change_kind
)
select
  store_id, currency_code, revision, enabled, rate_to_eur,
  rate_at, rate_source, 'migration_snapshot'
from public.store_cost_currency_rates;

create or replace function public.repairdesk_initialize_cost_currency_config()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.store_cost_currency_configs (store_id) values (new.id)
  on conflict (store_id) do nothing;
  insert into public.store_cost_currency_rates (
    store_id, currency_code, enabled, rate_to_eur, rate_at, rate_source, revision
  )
  select
    new.id, code.currency_code, code.currency_code = 'EUR',
    case when code.currency_code = 'EUR' then 1 else null end,
    case when code.currency_code = 'EUR' then clock_timestamp() else null end,
    case when code.currency_code = 'EUR' then 'store_base' else null end,
    1
  from (values ('EUR'), ('USD'), ('GBP'), ('CNY'), ('CHF')) as code(currency_code)
  on conflict (store_id, currency_code) do nothing;
  insert into public.store_cost_currency_rate_revisions (
    store_id, currency_code, config_revision, enabled, rate_to_eur,
    rate_at, rate_source, change_kind
  )
  select
    rate.store_id, rate.currency_code, rate.revision, rate.enabled, rate.rate_to_eur,
    rate.rate_at, rate.rate_source, 'migration_snapshot'
  from public.store_cost_currency_rates as rate
  where rate.store_id = new.id
    and not exists (
      select 1 from public.store_cost_currency_rate_revisions as revision
      where revision.store_id = rate.store_id
        and revision.currency_code = rate.currency_code
    );
  return new;
end;
$$;

revoke all on function public.repairdesk_initialize_cost_currency_config()
  from public, anon, authenticated, service_role;
create trigger repairdesk_initialize_cost_currency_config_trigger
after insert on public.stores
for each row execute function public.repairdesk_initialize_cost_currency_config();

create or replace function public.repairdesk_guard_cost_currency_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_catalog.current_setting('repairdesk.currency_rate_write', true) <> '1' then
    raise exception 'cost_currency_mutation_requires_rpc' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.repairdesk_guard_cost_currency_mutation()
  from public, anon, authenticated, service_role;
create trigger repairdesk_guard_cost_currency_config_trigger
before update or delete on public.store_cost_currency_configs
for each row execute function public.repairdesk_guard_cost_currency_mutation();
create trigger repairdesk_guard_cost_currency_rate_trigger
before update or delete on public.store_cost_currency_rates
for each row execute function public.repairdesk_guard_cost_currency_mutation();
create trigger repairdesk_guard_cost_currency_revision_trigger
before update or delete on public.store_cost_currency_rate_revisions
for each row execute function public.repairdesk_guard_cost_currency_mutation();

create or replace function public.repairdesk_read_cost_currency_settings_rpc(
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
    when not public.repairdesk_actor_has_phase2_cost_permission(
      p_store_id, p_actor_id, 'finance:currency_manage'
    ) then jsonb_build_object('ok', false, 'code', 'actor_forbidden')
    else jsonb_build_object(
      'ok', true,
      'code', 'read',
      'version', coalesce((
        select config.revision from public.store_cost_currency_configs as config
        where config.store_id = p_store_id
      ), 0),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'currency_code', rate.currency_code,
          'enabled', rate.enabled,
          'rate_to_eur', rate.rate_to_eur,
          'rate_at', rate.rate_at,
          'rate_source', rate.rate_source,
          'revision', rate.revision,
          'stale', rate.enabled and rate.currency_code <> 'EUR'
            and rate.rate_at < statement_timestamp() - interval '30 days'
        ) order by array_position(array['EUR','USD','GBP','CNY','CHF'], rate.currency_code))
        from public.store_cost_currency_rates as rate
        where rate.store_id = p_store_id
      ), '[]'::jsonb)
    )
  end;
$$;

create or replace function public.repairdesk_read_cost_currency_options_rpc(
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
    when not (
      public.repairdesk_actor_has_phase2_cost_permission(
        p_store_id, p_actor_id, 'finance:currency_manage'
      )
      or public.repairdesk_actor_has_phase2_cost_permission(
        p_store_id, p_actor_id, 'finance:cost_manage'
      )
      or public.repairdesk_actor_has_phase2_cost_permission(
        p_store_id, p_actor_id, 'inventory:cost_allocate'
      )
    ) then jsonb_build_object('ok', false, 'code', 'actor_forbidden')
    else jsonb_build_object(
      'ok', true,
      'code', 'read',
      'version', coalesce((
        select config.revision from public.store_cost_currency_configs as config
        where config.store_id = p_store_id
      ), 0),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'currency_code', rate.currency_code,
          'enabled', rate.enabled,
          'rate_to_eur', rate.rate_to_eur,
          'rate_at', rate.rate_at,
          'rate_source', rate.rate_source,
          'revision', rate.revision,
          'stale', rate.enabled and rate.currency_code <> 'EUR'
            and rate.rate_at < statement_timestamp() - interval '30 days'
        ) order by array_position(array['EUR','USD','GBP','CNY','CHF'], rate.currency_code))
        from public.store_cost_currency_rates as rate
        where rate.store_id = p_store_id and rate.enabled
      ), '[]'::jsonb)
    )
  end;
$$;

create or replace function public.repairdesk_replace_cost_currency_settings_rpc(
  p_store_id uuid,
  p_actor_id uuid,
  p_expected_version bigint,
  p_items jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_config public.store_cost_currency_configs%rowtype;
  v_code text;
  v_item jsonb;
  v_enabled boolean;
  -- Keep full input precision until validation; assigning directly to a
  -- numeric(20,10) variable would silently round and defeat the precision gate.
  v_rate numeric;
  v_rate_at timestamptz;
  v_existing public.store_cost_currency_rates%rowtype;
  v_next_version bigint;
  v_changed integer := 0;
  v_enabled_count integer := 0;
  v_kind text;
begin
  if not public.repairdesk_actor_has_phase2_cost_permission(
    p_store_id, p_actor_id, 'finance:currency_manage'
  ) then return jsonb_build_object('ok', false, 'code', 'actor_forbidden'); end if;
  if p_actor_id is null or p_expected_version is null or p_expected_version < 1
     or jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) <> 5
     or exists (
       select 1 from jsonb_array_elements(p_items) as item
       where item ->> 'currency_code' not in ('EUR', 'USD', 'GBP', 'CNY', 'CHF')
     )
     or (
       select count(distinct item ->> 'currency_code')
       from jsonb_array_elements(p_items) as item
     ) <> 5 then
    return jsonb_build_object('ok', false, 'code', 'invalid_currency_settings');
  end if;

  select * into v_config from public.store_cost_currency_configs
  where store_id = p_store_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'store_not_found'); end if;
  if v_config.revision <> p_expected_version then
    return jsonb_build_object('ok', false, 'code', 'version_conflict',
      'current_version', v_config.revision);
  end if;
  v_next_version := v_config.revision + 1;

  for v_code in select unnest(array['EUR','USD','GBP','CNY','CHF'])
  loop
    select item.value into v_item
    from jsonb_array_elements(p_items) as item(value)
    where item.value ->> 'currency_code' = v_code;
    begin
      if jsonb_typeof(v_item -> 'enabled') <> 'boolean' then
        raise invalid_parameter_value;
      end if;
      v_enabled := (v_item ->> 'enabled')::boolean;
      v_rate := nullif(v_item ->> 'rate_to_eur', '')::numeric;
      v_rate_at := nullif(v_item ->> 'rate_at', '')::timestamptz;
    exception when others then
      return jsonb_build_object('ok', false, 'code', 'invalid_currency_settings');
    end;

    if v_code = 'EUR' then
      if not v_enabled or v_rate is distinct from 1 or v_rate_at is null then
        return jsonb_build_object('ok', false, 'code', 'eur_rate_must_be_one');
      end if;
    elsif v_enabled then
      if v_rate is null or v_rate <= 0 or v_rate > 1000000
         or v_rate <> round(v_rate, 10) or v_rate_at is null
         or v_rate_at > clock_timestamp() + interval '5 minutes' then
        return jsonb_build_object('ok', false, 'code', 'invalid_currency_rate',
          'currency_code', v_code);
      end if;
      v_enabled_count := v_enabled_count + 1;
    elsif v_rate is not null or v_rate_at is not null then
      return jsonb_build_object('ok', false, 'code', 'disabled_currency_has_rate',
        'currency_code', v_code);
    end if;

    select * into v_existing from public.store_cost_currency_rates
    where store_id = p_store_id and currency_code = v_code;
    if v_existing.enabled is distinct from v_enabled
       or v_existing.rate_to_eur is distinct from v_rate
       or v_existing.rate_at is distinct from v_rate_at then
      v_changed := v_changed + 1;
      v_kind := case
        when not v_enabled then 'disabled'
        when not v_existing.enabled then 'enabled'
        else 'rate_changed'
      end;
      perform pg_catalog.set_config('repairdesk.currency_rate_write', '1', true);
      update public.store_cost_currency_rates
      set enabled = v_enabled,
          rate_to_eur = v_rate,
          rate_at = v_rate_at,
          rate_source = case when v_code = 'EUR' then 'store_base'
            when v_enabled then 'owner_manual' else null end,
          revision = v_next_version,
          updated_by = p_actor_id,
          updated_at = clock_timestamp()
      where store_id = p_store_id and currency_code = v_code;
      insert into public.store_cost_currency_rate_revisions (
        store_id, currency_code, config_revision, enabled, rate_to_eur,
        rate_at, rate_source, change_kind, actor_id
      ) values (
        p_store_id, v_code, v_next_version, v_enabled, v_rate, v_rate_at,
        case when v_code = 'EUR' then 'store_base'
          when v_enabled then 'owner_manual' else null end,
        v_kind, p_actor_id
      );
    end if;
  end loop;

  if v_changed > 0 then
    perform pg_catalog.set_config('repairdesk.currency_rate_write', '1', true);
    update public.store_cost_currency_configs
    set revision = v_next_version, updated_by = p_actor_id, updated_at = clock_timestamp()
    where store_id = p_store_id;
    insert into public.audit_logs (
      id, actor_id, actor_name, store_id, action, entity_type, entity_id, metadata
    ) values (
      gen_random_uuid()::text, p_actor_id, 'staff', p_store_id, 'updated',
      'cost_currency_settings', p_store_id::text,
      jsonb_build_object('version', v_next_version, 'changed_currency_count', v_changed,
        'enabled_non_eur_count', v_enabled_count)
    );
  else
    v_next_version := v_config.revision;
  end if;

  return jsonb_build_object('ok', true,
    'code', case when v_changed = 0 then 'no_change' else 'updated' end,
    'version', v_next_version, 'changed_currency_count', v_changed);
end;
$$;

alter table public.parts_purchase_lots
  add column fx_rate_revision bigint;
alter table public.parts_purchase_lots
  add constraint parts_purchase_lots_fx_revision_check
  check (fx_rate_revision is null or fx_rate_revision >= 1) not valid;
alter table public.parts_purchase_lots
  validate constraint parts_purchase_lots_fx_revision_check;
alter table public.parts_purchase_lots
  add constraint parts_purchase_lots_cost_currency_check
  check (original_currency_code in ('EUR', 'USD', 'GBP', 'CNY', 'CHF')) not valid;
alter table public.parts_purchase_lots
  validate constraint parts_purchase_lots_cost_currency_check;

create or replace function public.repairdesk_receive_part_lot_v2_rpc(
  p_store_id uuid,
  p_actor_id uuid,
  p_part_item_id uuid,
  p_supplier_id uuid,
  p_lot_code text,
  p_supplier_document_ref text,
  p_quantity integer,
  p_original_unit_cost numeric,
  p_original_currency_code text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_existing public.parts_purchase_lots%rowtype;
  v_rate public.store_cost_currency_rates%rowtype;
  v_cost_eur numeric(12, 2);
  v_now timestamptz := clock_timestamp();
begin
  if not public.repairdesk_actor_has_phase2_cost_permission(
    p_store_id, p_actor_id, 'inventory:cost_allocate'
  ) then return jsonb_build_object('ok', false, 'code', 'actor_forbidden'); end if;
  if p_idempotency_key is null or p_part_item_id is null
     or p_quantity not between 1 and 1000000
     or p_original_unit_cost is null or p_original_unit_cost < 0
     or p_original_unit_cost > 999999999999.999999
     or p_original_unit_cost <> round(p_original_unit_cost, 6)
     or p_original_currency_code not in ('EUR', 'USD', 'GBP', 'CNY', 'CHF')
     or char_length(btrim(coalesce(p_lot_code, ''))) not between 1 and 100 then
    return jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;

  select * into v_existing from public.parts_purchase_lots
  where store_id = p_store_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.part_item_id <> p_part_item_id
       or v_existing.supplier_id is distinct from p_supplier_id
       or v_existing.lot_code <> btrim(p_lot_code)
       or v_existing.received_quantity <> p_quantity
       or v_existing.original_unit_cost <> round(p_original_unit_cost, 6)
       or v_existing.original_currency_code <> p_original_currency_code then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return jsonb_build_object(
      'ok', true, 'code', 'idempotent_replay', 'id', v_existing.id,
      'unit_cost_eur', v_existing.unit_cost_eur,
      'fx_rate_to_eur', v_existing.fx_rate_to_eur,
      'fx_rate_at', v_existing.fx_rate_at,
      'fx_rate_source', v_existing.fx_rate_source,
      'fx_rate_revision', v_existing.fx_rate_revision
    );
  end if;

  if not exists (
    select 1 from public.parts_catalog_items
    where id = p_part_item_id and store_id = p_store_id and active
  ) then return jsonb_build_object('ok', false, 'code', 'part_not_found'); end if;
  if p_supplier_id is not null and not exists (
    select 1 from public.suppliers
    where id = p_supplier_id and store_id = p_store_id and archived_at is null
  ) then return jsonb_build_object('ok', false, 'code', 'supplier_not_found'); end if;

  select * into v_rate from public.store_cost_currency_rates
  where store_id = p_store_id and currency_code = p_original_currency_code
  for share;
  if not found or not v_rate.enabled then
    return jsonb_build_object('ok', false, 'code', 'currency_not_approved');
  end if;
  if v_rate.rate_to_eur is null or v_rate.rate_at is null then
    return jsonb_build_object('ok', false, 'code', 'currency_rate_missing');
  end if;
  if p_original_currency_code <> 'EUR'
     and v_rate.rate_at < v_now - interval '30 days' then
    return jsonb_build_object('ok', false, 'code', 'currency_rate_stale',
      'rate_at', v_rate.rate_at);
  end if;
  v_cost_eur := round(p_original_unit_cost * v_rate.rate_to_eur, 2);
  if v_cost_eur > 999999.99 then
    return jsonb_build_object('ok', false, 'code', 'eur_snapshot_out_of_range');
  end if;

  insert into public.parts_purchase_lots (
    store_id, part_item_id, supplier_id, lot_code, supplier_document_ref,
    received_quantity, available_quantity, original_unit_cost, original_currency_code,
    fx_rate_to_eur, fx_rate_at, fx_rate_source, fx_rate_revision,
    unit_cost_eur, evidence_status, received_at, idempotency_key, created_by
  ) values (
    p_store_id, p_part_item_id, p_supplier_id, btrim(p_lot_code),
    nullif(btrim(p_supplier_document_ref), ''), p_quantity, p_quantity,
    round(p_original_unit_cost, 6), p_original_currency_code,
    v_rate.rate_to_eur, v_rate.rate_at, v_rate.rate_source, v_rate.revision,
    v_cost_eur, 'confirmed', v_now, p_idempotency_key, p_actor_id
  ) returning id into v_id;

  insert into public.part_stock_movements (
    store_id, lot_id, movement_type, quantity_delta, unit_cost_eur_snapshot,
    idempotency_key, reason, actor_id
  ) values (
    p_store_id, v_id, 'receipt', p_quantity, v_cost_eur,
    p_idempotency_key, 'purchase_receipt', p_actor_id
  );
  insert into public.audit_logs (
    id, actor_id, actor_name, store_id, action, entity_type, entity_id, metadata
  ) values (
    gen_random_uuid()::text, p_actor_id, 'staff', p_store_id, 'received',
    'parts_purchase_lot', v_id::text,
    jsonb_build_object('part_item_id', p_part_item_id, 'quantity', p_quantity,
      'supplier_id', p_supplier_id, 'currency_code', p_original_currency_code,
      'fx_rate_revision', v_rate.revision)
  );
  return jsonb_build_object(
    'ok', true, 'code', 'received', 'id', v_id,
    'unit_cost_eur', v_cost_eur,
    'fx_rate_to_eur', v_rate.rate_to_eur,
    'fx_rate_at', v_rate.rate_at,
    'fx_rate_source', v_rate.rate_source,
    'fx_rate_revision', v_rate.revision
  );
end;
$$;

-- Keep the Phase 1/feature-off receipt contract available, but restrict it to
-- the EUR base currency. Non-EUR receipts must use the authoritative v2 RPC so
-- a caller cannot inject an arbitrary conversion rate.
create or replace function public.repairdesk_receive_part_lot_rpc(
  p_store_id uuid,
  p_actor_id uuid,
  p_part_item_id uuid,
  p_supplier_id uuid,
  p_lot_code text,
  p_supplier_document_ref text,
  p_quantity integer,
  p_original_unit_cost numeric,
  p_original_currency_code text,
  p_fx_rate_to_eur numeric,
  p_fx_rate_at timestamptz,
  p_fx_rate_source text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_original_currency_code is distinct from 'EUR'
     or p_fx_rate_to_eur is distinct from 1
     or p_fx_rate_source is distinct from 'store_base'
     or p_fx_rate_at is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;
  return public.repairdesk_receive_part_lot_v2_rpc(
    p_store_id,
    p_actor_id,
    p_part_item_id,
    p_supplier_id,
    p_lot_code,
    p_supplier_document_ref,
    p_quantity,
    p_original_unit_cost,
    'EUR',
    p_idempotency_key
  );
end;
$$;

create or replace function public.repairdesk_read_profit_currency_drilldown_rpc(
  p_store_id uuid,
  p_actor_id uuid,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_timezone text;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_row_count integer;
  v_items jsonb;
begin
  if not public.repairdesk_actor_has_phase2_cost_permission(
    p_store_id, p_actor_id, 'finance:profit_read'
  ) then return jsonb_build_object('ok', false, 'code', 'actor_forbidden'); end if;
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date
     or p_end_date - p_start_date > 366 then
    return jsonb_build_object('ok', false, 'code', 'invalid_date_range');
  end if;
  select coalesce(nullif(btrim(store_row.timezone), ''), 'Europe/Rome')
  into v_timezone
  from public.stores as store_row
  where store_row.id = p_store_id and store_row.status::text = 'active';
  if v_timezone is null then
    return jsonb_build_object('ok', false, 'code', 'store_not_found');
  end if;
  v_start_at := p_start_date::timestamp at time zone v_timezone;
  v_end_at := (p_end_date + 1)::timestamp at time zone v_timezone;

  with cost_rows as (
    select
      order_row.id as order_id,
      cost_row.line_id,
      coalesce(nullif(line.value ->> 'name', ''), '未命名维修项目') as line_name,
      cost_row.cost_amount::numeric(14, 2) as cost_amount_eur,
      cost_row.original_amount,
      cost_row.original_currency_code,
      cost_row.fx_rate_to_eur,
      cost_row.fx_rate_at,
      cost_row.fx_rate_source,
      cost_row.source as cost_source,
      cost_row.evidence_status
    from public.repair_orders as order_row
    join public.repair_order_line_costs as cost_row
      on cost_row.store_id = order_row.store_id
     and cost_row.order_id = order_row.id
     and cost_row.is_active
    left join lateral jsonb_array_elements(order_row.fault_prices) as line(value)
      on line.value ->> 'line_id' = cost_row.line_id::text
    where order_row.store_id = p_store_id
      and order_row.record_state::text = 'active'
      and order_row.deleted_at is null
      and order_row.status::text <> 'cancelled'
      and coalesce(order_row.exception_status::text, '') <> 'cancelled'
      and order_row.created_at >= v_start_at
      and order_row.created_at < v_end_at
      and cost_row.original_amount is not null
      and cost_row.original_currency_code is not null
      and cost_row.fx_rate_to_eur is not null
    order by order_row.created_at desc, order_row.id, cost_row.line_id
    limit 5001
  )
  select count(*)::integer,
    coalesce(jsonb_agg(to_jsonb(cost_rows) order by order_id, line_id), '[]'::jsonb)
  into v_row_count, v_items
  from cost_rows;

  return jsonb_build_object(
    'ok', true,
    'code', 'read',
    'row_count', least(v_row_count, 5000),
    'overflow', v_row_count > 5000,
    'items', case when v_row_count > 5000 then '[]'::jsonb else v_items end
  );
end;
$$;

revoke all on function public.repairdesk_read_cost_currency_settings_rpc(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.repairdesk_read_cost_currency_options_rpc(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.repairdesk_replace_cost_currency_settings_rpc(uuid, uuid, bigint, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.repairdesk_receive_part_lot_v2_rpc(
  uuid, uuid, uuid, uuid, text, text, integer, numeric, text, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.repairdesk_receive_part_lot_rpc(
  uuid, uuid, uuid, uuid, text, text, integer, numeric, text, numeric, timestamptz, text, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.repairdesk_read_profit_currency_drilldown_rpc(
  uuid, uuid, date, date
) from public, anon, authenticated, service_role;
grant execute on function public.repairdesk_read_cost_currency_settings_rpc(uuid, uuid)
  to service_role;
grant execute on function public.repairdesk_read_cost_currency_options_rpc(uuid, uuid)
  to service_role;
grant execute on function public.repairdesk_replace_cost_currency_settings_rpc(uuid, uuid, bigint, jsonb)
  to service_role;
grant execute on function public.repairdesk_receive_part_lot_v2_rpc(
  uuid, uuid, uuid, uuid, text, text, integer, numeric, text, uuid
) to service_role;
grant execute on function public.repairdesk_receive_part_lot_rpc(
  uuid, uuid, uuid, uuid, text, text, integer, numeric, text, numeric, timestamptz, text, uuid
) to service_role;
grant execute on function public.repairdesk_read_profit_currency_drilldown_rpc(
  uuid, uuid, date, date
) to service_role;

reset statement_timeout;
reset lock_timeout;

notify pgrst, 'reload schema';
