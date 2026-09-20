-- Expand the customer list contract with quote/review counts while preserving
-- repairdesk_customer_list_page_v3 for older application releases. This is a
-- read-model-only change: it performs no backfill and rewrites no order facts.
create or replace function public.repairdesk_customer_list_page_v4(
  p_store_id uuid,
  p_search text default null,
  p_tag_ids text[] default null,
  p_work_filter text default 'all',
  p_marketing text default 'all',
  p_followup text default 'all',
  p_page integer default 1,
  p_page_size integer default 50
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
  v_items jsonb;
begin
  v_result := public.repairdesk_customer_list_page_v3(
    p_store_id,
    p_search,
    p_tag_ids,
    p_work_filter,
    p_marketing,
    p_followup,
    p_page,
    p_page_size
  );

  with selected_items as (
    select
      item.value as item,
      item.ordinality,
      nullif(item.value ->> 'id', '')::uuid as customer_id
    from jsonb_array_elements(coalesce(v_result -> 'items', '[]'::jsonb))
      with ordinality as item(value, ordinality)
  ),
  raw_order_facts as (
    select
      repair_order.customer_id,
      not (
        lower(coalesce(repair_order.status::text, '')) = 'cancelled'
        or lower(coalesce(repair_order.exception_status::text, '')) = 'cancelled'
        or lower(coalesce(workflow_status.bucket, '')) = 'cancelled'
        or lower(coalesce(repair_order.record_state::text, 'active')) <> 'active'
        or repair_order.deleted_at is not null
      ) as is_valid,
      coalesce(repair_order.quotation_amount, 0)::numeric as quotation_amount,
      coalesce(repair_order.deposit_amount, 0)::numeric as deposit_amount,
      coalesce(repair_order.balance_amount, 0)::numeric as balance_amount,
      coalesce(repair_order.is_paid, false) as is_paid,
      lower(coalesce(repair_order.payment_status::text, '')) as payment_status,
      lower(coalesce(repair_order.approval_status::text, '')) as approval_status,
      lower(coalesce(repair_order.approval_flow_status::text, '')) as approval_flow_status,
      (
        coalesce(repair_order.quotation_amount, 0) > 0
        or (
          jsonb_typeof(coalesce(repair_order.fault_prices, '[]'::jsonb)) = 'array'
          and jsonb_array_length(coalesce(repair_order.fault_prices, '[]'::jsonb)) > 0
        )
      ) as has_quote,
      (
        coalesce(repair_order.quotation_amount, 0) < 0
        or coalesce(repair_order.deposit_amount, 0) < 0
        or coalesce(repair_order.balance_amount, 0) < 0
        or coalesce(repair_order.quotation_amount, 0) <> round(coalesce(repair_order.quotation_amount, 0), 2)
        or coalesce(repair_order.deposit_amount, 0) <> round(coalesce(repair_order.deposit_amount, 0), 2)
        or coalesce(repair_order.balance_amount, 0) <> round(coalesce(repair_order.balance_amount, 0), 2)
      ) as invalid_amount
    from public.repair_orders as repair_order
    join selected_items on selected_items.customer_id = repair_order.customer_id
    left join public.order_workflow_statuses as workflow_status
      on workflow_status.store_id = repair_order.store_id
     and workflow_status.code = repair_order.status::text
    where repair_order.store_id = p_store_id
  ),
  classified as (
    select
      raw_order_facts.*,
      (
        raw_order_facts.approval_flow_status = 'rejected'
        or raw_order_facts.approval_status = 'rejected'
      ) as quote_rejected,
      (
        raw_order_facts.approval_flow_status = 'waiting_customer'
        or raw_order_facts.approval_status = 'pending'
      ) as quote_pending,
      (
        raw_order_facts.approval_flow_status = 'approved'
        or raw_order_facts.approval_status = 'approved'
      ) as quote_explicitly_approved,
      (
        raw_order_facts.approval_flow_status in ('approved', 'not_required')
        or raw_order_facts.approval_status = 'approved'
      ) as quote_approved
    from raw_order_facts
  ),
  financial_states as (
    select
      classified.*,
      classified.is_valid
        and classified.payment_status <> 'refunded'
        and (
          classified.invalid_amount
          or (
            classified.quote_rejected::integer
            + classified.quote_pending::integer
            + classified.quote_explicitly_approved::integer
          ) > 1
          or (not classified.has_quote and classified.balance_amount > 0)
          or (
            classified.quote_rejected
            and (
              classified.deposit_amount > 0
              or classified.balance_amount < classified.quotation_amount
              or classified.payment_status in ('partial', 'paid')
              or classified.is_paid
            )
          )
          or (
            classified.quote_approved
            and not classified.quote_pending
            and not classified.quote_rejected
            and classified.quotation_amount > 0
            and (
              classified.deposit_amount + classified.balance_amount > classified.quotation_amount
              or classified.is_paid <> (classified.balance_amount = 0)
              or (
                classified.payment_status <> ''
                and classified.payment_status <> case
                  when classified.is_paid or classified.balance_amount = 0 then 'paid'
                  when classified.deposit_amount > 0
                    or classified.balance_amount < classified.quotation_amount then 'partial'
                  else 'unpaid'
                end
              )
            )
          )
        ) as is_finance_review
    from classified
  ),
  customer_counts as (
    select
      financial_state.customer_id,
      count(*) filter (
        where financial_state.is_valid
          and financial_state.payment_status <> 'refunded'
          and not financial_state.invalid_amount
          and not financial_state.is_finance_review
          and (
            (not financial_state.has_quote and financial_state.balance_amount = 0)
            or (
              financial_state.has_quote
              and (
                financial_state.quote_pending
                or financial_state.quote_rejected
                or not financial_state.quote_approved
              )
            )
          )
      )::integer as pending_quote_count,
      count(*) filter (where financial_state.is_finance_review)::integer as finance_review_count
    from financial_states as financial_state
    group by financial_state.customer_id
  )
  select coalesce(
    jsonb_agg(
      selected_item.item || jsonb_build_object(
        'pending_quote_count', coalesce(customer_count.pending_quote_count, 0),
        'finance_review_count', coalesce(customer_count.finance_review_count, 0)
      )
      order by selected_item.ordinality
    ),
    '[]'::jsonb
  )
  into v_items
  from selected_items as selected_item
  left join customer_counts as customer_count
    on customer_count.customer_id = selected_item.customer_id;

  return jsonb_set(v_result, '{items}', v_items, true);
end;
$$;

revoke all on function public.repairdesk_customer_list_page_v4(
  uuid, text, text[], text, text, text, integer, integer
) from public, anon, authenticated;
grant execute on function public.repairdesk_customer_list_page_v4(
  uuid, text, text[], text, text, text, integer, integer
) to service_role;

comment on function public.repairdesk_customer_list_page_v4(
  uuid, text, text[], text, text, text, integer, integer
) is 'Customer list v3 compatibility projection plus per-customer pending quote and finance review counts; read only and no backfill.';

notify pgrst, 'reload schema';
