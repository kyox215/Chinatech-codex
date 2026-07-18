do $$
declare
  v_payload jsonb;
  v_part_id uuid;
  v_lot_id uuid;
  v_allocation_id uuid;
begin
  v_payload := public.repairdesk_create_part_catalog_item_rpc(
    '00000000-0000-4000-8000-000000008000',
    '00000000-0000-4000-8000-000000008002',
    'SCR-IP15-BLK', 'iPhone 15 Screen', 'phone:screen',
    '["iPhone 15"]'::jsonb,
    '00000000-0000-4000-8000-000000008401'
  );
  if v_payload ->> 'code' <> 'created' then
    raise exception 'part_create_failed: %', v_payload;
  end if;
  v_part_id := (v_payload ->> 'id')::uuid;

  v_payload := public.repairdesk_create_part_catalog_item_rpc(
    '00000000-0000-4000-8000-000000008000',
    '00000000-0000-4000-8000-000000008002',
    'SCR-IP15-BLK', 'iPhone 15 Screen', 'phone:screen',
    '["iPhone 15"]'::jsonb,
    '00000000-0000-4000-8000-000000008401'
  );
  if v_payload ->> 'code' <> 'idempotent_replay'
     or (select count(*) from public.parts_catalog_items) <> 1 then
    raise exception 'part_create_not_idempotent: %', v_payload;
  end if;

  v_payload := public.repairdesk_receive_part_lot_rpc(
    '00000000-0000-4000-8000-000000008000',
    '00000000-0000-4000-8000-000000008002',
    v_part_id,
    '00000000-0000-4000-8000-000000008301',
    'UT-2026-0718-01', 'INV-2026-778', 2, 15,
    'EUR', 1, '2026-07-18 08:00:00+00', 'store_base',
    '00000000-0000-4000-8000-000000008402'
  );
  if v_payload ->> 'code' <> 'received' then
    raise exception 'lot_receive_failed: %', v_payload;
  end if;
  v_lot_id := (v_payload ->> 'id')::uuid;

  v_payload := public.repairdesk_allocate_order_part_rpc(
    '00000000-0000-4000-8000-000000008000',
    '00000000-0000-4000-8000-000000008102',
    '00000000-0000-4000-8000-000000008002',
    '00000000-0000-4000-8000-000000008203',
    v_lot_id, 1,
    '00000000-0000-4000-8000-000000008403'
  );
  if v_payload ->> 'code' <> 'allocated'
     or (v_payload ->> 'cost_amount')::numeric <> 15 then
    raise exception 'allocation_failed: %', v_payload;
  end if;
  v_allocation_id := (v_payload ->> 'id')::uuid;

  if (select available_quantity from public.parts_purchase_lots where id = v_lot_id) <> 1
     or (select coalesce(sum(quantity_delta), 0) from public.part_stock_movements where lot_id = v_lot_id) <> 1 then
    raise exception 'stock_not_reconciled_after_allocation';
  end if;
  if not exists (
    select 1 from public.repair_order_line_costs
    where order_id = '00000000-0000-4000-8000-000000008102'
      and line_id = '00000000-0000-4000-8000-000000008203'
      and cost_amount = 15 and source = 'purchase_lot'
      and evidence_status = 'confirmed'
      and source_reference_type = 'parts_purchase_lot'
      and source_reference_id = v_lot_id
  ) then raise exception 'allocation_cost_projection_missing'; end if;

  v_payload := public.repairdesk_allocate_order_part_rpc(
    '00000000-0000-4000-8000-000000008000',
    '00000000-0000-4000-8000-000000008107',
    '00000000-0000-4000-8000-000000008002',
    '00000000-0000-4000-8000-000000008208',
    v_lot_id, 2,
    '00000000-0000-4000-8000-000000008404'
  );
  if v_payload ->> 'code' <> 'insufficient_quantity'
     or (v_payload ->> 'available_quantity')::integer <> 1 then
    raise exception 'over_consumption_not_blocked: %', v_payload;
  end if;

  begin
    update public.parts_purchase_lots set unit_cost_eur = 99 where id = v_lot_id;
    raise exception 'lot_snapshot_update_was_allowed';
  exception when others then
    if sqlerrm = 'lot_snapshot_update_was_allowed' then raise; end if;
  end;

  v_payload := public.repairdesk_read_profit_breakdowns_rpc(
    '00000000-0000-4000-8000-000000008000',
    '00000000-0000-4000-8000-000000008002',
    '2026-07-18', '2026-07-18'
  );
  if not exists (
    select 1 from jsonb_array_elements(v_payload -> 'suppliers') as item
    where item ->> 'label' = 'UTOPYA'
      and (item ->> 'known_cost_amount')::numeric = 15
      and (item ->> 'exact_margin_amount')::numeric = 25
  ) then raise exception 'supplier_profit_breakdown_missing: %', v_payload; end if;

  v_payload := public.repairdesk_release_order_part_rpc(
    '00000000-0000-4000-8000-000000008000', v_allocation_id,
    '00000000-0000-4000-8000-000000008002',
    'Part returned to lot',
    '00000000-0000-4000-8000-000000008405'
  );
  if v_payload ->> 'code' <> 'released' then
    raise exception 'allocation_release_failed: %', v_payload;
  end if;
  if (select available_quantity from public.parts_purchase_lots where id = v_lot_id) <> 2
     or (select coalesce(sum(quantity_delta), 0) from public.part_stock_movements where lot_id = v_lot_id) <> 2
     or not exists (
       select 1 from public.repair_order_line_costs
       where order_id = '00000000-0000-4000-8000-000000008102'
         and line_id = '00000000-0000-4000-8000-000000008203'
         and cost_amount is null and source = 'manual_blank' and evidence_status = 'unknown'
     ) then raise exception 'release_did_not_restore_stock_and_cost'; end if;

  v_payload := public.repairdesk_release_order_part_rpc(
    '00000000-0000-4000-8000-000000008000', v_allocation_id,
    '00000000-0000-4000-8000-000000008002',
    'Part returned to lot',
    '00000000-0000-4000-8000-000000008405'
  );
  if v_payload ->> 'code' <> 'idempotent_replay' then
    raise exception 'release_not_idempotent: %', v_payload;
  end if;

  v_payload := public.repairdesk_allocate_order_part_rpc(
    '00000000-0000-4000-8000-000000008000',
    '00000000-0000-4000-8000-000000008102',
    '00000000-0000-4000-8000-000000008002',
    '00000000-0000-4000-8000-000000008203',
    v_lot_id, 1,
    '00000000-0000-4000-8000-000000008406'
  );
  if v_payload ->> 'code' <> 'allocated' then
    raise exception 'reallocation_after_release_failed: %', v_payload;
  end if;

  v_payload := public.repairdesk_read_parts_procurement_rpc(
    '00000000-0000-4000-8000-000000008000',
    '00000000-0000-4000-8000-000000008002',
    '00000000-0000-4000-8000-000000008102'
  );
  if v_payload ->> 'code' <> 'read'
     or jsonb_array_length(v_payload -> 'items') <> 1
     or jsonb_array_length(v_payload -> 'lots') <> 1
     or jsonb_array_length(v_payload -> 'allocations') <> 2 then
    raise exception 'procurement_read_mismatch: %', v_payload;
  end if;

  if public.repairdesk_read_parts_procurement_rpc(
    '00000000-0000-4000-8000-000000008000',
    '00000000-0000-4000-8000-000000008003', null
  ) ->> 'code' <> 'actor_forbidden' then
    raise exception 'technician_procurement_leak';
  end if;

  if has_table_privilege('authenticated', 'public.parts_purchase_lots', 'select')
     or has_table_privilege('authenticated', 'public.order_part_allocations', 'select')
     or has_table_privilege('anon', 'public.part_stock_movements', 'select') then
    raise exception 'procurement_acl_leak';
  end if;
end;
$$;

select 'order_cost_phase2_parts_harness_passed' as result;
