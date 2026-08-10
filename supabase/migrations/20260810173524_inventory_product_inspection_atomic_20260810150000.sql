-- Apple product inspection persistence (expand-only, dormant by default).
--
-- This migration is self-contained for the canonical inspection table.  It is
-- intentionally independent from the broader inventory lifecycle migration:
-- a later lifecycle migration may use CREATE IF NOT EXISTS and its identical
-- constraints/triggers will remain compatible with this narrow sequence.

set lock_timeout = '5s';
set statement_timeout = '2min';

do $$
declare
  v_missing text;
begin
  select string_agg(requirement, ', ' order by requirement)
    into v_missing
    from (
      select 'inventory product base tables' as requirement
       where to_regclass('public.inventory_items') is null
          or to_regclass('public.inventory_stock_units') is null
      union all
      select 'inventory product V2 create/update RPCs'
       where to_regprocedure('public.repairdesk_create_inventory_product_v2(uuid,uuid,jsonb)') is null
          or to_regprocedure('public.repairdesk_update_inventory_product_v1(uuid,uuid,jsonb)') is null
    ) missing;
  if v_missing is not null then
    raise exception using
      errcode = '55000',
      message = 'inventory product inspection schema preflight failed: ' || v_missing;
  end if;
end;
$$;

-- The three-column reference below makes the item/unit pairing a database
-- invariant rather than an application convention.  The identity migration
-- already guarantees one unit per (store, legacy item); this unique index is
-- the exact referenced key needed by the inspection table's composite FK.
create unique index if not exists inventory_stock_units_id_legacy_item_store_unique_idx
  on public.inventory_stock_units(id, legacy_inventory_item_id, store_id);

create unique index if not exists inventory_items_id_store_inspection_fk_idx
  on public.inventory_items(id, store_id);

create or replace function public.repairdesk_inventory_lifecycle_checks_valid(p_checks jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_pair record;
  v_count integer := 0;
begin
  if p_checks is null or pg_catalog.jsonb_typeof(p_checks) <> 'object'
     or pg_catalog.pg_column_size(p_checks) > 8192 then
    return false;
  end if;
  for v_pair in select * from pg_catalog.jsonb_each(p_checks) loop
    v_count := v_count + 1;
    if v_count > 32
       or pg_catalog.char_length(v_pair.key) > 64
       or pg_catalog.jsonb_typeof(v_pair.value) not in ('string', 'number', 'boolean', 'null')
       or pg_catalog.pg_column_size(v_pair.value) > 1024 then
      return false;
    end if;
  end loop;
  return true;
end;
$$;
revoke all on function public.repairdesk_inventory_lifecycle_checks_valid(jsonb)
  from public, anon, authenticated, service_role;

create table if not exists public.inventory_device_inspections (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  inventory_item_id uuid not null,
  stock_unit_id uuid not null,
  device_kind text not null,
  battery_health smallint,
  face_id_status text not null default 'not_tested',
  touch_id_status text not null default 'not_tested',
  true_tone_status text not null default 'not_tested',
  activation_lock_status text not null default 'not_tested',
  data_wipe_status text not null default 'not_tested',
  imei_status text not null default 'not_tested',
  checks jsonb not null default '{}'::jsonb,
  notes text,
  inspected_at timestamptz not null,
  inspected_by uuid not null,
  created_at timestamptz not null default now(),
  constraint inventory_device_inspections_store_fkey
    foreign key (store_id) references public.stores(id) on update cascade on delete restrict,
  constraint inventory_device_inspections_item_same_store_fkey
    foreign key (inventory_item_id, store_id)
    references public.inventory_items(id, store_id) on update cascade on delete restrict,
  constraint inventory_device_inspections_unit_same_store_fkey
    foreign key (stock_unit_id, store_id)
    references public.inventory_stock_units(id, store_id) on update cascade on delete restrict,
  constraint inventory_device_inspections_unit_item_same_store_fkey
    foreign key (stock_unit_id, inventory_item_id, store_id)
    references public.inventory_stock_units(id, legacy_inventory_item_id, store_id)
    on update cascade on delete restrict,
  constraint inventory_device_inspections_actor_fkey
    foreign key (inspected_by) references auth.users(id) on update cascade on delete restrict,
  constraint inventory_device_inspections_battery_check
    check (battery_health is null or battery_health between 0 and 100),
  constraint inventory_device_inspections_check_object
    check (jsonb_typeof(checks) = 'object'),
  constraint inventory_device_inspections_checks_bound
    check (public.repairdesk_inventory_lifecycle_checks_valid(checks)),
  constraint inventory_device_inspections_face_id_check
    check (face_id_status in ('not_tested', 'normal', 'abnormal', 'not_applicable')),
  constraint inventory_device_inspections_touch_id_check
    check (touch_id_status in ('not_tested', 'normal', 'abnormal', 'not_applicable')),
  constraint inventory_device_inspections_true_tone_check
    check (true_tone_status in ('not_tested', 'normal', 'abnormal', 'not_applicable')),
  constraint inventory_device_inspections_activation_check
    check (activation_lock_status in ('not_tested', 'normal', 'abnormal', 'not_applicable')),
  constraint inventory_device_inspections_wipe_check
    check (data_wipe_status in ('not_tested', 'normal', 'abnormal', 'not_applicable')),
  constraint inventory_device_inspections_imei_check
    check (imei_status in ('not_tested', 'normal', 'abnormal', 'not_applicable'))
);

-- A future lifecycle migration may have created this table first. CREATE IF
-- NOT EXISTS intentionally does not reconcile constraints, so add the
-- item/unit pairing invariant explicitly and idempotently for both lineages.
do $$
begin
  if not exists (
    select 1
      from pg_catalog.pg_constraint constraint_row
      join pg_catalog.pg_class table_row on table_row.oid = constraint_row.conrelid
      join pg_catalog.pg_namespace schema_row on schema_row.oid = table_row.relnamespace
     where schema_row.nspname = 'public'
       and table_row.relname = 'inventory_device_inspections'
       and constraint_row.conname = 'inventory_device_inspections_unit_item_same_store_fkey'
  ) then
    alter table public.inventory_device_inspections
      add constraint inventory_device_inspections_unit_item_same_store_fkey
      foreign key (stock_unit_id, inventory_item_id, store_id)
      references public.inventory_stock_units(id, legacy_inventory_item_id, store_id)
      on update cascade on delete restrict;
  end if;
end;
$$;

alter table public.inventory_device_inspections enable row level security;
revoke all on table public.inventory_device_inspections
  from public, anon, authenticated, service_role;

create or replace function public.repairdesk_inventory_lifecycle_append_only_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using errcode = '42501', message = 'inventory_lifecycle_append_only';
end;
$$;
revoke all on function public.repairdesk_inventory_lifecycle_append_only_guard()
  from public, anon, authenticated, service_role;

drop trigger if exists inventory_device_inspections_append_only on public.inventory_device_inspections;
create trigger inventory_device_inspections_append_only
before update or delete on public.inventory_device_inspections
for each row execute function public.repairdesk_inventory_lifecycle_append_only_guard();

create table if not exists public.inventory_product_inspection_command_ledger (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  idempotency_key uuid not null,
  request_hash char(32) not null,
  operation text not null,
  actor_id uuid not null,
  inventory_item_id uuid not null,
  stock_unit_id uuid not null,
  version_before bigint not null,
  version_after bigint not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  constraint inventory_product_inspection_ledger_store_fkey
    foreign key (store_id) references public.stores(id) on update cascade on delete restrict,
  constraint inventory_product_inspection_ledger_actor_fkey
    foreign key (actor_id) references auth.users(id) on update cascade on delete restrict,
  constraint inventory_product_inspection_ledger_item_same_store_fkey
    foreign key (inventory_item_id, store_id)
    references public.inventory_items(id, store_id) on update cascade on delete restrict,
  constraint inventory_product_inspection_ledger_unit_same_store_fkey
    foreign key (stock_unit_id, store_id)
    references public.inventory_stock_units(id, store_id) on update cascade on delete restrict,
  constraint inventory_product_inspection_ledger_operation_check
    check (operation in ('create', 'update')),
  constraint inventory_product_inspection_ledger_hash_check
    check (request_hash ~ '^[0-9a-f]{32}$'),
  constraint inventory_product_inspection_ledger_version_check
    check (version_before >= 0 and version_after = version_before + 1),
  constraint inventory_product_inspection_ledger_result_check
    check (jsonb_typeof(result) = 'object'),
  constraint inventory_product_inspection_ledger_idempotency_unique
  unique (store_id, idempotency_key)
);

drop trigger if exists inventory_product_inspection_ledger_append_only
  on public.inventory_product_inspection_command_ledger;
create trigger inventory_product_inspection_ledger_append_only
before update or delete on public.inventory_product_inspection_command_ledger
for each row execute function public.repairdesk_inventory_lifecycle_append_only_guard();

create index if not exists inventory_product_inspection_ledger_store_created_idx
  on public.inventory_product_inspection_command_ledger(store_id, created_at desc);

create index if not exists inventory_device_inspections_latest_unit_idx
  on public.inventory_device_inspections(
    store_id, stock_unit_id, inspected_at desc, created_at desc, id desc
  );

alter table public.inventory_product_inspection_command_ledger enable row level security;
revoke all on table public.inventory_product_inspection_command_ledger
  from public, anon, authenticated, service_role;

-- Service-role access is granted only by the paired enable migration after the
-- object/ACL/security preflight has passed.  Browser roles never receive ACLs.

create or replace function public.repairdesk_inventory_product_save_with_inspection_v1(
  p_store_id uuid,
  p_actor_id uuid,
  p_operation text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_operation text := pg_catalog.btrim(coalesce(p_operation, ''));
  v_payload jsonb := p_payload;
  v_inspection jsonb;
  v_product_payload jsonb;
  v_key uuid;
  v_request_hash char(32);
  v_existing public.inventory_product_inspection_command_ledger%rowtype;
  v_result jsonb;
  v_item_id uuid;
  v_unit_id uuid;
  v_unit_item_id uuid;
  v_version_after bigint;
  v_version_before bigint;
  v_expected_version bigint;
  v_result_version bigint;
  v_inspection_id uuid;
  v_actor_role text;
  v_actor_name text;
  v_battery smallint;
  v_battery_numeric numeric;
  v_face_id_status text;
  v_device_kind text;
  v_key_name text;
begin
  if p_store_id is null or p_actor_id is null
     or v_operation not in ('create', 'update')
     or v_payload is null
     or pg_catalog.jsonb_typeof(v_payload) is distinct from 'object'
     or not (v_payload ? 'inspection')
     or pg_catalog.pg_column_size(v_payload) > 12288 then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;

  v_inspection := v_payload -> 'inspection';
  v_product_payload := v_payload - 'inspection';
  if v_inspection is null
     or pg_catalog.jsonb_typeof(v_inspection) is distinct from 'object' then
    return jsonb_build_object('ok', false, 'code', 'invalid_inspection');
  end if;
  if (select count(*) from pg_catalog.jsonb_object_keys(v_inspection)) = 0 then
    return jsonb_build_object('ok', false, 'code', 'invalid_inspection');
  end if;

  begin
    v_key := (v_payload ->> 'idempotency_key')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_idempotency_key');
  end;
  if v_key is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_idempotency_key');
  end if;
  if v_operation = 'update' then
    begin
      v_expected_version := (v_product_payload ->> 'expected_version')::bigint;
    exception when others then
      return jsonb_build_object('ok', false, 'code', 'invalid_payload');
    end;
    if v_expected_version is null or v_expected_version < 1 then
      return jsonb_build_object('ok', false, 'code', 'invalid_payload');
    end if;
  end if;

  -- Validate the narrow Phase 1 payload at the transaction boundary.  The
  -- server catalog decides whether a field is supported; SQL still rejects
  -- unknown keys and malformed values so a forged client cannot widen it.
  for v_key_name in select key from pg_catalog.jsonb_object_keys(v_inspection) as key loop
    if v_key_name not in ('battery_health', 'face_id_status') then
      return jsonb_build_object('ok', false, 'code', 'unsupported_inspection_field');
    end if;
  end loop;
  if not (v_inspection ? 'battery_health' or v_inspection ? 'face_id_status') then
    return jsonb_build_object('ok', false, 'code', 'invalid_inspection');
  end if;
  if v_inspection ? 'battery_health' then
    if v_inspection -> 'battery_health' = 'null'::jsonb then
      -- Explicit null means the inspection was performed but the battery
      -- percentage was not measured (or was cleared). Keep the record.
      v_battery := null;
    elsif pg_catalog.jsonb_typeof(v_inspection -> 'battery_health') is distinct from 'number' then
      return jsonb_build_object('ok', false, 'code', 'invalid_battery_health');
    else
      -- jsonb_typeof is checked in its own branch before any cast. The
      -- nested block then makes malformed/overflowing JSON numbers fail
      -- closed without relying on SQL OR short-circuit evaluation.
      begin
        v_battery_numeric := (v_inspection ->> 'battery_health')::numeric;
      exception when others then
        return jsonb_build_object('ok', false, 'code', 'invalid_battery_health');
      end;
      if v_battery_numeric < 0
         or v_battery_numeric > 100
         or v_battery_numeric <> pg_catalog.trunc(v_battery_numeric) then
        return jsonb_build_object('ok', false, 'code', 'invalid_battery_health');
      end if;
      v_battery := v_battery_numeric::smallint;
    end if;
  end if;
  if v_inspection ? 'face_id_status' then
    v_face_id_status := v_inspection ->> 'face_id_status';
    if v_inspection -> 'face_id_status' = 'null'::jsonb
       or v_face_id_status is null
       or v_face_id_status not in ('not_tested', 'normal', 'abnormal', 'not_applicable') then
      return jsonb_build_object('ok', false, 'code', 'invalid_face_id_status');
    end if;
  else
    v_face_id_status := 'not_tested';
  end if;

  v_request_hash := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'command', 'inventory_product_save_with_inspection_v1',
    'operation', v_operation,
    'payload', v_payload
  )::text);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_store_id::text || ':inventory-product-inspection:' || v_key::text, 0
  ));

  -- Membership is checked before the ledger lookup so a replay cannot become
  -- an authorization oracle.  The underlying product RPC repeats its own
  -- role check before any product mutation.
  select membership.role::text,
         coalesce(membership.display_name, profile.display_name, 'Staff')
    into v_actor_role, v_actor_name
    from public.store_memberships membership
    join public.staff_profiles profile
      on profile.id = membership.user_id
     and profile.status::text = 'active'
    join public.stores store_row
      on store_row.id = membership.store_id
     and store_row.status::text = 'active'
   where membership.store_id = p_store_id
     and membership.user_id = p_actor_id
     and membership.status::text = 'active'
   limit 1;
  if v_actor_role is null or v_actor_role not in ('owner', 'manager', 'technician') then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;

  select ledger.* into v_existing
    from public.inventory_product_inspection_command_ledger ledger
   where ledger.store_id = p_store_id and ledger.idempotency_key = v_key;
  if found then
    if v_existing.actor_id <> p_actor_id then
      return jsonb_build_object('ok', false, 'code', 'idempotency_actor_conflict');
    end if;
    if v_existing.request_hash <> v_request_hash then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return v_existing.result || jsonb_build_object('code', 'idempotent_replay');
  end if;

  if v_operation = 'create' then
    v_result := public.repairdesk_create_inventory_product_v2(
      p_store_id, p_actor_id, v_product_payload
    );
    if coalesce((v_result ->> 'ok')::boolean, false) is not true then
      return v_result;
    end if;
    if v_result ->> 'code' = 'idempotent_replay' then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    v_item_id := nullif(v_result ->> 'id', '')::uuid;
    select unit.id, unit.version, unit.legacy_inventory_item_id
      into v_unit_id, v_version_after, v_unit_item_id
      from public.inventory_stock_units unit
     where unit.store_id = p_store_id
       and unit.id = nullif(v_result ->> 'stock_unit_id', '')::uuid
     for update;
    if v_item_id is null or v_unit_id is null or v_unit_item_id is distinct from v_item_id
       or v_version_after is distinct from 1 then
      raise exception using
        errcode = 'P0001',
        message = 'inventory_product_inspection_create_postcondition_failed';
    end if;
    v_version_before := 0;
  else
    v_result := public.repairdesk_update_inventory_product_v1(
      p_store_id, p_actor_id, v_product_payload
    );
    if coalesce((v_result ->> 'ok')::boolean, false) is not true then
      return v_result;
    end if;
    if v_result ->> 'code' = 'idempotent_replay' then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    v_item_id := nullif(v_result ->> 'id', '')::uuid;
    select unit.id, unit.version
      into v_unit_id, v_version_after
      from public.inventory_stock_units unit
     where unit.store_id = p_store_id
       and unit.legacy_inventory_item_id = v_item_id
       for update;
    v_result_version := nullif(v_result ->> 'version', '')::bigint;
    select unit.legacy_inventory_item_id
      into v_unit_item_id
      from public.inventory_stock_units unit
     where unit.store_id = p_store_id and unit.id = v_unit_id;
    if v_item_id is null or v_unit_id is null or v_unit_item_id is distinct from v_item_id
       or v_version_after is null
       or v_result_version is distinct from v_version_after
       or v_expected_version is distinct from v_version_after - 1 then
      raise exception using
        errcode = 'P0001',
        message = 'inventory_product_inspection_update_postcondition_failed';
    end if;
    v_version_before := v_expected_version;
  end if;

  if v_item_id is null or v_unit_id is null or v_version_before < 0
     or v_version_after <> v_version_before + 1 then
    raise exception using
      errcode = 'P0001',
      message = 'inventory_product_inspection_version_postcondition_failed';
  end if;

  select item.category into v_device_kind
    from public.inventory_items item
   where item.store_id = p_store_id and item.id = v_item_id;
  if v_device_kind is null then
    raise exception using
      errcode = 'P0001',
      message = 'inventory_product_inspection_device_kind_postcondition_failed';
  end if;

  insert into public.inventory_device_inspections (
    store_id, inventory_item_id, stock_unit_id, device_kind, battery_health,
    face_id_status, touch_id_status, true_tone_status, activation_lock_status,
    data_wipe_status, imei_status, checks, notes, inspected_at, inspected_by
  ) values (
    p_store_id, v_item_id, v_unit_id, v_device_kind, v_battery,
    v_face_id_status, 'not_applicable', 'not_applicable', 'not_tested',
    'not_tested', 'not_tested', '{}'::jsonb, null,
    v_now, p_actor_id
  ) returning id into v_inspection_id;

  v_result := v_result || jsonb_build_object('inspection_id', v_inspection_id);
  insert into public.inventory_product_inspection_command_ledger (
    store_id, idempotency_key, request_hash, operation, actor_id,
    inventory_item_id, stock_unit_id, version_before, version_after, result, created_at
  ) values (
    p_store_id, v_key, v_request_hash, v_operation, p_actor_id,
    v_item_id, v_unit_id, v_version_before, v_version_after, v_result, v_now
  );
  insert into public.audit_logs (
    id, actor_id, actor_name, store_id, action, entity_type, entity_id, metadata, created_at
  ) values (
    gen_random_uuid()::text, p_actor_id, coalesce(v_actor_name, 'Staff'), p_store_id,
    'inventory_product_inspection_' || v_operation, 'inventory_product', v_item_id::text,
    jsonb_build_object(
      'inspection_id', v_inspection_id,
      'idempotency_key', v_key::text,
      'version_before', v_version_before,
      'version_after', v_version_after,
      'battery_health_present', v_inspection ? 'battery_health',
      'face_id_status', v_face_id_status
    ), v_now
  );
  return v_result;
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'duplicate_identifier');
end;
$$;

alter function public.repairdesk_inventory_product_save_with_inspection_v1(uuid, uuid, text, jsonb)
  owner to postgres;
revoke all on function public.repairdesk_inventory_product_save_with_inspection_v1(uuid, uuid, text, jsonb)
  from public, anon, authenticated, service_role;

comment on table public.inventory_product_inspection_command_ledger
  is 'Append-only idempotency ledger for atomic product + Phase 1 device inspection saves.';
comment on function public.repairdesk_inventory_product_save_with_inspection_v1(uuid, uuid, text, jsonb)
  is 'Dormant service-role-only atomic product create/update plus append-only Phase 1 inspection.';

reset lock_timeout;
reset statement_timeout;
