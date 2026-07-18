begin;

set local role service_role;

do $$
declare
  v_store_id uuid;
  v_actor_id uuid;
  intake_key uuid := gen_random_uuid();
  duplicate_key uuid := gen_random_uuid();
  sale_key uuid := gen_random_uuid();
  created_at timestamptz := clock_timestamp();
  sold_at timestamptz;
  ready_version timestamptz;
  serial_value text := 'RD-ROLLBACK-' || replace(gen_random_uuid()::text, '-', '');
  identifiers jsonb;
  intake_result jsonb;
  replay_result jsonb;
  duplicate_result jsonb;
  sale_result jsonb;
  sale_replay_result jsonb;
  sale_conflict_result jsonb;
  v_item_id uuid;
  row_total bigint;
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

  identifiers := jsonb_build_array(jsonb_build_object(
    'kind', 'serial',
    'value', serial_value,
    'source', 'manual',
    'primary', true
  ));

  intake_result := public.repairdesk_create_inventory_unit_v2(
    v_store_id,
    v_actor_id,
    intake_key,
    'manual_stock',
    null::uuid,
    null::uuid,
    'Recovery drill',
    'RepairDesk',
    'Inventory V2 rollback canary',
    null,
    null,
    null,
    identifiers,
    0::numeric,
    1::numeric,
    0,
    'Rollback-only',
    'Inventory V2 recovery drill rollback',
    'unstandardized',
    created_at
  );

  if intake_result ->> 'code' <> 'created' then
    raise exception 'Unexpected intake result: %', intake_result ->> 'code';
  end if;
  v_item_id := (intake_result ->> 'item_id')::uuid;

  replay_result := public.repairdesk_create_inventory_unit_v2(
    v_store_id,
    v_actor_id,
    intake_key,
    'manual_stock',
    null::uuid,
    null::uuid,
    'Recovery drill',
    'RepairDesk',
    'Inventory V2 rollback canary',
    null,
    null,
    null,
    identifiers,
    0::numeric,
    1::numeric,
    0,
    'Rollback-only',
    'Inventory V2 recovery drill rollback',
    'unstandardized',
    created_at
  );

  if replay_result ->> 'code' <> 'idempotent_replay'
     or replay_result ->> 'item_id' <> v_item_id::text then
    raise exception 'Intake idempotency replay failed';
  end if;

  duplicate_result := public.repairdesk_create_inventory_unit_v2(
    v_store_id,
    v_actor_id,
    duplicate_key,
    'manual_stock',
    null::uuid,
    null::uuid,
    'Recovery drill',
    'RepairDesk',
    'Duplicate identifier canary',
    null,
    null,
    null,
    identifiers,
    0::numeric,
    1::numeric,
    0,
    'Rollback-only',
    'Inventory V2 recovery drill rollback',
    'unstandardized',
    created_at
  );

  if duplicate_result ->> 'code' <> 'duplicate_identifier' then
    raise exception 'Duplicate identifier guard failed: %', duplicate_result ->> 'code';
  end if;

  update public.inventory_items as item
     set status = 'ready_for_sale',
         updated_at = clock_timestamp()
   where item.id = v_item_id
     and item.store_id = v_store_id
  returning updated_at into ready_version;

  if ready_version is null then
    raise exception 'Created inventory item could not be prepared for sale';
  end if;

  sold_at := clock_timestamp();
  sale_result := public.repairdesk_complete_inventory_sale_v2(
    v_store_id,
    v_item_id,
    v_actor_id,
    ready_version,
    sale_key,
    null::uuid,
    1::numeric,
    1::numeric,
    'cash',
    'store',
    0,
    '{}'::jsonb,
    'not_required',
    null,
    sold_at
  );

  if sale_result ->> 'code' <> 'completed' then
    raise exception 'Unexpected sale result: %', sale_result ->> 'code';
  end if;

  sale_replay_result := public.repairdesk_complete_inventory_sale_v2(
    v_store_id,
    v_item_id,
    v_actor_id,
    ready_version,
    sale_key,
    null::uuid,
    1::numeric,
    1::numeric,
    'cash',
    'store',
    0,
    '{}'::jsonb,
    'not_required',
    null,
    sold_at
  );

  if sale_replay_result ->> 'code' <> 'idempotent_replay'
     or sale_replay_result ->> 'sale_id' <> sale_result ->> 'sale_id' then
    raise exception 'Sale idempotency replay failed';
  end if;

  sale_conflict_result := public.repairdesk_complete_inventory_sale_v2(
    v_store_id,
    v_item_id,
    v_actor_id,
    ready_version,
    sale_key,
    null::uuid,
    2::numeric,
    2::numeric,
    'cash',
    'store',
    0,
    '{}'::jsonb,
    'not_required',
    null,
    sold_at
  );

  if sale_conflict_result ->> 'code' <> 'idempotency_conflict' then
    raise exception 'Sale idempotency conflict guard failed';
  end if;

  select count(*) into row_total
    from public.inventory_intake_command_ledger
   where idempotency_key = intake_key;
  if row_total <> 1 then
    raise exception 'Intake ledger cardinality mismatch';
  end if;

  select count(*) into row_total
    from public.inventory_sale_command_ledger
   where idempotency_key = sale_key;
  if row_total <> 1 then
    raise exception 'Sale ledger cardinality mismatch';
  end if;

  raise notice 'rollback canary passed: intake, duplicate guard, replay, sale and conflict guard';
end;
$$;

rollback;

select
  (select count(*) from public.inventory_items where notes = 'Inventory V2 recovery drill rollback') as residual_v1_items,
  (select count(*) from public.inventory_intake_command_ledger) as residual_intake_commands,
  (select count(*) from public.inventory_sale_command_ledger) as residual_sale_commands;
