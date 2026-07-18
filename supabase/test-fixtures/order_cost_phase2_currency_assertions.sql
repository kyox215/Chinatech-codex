do $$
declare
  v_store constant uuid := '00000000-0000-4000-8000-000000008000';
  v_owner constant uuid := '00000000-0000-4000-8000-000000008001';
  v_manager constant uuid := '00000000-0000-4000-8000-000000008002';
  v_tech constant uuid := '00000000-0000-4000-8000-000000008003';
  v_part_id uuid;
  v_usd_lot_id uuid;
  v_eur_at timestamptz;
  v_payload jsonb;
  v_items jsonb;
begin
  if (select count(*) from public.store_cost_currency_rates where store_id = v_store) <> 5
     or (select rate_to_eur from public.store_cost_currency_rates where store_id = v_store and currency_code = 'EUR') <> 1
     or (select count(*) from public.store_cost_currency_rates where store_id = v_store and enabled) <> 1 then
    raise exception 'initial_currency_configuration_invalid';
  end if;
  select rate_at into v_eur_at from public.store_cost_currency_rates
  where store_id = v_store and currency_code = 'EUR';

  if public.repairdesk_read_cost_currency_settings_rpc(v_store, v_manager) ->> 'code'
     <> 'actor_forbidden' then
    raise exception 'manager_read_owner_currency_settings';
  end if;
  if public.repairdesk_read_cost_currency_options_rpc(v_store, v_tech) ->> 'code'
     <> 'actor_forbidden' then
    raise exception 'technician_read_currency_options';
  end if;

  v_items := jsonb_build_array(
    jsonb_build_object('currency_code','EUR','enabled',true,'rate_to_eur',0.99,'rate_at',v_eur_at),
    jsonb_build_object('currency_code','USD','enabled',false,'rate_to_eur',null,'rate_at',null),
    jsonb_build_object('currency_code','GBP','enabled',false,'rate_to_eur',null,'rate_at',null),
    jsonb_build_object('currency_code','CNY','enabled',false,'rate_to_eur',null,'rate_at',null),
    jsonb_build_object('currency_code','CHF','enabled',false,'rate_to_eur',null,'rate_at',null)
  );
  if public.repairdesk_replace_cost_currency_settings_rpc(v_store, v_owner, 1, v_items)
     ->> 'code' <> 'eur_rate_must_be_one' then
    raise exception 'eur_non_one_rate_accepted';
  end if;

  v_items := jsonb_build_array(
    jsonb_build_object('currency_code','EUR','enabled',true,'rate_to_eur',1,'rate_at',v_eur_at),
    jsonb_build_object('currency_code','USD','enabled',true,'rate_to_eur',0.12345678901,'rate_at',clock_timestamp()),
    jsonb_build_object('currency_code','GBP','enabled',false,'rate_to_eur',null,'rate_at',null),
    jsonb_build_object('currency_code','CNY','enabled',false,'rate_to_eur',null,'rate_at',null),
    jsonb_build_object('currency_code','CHF','enabled',false,'rate_to_eur',null,'rate_at',null)
  );
  if public.repairdesk_replace_cost_currency_settings_rpc(v_store, v_owner, 1, v_items)
     ->> 'code' <> 'invalid_currency_rate' then
    raise exception 'excess_rate_precision_accepted';
  end if;
  if (select revision from public.store_cost_currency_configs where store_id = v_store) <> 1 then
    raise exception 'invalid_settings_changed_version';
  end if;

  v_items := jsonb_build_array(
    jsonb_build_object('currency_code','EUR','enabled',true,'rate_to_eur',1,'rate_at',v_eur_at),
    jsonb_build_object('currency_code','USD','enabled',true,'rate_to_eur',0.9,'rate_at',clock_timestamp()),
    jsonb_build_object('currency_code','GBP','enabled',true,'rate_to_eur',1.2,'rate_at',clock_timestamp() - interval '31 days'),
    jsonb_build_object('currency_code','CNY','enabled',true,'rate_to_eur',0.12,'rate_at',clock_timestamp()),
    jsonb_build_object('currency_code','CHF','enabled',false,'rate_to_eur',null,'rate_at',null)
  );
  v_payload := public.repairdesk_replace_cost_currency_settings_rpc(v_store, v_owner, 1, v_items);
  if v_payload ->> 'code' <> 'updated' or (v_payload ->> 'version')::integer <> 2 then
    raise exception 'valid_currency_settings_failed: %', v_payload;
  end if;
  v_payload := public.repairdesk_read_cost_currency_options_rpc(v_store, v_manager);
  if v_payload ->> 'code' <> 'read'
     or jsonb_array_length(v_payload -> 'items') <> 4
     or not exists (
       select 1 from jsonb_array_elements(v_payload -> 'items') as item
       where item ->> 'currency_code' = 'GBP' and (item ->> 'stale')::boolean
     ) then
    raise exception 'manager_currency_options_invalid: %', v_payload;
  end if;
  v_payload := public.repairdesk_read_cost_currency_settings_rpc(v_store, v_owner);
  if jsonb_array_length(v_payload -> 'items') <> 5 then
    raise exception 'owner_currency_settings_incomplete: %', v_payload;
  end if;

  select id into v_part_id from public.parts_catalog_items
  where store_id = v_store and sku = 'SCR-IP15-BLK';
  v_payload := public.repairdesk_receive_part_lot_v2_rpc(
    v_store, v_manager, v_part_id, '00000000-0000-4000-8000-000000008301',
    'USD-LOT-1', 'USD-INVOICE-1', 3, 10, 'USD',
    '00000000-0000-4000-8000-000000008501'
  );
  if v_payload ->> 'code' <> 'received'
     or (v_payload ->> 'unit_cost_eur')::numeric <> 9
     or (v_payload ->> 'fx_rate_to_eur')::numeric <> 0.9
     or (v_payload ->> 'fx_rate_revision')::integer <> 2 then
    raise exception 'usd_receipt_snapshot_invalid: %', v_payload;
  end if;
  v_usd_lot_id := (v_payload ->> 'id')::uuid;

  if public.repairdesk_receive_part_lot_v2_rpc(
    v_store, v_manager, v_part_id, null, 'BAD-PRECISION', null, 1,
    0.1234567, 'USD', '00000000-0000-4000-8000-000000008502'
  ) ->> 'code' <> 'invalid_input' then
    raise exception 'excess_original_cost_precision_accepted';
  end if;
  if public.repairdesk_receive_part_lot_v2_rpc(
    v_store, v_manager, v_part_id, null, 'STALE-GBP', null, 1,
    10, 'GBP', '00000000-0000-4000-8000-000000008503'
  ) ->> 'code' <> 'currency_rate_stale' then
    raise exception 'stale_currency_receipt_accepted';
  end if;
  if public.repairdesk_receive_part_lot_v2_rpc(
    v_store, v_manager, v_part_id, null, 'DISABLED-CHF', null, 1,
    10, 'CHF', '00000000-0000-4000-8000-000000008504'
  ) ->> 'code' <> 'currency_not_approved' then
    raise exception 'disabled_currency_receipt_accepted';
  end if;
  if public.repairdesk_receive_part_lot_rpc(
    v_store, v_manager, v_part_id, null, 'INJECTED-USD', null, 1,
    10, 'USD', 0.9, clock_timestamp(), 'client_manual',
    '00000000-0000-4000-8000-000000008505'
  ) ->> 'code' <> 'invalid_input' then
    raise exception 'legacy_rpc_non_eur_injection_accepted';
  end if;

  v_payload := public.repairdesk_receive_part_lot_v2_rpc(
    v_store, v_manager, v_part_id, null, 'CNY-LOT-1', null, 1,
    100, 'CNY', '00000000-0000-4000-8000-000000008506'
  );
  if (v_payload ->> 'unit_cost_eur')::numeric <> 12 then
    raise exception 'cny_receipt_conversion_failed: %', v_payload;
  end if;
  v_payload := public.repairdesk_receive_part_lot_rpc(
    v_store, v_manager, v_part_id, null, 'EUR-LOT-2', null, 1,
    7.25, 'EUR', 1, clock_timestamp(), 'store_base',
    '00000000-0000-4000-8000-000000008507'
  );
  if v_payload ->> 'code' <> 'received'
     or (v_payload ->> 'unit_cost_eur')::numeric <> 7.25 then
    raise exception 'eur_compatibility_receipt_failed: %', v_payload;
  end if;

  v_items := jsonb_build_array(
    jsonb_build_object('currency_code','EUR','enabled',true,'rate_to_eur',1,'rate_at',v_eur_at),
    jsonb_build_object('currency_code','USD','enabled',true,'rate_to_eur',0.8,'rate_at',clock_timestamp()),
    jsonb_build_object('currency_code','GBP','enabled',true,'rate_to_eur',1.2,'rate_at',clock_timestamp() - interval '31 days'),
    jsonb_build_object('currency_code','CNY','enabled',true,'rate_to_eur',0.12,'rate_at',clock_timestamp()),
    jsonb_build_object('currency_code','CHF','enabled',false,'rate_to_eur',null,'rate_at',null)
  );
  v_payload := public.repairdesk_replace_cost_currency_settings_rpc(v_store, v_owner, 2, v_items);
  if v_payload ->> 'code' <> 'updated' or (v_payload ->> 'version')::integer <> 3 then
    raise exception 'currency_rate_change_failed: %', v_payload;
  end if;
  if (select fx_rate_to_eur from public.parts_purchase_lots where id = v_usd_lot_id) <> 0.9
     or (select unit_cost_eur from public.parts_purchase_lots where id = v_usd_lot_id) <> 9
     or (select fx_rate_revision from public.parts_purchase_lots where id = v_usd_lot_id) <> 2 then
    raise exception 'historical_lot_changed_with_current_rate';
  end if;
  v_payload := public.repairdesk_receive_part_lot_v2_rpc(
    v_store, v_manager, v_part_id, '00000000-0000-4000-8000-000000008301',
    'USD-LOT-1', 'USD-INVOICE-1', 3, 10, 'USD',
    '00000000-0000-4000-8000-000000008501'
  );
  if v_payload ->> 'code' <> 'idempotent_replay'
     or (v_payload ->> 'fx_rate_to_eur')::numeric <> 0.9
     or (v_payload ->> 'unit_cost_eur')::numeric <> 9 then
    raise exception 'idempotent_receipt_did_not_preserve_snapshot: %', v_payload;
  end if;
  v_payload := public.repairdesk_receive_part_lot_v2_rpc(
    v_store, v_manager, v_part_id, null, 'USD-LOT-2', null, 1,
    10, 'USD', '00000000-0000-4000-8000-000000008508'
  );
  if (v_payload ->> 'fx_rate_to_eur')::numeric <> 0.8
     or (v_payload ->> 'unit_cost_eur')::numeric <> 8
     or (v_payload ->> 'fx_rate_revision')::integer <> 3 then
    raise exception 'new_receipt_did_not_use_current_rate: %', v_payload;
  end if;

  v_payload := public.repairdesk_allocate_order_part_rpc(
    v_store, '00000000-0000-4000-8000-000000008102', v_manager,
    '00000000-0000-4000-8000-000000008202', v_usd_lot_id, 1,
    '00000000-0000-4000-8000-000000008509'
  );
  if v_payload ->> 'code' <> 'allocated' or (v_payload ->> 'cost_amount')::numeric <> 9 then
    raise exception 'usd_allocation_failed: %', v_payload;
  end if;
  if not exists (
    select 1 from public.repair_order_line_costs
    where order_id = '00000000-0000-4000-8000-000000008102'
      and line_id = '00000000-0000-4000-8000-000000008202'
      and cost_amount = 9 and original_amount = 10
      and original_currency_code = 'USD' and fx_rate_to_eur = 0.9
      and source = 'purchase_lot' and evidence_status = 'confirmed'
  ) then raise exception 'usd_allocation_snapshot_missing'; end if;

  v_payload := public.repairdesk_read_cost_export_rpc(
    v_store, v_manager, '2026-07-18', '2026-07-18',
    array['diagnosing'], array['purchase_lot'], 10000
  );
  if not exists (
    select 1 from jsonb_array_elements(v_payload -> 'items') as item
    where item ->> 'line_id' = '00000000-0000-4000-8000-000000008202'
      and (item ->> 'cost_amount_eur')::numeric = 9
      and (item ->> 'original_amount')::numeric = 10
      and item ->> 'original_currency_code' = 'USD'
      and (item ->> 'fx_rate_to_eur')::numeric = 0.9
      and (item ->> 'margin_amount_eur')::numeric = 51
  ) then raise exception 'usd_export_did_not_reconcile: %', v_payload; end if;

  v_payload := public.repairdesk_read_profit_currency_drilldown_rpc(
    v_store, v_manager, '2026-07-18', '2026-07-18'
  );
  if v_payload ->> 'code' <> 'read' or (v_payload ->> 'overflow')::boolean
     or not exists (
       select 1 from jsonb_array_elements(v_payload -> 'items') as item
       where item ->> 'order_id' = '00000000-0000-4000-8000-000000008102'
         and item ->> 'line_id' = '00000000-0000-4000-8000-000000008202'
         and (item ->> 'cost_amount_eur')::numeric = 9
         and (item ->> 'original_amount')::numeric = 10
         and item ->> 'original_currency_code' = 'USD'
         and (item ->> 'fx_rate_to_eur')::numeric = 0.9
     ) then raise exception 'profit_currency_drilldown_missing: %', v_payload; end if;
  if public.repairdesk_read_profit_currency_drilldown_rpc(
    v_store, v_tech, '2026-07-18', '2026-07-18'
  ) ->> 'code' <> 'actor_forbidden' then
    raise exception 'technician_profit_currency_drilldown_leak';
  end if;

  if has_table_privilege('authenticated', 'public.store_cost_currency_rates', 'select')
     or has_table_privilege('service_role', 'public.store_cost_currency_rates', 'update')
     or has_function_privilege(
       'authenticated', 'public.repairdesk_read_cost_currency_options_rpc(uuid,uuid)', 'execute'
     ) or has_function_privilege(
       'authenticated',
       'public.repairdesk_read_profit_currency_drilldown_rpc(uuid,uuid,date,date)',
       'execute'
     ) then raise exception 'currency_acl_leak'; end if;
  if (select count(*) from public.store_cost_currency_rate_revisions where store_id = v_store) < 7 then
    raise exception 'currency_rate_revisions_not_appended';
  end if;

  insert into public.stores (id, name) values (
    '00000000-0000-4000-8000-000000008900', 'New Currency Store'
  );
  if (select count(*) from public.store_cost_currency_rates
      where store_id = '00000000-0000-4000-8000-000000008900') <> 5
     or (select rate_to_eur from public.store_cost_currency_rates
         where store_id = '00000000-0000-4000-8000-000000008900'
           and currency_code = 'EUR') <> 1 then
    raise exception 'new_store_currency_initialization_failed';
  end if;
end;
$$;

select 'order_cost_phase2_multi_currency_harness_passed' as result;
