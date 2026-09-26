-- Run after order-purchasing-schema.sql and 20260926071024_order_purchasing_lines.sql.
do $$
declare
  v jsonb;
  v_replay jsonb;
  v_draft uuid;
  v_ready uuid;
  v_ordered uuid;
  v_inventory_counts bigint[];
  v_audit_count bigint;
begin
  v_inventory_counts := array[
    (select count(*) from public.parts_purchase_lots),
    (select count(*) from public.part_stock_movements),
    (select count(*) from public.repair_order_line_costs)
  ];

  v := public.repairdesk_read_order_purchasing(
    '10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000003',
    array['10000000-0000-4000-8000-000000000301']::uuid[]);
  if v->>'code' <> 'actor_forbidden' then raise exception 'cost_read_leaked: %',v; end if;

  v := public.repairdesk_read_order_purchasing(
    '10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001',
    array['20000000-0000-4000-8000-000000000301']::uuid[]);
  if v->>'code' <> 'order_not_found' then raise exception 'cross_store_read_leaked: %',v; end if;

  v := public.repairdesk_save_order_purchase(
    '10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001',null,
    '10000000-0000-4000-8000-000000000301',null,'Adhesive',null,null,1,'needed',0,
    '10000000-0000-4000-8000-000000000501');
  if v->>'ok'<>'true' then raise exception 'draft_create_failed: %',v; end if;
  v_draft := (v#>>'{line,id}')::uuid;
  v_audit_count := (select count(*) from public.audit_logs);
  v_replay := public.repairdesk_save_order_purchase(
    '10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001',null,
    '10000000-0000-4000-8000-000000000301',null,'Adhesive',null,null,1,'needed',0,
    '10000000-0000-4000-8000-000000000501');
  if v_replay->>'replayed'<>'true' or v_replay#>>'{line,id}'<>v_draft::text then
    raise exception 'save_not_idempotent: %',v_replay;
  end if;
  if (select count(*) from public.audit_logs) <> v_audit_count then
    raise exception 'save_replay_duplicated_audit';
  end if;
  v_replay := public.repairdesk_save_order_purchase(
    '10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001',null,
    '10000000-0000-4000-8000-000000000301',null,'Adhesive',null,null,2,'needed',0,
    '10000000-0000-4000-8000-000000000501');
  if v_replay->>'code'<>'idempotency_conflict' then raise exception 'idempotency_conflict_missed'; end if;

  v := public.repairdesk_save_order_purchase(
    '10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000002',null,
    '10000000-0000-4000-8000-000000000301','10000000-0000-4000-8000-000000000401',
    'Screen','10000000-0000-4000-8000-000000000201','0',1,'ordered',0,
    '10000000-0000-4000-8000-000000000502');
  if v#>>'{line,unit_cost_eur}'<>'0.00' then raise exception 'zero_cost_not_string: %',v; end if;
  v_ordered := (v#>>'{line,id}')::uuid;

  v := public.repairdesk_save_order_purchase(
    '10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000002',null,
    '10000000-0000-4000-8000-000000000301',null,'Camera',
    '10000000-0000-4000-8000-000000000201','12.34',1,'needed',0,
    '10000000-0000-4000-8000-000000000503');
  v_ready := (v#>>'{line,id}')::uuid;

  v := public.repairdesk_save_order_purchase(
    '10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000002',v_ready,
    '10000000-0000-4000-8000-000000000301',null,'Camera',
    '10000000-0000-4000-8000-000000000201','12.34',1,'needed',99,
    '10000000-0000-4000-8000-000000000504');
  if v->>'code'<>'stale_revision' then raise exception 'cas_not_enforced: %',v; end if;

  v := public.repairdesk_batch_order_purchases(
    '10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000002','mark_ordered',
    jsonb_build_array(jsonb_build_object('id',v_draft,'expected_revision',1),
                      jsonb_build_object('id',v_ready,'expected_revision',1)),null,
    '10000000-0000-4000-8000-000000000505');
  if jsonb_array_length(v->'results')<>2
     or not exists(select 1 from jsonb_array_elements(v->'results') x where x->>'id'=v_draft::text and x->>'code'='incomplete_order')
     or not exists(select 1 from jsonb_array_elements(v->'results') x where x->>'id'=v_ready::text and x->>'ok'='true') then
    raise exception 'batch_partial_result_wrong: %',v;
  end if;
  v_audit_count := (select count(*) from public.audit_logs);

  v_replay := public.repairdesk_batch_order_purchases(
    '10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000002','mark_ordered',
    jsonb_build_array(jsonb_build_object('id',v_draft,'expected_revision',1),
                      jsonb_build_object('id',v_ready,'expected_revision',1)),null,
    '10000000-0000-4000-8000-000000000505');
  if v_replay->>'replayed'<>'true' then raise exception 'batch_not_idempotent'; end if;
  if (select count(*) from public.audit_logs) <> v_audit_count then
    raise exception 'batch_replay_duplicated_audit';
  end if;

  v := public.repairdesk_batch_order_purchases(
    '10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000002','assign_supplier',
    jsonb_build_array(jsonb_build_object('id',v_draft,'expected_revision',1)),
    '10000000-0000-4000-8000-000000000201',
    '10000000-0000-4000-8000-000000000506');
  if v#>>'{results,0,ok}' <> 'true' then raise exception 'supplier_assign_failed: %',v; end if;

  update public.store_member_permission_grants
  set revoked_at = clock_timestamp()
  where store_id='10000000-0000-4000-8000-000000000010'
    and user_id='10000000-0000-4000-8000-000000000002'
    and action='supplier:assign';

  v_replay := public.repairdesk_batch_order_purchases(
    '10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000002','assign_supplier',
    jsonb_build_array(jsonb_build_object('id',v_draft,'expected_revision',1)),
    '10000000-0000-4000-8000-000000000201',
    '10000000-0000-4000-8000-000000000506');
  if v_replay->>'code' <> 'actor_forbidden' or v_replay ? 'results' then
    raise exception 'revoked_assign_replay_leaked: %',v_replay;
  end if;

  v_replay := public.repairdesk_save_order_purchase(
    '10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000002',null,
    '10000000-0000-4000-8000-000000000301','10000000-0000-4000-8000-000000000401',
    'Screen','10000000-0000-4000-8000-000000000201','0',1,'ordered',0,
    '10000000-0000-4000-8000-000000000502');
  if v_replay->>'code' <> 'actor_forbidden' or v_replay ? 'line' then
    raise exception 'revoked_save_assign_replay_leaked: %',v_replay;
  end if;

  update public.store_member_permission_grants
  set revoked_at = clock_timestamp()
  where store_id='10000000-0000-4000-8000-000000000010'
    and user_id='10000000-0000-4000-8000-000000000002'
    and action='supplier:read';

  -- A supplier-backed save and its retry must not expose the line without supplier:read.
  v := public.repairdesk_save_order_purchase(
    '10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000002',v_ready,
    '10000000-0000-4000-8000-000000000301',null,'Camera',
    '10000000-0000-4000-8000-000000000201','13.00',2,'ordered',2,
    '10000000-0000-4000-8000-000000000507');
  if v->>'code' <> 'actor_forbidden' or v ? 'line' then
    raise exception 'supplier_read_required_for_save: %',v;
  end if;
  v_replay := public.repairdesk_save_order_purchase(
    '10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000002',v_ready,
    '10000000-0000-4000-8000-000000000301',null,'Camera',
    '10000000-0000-4000-8000-000000000201','13.00',2,'ordered',2,
    '10000000-0000-4000-8000-000000000507');
  if v_replay->>'code' <> 'actor_forbidden' or v_replay ? 'line' then
    raise exception 'supplier_read_required_for_save_retry: %',v_replay;
  end if;

  update public.store_member_permission_grants set revoked_at=null
  where store_id='10000000-0000-4000-8000-000000000010'
    and user_id='10000000-0000-4000-8000-000000000002'
    and action='supplier:read';

  -- finance:cost_manage plus supplier:read may edit an unchanged supplier without supplier:assign.
  v := public.repairdesk_save_order_purchase(
    '10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000002',v_ready,
    '10000000-0000-4000-8000-000000000301',null,'Camera',
    '10000000-0000-4000-8000-000000000201','13.00',2,'ordered',2,
    '10000000-0000-4000-8000-000000000507');
  if v#>>'{line,revision}' <> '3' or v#>>'{line,unit_cost_eur}' <> '13.00' then
    raise exception 'unchanged_supplier_cost_edit_blocked: %',v;
  end if;

  v_replay := public.repairdesk_save_order_purchase(
    '10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000002',v_ready,
    '10000000-0000-4000-8000-000000000301',null,'Camera',
    '10000000-0000-4000-8000-000000000201','13.00',2,'ordered',2,
    '10000000-0000-4000-8000-000000000507');
  if v_replay->>'replayed' <> 'true' then raise exception 'unchanged_supplier_replay_failed'; end if;

  v := public.repairdesk_save_order_purchase(
    '10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000002',v_ready,
    '10000000-0000-4000-8000-000000000301',null,'Camera',
    '10000000-0000-4000-8000-000000000202','13.00',2,'ordered',3,
    '10000000-0000-4000-8000-000000000508');
  if v->>'code' <> 'actor_forbidden' then raise exception 'supplier_change_without_grant_allowed: %',v; end if;

  v := public.repairdesk_save_order_purchase(
    '10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000002',null,
    '10000000-0000-4000-8000-000000000301',null,'Battery',
    '10000000-0000-4000-8000-000000000201','20.00',1,'needed',0,
    '10000000-0000-4000-8000-000000000509');
  if v->>'code' <> 'actor_forbidden' then raise exception 'supplier_create_without_grant_allowed: %',v; end if;

  update public.store_member_permission_grants
  set revoked_at = clock_timestamp()
  where store_id='10000000-0000-4000-8000-000000000010'
    and user_id='10000000-0000-4000-8000-000000000002'
    and action='finance:cost_manage';
  v_replay := public.repairdesk_save_order_purchase(
    '10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000002',v_ready,
    '10000000-0000-4000-8000-000000000301',null,'Camera',
    '10000000-0000-4000-8000-000000000201','13.00',2,'ordered',2,
    '10000000-0000-4000-8000-000000000507');
  if v_replay->>'code' <> 'actor_forbidden' or v_replay ? 'line' then
    raise exception 'revoked_cost_replay_leaked: %',v_replay;
  end if;
  update public.store_member_permission_grants set revoked_at=null
  where store_id='10000000-0000-4000-8000-000000000010'
    and user_id='10000000-0000-4000-8000-000000000002'
    and action in ('finance:cost_manage','supplier:assign');

  update public.stores set status='suspended'
  where id='10000000-0000-4000-8000-000000000010';
  v_replay := public.repairdesk_save_order_purchase(
    '10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001',null,
    '10000000-0000-4000-8000-000000000301',null,'Adhesive',null,null,1,'needed',0,
    '10000000-0000-4000-8000-000000000501');
  if v_replay->>'code' <> 'actor_forbidden' or v_replay ? 'line' then
    raise exception 'inactive_store_replay_leaked: %',v_replay;
  end if;
  update public.stores set status='active'
  where id='10000000-0000-4000-8000-000000000010';

  if (select parts_status from public.repair_orders where id='10000000-0000-4000-8000-000000000301')<>'needed' then
    raise exception 'aggregate_needed_precedence_failed';
  end if;
  if v_inventory_counts <> array[(select count(*) from public.parts_purchase_lots),
    (select count(*) from public.part_stock_movements),(select count(*) from public.repair_order_line_costs)] then
    raise exception 'inventory_side_effect_detected';
  end if;
  if has_table_privilege('authenticated','public.order_part_purchases','select')
     or has_table_privilege('anon','public.order_part_purchase_revisions','select')
     or has_table_privilege('service_role','public.order_part_purchase_operations','select') then
    raise exception 'cost_table_acl_leak';
  end if;
  if (select count(*) from public.order_part_purchase_revisions) <> 6 then
    raise exception 'revision_history_missing';
  end if;
  if exists (
    select 1 from public.audit_logs
    where entity_type like 'order_part_purchase%'
      and (metadata::text like '%unit_cost%' or metadata::text like '%13.00%')
  ) then raise exception 'audit_cost_leak'; end if;
end $$;

create function public.order_purchasing_fixture_fail_audit()
returns trigger language plpgsql as $$
begin
  if new.entity_type in ('order_part_purchase', 'order_part_purchase_batch') then
    raise exception 'fixture_audit_failure';
  end if;
  return new;
end $$;
create trigger order_purchasing_fixture_fail_audit_trigger
before insert on public.audit_logs
for each row execute function public.order_purchasing_fixture_fail_audit();

do $$
declare
  v jsonb;
  v_purchase_count bigint := (select count(*) from public.order_part_purchases);
  v_revision_count bigint := (select count(*) from public.order_part_purchase_revisions);
  v_operation_count bigint := (select count(*) from public.order_part_purchase_operations);
begin
  begin
    v := public.repairdesk_save_order_purchase(
      '10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001',null,
      '10000000-0000-4000-8000-000000000301',null,'Audit rollback',null,null,1,'needed',0,
      '10000000-0000-4000-8000-000000000510');
    raise exception 'audit_failure_did_not_abort: %',v;
  exception when others then
    if sqlerrm not like '%fixture_audit_failure%' then raise; end if;
  end;
  if (select count(*) from public.order_part_purchases) <> v_purchase_count
     or (select count(*) from public.order_part_purchase_revisions) <> v_revision_count
     or (select count(*) from public.order_part_purchase_operations) <> v_operation_count
     or exists (select 1 from public.order_part_purchases where part_name='Audit rollback')
     or exists (select 1 from public.order_part_purchase_operations
       where idempotency_key='10000000-0000-4000-8000-000000000510') then
    raise exception 'audit_failure_did_not_roll_back_transaction';
  end if;
end $$;

drop trigger order_purchasing_fixture_fail_audit_trigger on public.audit_logs;
drop function public.order_purchasing_fixture_fail_audit();

do $$
declare
  v jsonb;
  v_purchase_id uuid;
  v_audit_count bigint;
begin
  v := public.repairdesk_save_order_purchase(
    '10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001',null,
    '10000000-0000-4000-8000-000000000301',null,'Audit rollback',null,null,1,'needed',0,
    '10000000-0000-4000-8000-000000000510');
  if v->>'ok'<>'true' then raise exception 'audit_retry_failed: %',v; end if;
  v_purchase_id := (v#>>'{line,id}')::uuid;
  if (select count(*) from public.audit_logs
      where entity_type='order_part_purchase' and entity_id=v_purchase_id::text) <> 1 then
    raise exception 'audit_retry_missing_atomic_audit';
  end if;
  v_audit_count := (select count(*) from public.audit_logs);
  v := public.repairdesk_save_order_purchase(
    '10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001',null,
    '10000000-0000-4000-8000-000000000301',null,'Audit rollback',null,null,1,'needed',0,
    '10000000-0000-4000-8000-000000000510');
  if v->>'replayed'<>'true' or (select count(*) from public.audit_logs)<>v_audit_count then
    raise exception 'audit_retry_replay_duplicated: %',v;
  end if;
end $$;

select 'order_purchasing_harness_passed' as result;
