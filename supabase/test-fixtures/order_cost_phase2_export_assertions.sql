insert into public.store_member_permission_grants (
  store_id, membership_id, user_id, action, granted_by
) values (
  '00000000-0000-4000-8000-000000008000',
  '00000000-0000-4000-8000-000000008012',
  '00000000-0000-4000-8000-000000008002',
  'finance:cost_export',
  '00000000-0000-4000-8000-000000008001'
);

do $$
declare
  v_payload jsonb;
  v_items jsonb;
begin
  v_payload := public.repairdesk_read_cost_export_rpc(
    '00000000-0000-4000-8000-000000008000',
    '00000000-0000-4000-8000-000000008002',
    '2026-07-18', '2026-07-18', null, null, 10000
  );
  if v_payload ->> 'code' <> 'read'
     or (v_payload ->> 'overflow')::boolean
     or (v_payload ->> 'row_count')::integer <> 5 then
    raise exception 'cost_export_read_mismatch: %', v_payload;
  end if;
  v_items := v_payload -> 'items';
  if exists (
    select 1 from jsonb_array_elements(v_items) as item
    where item ->> 'order_public_no' in ('R-PROFIT-D', 'R-PROFIT-E', 'R-PROFIT-G')
  ) then raise exception 'excluded_order_leaked_into_export: %', v_items; end if;
  if (select sum((item ->> 'quote_amount_eur')::numeric) from jsonb_array_elements(v_items) item) <> 270
     or (select sum((item ->> 'cost_amount_eur')::numeric) from jsonb_array_elements(v_items) item) <> 90
     or (select sum((item ->> 'margin_amount_eur')::numeric) from jsonb_array_elements(v_items) item) <> 180 then
    raise exception 'cost_export_totals_do_not_reconcile: %', v_items;
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_items) as item
    where item ?| array['customer_name','phone','email','imei','unlock','message']
  ) then raise exception 'pii_key_leaked_into_export'; end if;

  v_payload := public.repairdesk_read_cost_export_rpc(
    '00000000-0000-4000-8000-000000008000',
    '00000000-0000-4000-8000-000000008002',
    '2026-07-18', '2026-07-18', array['diagnosing'], array['purchase_lot'], 10000
  );
  if (v_payload ->> 'row_count')::integer <> 1
     or v_payload #>> '{items,0,cost_source}' <> 'purchase_lot'
     or v_payload #>> '{items,0,supplier_name}' <> 'UTOPYA' then
    raise exception 'cost_export_filter_or_supplier_mismatch: %', v_payload;
  end if;

  v_payload := public.repairdesk_read_cost_export_rpc(
    '00000000-0000-4000-8000-000000008000',
    '00000000-0000-4000-8000-000000008002',
    '2026-07-18', '2026-07-18', null, null, 1
  );
  if not (v_payload ->> 'overflow')::boolean
     or jsonb_array_length(v_payload -> 'items') <> 0 then
    raise exception 'cost_export_limit_did_not_fail_closed: %', v_payload;
  end if;

  if public.repairdesk_read_cost_export_rpc(
    '00000000-0000-4000-8000-000000008000',
    '00000000-0000-4000-8000-000000008003',
    '2026-07-18', '2026-07-18', null, null, 10000
  ) ->> 'code' <> 'actor_forbidden' then
    raise exception 'technician_cost_export_leak';
  end if;
  if public.repairdesk_read_cost_export_rpc(
    '00000000-0000-4000-8000-000000008999',
    '00000000-0000-4000-8000-000000008002',
    '2026-07-18', '2026-07-18', null, null, 10000
  ) ->> 'code' <> 'actor_forbidden' then
    raise exception 'cross_store_cost_export_leak';
  end if;
  if has_function_privilege(
    'authenticated',
    'public.repairdesk_read_cost_export_rpc(uuid,uuid,date,date,text[],text[],integer)',
    'execute'
  ) or has_function_privilege(
    'anon',
    'public.repairdesk_read_cost_export_rpc(uuid,uuid,date,date,text[],text[],integer)',
    'execute'
  ) then raise exception 'browser_cost_export_rpc_acl_leak'; end if;
end;
$$;

select 'order_cost_phase2_export_harness_passed' as result;
