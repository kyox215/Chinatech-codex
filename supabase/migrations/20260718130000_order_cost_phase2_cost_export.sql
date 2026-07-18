-- Bounded, store-private, PII-minimized line-level cost and gross-margin export.

set lock_timeout = '5s';
set statement_timeout = '60s';

create or replace function public.repairdesk_read_cost_export_rpc(
  p_store_id uuid,
  p_actor_id uuid,
  p_start_date date,
  p_end_date date,
  p_statuses text[] default null,
  p_sources text[] default null,
  p_limit integer default 10000
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_timezone text;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_rows jsonb;
  v_row_count integer;
begin
  if p_store_id is null or p_actor_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_target');
  end if;
  if not public.repairdesk_actor_has_phase2_cost_permission(
    p_store_id,
    p_actor_id,
    'finance:cost_export'
  ) then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;
  if p_start_date is null
     or p_end_date is null
     or p_end_date < p_start_date
     or p_end_date - p_start_date > 366 then
    return jsonb_build_object('ok', false, 'code', 'invalid_date_range');
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 10000
     or coalesce(cardinality(p_statuses), 0) > 20
     or coalesce(cardinality(p_sources), 0) > 20 then
    return jsonb_build_object('ok', false, 'code', 'invalid_filter');
  end if;

  select coalesce(nullif(btrim(store_row.timezone), ''), 'Europe/Rome')
  into v_timezone
  from public.stores as store_row
  where store_row.id = p_store_id
    and store_row.status::text = 'active';

  if v_timezone is null then
    return jsonb_build_object('ok', false, 'code', 'store_not_found');
  end if;

  v_start_at := p_start_date::timestamp at time zone v_timezone;
  v_end_at := (p_end_date + 1)::timestamp at time zone v_timezone;

  with export_rows as (
    select
      order_row.public_no::text as order_public_no,
      (order_row.created_at at time zone v_timezone)::date as order_created_date,
      order_row.status::text as order_status,
      line.value ->> 'line_id' as line_id,
      coalesce(cost_row.catalog_key, line.value ->> 'catalog_key') as catalog_key,
      coalesce(nullif(line.value ->> 'name', ''), '未命名维修项目') as line_name,
      coalesce((line.value ->> 'price')::numeric, 0)::numeric(14, 2) as quote_amount_eur,
      cost_row.cost_amount::numeric(14, 2) as cost_amount_eur,
      coalesce(cost_row.source, 'unrecorded') as cost_source,
      coalesce(cost_row.evidence_status, 'unknown') as evidence_status,
      cost_row.original_amount,
      cost_row.original_currency_code,
      cost_row.fx_rate_to_eur,
      cost_row.fx_rate_at,
      cost_row.fx_rate_source,
      allocation.supplier_name_snapshot as supplier_name,
      case
        when cost_row.cost_amount is null then null
        else (coalesce((line.value ->> 'price')::numeric, 0) - cost_row.cost_amount)::numeric(14, 2)
      end as margin_amount_eur,
      order_row.created_at,
      order_row.id as order_id
    from public.repair_orders as order_row
    cross join lateral jsonb_array_elements(order_row.fault_prices) as line(value)
    left join public.repair_order_line_costs as cost_row
      on cost_row.store_id = order_row.store_id
     and cost_row.order_id = order_row.id
     and cost_row.line_id::text = line.value ->> 'line_id'
     and cost_row.is_active
    left join public.order_part_allocations as allocation
      on allocation.store_id = order_row.store_id
     and allocation.order_id = order_row.id
     and allocation.line_id::text = line.value ->> 'line_id'
     and allocation.state = 'allocated'
    where order_row.store_id = p_store_id
      and order_row.record_state::text = 'active'
      and order_row.deleted_at is null
      and order_row.status::text <> 'cancelled'
      and coalesce(order_row.exception_status::text, '') <> 'cancelled'
      and order_row.payment_status::text <> 'refunded'
      and order_row.created_at >= v_start_at
      and order_row.created_at < v_end_at
      and (
        coalesce(cardinality(p_statuses), 0) = 0
        or order_row.status::text = any(p_statuses)
      )
      and (
        coalesce(cardinality(p_sources), 0) = 0
        or coalesce(cost_row.source, 'unrecorded') = any(p_sources)
      )
    order by order_row.created_at, order_row.id, line.value ->> 'line_id'
    limit p_limit + 1
  )
  select
    count(*)::integer,
    coalesce(jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'order_public_no', row.order_public_no,
        'order_created_date', row.order_created_date,
        'order_status', row.order_status,
        'line_id', row.line_id,
        'catalog_key', row.catalog_key,
        'line_name', row.line_name,
        'quote_amount_eur', row.quote_amount_eur,
        'cost_amount_eur', row.cost_amount_eur,
        'cost_source', row.cost_source,
        'evidence_status', row.evidence_status,
        'original_amount', row.original_amount,
        'original_currency_code', row.original_currency_code,
        'fx_rate_to_eur', row.fx_rate_to_eur,
        'fx_rate_at', row.fx_rate_at,
        'fx_rate_source', row.fx_rate_source,
        'supplier_name', row.supplier_name,
        'margin_amount_eur', row.margin_amount_eur
      )) order by row.created_at, row.order_id, row.line_id
    ), '[]'::jsonb)
  into v_row_count, v_rows
  from export_rows as row;

  return jsonb_build_object(
    'ok', true,
    'code', 'read',
    'timezone', v_timezone,
    'start_date', p_start_date,
    'end_date', p_end_date,
    'row_count', least(v_row_count, p_limit),
    'overflow', v_row_count > p_limit,
    'items', case when v_row_count > p_limit then '[]'::jsonb else v_rows end
  );
exception when invalid_parameter_value then
  return jsonb_build_object('ok', false, 'code', 'invalid_store_timezone');
end;
$$;

revoke all on function public.repairdesk_read_cost_export_rpc(
  uuid, uuid, date, date, text[], text[], integer
) from public, anon, authenticated, service_role;
grant execute on function public.repairdesk_read_cost_export_rpc(
  uuid, uuid, date, date, text[], text[], integer
) to service_role;

reset statement_timeout;
reset lock_timeout;

notify pgrst, 'reload schema';
