-- Runtime enablement for the atomic product + inspection wrapper.
-- Apply only after the expand migration, lifecycle schema, ACL/recovery and
-- application feature-flag gates have been independently verified.

set lock_timeout = '5s';

do $$
declare
  v_missing text;
begin
  select string_agg(requirement, ', ' order by requirement)
    into v_missing
    from (
      select 'inspection/ledger/wrapper objects' as requirement
       where to_regclass('public.inventory_device_inspections') is null
          or to_regclass('public.inventory_product_inspection_command_ledger') is null
          or to_regprocedure('public.repairdesk_inventory_product_save_with_inspection_v1(uuid,uuid,text,jsonb)') is null
      union all
      select 'inspection RLS'
       where coalesce((select relrowsecurity from pg_catalog.pg_class where oid = 'public.inventory_device_inspections'::regclass), false) is not true
      union all
      select 'ledger RLS'
       where coalesce((select relrowsecurity from pg_catalog.pg_class where oid = 'public.inventory_product_inspection_command_ledger'::regclass), false) is not true
      union all
      select 'inspection append-only trigger'
       where not exists (
         select 1
           from pg_catalog.pg_trigger trigger_row
          where trigger_row.tgrelid = 'public.inventory_device_inspections'::regclass
            and trigger_row.tgname = 'inventory_device_inspections_append_only'
            and trigger_row.tgisinternal is false
            and trigger_row.tgenabled = 'O'
            and (trigger_row.tgtype & 1) <> 0
            and (trigger_row.tgtype & 2) <> 0
            and (trigger_row.tgtype & 8) <> 0
            and (trigger_row.tgtype & 16) <> 0
            and (trigger_row.tgtype & 4) = 0
            and (trigger_row.tgtype & 32) = 0
            and pg_catalog.pg_get_triggerdef(trigger_row.oid) ilike '%repairdesk_inventory_lifecycle_append_only_guard%'
       )
      union all
      select 'ledger append-only trigger'
       where not exists (
         select 1
           from pg_catalog.pg_trigger trigger_row
          where trigger_row.tgrelid = 'public.inventory_product_inspection_command_ledger'::regclass
            and trigger_row.tgname = 'inventory_product_inspection_ledger_append_only'
            and trigger_row.tgisinternal is false
            and trigger_row.tgenabled = 'O'
            and (trigger_row.tgtype & 1) <> 0
            and (trigger_row.tgtype & 2) <> 0
            and (trigger_row.tgtype & 8) <> 0
            and (trigger_row.tgtype & 16) <> 0
            and (trigger_row.tgtype & 4) = 0
            and (trigger_row.tgtype & 32) = 0
            and pg_catalog.pg_get_triggerdef(trigger_row.oid) ilike '%repairdesk_inventory_lifecycle_append_only_guard%'
       )
      union all
      select 'inspection columns/types'
       where exists (
         select 1
           from (values
             ('store_id', 'uuid'), ('inventory_item_id', 'uuid'), ('stock_unit_id', 'uuid'),
             ('id', 'uuid'),
             ('device_kind', 'text'), ('battery_health', 'smallint'),
             ('face_id_status', 'text'), ('touch_id_status', 'text'),
             ('true_tone_status', 'text'), ('activation_lock_status', 'text'),
             ('data_wipe_status', 'text'), ('imei_status', 'text'),
             ('checks', 'jsonb'), ('notes', 'text'),
             ('inspected_at', 'timestamp with time zone'), ('inspected_by', 'uuid')
           ) as required(column_name, format_type)
          where not exists (
            select 1
              from pg_catalog.pg_attribute attribute_row
              join pg_catalog.pg_class relation on relation.oid = attribute_row.attrelid
              join pg_catalog.pg_namespace namespace_row on namespace_row.oid = relation.relnamespace
             where namespace_row.nspname = 'public'
               and relation.relname = 'inventory_device_inspections'
               and attribute_row.attname = required.column_name
               and attribute_row.attnum > 0
               and attribute_row.attisdropped is false
               and pg_catalog.format_type(attribute_row.atttypid, attribute_row.atttypmod) = required.format_type
          )
       )
      union all
      select 'ledger columns/types'
       where exists (
         select 1
           from (values
             ('id', 'uuid'), ('store_id', 'uuid'), ('idempotency_key', 'uuid'),
             ('request_hash', 'character(32)'), ('operation', 'text'), ('actor_id', 'uuid'),
             ('inventory_item_id', 'uuid'), ('stock_unit_id', 'uuid'),
             ('version_before', 'bigint'), ('version_after', 'bigint'),
             ('result', 'jsonb'), ('created_at', 'timestamp with time zone')
           ) as required(column_name, format_type)
          where not exists (
            select 1
              from pg_catalog.pg_attribute attribute_row
              join pg_catalog.pg_class relation on relation.oid = attribute_row.attrelid
              join pg_catalog.pg_namespace namespace_row on namespace_row.oid = relation.relnamespace
             where namespace_row.nspname = 'public'
               and relation.relname = 'inventory_product_inspection_command_ledger'
               and attribute_row.attname = required.column_name
               and attribute_row.attnum > 0
               and attribute_row.attisdropped is false
               and pg_catalog.format_type(attribute_row.atttypid, attribute_row.atttypmod) = required.format_type
          )
       )
      union all
      select 'inspection constraints'
       where exists (
         select 1
           from (values
             ('inventory_device_inspections_pkey', 'p', 'primary key (id)', null, null, null, null, null),
             ('inventory_device_inspections_store_fkey', 'f', 'foreign key (store_id)%references %stores(id)%', 'public.stores', array['store_id'], array['id'], 'c', 'r'),
             ('inventory_device_inspections_item_same_store_fkey', 'f', 'foreign key (inventory_item_id, store_id)%references %inventory_items(id, store_id)%', 'public.inventory_items', array['inventory_item_id', 'store_id'], array['id', 'store_id'], 'c', 'r'),
             ('inventory_device_inspections_unit_same_store_fkey', 'f', 'foreign key (stock_unit_id, store_id)%references %inventory_stock_units(id, store_id)%', 'public.inventory_stock_units', array['stock_unit_id', 'store_id'], array['id', 'store_id'], 'c', 'r'),
             ('inventory_device_inspections_unit_item_same_store_fkey', 'f', 'foreign key (stock_unit_id, inventory_item_id, store_id)%references %inventory_stock_units(id, legacy_inventory_item_id, store_id)%', 'public.inventory_stock_units', array['stock_unit_id', 'inventory_item_id', 'store_id'], array['id', 'legacy_inventory_item_id', 'store_id'], 'c', 'r'),
             ('inventory_device_inspections_actor_fkey', 'f', 'foreign key (inspected_by)%references %users(id)%', 'auth.users', array['inspected_by'], array['id'], 'c', 'r'),
             ('inventory_device_inspections_battery_check', 'c', 'check%battery_health%', null, null, null, null, null),
             ('inventory_device_inspections_check_object', 'c', 'check%checks%', null, null, null, null, null),
             ('inventory_device_inspections_checks_bound', 'c', 'check%repairdesk_inventory_lifecycle_checks_valid%', null, null, null, null, null),
             ('inventory_device_inspections_face_id_check', 'c', 'check%face_id_status%', null, null, null, null, null),
             ('inventory_device_inspections_touch_id_check', 'c', 'check%touch_id_status%', null, null, null, null, null),
             ('inventory_device_inspections_true_tone_check', 'c', 'check%true_tone_status%', null, null, null, null, null),
             ('inventory_device_inspections_activation_check', 'c', 'check%activation_lock_status%', null, null, null, null, null),
             ('inventory_device_inspections_wipe_check', 'c', 'check%data_wipe_status%', null, null, null, null, null),
             ('inventory_device_inspections_imei_check', 'c', 'check%imei_status%', null, null, null, null, null)
           ) as required(constraint_name, constraint_type, definition_pattern, referenced_relation, local_columns, referenced_columns, update_action, delete_action)
          where not exists (
            select 1
              from pg_catalog.pg_constraint constraint_row
             where constraint_row.conrelid = 'public.inventory_device_inspections'::regclass
               and constraint_row.conname = required.constraint_name
               and constraint_row.contype = required.constraint_type
               and constraint_row.convalidated is true
               and pg_catalog.lower(pg_catalog.pg_get_constraintdef(constraint_row.oid)) ilike required.definition_pattern
               and (
                 required.referenced_relation is null
                 or (
                   constraint_row.confrelid = pg_catalog.to_regclass(required.referenced_relation)
                   and constraint_row.conkey = (
                     select pg_catalog.array_agg(attribute_row.attnum::smallint order by column_row.ordinality)::smallint[]
                       from pg_catalog.unnest(required.local_columns) with ordinality as column_row(column_name, ordinality)
                       join pg_catalog.pg_attribute attribute_row
                         on attribute_row.attrelid = constraint_row.conrelid
                        and attribute_row.attname = column_row.column_name
                   )
                   and constraint_row.confkey = (
                     select pg_catalog.array_agg(attribute_row.attnum::smallint order by column_row.ordinality)::smallint[]
                       from pg_catalog.unnest(required.referenced_columns) with ordinality as column_row(column_name, ordinality)
                       join pg_catalog.pg_attribute attribute_row
                         on attribute_row.attrelid = constraint_row.confrelid
                        and attribute_row.attname = column_row.column_name
                   )
                   and constraint_row.confupdtype = required.update_action::"char"
                   and constraint_row.confdeltype = required.delete_action::"char"
                 )
               )
          )
       )
      union all
      select 'ledger constraints'
       where exists (
         select 1
           from (values
             ('inventory_product_inspection_command_ledger_pkey', 'p', 'primary key (id)', null, null, null, null, null),
             ('inventory_product_inspection_ledger_store_fkey', 'f', 'foreign key (store_id)%references %stores(id)%', 'public.stores', array['store_id'], array['id'], 'c', 'r'),
             ('inventory_product_inspection_ledger_actor_fkey', 'f', 'foreign key (actor_id)%references %users(id)%', 'auth.users', array['actor_id'], array['id'], 'c', 'r'),
             ('inventory_product_inspection_ledger_item_same_store_fkey', 'f', 'foreign key (inventory_item_id, store_id)%references %inventory_items(id, store_id)%', 'public.inventory_items', array['inventory_item_id', 'store_id'], array['id', 'store_id'], 'c', 'r'),
             ('inventory_product_inspection_ledger_unit_same_store_fkey', 'f', 'foreign key (stock_unit_id, store_id)%references %inventory_stock_units(id, store_id)%', 'public.inventory_stock_units', array['stock_unit_id', 'store_id'], array['id', 'store_id'], 'c', 'r'),
             ('inventory_product_inspection_ledger_operation_check', 'c', 'check%operation%', null, null, null, null, null),
             ('inventory_product_inspection_ledger_hash_check', 'c', 'check%request_hash%', null, null, null, null, null),
             ('inventory_product_inspection_ledger_version_check', 'c', 'check%version_before%version_after%', null, null, null, null, null),
             ('inventory_product_inspection_ledger_result_check', 'c', 'check%result%', null, null, null, null, null),
             ('inventory_product_inspection_ledger_idempotency_unique', 'u', 'unique (store_id, idempotency_key)', null, null, null, null, null)
           ) as required(constraint_name, constraint_type, definition_pattern, referenced_relation, local_columns, referenced_columns, update_action, delete_action)
          where not exists (
            select 1
              from pg_catalog.pg_constraint constraint_row
             where constraint_row.conrelid = 'public.inventory_product_inspection_command_ledger'::regclass
               and constraint_row.conname = required.constraint_name
               and constraint_row.contype = required.constraint_type
               and constraint_row.convalidated is true
               and pg_catalog.lower(pg_catalog.pg_get_constraintdef(constraint_row.oid)) ilike required.definition_pattern
               and (
                 required.referenced_relation is null
                 or (
                   constraint_row.confrelid = pg_catalog.to_regclass(required.referenced_relation)
                   and constraint_row.conkey = (
                     select pg_catalog.array_agg(attribute_row.attnum::smallint order by column_row.ordinality)::smallint[]
                       from pg_catalog.unnest(required.local_columns) with ordinality as column_row(column_name, ordinality)
                       join pg_catalog.pg_attribute attribute_row
                         on attribute_row.attrelid = constraint_row.conrelid
                        and attribute_row.attname = column_row.column_name
                   )
                   and constraint_row.confkey = (
                     select pg_catalog.array_agg(attribute_row.attnum::smallint order by column_row.ordinality)::smallint[]
                       from pg_catalog.unnest(required.referenced_columns) with ordinality as column_row(column_name, ordinality)
                       join pg_catalog.pg_attribute attribute_row
                         on attribute_row.attrelid = constraint_row.confrelid
                        and attribute_row.attname = column_row.column_name
                   )
                   and constraint_row.confupdtype = required.update_action::"char"
                   and constraint_row.confdeltype = required.delete_action::"char"
                 )
               )
          )
       )
      union all
      select 'inspection/ledger table owners'
       where coalesce((select pg_catalog.pg_get_userbyid(relation.relowner) in ('postgres', 'supabase_admin')
                         from pg_catalog.pg_class relation
                        where relation.oid = 'public.inventory_device_inspections'::regclass), false) is not true
          or coalesce((select pg_catalog.pg_get_userbyid(relation.relowner) in ('postgres', 'supabase_admin')
                         from pg_catalog.pg_class relation
                        where relation.oid = 'public.inventory_product_inspection_command_ledger'::regclass), false) is not true
      union all
      select 'inspection column nullability/defaults'
       where exists (
         select 1
           from (values
             ('id', true, 'gen_random_uuid%'),
             ('store_id', true, null),
             ('inventory_item_id', true, null),
             ('stock_unit_id', true, null),
             ('device_kind', true, null),
             ('battery_health', false, null),
             ('face_id_status', true, '%not_tested%'),
             ('touch_id_status', true, '%not_tested%'),
             ('true_tone_status', true, '%not_tested%'),
             ('activation_lock_status', true, '%not_tested%'),
             ('data_wipe_status', true, '%not_tested%'),
             ('imei_status', true, '%not_tested%'),
             ('checks', true, '%{}%'),
             ('notes', false, null),
             ('inspected_at', true, null),
             ('inspected_by', true, null),
             ('created_at', true, '%now()%')
           ) as required(column_name, requires_not_null, default_pattern)
           left join pg_catalog.pg_attribute attribute_row
             on attribute_row.attrelid = 'public.inventory_device_inspections'::regclass
            and attribute_row.attname = required.column_name
            and attribute_row.attnum > 0
            and attribute_row.attisdropped is false
           left join pg_catalog.pg_attrdef default_row
             on default_row.adrelid = attribute_row.attrelid
            and default_row.adnum = attribute_row.attnum
          where attribute_row.attnum is null
             or attribute_row.attrelid is null
             or attribute_row.attnotnull is distinct from required.requires_not_null
             or (required.default_pattern is not null
                 and (default_row.oid is null
                      or pg_catalog.pg_get_expr(default_row.adbin, default_row.adrelid) not ilike required.default_pattern))
       )
      union all
      select 'ledger column nullability/defaults'
       where exists (
         select 1
           from (values
             ('id', true, 'gen_random_uuid%'),
             ('store_id', true, null),
             ('idempotency_key', true, null),
             ('request_hash', true, null),
             ('operation', true, null),
             ('actor_id', true, null),
             ('inventory_item_id', true, null),
             ('stock_unit_id', true, null),
             ('version_before', true, null),
             ('version_after', true, null),
             ('result', true, null),
             ('created_at', true, '%now()%')
           ) as required(column_name, requires_not_null, default_pattern)
           left join pg_catalog.pg_attribute attribute_row
             on attribute_row.attrelid = 'public.inventory_product_inspection_command_ledger'::regclass
            and attribute_row.attname = required.column_name
            and attribute_row.attnum > 0
            and attribute_row.attisdropped is false
           left join pg_catalog.pg_attrdef default_row
             on default_row.adrelid = attribute_row.attrelid
            and default_row.adnum = attribute_row.attnum
          where attribute_row.attnum is null
             or attribute_row.attrelid is null
             or attribute_row.attnotnull is distinct from required.requires_not_null
             or (required.default_pattern is not null
                 and (default_row.oid is null
                      or pg_catalog.pg_get_expr(default_row.adbin, default_row.adrelid) not ilike required.default_pattern))
       )
      union all
      select 'latest inspection index'
       where not exists (
         select 1
           from pg_catalog.pg_index index_row
          where index_row.indexrelid = to_regclass('public.inventory_device_inspections_latest_unit_idx')
            and index_row.indisvalid is true
            and index_row.indisready is true
            and pg_catalog.pg_get_indexdef(index_row.indexrelid) ilike '%store_id, stock_unit_id, inspected_at DESC, created_at DESC, id DESC%'
       )
      union all
      select 'inspection source pairing indexes'
       where not exists (
         select 1
           from pg_catalog.pg_index index_row
          where index_row.indexrelid = to_regclass('public.inventory_items_id_store_inspection_fk_idx')
            and index_row.indisvalid is true
            and index_row.indisready is true
            and pg_catalog.pg_get_indexdef(index_row.indexrelid) ilike '%(id, store_id)%'
       )
          or not exists (
         select 1
           from pg_catalog.pg_index index_row
          where index_row.indexrelid = to_regclass('public.inventory_stock_units_id_legacy_item_store_unique_idx')
            and index_row.indisvalid is true
            and index_row.indisready is true
            and pg_catalog.pg_get_indexdef(index_row.indexrelid) ilike '%(id, legacy_inventory_item_id, store_id)%'
       )
      union all
      select 'inspection/ledger browser ACL'
       where has_table_privilege('anon', 'public.inventory_device_inspections', 'select,insert,update,delete,truncate')
          or has_table_privilege('authenticated', 'public.inventory_device_inspections', 'select,insert,update,delete,truncate')
          or has_table_privilege('anon', 'public.inventory_product_inspection_command_ledger', 'select,insert,update,delete,truncate')
          or has_table_privilege('authenticated', 'public.inventory_product_inspection_command_ledger', 'select,insert,update,delete,truncate')
      union all
      select 'inspection/ledger service-role write ACL'
       where has_table_privilege('service_role', 'public.inventory_device_inspections', 'insert,update,delete,truncate')
          or has_table_privilege('service_role', 'public.inventory_product_inspection_command_ledger', 'insert,update,delete,truncate')
      union all
      select 'wrapper owner/security/search_path'
       where not exists (
         select 1
           from pg_catalog.pg_proc proc
           join pg_catalog.pg_namespace namespace_row on namespace_row.oid = proc.pronamespace
          where namespace_row.nspname = 'public'
            and proc.oid = to_regprocedure('public.repairdesk_inventory_product_save_with_inspection_v1(uuid,uuid,text,jsonb)')
            and pg_catalog.pg_get_userbyid(proc.proowner) in ('postgres', 'supabase_admin')
            and proc.prosecdef is true
            and exists (
              select 1 from unnest(coalesce(proc.proconfig, '{}'::text[])) as config
               where config in ('search_path=', 'search_path=""')
            )
       )
      union all
      select 'wrapper browser ACL'
       where has_function_privilege('anon', 'public.repairdesk_inventory_product_save_with_inspection_v1(uuid,uuid,text,jsonb)', 'EXECUTE')
          or has_function_privilege('authenticated', 'public.repairdesk_inventory_product_save_with_inspection_v1(uuid,uuid,text,jsonb)', 'EXECUTE')
    ) missing;
  if v_missing is not null then
    raise exception using errcode = '55000',
      message = 'inventory product inspection enable preflight failed: ' || v_missing;
  end if;
end;
$$;

revoke all on table public.inventory_product_inspection_command_ledger
  from public, anon, authenticated, service_role;
grant select on table public.inventory_product_inspection_command_ledger to service_role;

revoke all on table public.inventory_device_inspections
  from public, anon, authenticated, service_role;
grant select on table public.inventory_device_inspections to service_role;

revoke all on function public.repairdesk_inventory_product_save_with_inspection_v1(uuid, uuid, text, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.repairdesk_inventory_product_save_with_inspection_v1(uuid, uuid, text, jsonb)
  to service_role;

comment on function public.repairdesk_inventory_product_save_with_inspection_v1(uuid, uuid, text, jsonb)
  is 'Enabled atomic product + Phase 1 inspection boundary. Service-role only; application rollout remains flag/allowlist gated.';

notify pgrst, 'reload schema';
reset lock_timeout;
