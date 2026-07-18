-- Bounded, store-private operational repair gross-margin reporting.
-- This intentionally reports final-quote margin, not VAT/accounting net profit or
-- refund-adjusted realized cash profit. Collections remain a separate reference metric.

set lock_timeout = '5s';
set statement_timeout = '60s';

create index if not exists repair_orders_store_live_created_profit_idx
  on public.repair_orders (store_id, created_at, id)
  where record_state = 'active' and deleted_at is null;

create index if not exists repair_orders_store_live_delivered_profit_idx
  on public.repair_orders (store_id, delivered_at, id)
  where record_state = 'active' and deleted_at is null and delivered_at is not null;

create index if not exists order_payment_ledger_store_created_profit_idx
  on public.order_payment_ledger (store_id, created_at, order_id);

create or replace view public.repairdesk_order_profit_facts_v1
with (security_invoker = true)
as
with cost_totals as (
  select
    cost_row.store_id,
    cost_row.order_id,
    count(*) filter (where cost_row.is_active) as active_cost_row_count,
    count(*) filter (
      where cost_row.is_active and cost_row.cost_amount is not null
    ) as known_cost_line_count,
    count(*) filter (
      where cost_row.is_active and cost_row.evidence_status = 'estimated'
    ) as estimated_cost_line_count,
    count(*) filter (
      where cost_row.is_active and cost_row.evidence_status in ('confirmed', 'reconciled')
    ) as confirmed_cost_line_count,
    coalesce(sum(cost_row.cost_amount) filter (where cost_row.is_active), 0)::numeric(14, 2)
      as known_cost_amount
  from public.repair_order_line_costs as cost_row
  group by cost_row.store_id, cost_row.order_id
), facts as (
  select
    order_row.store_id,
    order_row.id as order_id,
    order_row.public_no,
    order_row.status::text as status,
    order_row.exception_status::text as exception_status,
    order_row.payment_status::text as payment_status,
    order_row.original_order_id,
    order_row.created_at,
    order_row.completed_at,
    order_row.delivered_at,
    order_row.quotation_amount::numeric(14, 2) as quote_amount,
    jsonb_array_length(order_row.fault_prices) as quote_line_count,
    coalesce(cost_totals.active_cost_row_count, 0)::integer as active_cost_row_count,
    coalesce(cost_totals.known_cost_line_count, 0)::integer as known_cost_line_count,
    coalesce(cost_totals.estimated_cost_line_count, 0)::integer as estimated_cost_line_count,
    coalesce(cost_totals.confirmed_cost_line_count, 0)::integer as confirmed_cost_line_count,
    coalesce(cost_totals.known_cost_amount, 0)::numeric(14, 2) as known_cost_amount,
    greatest(
      jsonb_array_length(order_row.fault_prices)
        - coalesce(cost_totals.known_cost_line_count, 0),
      0
    )::integer as unknown_cost_line_count
  from public.repair_orders as order_row
  left join cost_totals
    on cost_totals.store_id = order_row.store_id
   and cost_totals.order_id = order_row.id
  where order_row.record_state = 'active'
    and order_row.deleted_at is null
)
select
  facts.*,
  case
    when facts.unknown_cost_line_count > 0 then 'incomplete'
    when facts.estimated_cost_line_count > 0 then 'estimated'
    else 'confirmed'
  end as cost_completeness,
  case
    when facts.unknown_cost_line_count = 0
      then (facts.quote_amount - facts.known_cost_amount)::numeric(14, 2)
    else null
  end as quote_gross_margin,
  case
    when facts.unknown_cost_line_count = 0 and facts.quote_amount > 0
      then round((facts.quote_amount - facts.known_cost_amount) / facts.quote_amount * 100, 2)
    else null
  end as quote_gross_margin_percent,
  facts.payment_status = 'refunded' as is_refunded,
  facts.exception_status = 'rework' or facts.original_order_id is not null as is_rework
from facts;

revoke all on table public.repairdesk_order_profit_facts_v1
  from public, anon, authenticated, service_role;

create or replace function public.repairdesk_read_profit_center_rpc(
  p_store_id uuid,
  p_actor_id uuid,
  p_start_date date,
  p_end_date date
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
  v_result jsonb;
begin
  if p_store_id is null or p_actor_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_target');
  end if;
  if not public.repairdesk_actor_has_phase2_cost_permission(
    p_store_id,
    p_actor_id,
    'finance:profit_read'
  ) then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;
  if p_start_date is null
     or p_end_date is null
     or p_end_date < p_start_date
     or p_end_date - p_start_date > 366 then
    return jsonb_build_object('ok', false, 'code', 'invalid_date_range');
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

  with eligible as (
    select fact.*
    from public.repairdesk_order_profit_facts_v1 as fact
    where fact.store_id = p_store_id
      and fact.status <> 'cancelled'
      and coalesce(fact.exception_status, '') <> 'cancelled'
  ), expected_orders as (
    select *
    from eligible
    where created_at >= v_start_at
      and created_at < v_end_at
  ), completed_orders as (
    select *
    from eligible
    where delivered_at >= v_start_at
      and delivered_at < v_end_at
  ), expected_daily as (
    select
      (created_at at time zone v_timezone)::date as bucket_date,
      count(*)::integer as order_count,
      coalesce(sum(quote_amount) filter (where not is_refunded), 0)::numeric(14, 2)
        as quote_amount,
      coalesce(sum(known_cost_amount) filter (where not is_refunded), 0)::numeric(14, 2)
        as known_cost_amount,
      coalesce(sum(quote_gross_margin) filter (
        where not is_refunded and quote_gross_margin is not null
      ), 0)::numeric(14, 2) as exact_margin_amount,
      count(*) filter (
        where not is_refunded and quote_gross_margin is null
      )::integer as incomplete_order_count
    from expected_orders
    group by (created_at at time zone v_timezone)::date
  ), completed_daily as (
    select
      (delivered_at at time zone v_timezone)::date as bucket_date,
      count(*)::integer as order_count,
      coalesce(sum(quote_amount) filter (where not is_refunded), 0)::numeric(14, 2)
        as quote_amount,
      coalesce(sum(known_cost_amount) filter (where not is_refunded), 0)::numeric(14, 2)
        as known_cost_amount,
      coalesce(sum(quote_gross_margin) filter (
        where not is_refunded and quote_gross_margin is not null
      ), 0)::numeric(14, 2) as exact_margin_amount,
      count(*) filter (
        where not is_refunded and quote_gross_margin is null
      )::integer as incomplete_order_count
    from completed_orders
    group by (delivered_at at time zone v_timezone)::date
  ), collection_reference as (
    select
      coalesce(sum(ledger.amount) filter (where ledger.currency_code = 'EUR'), 0)::numeric(14, 2)
        as amount,
      count(*) filter (where ledger.currency_code = 'EUR')::integer as entry_count,
      count(*) filter (where ledger.currency_code <> 'EUR')::integer as non_eur_entry_count
    from public.order_payment_ledger as ledger
    join eligible on eligible.order_id = ledger.order_id
      and eligible.store_id = ledger.store_id
    where ledger.store_id = p_store_id
      and ledger.created_at >= v_start_at
      and ledger.created_at < v_end_at
      and ledger.entry_type = 'collection'
  )
  select jsonb_build_object(
    'ok', true,
    'code', 'read',
    'timezone', v_timezone,
    'start_date', p_start_date,
    'end_date', p_end_date,
    'definition', 'final_quote_operational_gross_margin',
    'summary', jsonb_build_object(
      'expected', jsonb_build_object(
        'order_count', (select count(*) from expected_orders),
        'eligible_order_count', (select count(*) from expected_orders where not is_refunded),
        'quote_amount', (select coalesce(sum(quote_amount) filter (where not is_refunded), 0) from expected_orders),
        'known_cost_amount', (select coalesce(sum(known_cost_amount) filter (where not is_refunded), 0) from expected_orders),
        'exact_margin_amount', (select coalesce(sum(quote_gross_margin) filter (where not is_refunded and quote_gross_margin is not null), 0) from expected_orders),
        'exact_order_count', (select count(*) from expected_orders where not is_refunded and quote_gross_margin is not null),
        'incomplete_order_count', (select count(*) from expected_orders where not is_refunded and quote_gross_margin is null),
        'estimated_order_count', (select count(*) from expected_orders where not is_refunded and cost_completeness = 'estimated'),
        'negative_margin_order_count', (select count(*) from expected_orders where not is_refunded and quote_gross_margin < 0)
      ),
      'completed', jsonb_build_object(
        'order_count', (select count(*) from completed_orders),
        'eligible_order_count', (select count(*) from completed_orders where not is_refunded),
        'quote_amount', (select coalesce(sum(quote_amount) filter (where not is_refunded), 0) from completed_orders),
        'known_cost_amount', (select coalesce(sum(known_cost_amount) filter (where not is_refunded), 0) from completed_orders),
        'exact_margin_amount', (select coalesce(sum(quote_gross_margin) filter (where not is_refunded and quote_gross_margin is not null), 0) from completed_orders),
        'exact_order_count', (select count(*) from completed_orders where not is_refunded and quote_gross_margin is not null),
        'incomplete_order_count', (select count(*) from completed_orders where not is_refunded and quote_gross_margin is null),
        'estimated_order_count', (select count(*) from completed_orders where not is_refunded and cost_completeness = 'estimated'),
        'negative_margin_order_count', (select count(*) from completed_orders where not is_refunded and quote_gross_margin < 0)
      ),
      'data_quality', jsonb_build_object(
        'unknown_line_count', (select coalesce(sum(unknown_cost_line_count), 0) from expected_orders),
        'refunded_order_count', (select count(*) from expected_orders where is_refunded),
        'rework_order_count', (select count(*) from expected_orders where is_rework)
      ),
      'collection_reference', (select to_jsonb(collection_reference) from collection_reference)
    ),
    'trend', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'date', day_row.bucket_date::date,
          'expected_order_count', coalesce(expected_daily.order_count, 0),
          'expected_quote_amount', coalesce(expected_daily.quote_amount, 0),
          'expected_known_cost_amount', coalesce(expected_daily.known_cost_amount, 0),
          'expected_exact_margin_amount', coalesce(expected_daily.exact_margin_amount, 0),
          'expected_incomplete_order_count', coalesce(expected_daily.incomplete_order_count, 0),
          'completed_order_count', coalesce(completed_daily.order_count, 0),
          'completed_quote_amount', coalesce(completed_daily.quote_amount, 0),
          'completed_known_cost_amount', coalesce(completed_daily.known_cost_amount, 0),
          'completed_exact_margin_amount', coalesce(completed_daily.exact_margin_amount, 0),
          'completed_incomplete_order_count', coalesce(completed_daily.incomplete_order_count, 0)
        ) order by day_row.bucket_date
      )
      from generate_series(p_start_date, p_end_date, interval '1 day')
        as day_row(bucket_date)
      left join expected_daily on expected_daily.bucket_date = day_row.bucket_date::date
      left join completed_daily on completed_daily.bucket_date = day_row.bucket_date::date
    ), '[]'::jsonb),
    'orders', coalesce((
      select jsonb_agg(to_jsonb(drilldown_row) order by drilldown_row.created_at desc)
      from (
        select
          order_id,
          public_no,
          status,
          exception_status,
          payment_status,
          created_at,
          completed_at,
          delivered_at,
          quote_amount,
          known_cost_amount,
          quote_gross_margin,
          quote_gross_margin_percent,
          quote_line_count,
          unknown_cost_line_count,
          estimated_cost_line_count,
          confirmed_cost_line_count,
          cost_completeness,
          is_refunded,
          is_rework
        from expected_orders
        order by created_at desc
        limit 100
      ) as drilldown_row
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
exception when invalid_parameter_value then
  return jsonb_build_object('ok', false, 'code', 'invalid_store_timezone');
end;
$$;

revoke all on function public.repairdesk_read_profit_center_rpc(uuid, uuid, date, date)
  from public, anon, authenticated, service_role;
grant execute on function public.repairdesk_read_profit_center_rpc(uuid, uuid, date, date)
  to service_role;

reset statement_timeout;
reset lock_timeout;

notify pgrst, 'reload schema';
