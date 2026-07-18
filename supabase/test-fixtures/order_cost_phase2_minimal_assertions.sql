do $$
declare
  v_payload jsonb;
begin
  if not exists (
    select 1 from public.repair_order_line_cost_revisions
    where order_id = '00000000-0000-4000-8000-000000008101'
      and change_kind = 'migration_snapshot'
      and cost_amount = 15
      and evidence_status = 'estimated'
  ) then
    raise exception 'missing_cost_migration_snapshot';
  end if;

  if not exists (
    select 1 from public.store_fault_cost_default_versions
    where store_id = '00000000-0000-4000-8000-000000008000'
      and catalog_key = 'phone:screen'
      and change_kind = 'migration_snapshot'
      and effective_to is null
  ) then
    raise exception 'missing_default_migration_snapshot';
  end if;

  if has_table_privilege('authenticated', 'public.repair_order_line_cost_revisions', 'select')
     or has_table_privilege('anon', 'public.repair_order_line_cost_revisions', 'select') then
    raise exception 'cost_revision_acl_leak';
  end if;

  insert into public.store_member_permission_grants (
    store_id, membership_id, user_id, action, granted_by
  ) values
    ('00000000-0000-4000-8000-000000008000', '00000000-0000-4000-8000-000000008012', '00000000-0000-4000-8000-000000008002', 'finance:cost_manage', '00000000-0000-4000-8000-000000008001'),
    ('00000000-0000-4000-8000-000000008000', '00000000-0000-4000-8000-000000008013', '00000000-0000-4000-8000-000000008003', 'finance:cost_manage', '00000000-0000-4000-8000-000000008001');

  if not public.repairdesk_actor_has_phase2_cost_permission(
    '00000000-0000-4000-8000-000000008000',
    '00000000-0000-4000-8000-000000008002',
    'finance:cost_manage'
  ) then
    raise exception 'manager_grant_not_honored';
  end if;

  if public.repairdesk_actor_has_phase2_cost_permission(
    '00000000-0000-4000-8000-000000008000',
    '00000000-0000-4000-8000-000000008003',
    'finance:cost_manage'
  ) then
    raise exception 'technician_forged_grant_honored';
  end if;

  if public.repairdesk_actor_has_phase2_cost_permission(
    '00000000-0000-4000-8000-000000008000',
    '00000000-0000-4000-8000-000000008002',
    'finance:cost_backfill_apply'
  ) then
    raise exception 'manager_received_owner_only_apply';
  end if;

  update public.repair_order_line_costs
  set cost_amount = 0,
      source = 'manual',
      revision = 2,
      updated_by = '00000000-0000-4000-8000-000000008002',
      updated_at = clock_timestamp()
  where order_id = '00000000-0000-4000-8000-000000008101'
    and line_id = '00000000-0000-4000-8000-000000008201';

  if not exists (
    select 1 from public.repair_order_line_costs
    where order_id = '00000000-0000-4000-8000-000000008101'
      and cost_amount = 0
      and evidence_status = 'confirmed'
      and original_amount = 0
      and original_currency_code = 'EUR'
      and fx_rate_to_eur = 1
  ) then
    raise exception 'manual_zero_not_confirmed';
  end if;

  update public.repair_order_line_costs
  set cost_amount = null,
      source = 'manual_blank',
      revision = 3,
      updated_by = '00000000-0000-4000-8000-000000008002',
      updated_at = clock_timestamp()
  where order_id = '00000000-0000-4000-8000-000000008101'
    and line_id = '00000000-0000-4000-8000-000000008201';

  if not exists (
    select 1 from public.repair_order_line_costs
    where order_id = '00000000-0000-4000-8000-000000008101'
      and cost_amount is null
      and evidence_status = 'unknown'
      and original_amount is null
      and original_currency_code is null
  ) then
    raise exception 'blank_not_unknown';
  end if;

  if (select count(*) from public.repair_order_line_cost_revisions
      where order_id = '00000000-0000-4000-8000-000000008101') <> 3 then
    raise exception 'revision_count_mismatch';
  end if;

  v_payload := public.repairdesk_read_order_cost_history_rpc(
    '00000000-0000-4000-8000-000000008000',
    '00000000-0000-4000-8000-000000008101',
    '00000000-0000-4000-8000-000000008001'
  );
  if v_payload ->> 'code' <> 'read' or jsonb_array_length(v_payload -> 'items') <> 3 then
    raise exception 'owner_history_read_failed';
  end if;

  v_payload := public.repairdesk_read_order_cost_history_rpc(
    '00000000-0000-4000-8000-000000008000',
    '00000000-0000-4000-8000-000000008101',
    '00000000-0000-4000-8000-000000008003'
  );
  if v_payload ->> 'code' <> 'actor_forbidden' then
    raise exception 'technician_history_read_leak';
  end if;
end;
$$;

select 'order_cost_phase2_minimal_harness_passed' as result;
