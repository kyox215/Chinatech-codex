-- PG17 rehearsal for the narrow production sequence:
--   20260810173524_inventory_product_inspection_atomic_20260810150000.sql
--   20260810173610_inventory_product_inspection_atomic_enable_20260810150100.sql
--
-- Run only against a disposable local/staging database after both migrations
-- have been applied.  The outer transaction is rolled back.  This file does
-- not apply migrations, seed production, or enable the application flag.

begin;

create extension if not exists pgtap with schema extensions;
select plan(36);

select ok(current_setting('server_version_num')::integer >= 170000, 'rehearsal runs on PostgreSQL 17 or newer');
select has_table('public', 'inventory_device_inspections', 'canonical inspection table exists');
select has_table('public', 'inventory_product_inspection_command_ledger', 'dedicated inspection ledger exists');
select ok((select relrowsecurity from pg_catalog.pg_class where oid = 'public.inventory_device_inspections'::regclass), 'inspection table has RLS');
select ok((select relrowsecurity from pg_catalog.pg_class where oid = 'public.inventory_product_inspection_command_ledger'::regclass), 'inspection ledger has RLS');
select ok((select count(*) = 1 from pg_catalog.pg_trigger where tgrelid = 'public.inventory_device_inspections'::regclass and tgname = 'inventory_device_inspections_append_only'), 'inspection table is append-only');
select ok((select count(*) = 1 from pg_catalog.pg_trigger where tgrelid = 'public.inventory_product_inspection_command_ledger'::regclass and tgname = 'inventory_product_inspection_ledger_append_only'), 'inspection ledger is append-only');
select ok(to_regclass('public.inventory_device_inspections_latest_unit_idx') is not null, 'latest inspection index exists');
select ok(to_regclass('public.inventory_items_id_store_inspection_fk_idx') is not null and to_regclass('public.inventory_stock_units_id_legacy_item_store_unique_idx') is not null, 'same-store source indexes exist');
select ok((select count(*) = 1 from pg_catalog.pg_constraint where conrelid = 'public.inventory_device_inspections'::regclass and conname = 'inventory_device_inspections_unit_item_same_store_fkey'), 'item/unit composite FK exists after either migration lineage');
select ok(
  (select count(*) >= 16
     from pg_catalog.pg_attribute attribute_row
     join pg_catalog.pg_class relation on relation.oid = attribute_row.attrelid
     join pg_catalog.pg_namespace namespace_row on namespace_row.oid = relation.relnamespace
    where namespace_row.nspname = 'public'
      and relation.relname = 'inventory_device_inspections'
      and attribute_row.attnum > 0
      and attribute_row.attisdropped is false
      and attribute_row.attrelid is not null),
  'inspection catalog columns expose valid attnum/attrelid metadata'
);
select ok(not has_table_privilege('anon', 'public.inventory_device_inspections', 'select,insert,update,delete,truncate'), 'anon cannot access inspections');
select ok(not has_table_privilege('authenticated', 'public.inventory_device_inspections', 'select,insert,update,delete,truncate'), 'authenticated cannot access inspections');
select ok(not has_table_privilege('anon', 'public.inventory_product_inspection_command_ledger', 'select,insert,update,delete,truncate'), 'anon cannot access inspection ledger');
select ok(not has_table_privilege('authenticated', 'public.inventory_product_inspection_command_ledger', 'select,insert,update,delete,truncate'), 'authenticated cannot access inspection ledger');
select ok(not has_function_privilege('anon', to_regprocedure('public.repairdesk_inventory_product_save_with_inspection_v1(uuid,uuid,text,jsonb)'), 'execute'), 'anon cannot execute inspection wrapper');
select ok(not has_function_privilege('authenticated', to_regprocedure('public.repairdesk_inventory_product_save_with_inspection_v1(uuid,uuid,text,jsonb)'), 'execute'), 'authenticated cannot execute inspection wrapper');
select ok((select proc.prosecdef from pg_catalog.pg_proc proc where proc.oid = to_regprocedure('public.repairdesk_inventory_product_save_with_inspection_v1(uuid,uuid,text,jsonb)')), 'wrapper is SECURITY DEFINER');
select ok((select exists (select 1 from unnest(coalesce(proc.proconfig, '{}'::text[])) config where config in ('search_path=', 'search_path=""')) from pg_catalog.pg_proc proc where proc.oid = to_regprocedure('public.repairdesk_inventory_product_save_with_inspection_v1(uuid,uuid,text,jsonb)')), 'wrapper pins an empty search_path');
select ok((select pg_catalog.pg_get_userbyid(proc.proowner) in ('postgres', 'supabase_admin') from pg_catalog.pg_proc proc where proc.oid = to_regprocedure('public.repairdesk_inventory_product_save_with_inspection_v1(uuid,uuid,text,jsonb)')), 'wrapper owner is a trusted database owner');

-- Invalid payloads are fixture-independent and prove fail-closed inspection
-- presence/null handling before membership or product mutation is reached.
select is((public.repairdesk_inventory_product_save_with_inspection_v1('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'create', jsonb_build_object('idempotency_key', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')) ->> 'code'), 'invalid_request', 'inspection omission is rejected');
select is((public.repairdesk_inventory_product_save_with_inspection_v1('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'create', jsonb_build_object('idempotency_key', 'cccccccc-cccc-4ccc-8ccc-cccccccccccd', 'inspection', null)) ->> 'code'), 'invalid_inspection', 'SQL null inspection is rejected');
select is((public.repairdesk_inventory_product_save_with_inspection_v1('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'create', jsonb_build_object('idempotency_key', 'cccccccc-cccc-4ccc-8ccc-ccccccccccce', 'inspection', '{}'::jsonb)) ->> 'code'), 'invalid_inspection', 'empty inspection object is rejected');
select is((public.repairdesk_inventory_product_save_with_inspection_v1('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbf', 'create', jsonb_build_object('idempotency_key', 'cccccccc-cccc-4ccc-8ccc-cccccccccccf', 'inspection', jsonb_build_object('face_id_status', null))) ->> 'code'), 'invalid_face_id_status', 'null Face ID status is rejected');
select is((public.repairdesk_inventory_product_save_with_inspection_v1('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc0', 'create', jsonb_build_object('idempotency_key', 'cccccccc-cccc-4ccc-8ccc-ccccccccccd0', 'inspection', jsonb_build_object('battery_health', null))) ->> 'code'), 'actor_forbidden', 'explicit null battery reaches authorization and remains valid');
select is(
  jsonb_build_array(
    public.repairdesk_inventory_product_save_with_inspection_v1(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'create',
      jsonb_build_object(
        'idempotency_key', 'cccccccc-cccc-4ccc-8ccc-ccccccccccd1',
        'inspection', jsonb_build_object('battery_health', 0)
      )
    ) ->> 'code',
    public.repairdesk_inventory_product_save_with_inspection_v1(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'create',
      jsonb_build_object(
        'idempotency_key', 'cccccccc-cccc-4ccc-8ccc-ccccccccccd2',
        'inspection', jsonb_build_object('battery_health', 100)
      )
    ) ->> 'code'
  ),
  jsonb_build_array('actor_forbidden', 'actor_forbidden'),
  'battery health 0 and 100 are accepted before authorization'
);

create or replace function pg_temp.rehearsal_product_payload(p_key uuid, p_model text)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'idempotency_key', p_key,
    'category', 'phone',
    'brand', 'Codex Rehearsal',
    'model', p_model,
    'identifiers', '[]'::jsonb,
    'list_price', 199,
    'notes', 'rollback-only inspection rehearsal',
    'inspection', jsonb_build_object('battery_health', null)
  );
$$;

-- Capture fixture-safe baselines so the forced outer rollback can assert that
-- every write projection is unchanged even when a rehearsal database already
-- contains a matching model from an earlier disposable run.
create temporary table rehearsal_forced_rollback_baseline on commit drop as
select
  (select count(*)::bigint
     from public.inventory_items item
    where item.model = 'forced-rollback-rehearsal'
      and item.notes = 'rollback-only inspection rehearsal') as product_count,
  (select count(*)::bigint
     from public.inventory_stock_units unit
     join public.inventory_items item
       on item.id = unit.legacy_inventory_item_id
      and item.model = 'forced-rollback-rehearsal'
      and item.notes = 'rollback-only inspection rehearsal') as unit_count,
  (select count(*)::bigint
     from public.inventory_device_inspections inspection
     join public.inventory_items item
       on item.id = inspection.inventory_item_id
      and item.model = 'forced-rollback-rehearsal'
      and item.notes = 'rollback-only inspection rehearsal') as inspection_count,
  (select count(*)::bigint
     from public.inventory_product_inspection_command_ledger ledger
    where ledger.idempotency_key = '22222222-2222-4222-8222-222222222222') as ledger_count,
  (select count(*)::bigint
     from public.audit_logs audit_row
    where audit_row.metadata ->> 'idempotency_key' = '22222222-2222-4222-8222-222222222222') as audit_count;
grant select on rehearsal_forced_rollback_baseline to service_role;

-- The following calls execute against real fixtures when the database has an
-- active owner/manager/technician membership.  An empty fixture database
-- remains a valid structural rehearsal; fixture-gated assertions explicitly
-- skip rather than manufacturing production-like rows.
set local role service_role;

select ok(
  (select count(*) = 1 from pg_temp.rehearsal_forced_rollback_baseline),
  'service_role can read the rollback baseline'
);

select ok(
  not exists (select 1 from public.store_memberships membership where membership.status::text = 'active' and membership.role::text in ('owner', 'manager', 'technician'))
  or coalesce((select (public.repairdesk_inventory_product_save_with_inspection_v1(actor.store_id, actor.user_id, 'create', pg_temp.rehearsal_product_payload('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'atomic-create-rehearsal')) ->> 'ok')::boolean from (select membership.store_id, membership.user_id from public.store_memberships membership join public.stores store_row on store_row.id = membership.store_id and store_row.status::text = 'active' join public.staff_profiles profile on profile.id = membership.user_id and profile.status::text = 'active' where membership.status::text = 'active' and membership.role::text in ('owner', 'manager', 'technician') limit 1) actor), false),
  'authorized create writes a product and inspection atomically (fixture-gated)'
);

select ok(
  not exists (select 1 from public.store_memberships membership where membership.status::text = 'active' and membership.role::text in ('owner', 'manager', 'technician'))
  or coalesce((select (replay.result ->> 'code') = 'idempotent_replay' and (select count(*) from public.inventory_product_inspection_command_ledger ledger where ledger.idempotency_key = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd') = 1 from (select public.repairdesk_inventory_product_save_with_inspection_v1(actor.store_id, actor.user_id, 'create', pg_temp.rehearsal_product_payload('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'atomic-create-rehearsal')) result from (select membership.store_id, membership.user_id from public.store_memberships membership join public.stores store_row on store_row.id = membership.store_id and store_row.status::text = 'active' join public.staff_profiles profile on profile.id = membership.user_id and profile.status::text = 'active' where membership.status::text = 'active' and membership.role::text in ('owner', 'manager', 'technician') limit 1) actor) replay), false),
  'same actor replay returns one ledger row (fixture-gated)'
);

select ok(
  not exists (select 1 from public.store_memberships membership where membership.status::text = 'active' and membership.role::text = 'sales')
  or coalesce((select (public.repairdesk_create_inventory_product_v2(actor.store_id, actor.user_id, pg_temp.rehearsal_product_payload('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'sales-ordinary-save') - 'inspection') ->> 'ok')::boolean from (select membership.store_id, membership.user_id from public.store_memberships membership join public.stores store_row on store_row.id = membership.store_id and store_row.status::text = 'active' join public.staff_profiles profile on profile.id = membership.user_id and profile.status::text = 'active' where membership.status::text = 'active' and membership.role::text = 'sales' limit 1) actor), false),
  'sales can use the ordinary product save RPC (fixture-gated)'
);

select is(
  case when exists (select 1 from public.store_memberships membership where membership.status::text = 'active' and membership.role::text = 'sales') then (select public.repairdesk_inventory_product_save_with_inspection_v1(actor.store_id, actor.user_id, 'create', pg_temp.rehearsal_product_payload('ffffffff-ffff-4fff-8fff-ffffffffffff', 'sales-inspection-rejected')) ->> 'code' from (select membership.store_id, membership.user_id from public.store_memberships membership join public.stores store_row on store_row.id = membership.store_id and store_row.status::text = 'active' join public.staff_profiles profile on profile.id = membership.user_id and profile.status::text = 'active' where membership.status::text = 'active' and membership.role::text = 'sales' limit 1) actor) else 'fixture-gated' end,
  case when exists (select 1 from public.store_memberships membership where membership.status::text = 'active' and membership.role::text = 'sales') then 'actor_forbidden' else 'fixture-gated' end,
  'sales with inspection is rejected at the wrapper boundary'
);

select is(
  case when exists (select 1 from public.store_memberships source_membership join public.stores source_store on source_store.id = source_membership.store_id and source_store.status::text = 'active' join public.staff_profiles source_profile on source_profile.id = source_membership.user_id and source_profile.status::text = 'active' join public.store_memberships target_membership on target_membership.store_id <> source_membership.store_id and target_membership.status::text = 'active' join public.stores target_store on target_store.id = target_membership.store_id and target_store.status::text = 'active' where source_membership.status::text = 'active' and source_membership.role::text in ('owner', 'manager', 'technician') and not exists (select 1 from public.store_memberships actor_membership where actor_membership.store_id = target_membership.store_id and actor_membership.user_id = source_membership.user_id and actor_membership.status::text = 'active')) then (select public.repairdesk_inventory_product_save_with_inspection_v1(candidate.target_store_id, candidate.actor_id, 'create', pg_temp.rehearsal_product_payload('12121212-1212-4121-8121-121212121212', 'cross-store-rejected')) ->> 'code' from (select target_membership.store_id target_store_id, source_membership.user_id actor_id from public.store_memberships source_membership join public.stores source_store on source_store.id = source_membership.store_id and source_store.status::text = 'active' join public.staff_profiles source_profile on source_profile.id = source_membership.user_id and source_profile.status::text = 'active' join public.store_memberships target_membership on target_membership.store_id <> source_membership.store_id and target_membership.status::text = 'active' join public.stores target_store on target_store.id = target_membership.store_id and target_store.status::text = 'active' where source_membership.status::text = 'active' and source_membership.role::text in ('owner', 'manager', 'technician') and not exists (select 1 from public.store_memberships actor_membership where actor_membership.store_id = target_membership.store_id and actor_membership.user_id = source_membership.user_id and actor_membership.status::text = 'active') limit 1) candidate) else 'fixture-gated' end,
  case when exists (select 1 from public.store_memberships source_membership join public.stores source_store on source_store.id = source_membership.store_id and source_store.status::text = 'active' join public.staff_profiles source_profile on source_profile.id = source_membership.user_id and source_profile.status::text = 'active' join public.store_memberships target_membership on target_membership.store_id <> source_membership.store_id and target_membership.status::text = 'active' join public.stores target_store on target_store.id = target_membership.store_id and target_store.status::text = 'active' where source_membership.status::text = 'active' and source_membership.role::text in ('owner', 'manager', 'technician') and not exists (select 1 from public.store_memberships actor_membership where actor_membership.store_id = target_membership.store_id and actor_membership.user_id = source_membership.user_id and actor_membership.status::text = 'active')) then 'actor_forbidden' else 'fixture-gated' end,
  'cross-store actor is rejected before product mutation'
);

select is(
  case when exists (select 1 from public.store_memberships first_membership join public.store_memberships second_membership on second_membership.store_id = first_membership.store_id and second_membership.user_id <> first_membership.user_id and second_membership.status::text = 'active' where first_membership.status::text = 'active' and first_membership.role::text in ('owner', 'manager', 'technician') and second_membership.role::text in ('owner', 'manager', 'technician') and exists (select 1 from public.inventory_product_inspection_command_ledger ledger where ledger.idempotency_key = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd')) then (select public.repairdesk_inventory_product_save_with_inspection_v1(second_membership.store_id, second_membership.user_id, 'create', pg_temp.rehearsal_product_payload('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'atomic-create-rehearsal')) ->> 'code' from public.store_memberships first_membership join public.store_memberships second_membership on second_membership.store_id = first_membership.store_id and second_membership.user_id <> first_membership.user_id and second_membership.status::text = 'active' where first_membership.status::text = 'active' and first_membership.role::text in ('owner', 'manager', 'technician') and second_membership.role::text in ('owner', 'manager', 'technician') limit 1) else 'fixture-gated' end,
  case when exists (select 1 from public.store_memberships first_membership join public.store_memberships second_membership on second_membership.store_id = first_membership.store_id and second_membership.user_id <> first_membership.user_id and second_membership.status::text = 'active' where first_membership.status::text = 'active' and first_membership.role::text in ('owner', 'manager', 'technician') and second_membership.role::text in ('owner', 'manager', 'technician') and exists (select 1 from public.inventory_product_inspection_command_ledger ledger where ledger.idempotency_key = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd')) then 'idempotency_actor_conflict' else 'fixture-gated' end,
  'replay by another actor is rejected'
);

select is(
  case when exists (select 1 from public.store_memberships membership where membership.status::text = 'active' and membership.role::text in ('owner', 'manager', 'technician')) then (select public.repairdesk_inventory_product_save_with_inspection_v1(candidate.store_id, candidate.user_id, 'update', pg_temp.rehearsal_product_payload('11111111-1111-4111-8111-111111111111', 'cas-rehearsal') || jsonb_build_object('product_id', candidate.item_id, 'expected_version', candidate.version + 1)) ->> 'code' from (select membership.store_id, membership.user_id, item.id item_id, unit.version from public.store_memberships membership join public.stores store_row on store_row.id = membership.store_id and store_row.status::text = 'active' join public.staff_profiles profile on profile.id = membership.user_id and profile.status::text = 'active' join public.inventory_items item on item.store_id = membership.store_id and item.status::text not in ('sold', 'cancelled', 'recycled') join public.inventory_stock_units unit on unit.store_id = item.store_id and unit.legacy_inventory_item_id = item.id and unit.status::text not in ('sold', 'cancelled', 'recycled') where membership.status::text = 'active' and membership.role::text in ('owner', 'manager', 'technician') and coalesce((item.legacy_payload ->> 'inventory_v2_intake')::boolean, false) limit 1) candidate) else 'fixture-gated' end,
  case when exists (select 1 from public.store_memberships membership where membership.status::text = 'active' and membership.role::text in ('owner', 'manager', 'technician')) then 'version_conflict' else 'fixture-gated' end,
  'update CAS mismatch does not enter inspection persistence'
);

create or replace function pg_temp.rehearsal_forced_rollback(p_store_id uuid, p_actor_id uuid, p_key uuid)
returns void
language plpgsql
as $$
declare
  v_result jsonb;
begin
  v_result := public.repairdesk_inventory_product_save_with_inspection_v1(
    p_store_id,
    p_actor_id,
    'create',
    pg_temp.rehearsal_product_payload(p_key, 'forced-rollback-rehearsal')
  );
  if coalesce((v_result ->> 'ok')::boolean, false) is not true then
    raise exception using
      errcode = 'P0001',
      message = 'inspection_rehearsal_wrapper_not_ok';
  end if;
  raise exception using errcode = 'P0001', message = 'inspection_rehearsal_forced_rollback';
end;
$$;

-- pgtap's throws_ok must not receive a SELECT with zero rows.  If the
-- disposable database has no authorized fixture, emit an explicit structural
-- skip; with a real fixture, first verify wrapper ok=true before injecting the
-- outer failure so a rejected wrapper cannot become a false-positive rollback.
create or replace function pg_temp.rehearsal_forced_rollback_assertion()
returns setof text
language plpgsql
as $$
declare
  v_actor record;
begin
  select membership.store_id, membership.user_id
    into v_actor
    from public.store_memberships membership
    join public.stores store_row
      on store_row.id = membership.store_id
     and store_row.status::text = 'active'
    join public.staff_profiles profile
      on profile.id = membership.user_id
     and profile.status::text = 'active'
   where membership.status::text = 'active'
     and membership.role::text in ('owner', 'manager', 'technician')
   limit 1;
  if not found then
    return query select * from skip(1, 'no active owner/manager/technician fixture; forced rollback skipped');
    return;
  end if;
  return query select * from throws_ok(
    format(
      'select pg_temp.rehearsal_forced_rollback(%L::uuid, %L::uuid, %L::uuid)',
      v_actor.store_id,
      v_actor.user_id,
      '22222222-2222-4222-8222-222222222222'
    ),
    'P0001',
    'inspection_rehearsal_forced_rollback',
    'forced outer rollback is observable (authorized fixture)'
  );
end;
$$;

select * from pg_temp.rehearsal_forced_rollback_assertion();
select is(
  (
    select jsonb_build_object(
      'item', (select count(*)::bigint
                 from public.inventory_items item
                where item.model = 'forced-rollback-rehearsal'
                  and item.notes = 'rollback-only inspection rehearsal'),
      'unit', (select count(*)::bigint
                 from public.inventory_stock_units unit
                 join public.inventory_items item
                   on item.id = unit.legacy_inventory_item_id
                  and item.model = 'forced-rollback-rehearsal'
                  and item.notes = 'rollback-only inspection rehearsal'),
      'inspection', (select count(*)::bigint
                       from public.inventory_device_inspections inspection
                       join public.inventory_items item
                         on item.id = inspection.inventory_item_id
                        and item.model = 'forced-rollback-rehearsal'
                        and item.notes = 'rollback-only inspection rehearsal'),
      'ledger', (select count(*)::bigint
                   from public.inventory_product_inspection_command_ledger ledger
                  where ledger.idempotency_key = '22222222-2222-4222-8222-222222222222'),
      'audit', (select count(*)::bigint
                  from public.audit_logs audit_row
                 where audit_row.metadata ->> 'idempotency_key' = '22222222-2222-4222-8222-222222222222')
    )
  ),
  (
    select jsonb_build_object(
      'item', baseline.product_count,
      'unit', baseline.unit_count,
      'inspection', baseline.inspection_count,
      'ledger', baseline.ledger_count,
      'audit', baseline.audit_count
    )
      from pg_temp.rehearsal_forced_rollback_baseline baseline
  ),
  'forced rollback leaves no item/unit/inspection/ledger/audit residuals'
);

select * from finish();
rollback;
