do $$
declare
  v_payload jsonb;
  v_expected jsonb;
  v_completed jsonb;
begin
  v_payload := public.repairdesk_read_profit_center_rpc(
    '00000000-0000-4000-8000-000000008000',
    '00000000-0000-4000-8000-000000008002',
    '2026-07-18',
    '2026-07-18'
  );

  if v_payload ->> 'code' <> 'read' then
    raise exception 'manager_profit_read_failed: %', v_payload;
  end if;
  v_expected := v_payload #> '{summary,expected}';
  v_completed := v_payload #> '{summary,completed}';

  if (v_expected ->> 'order_count')::integer <> 5
     or (v_expected ->> 'eligible_order_count')::integer <> 4
     or (v_expected ->> 'quote_amount')::numeric <> 270
     or (v_expected ->> 'known_cost_amount')::numeric <> 75
     or (v_expected ->> 'exact_margin_amount')::numeric <> 115
     or (v_expected ->> 'exact_order_count')::integer <> 3
     or (v_expected ->> 'incomplete_order_count')::integer <> 1
     or (v_expected ->> 'estimated_order_count')::integer <> 1
     or (v_expected ->> 'negative_margin_order_count')::integer <> 1 then
    raise exception 'expected_summary_mismatch: %', v_expected;
  end if;

  if (v_completed ->> 'order_count')::integer <> 4
     or (v_completed ->> 'eligible_order_count')::integer <> 3
     or (v_completed ->> 'quote_amount')::numeric <> 170
     or (v_completed ->> 'known_cost_amount')::numeric <> 55
     or (v_completed ->> 'exact_margin_amount')::numeric <> 115
     or (v_completed ->> 'exact_order_count')::integer <> 3
     or (v_completed ->> 'incomplete_order_count')::integer <> 0 then
    raise exception 'completed_summary_mismatch: %', v_completed;
  end if;

  if (v_payload #>> '{summary,data_quality,unknown_line_count}')::integer <> 1
     or (v_payload #>> '{summary,data_quality,refunded_order_count}')::integer <> 1
     or (v_payload #>> '{summary,data_quality,rework_order_count}')::integer <> 1
     or (v_payload #>> '{summary,collection_reference,amount}')::numeric <> 110
     or (v_payload #>> '{summary,collection_reference,entry_count}')::integer <> 2
     or (v_payload #>> '{summary,collection_reference,non_eur_entry_count}')::integer <> 1 then
    raise exception 'quality_or_collection_mismatch: %', v_payload -> 'summary';
  end if;

  if jsonb_array_length(v_payload -> 'trend') <> 1
     or v_payload #>> '{trend,0,date}' <> '2026-07-18' then
    raise exception 'timezone_trend_mismatch: %', v_payload -> 'trend';
  end if;

  if jsonb_array_length(v_payload -> 'orders') <> 5
     or exists (
       select 1
       from jsonb_array_elements(v_payload -> 'orders') as item
       where item ->> 'public_no' in ('R-PROFIT-E', 'R-PROFIT-G')
     ) then
    raise exception 'cancelled_or_next_day_leaked: %', v_payload -> 'orders';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(v_payload -> 'orders') as item
    where item ->> 'public_no' = 'R-PROFIT-B'
      and item ->> 'cost_completeness' = 'incomplete'
      and item -> 'quote_gross_margin' = 'null'::jsonb
  ) then
    raise exception 'unknown_cost_became_exact_margin';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(v_payload -> 'orders') as item
    where item ->> 'public_no' = 'R-PROFIT-C'
      and (item ->> 'known_cost_amount')::numeric = 0
      and (item ->> 'quote_gross_margin')::numeric = 40
  ) then
    raise exception 'explicit_zero_cost_not_counted';
  end if;

  if public.repairdesk_read_profit_center_rpc(
    '00000000-0000-4000-8000-000000008000',
    '00000000-0000-4000-8000-000000008003',
    '2026-07-18',
    '2026-07-18'
  ) ->> 'code' <> 'actor_forbidden' then
    raise exception 'technician_profit_data_leak';
  end if;

  if public.repairdesk_read_profit_center_rpc(
    '00000000-0000-4000-8000-000000008000',
    '00000000-0000-4000-8000-000000008001',
    '2025-01-01',
    '2026-07-18'
  ) ->> 'code' <> 'invalid_date_range' then
    raise exception 'unbounded_profit_range_accepted';
  end if;

  if has_table_privilege('authenticated', 'public.repairdesk_order_profit_facts_v1', 'select')
     or has_table_privilege('anon', 'public.repairdesk_order_profit_facts_v1', 'select')
     or has_table_privilege('service_role', 'public.repairdesk_order_profit_facts_v1', 'select') then
    raise exception 'profit_fact_view_acl_leak';
  end if;
end;
$$;

select 'order_cost_phase2_profit_harness_passed' as result;
