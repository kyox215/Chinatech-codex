\set ON_ERROR_STOP on

begin;

create temporary table smoke_base_variant(id uuid);
with catalog as (
  insert into public.inventory_product_catalog_items (
    store_id, category, brand, model, normalized_key, tracking_mode,
    standardization_status, created_by, updated_by
  ) values (
    :'store_id'::uuid, 'phone', 'Synthetic', 'Device Pro',
    'phone|synthetic|device pro|serial', 'serial', 'unstandardized',
    :'actor_id'::uuid, :'actor_id'::uuid
  )
  on conflict (store_id, normalized_key) do update set updated_at = clock_timestamp()
  returning id
), variant as (
  insert into public.inventory_product_variants (
  store_id, catalog_item_id, storage_capacity, color, normalized_key,
  created_by, updated_by
  )
  select
    :'store_id'::uuid, catalog.id, '512 GB', 'Blue',
    'phone|synthetic|device pro|serial|-|512 gb|blue',
    :'actor_id'::uuid, :'actor_id'::uuid
  from catalog
  on conflict (store_id, normalized_key) do update set updated_at = clock_timestamp()
  returning id
)
insert into smoke_base_variant(id)
select id from variant;

insert into public.inventory_stock_movements (
  store_id, stock_unit_id, variant_id, movement_type, quantity, source_kind,
  source_id, idempotency_key, actor_id, metadata, occurred_at
)
select
  :'store_id'::uuid, unit.id, variant.id, 'adjust', 1, 'validation',
  'historical-variant-reference', '30000000-0000-4000-8000-000000000001'::uuid,
  :'actor_id'::uuid, '{}'::jsonb, clock_timestamp()
from smoke_base_variant variant
cross join lateral (
  select id from public.inventory_stock_units
  where store_id = :'store_id'::uuid
  order by created_at limit 1
) unit;

set local role service_role;

create temporary table smoke_create(result jsonb);
create temporary table smoke_identity(
  item_id uuid,
  unit_id uuid,
  initial_variant_id uuid,
  create_legacy_primary_ok boolean
);
create temporary table smoke_identifier_before(id uuid);
create temporary table smoke_create_replay(result jsonb);
create temporary table smoke_update(result jsonb);
create temporary table smoke_update_replay(result jsonb);
create temporary table smoke_stale(result jsonb);
create temporary table smoke_projection_conflict(result jsonb);
create temporary table smoke_identity_conflict(result jsonb);
insert into smoke_create
select public.repairdesk_create_inventory_product_v2(
  :'store_id'::uuid,
  :'actor_id'::uuid,
  jsonb_build_object(
    'idempotency_key', '10000000-0000-4000-8000-000000000001',
    'category', 'phone',
    'brand', 'Synthetic',
    'model', 'Device Pro',
    'ram_capacity', '12 GB',
    'storage_capacity', '512 GB',
    'color', 'Blue',
    'gtin', '4006381333931',
    'condition', 'good',
    'specifications', jsonb_build_object('network_variant', 'EU'),
    'identifiers', jsonb_build_array(
      jsonb_build_object(
        'kind', 'imei1',
        'value', '490154203237518',
        'source', 'scan',
        'primary', false
      ),
      jsonb_build_object(
        'kind', 'eid',
        'value', '89049032000000000000000000000001',
        'source', 'scan',
        'primary', true
      )
    ),
    'list_price', 499.90,
    'cost_amount', 123.45,
    'location', 'SMOKE-A',
    'warranty_months', 12
  )
);
reset role;

insert into smoke_identity
select
  (result ->> 'id')::uuid as item_id,
  (result ->> 'stock_unit_id')::uuid as unit_id,
  unit.variant_id as initial_variant_id,
  item.serial_or_imei = '89049032000000000000000000000001' as create_legacy_primary_ok
from smoke_create
join public.inventory_stock_units unit
  on unit.id = (result ->> 'stock_unit_id')::uuid
  and unit.store_id = :'store_id'::uuid
join public.inventory_items item
  on item.id = (result ->> 'id')::uuid
  and item.store_id = unit.store_id;

insert into smoke_identifier_before
select identifier.id
from public.inventory_stock_unit_identifiers identifier
join smoke_identity smoke on smoke.unit_id = identifier.stock_unit_id
where identifier.store_id = :'store_id'::uuid
  and identifier.kind = 'imei1'
  and identifier.retired_at is null;

set local role service_role;
insert into smoke_create_replay
select public.repairdesk_create_inventory_product_v2(
  :'store_id'::uuid,
  :'actor_id'::uuid,
  jsonb_build_object(
    'idempotency_key', '10000000-0000-4000-8000-000000000001',
    'category', 'phone',
    'brand', 'Synthetic',
    'model', 'Device Pro',
    'ram_capacity', '12 GB',
    'storage_capacity', '512 GB',
    'color', 'Blue',
    'gtin', '4006381333931',
    'condition', 'good',
    'specifications', jsonb_build_object('network_variant', 'EU'),
    'identifiers', jsonb_build_array(
      jsonb_build_object(
        'kind', 'imei1',
        'value', '490154203237518',
        'source', 'scan',
        'primary', false
      ),
      jsonb_build_object(
        'kind', 'eid',
        'value', '89049032000000000000000000000001',
        'source', 'scan',
        'primary', true
      )
    ),
    'list_price', 499.90,
    'cost_amount', 123.45,
    'location', 'SMOKE-A',
    'warranty_months', 12
  )
);
reset role;

set local role service_role;
insert into smoke_update
select public.repairdesk_update_inventory_product_v1(
  :'store_id'::uuid,
  :'actor_id'::uuid,
  jsonb_build_object(
    'idempotency_key', '20000000-0000-4000-8000-000000000001',
    'product_id', smoke.item_id,
    'expected_version', 1,
    'category', 'phone',
    'brand', 'Synthetic',
    'model', 'Device Pro Updated',
    'ram_capacity', '12 GB',
    'storage_capacity', '512 GB',
    'color', 'Blue',
    'gtin', '4006381333931',
    'condition', 'good',
    'specifications', jsonb_build_object('network_variant', 'EU'),
    'identifiers', jsonb_build_array(
      jsonb_build_object(
        'kind', 'imei1',
        'value', '490154203237518',
        'source', 'scan',
        'primary', true
      ),
      jsonb_build_object(
        'kind', 'serial',
        'value', 'SMOKE-SERIAL-001',
        'source', 'manual',
        'primary', false
      )
    ),
    'list_price', 519.90,
    'location', 'SMOKE-B',
    'warranty_months', 12
  )
)
from smoke_identity smoke;
reset role;

set local role service_role;
insert into smoke_stale
select public.repairdesk_update_inventory_product_v1(
  :'store_id'::uuid,
  :'actor_id'::uuid,
  jsonb_build_object(
    'idempotency_key', '20000000-0000-4000-8000-000000000002',
    'product_id', smoke.item_id,
    'expected_version', 1,
    'category', 'phone',
    'brand', 'Synthetic',
    'model', 'Stale',
    'specifications', '{}'::jsonb,
    'identifiers', '[]'::jsonb
  )
)
from smoke_identity smoke;
reset role;

update public.inventory_items item
   set status = 'listed'
  from smoke_identity smoke
 where item.store_id = :'store_id'::uuid and item.id = smoke.item_id;
set local role service_role;
insert into smoke_projection_conflict
select public.repairdesk_update_inventory_product_v1(
  :'store_id'::uuid,
  :'actor_id'::uuid,
  jsonb_build_object(
    'idempotency_key', '20000000-0000-4000-8000-000000000003',
    'product_id', smoke.item_id,
    'expected_version', 2,
    'category', 'phone', 'brand', 'Synthetic', 'model', 'Projection Drift',
    'specifications', '{}'::jsonb, 'identifiers', '[]'::jsonb
  )
)
from smoke_identity smoke;
reset role;

update public.inventory_items item
   set status = 'intake',
       legacy_payload = jsonb_set(
         item.legacy_payload,
         '{inventory_v2_unit_id}',
         to_jsonb('00000000-0000-4000-8000-000000000099'::text)
       )
  from smoke_identity smoke
 where item.store_id = :'store_id'::uuid and item.id = smoke.item_id;
set local role service_role;
insert into smoke_identity_conflict
select public.repairdesk_update_inventory_product_v1(
  :'store_id'::uuid,
  :'actor_id'::uuid,
  jsonb_build_object(
    'idempotency_key', '20000000-0000-4000-8000-000000000004',
    'product_id', smoke.item_id,
    'expected_version', 2,
    'category', 'phone', 'brand', 'Synthetic', 'model', 'Identity Drift',
    'specifications', '{}'::jsonb, 'identifiers', '[]'::jsonb
  )
)
from smoke_identity smoke;
reset role;

set local role service_role;
insert into smoke_update_replay
select public.repairdesk_update_inventory_product_v1(
  :'store_id'::uuid,
  :'actor_id'::uuid,
  jsonb_build_object(
    'idempotency_key', '20000000-0000-4000-8000-000000000001',
    'product_id', smoke.item_id,
    'expected_version', 1,
    'category', 'phone',
    'brand', 'Synthetic',
    'model', 'Device Pro Updated',
    'ram_capacity', '12 GB',
    'storage_capacity', '512 GB',
    'color', 'Blue',
    'gtin', '4006381333931',
    'condition', 'good',
    'specifications', jsonb_build_object('network_variant', 'EU'),
    'identifiers', jsonb_build_array(
      jsonb_build_object(
        'kind', 'imei1',
        'value', '490154203237518',
        'source', 'scan',
        'primary', true
      ),
      jsonb_build_object(
        'kind', 'serial',
        'value', 'SMOKE-SERIAL-001',
        'source', 'manual',
        'primary', false
      )
    ),
    'list_price', 519.90,
    'location', 'SMOKE-B',
    'warranty_months', 12
  )
)
from smoke_identity smoke;
reset role;

select
  (select result ->> 'code' from smoke_create) = 'created' as create_ok,
  (select result ->> 'code' from smoke_create_replay) = 'idempotent_replay' as create_replay_ok,
  (select result ->> 'code' from smoke_update) = 'updated' as update_ok,
  (select result ->> 'code' from smoke_update_replay) = 'idempotent_replay'
    as update_replay_ok,
  (select result ->> 'code' from smoke_stale) = 'version_conflict' as stale_conflict_ok,
  (select result ->> 'code' from smoke_projection_conflict) = 'projection_conflict'
    as state_projection_conflict_ok,
  (select result ->> 'code' from smoke_identity_conflict) = 'projection_conflict'
    as identity_projection_conflict_ok,
  smoke.create_legacy_primary_ok,
  unit.cost_amount = 123.45 as omitted_cost_preserved,
  item.buyback_price = 123.45 as legacy_cost_preserved,
  unit.version = 2 as version_incremented,
  movement.variant_id = smoke.initial_variant_id as receive_movement_variant_matches,
  identifier.id = (select id from smoke_identifier_before) as unchanged_identifier_preserved,
  identifier.source = 'scan' and identifier.is_primary as source_and_primary_preserved,
  variant.gtin = '4006381333931' and variant.specifications ->> 'network_variant' = 'EU'
    as variant_device_data_ok,
  (
    select count(*)
    from public.inventory_stock_unit_identifiers active_identifier
    where active_identifier.store_id = :'store_id'::uuid
      and active_identifier.stock_unit_id = unit.id
      and active_identifier.retired_at is null
      and active_identifier.is_primary
  ) = 1 as one_active_primary
from smoke_identity smoke
join public.inventory_stock_units unit on unit.id = smoke.unit_id and unit.store_id = :'store_id'::uuid
join public.inventory_items item on item.id = smoke.item_id and item.store_id = unit.store_id
join public.inventory_stock_movements movement
  on movement.stock_unit_id = unit.id and movement.store_id = unit.store_id
join public.inventory_product_variants variant
  on variant.id = unit.variant_id and variant.store_id = unit.store_id
join public.inventory_stock_unit_identifiers identifier
  on identifier.stock_unit_id = unit.id and identifier.store_id = unit.store_id
  and identifier.kind = 'imei1' and identifier.retired_at is null;

select
  has_function_privilege('anon', p.oid, 'execute') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute,
  has_function_privilege('service_role', p.oid, 'execute') as service_role_execute,
  p.prosecdef as security_definer,
  p.proconfig = array['search_path=""']::text[] as empty_search_path
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('repairdesk_create_inventory_product_v2', 'repairdesk_update_inventory_product_v1')
order by p.proname;

rollback;
