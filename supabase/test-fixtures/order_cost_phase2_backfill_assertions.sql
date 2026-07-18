do $$
declare
  v_payload jsonb;
  v_replay jsonb;
  v_run_id uuid;
  v_fixture_hash text;
  v_planned_line_id uuid;
  v_apply_key uuid := '00000000-0000-4000-8000-000000008701';
  v_revert_key uuid := '00000000-0000-4000-8000-000000008702';
  v_order_hash text;
  v_cost_hash text;
  v_revision_hash text;
begin
  if exists (select 1 from public.repair_cost_backfill_runs) then
    raise exception 'migration_automatically_created_backfill_run';
  end if;

  select md5(coalesce(string_agg(id::text || ':' || fault_prices::text, '|' order by id), ''))
  into v_order_hash from public.repair_orders;
  select md5(coalesce(string_agg(id::text || ':' || coalesce(cost_amount::text, 'null') || ':' || source, '|' order by id), ''))
  into v_cost_hash from public.repair_order_line_costs;
  select md5(coalesce(string_agg(id::text || ':' || change_kind, '|' order by id), ''))
  into v_revision_hash from public.repair_order_line_cost_revisions;

  v_payload := public.repairdesk_preview_cost_backfill_rpc(
    '00000000-0000-4000-8000-000000008000',
    '00000000-0000-4000-8000-000000008002',
    '2026-01-01', '2026-01-31', 10,
    '00000000-0000-4000-8000-000000008700'
  );
  if v_payload ->> 'code' <> 'previewed'
     or (v_payload ->> 'candidate_count')::integer <> 3
     or (v_payload ->> 'estimated_count')::integer <> 1
     or (v_payload ->> 'unknown_count')::integer <> 2 then
    raise exception 'preview_counts_mismatch: %', v_payload;
  end if;
  v_run_id := (v_payload ->> 'id')::uuid;
  v_fixture_hash := v_payload ->> 'fixture_hash';

  if v_order_hash <> (
       select md5(coalesce(string_agg(id::text || ':' || fault_prices::text, '|' order by id), ''))
       from public.repair_orders
     )
     or v_cost_hash <> (
       select md5(coalesce(string_agg(id::text || ':' || coalesce(cost_amount::text, 'null') || ':' || source, '|' order by id), ''))
       from public.repair_order_line_costs
     )
     or v_revision_hash <> (
       select md5(coalesce(string_agg(id::text || ':' || change_kind, '|' order by id), ''))
       from public.repair_order_line_cost_revisions
     ) then
    raise exception 'preview_modified_business_data';
  end if;

  v_replay := public.repairdesk_preview_cost_backfill_rpc(
    '00000000-0000-4000-8000-000000008000',
    '00000000-0000-4000-8000-000000008002',
    '2026-01-01', '2026-01-31', 10,
    '00000000-0000-4000-8000-000000008700'
  );
  if v_replay ->> 'code' <> 'idempotent_replay'
     or (v_replay ->> 'id')::uuid <> v_run_id
     or v_replay ->> 'fixture_hash' <> v_fixture_hash then
    raise exception 'preview_not_idempotent: %', v_replay;
  end if;
  if public.repairdesk_preview_cost_backfill_rpc(
    '00000000-0000-4000-8000-000000008000',
    '00000000-0000-4000-8000-000000008002',
    '2026-01-02', '2026-01-31', 10,
    '00000000-0000-4000-8000-000000008700'
  ) ->> 'code' <> 'idempotency_conflict' then
    raise exception 'preview_idempotency_conflict_not_blocked';
  end if;

  if public.repairdesk_apply_cost_backfill_rpc(
    '00000000-0000-4000-8000-000000008000', v_run_id,
    '00000000-0000-4000-8000-000000008002', v_fixture_hash, 1, v_apply_key
  ) ->> 'code' <> 'actor_forbidden' then
    raise exception 'manager_was_allowed_to_apply_backfill';
  end if;

  v_payload := public.repairdesk_apply_cost_backfill_rpc(
    '00000000-0000-4000-8000-000000008000', v_run_id,
    '00000000-0000-4000-8000-000000008001', v_fixture_hash, 1, v_apply_key
  );
  if v_payload ->> 'code' <> 'partial'
     or (v_payload ->> 'applied_count')::integer <> 1
     or not (v_payload ->> 'has_more')::boolean then
    raise exception 'first_apply_batch_mismatch: %', v_payload;
  end if;

  select planned_line_id into v_planned_line_id
  from public.repair_cost_backfill_candidates
  where run_id = v_run_id
    and order_id = '00000000-0000-4000-8000-000000008150';
  if (select fault_prices #>> '{0,line_id}' from public.repair_orders
      where id = '00000000-0000-4000-8000-000000008150') <> v_planned_line_id::text
     or not exists (
       select 1 from public.repair_order_line_costs
       where order_id = '00000000-0000-4000-8000-000000008150'
         and line_id = v_planned_line_id and cost_amount = 15
         and source = 'backfill_estimate' and evidence_status = 'estimated'
         and original_amount = 15 and original_currency_code = 'EUR'
         and fx_rate_to_eur = 1 and fx_rate_source = 'historical_default_version'
     )
     or exists (
       select 1 from public.repair_order_line_costs
       where order_id = '00000000-0000-4000-8000-000000008150'
         and cost_amount = 99
     ) then
    raise exception 'historical_estimate_or_sentinel_ordering_mismatch';
  end if;

  v_payload := public.repairdesk_apply_cost_backfill_rpc(
    '00000000-0000-4000-8000-000000008000', v_run_id,
    '00000000-0000-4000-8000-000000008001', v_fixture_hash, 1, v_apply_key
  );
  if v_payload ->> 'code' <> 'partial'
     or (v_payload ->> 'applied_count')::integer <> 2 then
    raise exception 'second_apply_batch_mismatch: %', v_payload;
  end if;
  if not exists (
    select 1 from public.repair_order_line_costs
    where order_id = '00000000-0000-4000-8000-000000008151'
      and line_id = '00000000-0000-4000-8000-000000008251'
      and cost_amount is null and source = 'historical_unknown'
      and evidence_status = 'unknown'
  ) then raise exception 'unknown_candidate_was_not_preserved'; end if;

  -- A real order edit after preview must be reported as a conflict, not overwritten.
  update public.repair_orders
  set fault_prices = jsonb_set(fault_prices, '{0,price}', '56'::jsonb, false),
      updated_at = clock_timestamp()
  where id = '00000000-0000-4000-8000-000000008152';
  v_payload := public.repairdesk_apply_cost_backfill_rpc(
    '00000000-0000-4000-8000-000000008000', v_run_id,
    '00000000-0000-4000-8000-000000008001', v_fixture_hash, 1, v_apply_key
  );
  if v_payload ->> 'code' <> 'applied'
     or (v_payload ->> 'applied_count')::integer <> 2
     or (v_payload ->> 'conflict_count')::integer <> 1
     or (v_payload ->> 'has_more')::boolean then
    raise exception 'conflict_apply_completion_mismatch: %', v_payload;
  end if;
  if public.repairdesk_apply_cost_backfill_rpc(
    '00000000-0000-4000-8000-000000008000', v_run_id,
    '00000000-0000-4000-8000-000000008001', v_fixture_hash, 1, v_apply_key
  ) ->> 'code' <> 'idempotent_replay' then
    raise exception 'apply_not_idempotent';
  end if;
  if not exists (
    select 1 from public.repair_order_line_cost_revisions
    where order_id = '00000000-0000-4000-8000-000000008150'
      and change_kind = 'backfill_applied'
      and reason like 'Historical cost backfill run %'
  ) then raise exception 'backfill_apply_revision_missing'; end if;

  -- Simulate a later, confirmed human correction on the estimated line.
  update public.repair_order_line_costs
  set cost_amount = 31, source = 'manual', evidence_status = 'confirmed',
      original_amount = 31, original_currency_code = 'EUR', fx_rate_to_eur = 1,
      fx_rate_at = clock_timestamp(), fx_rate_source = 'store_base',
      source_reference_type = null, source_reference_id = null,
      revision = revision + 1, updated_by = '00000000-0000-4000-8000-000000008001',
      confirmed_by = '00000000-0000-4000-8000-000000008001',
      confirmed_at = clock_timestamp(), updated_at = clock_timestamp()
  where order_id = '00000000-0000-4000-8000-000000008150'
    and line_id = v_planned_line_id;

  v_payload := public.repairdesk_revert_cost_backfill_rpc(
    '00000000-0000-4000-8000-000000008000', v_run_id,
    '00000000-0000-4000-8000-000000008001', 100, v_revert_key
  );
  if v_payload ->> 'code' <> 'revert_partial'
     or (v_payload ->> 'reverted_count')::integer <> 1
     or (v_payload ->> 'revert_conflict_count')::integer <> 1 then
    raise exception 'compensating_revert_counts_mismatch: %', v_payload;
  end if;
  if not exists (
    select 1 from public.repair_order_line_costs
    where order_id = '00000000-0000-4000-8000-000000008150'
      and line_id = v_planned_line_id and cost_amount = 31
      and source = 'manual' and evidence_status = 'confirmed'
  ) then raise exception 'revert_overwrote_later_human_edit'; end if;
  if not exists (
    select 1 from public.repair_order_line_costs
    where order_id = '00000000-0000-4000-8000-000000008151'
      and line_id = '00000000-0000-4000-8000-000000008251'
      and cost_amount is null and source = 'historical_unknown'
      and source_reference_type = 'cost_backfill_revert'
  ) then raise exception 'compensating_unknown_projection_missing'; end if;
  if not exists (
    select 1 from public.repair_order_line_cost_revisions
    where order_id = '00000000-0000-4000-8000-000000008151'
      and change_kind = 'backfill_reverted'
      and reason like 'Compensating revert for backfill run %'
  ) then raise exception 'backfill_revert_revision_missing'; end if;
  if (select fault_prices #>> '{0,line_id}' from public.repair_orders
      where id = '00000000-0000-4000-8000-000000008150') <> v_planned_line_id::text then
    raise exception 'stable_line_id_was_removed_during_revert';
  end if;

  if public.repairdesk_read_cost_backfill_runs_rpc(
    '00000000-0000-4000-8000-000000008999',
    '00000000-0000-4000-8000-000000008002', null
  ) ->> 'code' <> 'actor_forbidden' then
    raise exception 'cross_store_backfill_read_leak';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.repair_cost_backfill_runs'::regclass)
     or has_table_privilege('authenticated', 'public.repair_cost_backfill_runs', 'select')
     or has_table_privilege('anon', 'public.repair_cost_backfill_candidates', 'select')
     or has_function_privilege(
       'authenticated',
       'public.repairdesk_apply_cost_backfill_rpc(uuid,uuid,uuid,text,integer,uuid)',
       'execute'
     ) then
    raise exception 'backfill_browser_acl_or_rls_leak';
  end if;
end;
$$;

select 'order_cost_phase2_backfill_harness_passed' as result;
