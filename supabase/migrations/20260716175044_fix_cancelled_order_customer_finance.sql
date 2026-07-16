-- Customer finance facts deliberately keep cancelled orders in history while
-- excluding them from valid counts, active work, lifetime quoted value and
-- outstanding balance. No historical order amount is rewritten.
create or replace function public.repairdesk_customer_list_page_v3(
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
language sql
stable
security invoker
set search_path = ''
as $$
with params as (
  select
    p_store_id as store_id,
    nullif(trim(coalesce(p_search, '')), '') as search,
    case
      when p_tag_ids is null or cardinality(p_tag_ids) = 0 then null::text[]
      else p_tag_ids
    end as tag_ids,
    coalesce(nullif(p_work_filter, ''), 'all') as work_filter,
    coalesce(nullif(p_marketing, ''), 'all') as marketing,
    coalesce(nullif(p_followup, ''), 'all') as followup,
    greatest(1, coalesce(p_page, 1))::integer as page,
    least(100, greatest(10, coalesce(p_page_size, 50)))::integer as page_size
),
search_params as (
  select
    params.*,
    case when params.search is null then null else '%' || lower(params.search) || '%' end as term,
    regexp_replace(coalesce(params.search, ''), '\D', '', 'g') as phone_term
  from params
),
raw_order_facts as (
  select
    ro.customer_id,
    ro.created_at,
    greatest(coalesce(ro.quotation_amount, 0), 0)::numeric as quotation_amount,
    greatest(coalesce(ro.balance_amount, 0), 0)::numeric as balance_amount,
    not (
      lower(coalesce(ro.status::text, '')) = 'cancelled'
      or lower(coalesce(ro.exception_status::text, '')) = 'cancelled'
    ) as is_valid,
    coalesce(ro.workflow_status::text, '') as canonical_workflow_status,
    lower(coalesce(ro.status::text, '')) as legacy_status
  from public.repair_orders as ro
  join params on params.store_id = ro.store_id
),
order_facts as (
  select
    raw_order_facts.*,
    raw_order_facts.is_valid
      and raw_order_facts.canonical_workflow_status <> 'closed'
      and raw_order_facts.legacy_status not in ('completed', 'cancelled') as is_active
  from raw_order_facts
),
filtered_customers as (
  select
    customer.*,
    latest.last_order_at
  from public.customers as customer
  join search_params on search_params.store_id = customer.store_id
  left join lateral (
    select max(order_fact.created_at) as last_order_at
    from order_facts as order_fact
    where order_fact.customer_id = customer.id
  ) as latest on true
  where
    (
      search_params.search is null
      or lower(customer.name) like search_params.term
      or lower(coalesce(customer.email, '')) like search_params.term
      or lower(array_to_string(customer.contact_phones, ' ')) like search_params.term
      or (
        search_params.phone_term <> ''
        and (
          customer.phone_raw like '%' || search_params.phone_term || '%'
          or regexp_replace(customer.phone_e164, '\D', '', 'g') like '%' || search_params.phone_term || '%'
          or exists (
            select 1
            from unnest(customer.contact_phones) as contact_phone(phone)
            where regexp_replace(contact_phone.phone, '\D', '', 'g') like '%' || search_params.phone_term || '%'
          )
        )
      )
      or exists (
        select 1
        from public.devices as search_device
        where search_device.store_id = search_params.store_id
          and search_device.customer_id = customer.id
          and lower(concat_ws(
            ' ',
            search_device.brand,
            search_device.model,
            search_device.serial_or_imei,
            search_device.device_notes
          )) like search_params.term
      )
    )
    and (
      search_params.tag_ids is null
      or exists (
        select 1
        from public.customer_tag_assignments as assignment
        where assignment.store_id = search_params.store_id
          and assignment.customer_id = customer.id
          and assignment.tag_id = any(search_params.tag_ids)
      )
    )
    and (
      search_params.work_filter = 'all'
      or (
        search_params.work_filter = 'active'
        and exists (
          select 1
          from order_facts as active_order
          where active_order.customer_id = customer.id
            and active_order.is_active
        )
      )
      or (
        search_params.work_filter = 'unpaid'
        and exists (
          select 1
          from order_facts as unpaid_order
          where unpaid_order.customer_id = customer.id
            and unpaid_order.is_valid
            and unpaid_order.balance_amount > 0
        )
      )
      or (
        search_params.work_filter = 'with_devices'
        and exists (
          select 1
          from public.devices as customer_device
          where customer_device.store_id = search_params.store_id
            and customer_device.customer_id = customer.id
        )
      )
      or (
        search_params.work_filter = 'repeat'
        and (
          select count(*)
          from order_facts as repeat_order
          where repeat_order.customer_id = customer.id
            and repeat_order.is_valid
        ) > 1
      )
    )
    and (
      search_params.marketing = 'all'
      or (
        search_params.marketing = 'allowed'
        and customer.consent_marketing
        and customer.blacklisted_at is null
      )
      or (
        search_params.marketing = 'blocked'
        and (not customer.consent_marketing or customer.blacklisted_at is not null)
      )
    )
    and (
      search_params.followup = 'all'
      or exists (
        select 1
        from public.customer_followups as followup
        where followup.store_id = search_params.store_id
          and followup.customer_id = customer.id
          and followup.status = 'open'
          and (
            (
              search_params.followup = 'due'
              and followup.due_at <= date_trunc('day', now()) + interval '1 day' - interval '1 millisecond'
            )
            or (search_params.followup = 'overdue' and followup.due_at < now())
          )
      )
    )
),
totals as (
  select count(*)::integer as total
  from filtered_customers
),
paged_customers as (
  select filtered_customer.*
  from filtered_customers as filtered_customer
  order by filtered_customer.last_order_at desc nulls last, filtered_customer.name asc
  offset ((select page from params) - 1) * (select page_size from params)
  limit (select page_size from params)
),
paged_ids as (
  select id
  from paged_customers
),
tag_map as (
  select
    assignment.customer_id,
    jsonb_agg(
      jsonb_build_object(
        'id', tag.id,
        'name', tag.name,
        'color', tag.color,
        'description', tag.description
      )
      order by tag.name
    ) as tags
  from public.customer_tag_assignments as assignment
  join public.customer_tags as tag
    on tag.id = assignment.tag_id
   and tag.store_id = assignment.store_id
  join params on params.store_id = assignment.store_id
  join paged_ids on paged_ids.id = assignment.customer_id
  group by assignment.customer_id
),
device_stats as (
  select
    device.customer_id,
    count(*)::integer as device_count,
    (array_agg(concat_ws(' ', device.brand, device.model) order by device.created_at desc))[1]
      as latest_device_label,
    lower(string_agg(
      concat_ws(' ', device.brand, device.model, device.serial_or_imei, device.device_notes),
      ' '
    )) as device_search_text
  from public.devices as device
  join params on params.store_id = device.store_id
  join paged_ids on paged_ids.id = device.customer_id
  group by device.customer_id
),
order_stats as (
  select
    order_fact.customer_id,
    count(*)::integer as historical_order_count,
    count(*) filter (where order_fact.is_valid)::integer as valid_order_count,
    count(*) filter (where order_fact.is_active)::integer as active_order_count,
    coalesce(sum(order_fact.quotation_amount) filter (where order_fact.is_valid), 0)::numeric
      as lifetime_quoted_amount,
    coalesce(sum(order_fact.balance_amount) filter (where order_fact.is_valid), 0)::numeric
      as outstanding_amount,
    max(order_fact.created_at) as last_order_at
  from order_facts as order_fact
  join paged_ids on paged_ids.id = order_fact.customer_id
  group by order_fact.customer_id
),
followup_stats as (
  select
    followup.customer_id,
    min(followup.due_at) filter (where followup.status = 'open') as next_followup_at
  from public.customer_followups as followup
  join params on params.store_id = followup.store_id
  join paged_ids on paged_ids.id = followup.customer_id
  group by followup.customer_id
),
page_items as (
  select
    paged_customer.*,
    coalesce(tag_map.tags, '[]'::jsonb) as tags,
    coalesce(device_stats.device_count, 0) as device_count,
    coalesce(order_stats.historical_order_count, 0) as historical_order_count,
    coalesce(order_stats.valid_order_count, 0) as valid_order_count,
    coalesce(order_stats.active_order_count, 0) as active_order_count,
    coalesce(order_stats.lifetime_quoted_amount, 0)::numeric as lifetime_quoted_amount,
    coalesce(order_stats.outstanding_amount, 0)::numeric as outstanding_amount,
    coalesce(order_stats.last_order_at, paged_customer.last_order_at) as computed_last_order_at,
    followup_stats.next_followup_at,
    device_stats.latest_device_label,
    coalesce(device_stats.device_search_text, '') as device_search_text
  from paged_customers as paged_customer
  left join tag_map on tag_map.customer_id = paged_customer.id
  left join device_stats on device_stats.customer_id = paged_customer.id
  left join order_stats on order_stats.customer_id = paged_customer.id
  left join followup_stats on followup_stats.customer_id = paged_customer.id
),
all_tags as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', tag.id,
        'name', tag.name,
        'color', tag.color,
        'description', tag.description
      )
      order by tag.name
    ),
    '[]'::jsonb
  ) as tags
  from public.customer_tags as tag
  join params on params.store_id = tag.store_id
),
global_stats as (
  select
    (
      select count(*)::integer
      from public.customers as customer
      join params on params.store_id = customer.store_id
    ) as total,
    (
      select count(*)::integer
      from (
        select repeat_order.customer_id
        from order_facts as repeat_order
        where repeat_order.is_valid
        group by repeat_order.customer_id
        having count(*) > 1
      ) as repeat_customers
    ) as repeat,
    (
      select count(distinct active_order.customer_id)::integer
      from order_facts as active_order
      where active_order.is_active
    ) as active_repairs,
    (
      select count(distinct unpaid_order.customer_id)::integer
      from order_facts as unpaid_order
      where unpaid_order.is_valid
        and unpaid_order.balance_amount > 0
    ) as unpaid,
    (
      select count(distinct device.customer_id)::integer
      from public.devices as device
      join params on params.store_id = device.store_id
    ) as with_devices,
    (
      select count(distinct followup.customer_id)::integer
      from public.customer_followups as followup
      join params on params.store_id = followup.store_id
      where followup.status = 'open'
        and followup.due_at <= now()
    ) as due_followups,
    (
      select count(*)::integer
      from public.customers as customer
      join params on params.store_id = customer.store_id
      where customer.consent_marketing
        and customer.blacklisted_at is null
    ) as marketable
)
select jsonb_build_object(
  'items',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', page_item.id,
            'name', page_item.name,
            'phone_e164', page_item.phone_e164,
            'phone_raw', page_item.phone_raw,
            'contact_phones', page_item.contact_phones,
            'consent_marketing', page_item.consent_marketing,
            'consent_sms', page_item.consent_sms,
            'email', page_item.email,
            'preferred_channel', page_item.preferred_channel,
            'language', page_item.language,
            'notes', page_item.notes,
            'marketing_notes', page_item.marketing_notes,
            'last_contacted_at', page_item.last_contacted_at,
            'blacklisted_at', page_item.blacklisted_at,
            'tags', page_item.tags,
            'device_count', page_item.device_count,
            'order_count', page_item.historical_order_count,
            'valid_order_count', page_item.valid_order_count,
            'active_order_count', page_item.active_order_count,
            'lifetime_quoted_amount', page_item.lifetime_quoted_amount,
            'outstanding_amount', page_item.outstanding_amount,
            'total_spent', page_item.lifetime_quoted_amount,
            'unpaid_amount', page_item.outstanding_amount,
            'last_order_at', page_item.computed_last_order_at,
            'next_followup_at', page_item.next_followup_at,
            'latest_device_label', page_item.latest_device_label,
            'device_search_text', page_item.device_search_text
          )
          order by page_item.computed_last_order_at desc nulls last, page_item.name asc
        )
        from page_items as page_item
      ),
      '[]'::jsonb
    ),
  'total', (select total from totals),
  'page', (select page from params),
  'pageSize', (select page_size from params),
  'pageCount', greatest(
    1,
    ceil((select total from totals)::numeric / (select page_size from params))::integer
  ),
  'tags', (select tags from all_tags),
  'stats', jsonb_build_object(
    'total', (select total from global_stats),
    'repeat', (select repeat from global_stats),
    'activeRepairs', (select active_repairs from global_stats),
    'unpaid', (select unpaid from global_stats),
    'withDevices', (select with_devices from global_stats),
    'dueFollowups', (select due_followups from global_stats),
    'marketable', (select marketable from global_stats)
  )
);
$$;

-- Old deployed clients still call v2. Keep the signature but route it through
-- the corrected contract so rollout and app rollback cannot restore the bug.
create or replace function public.repairdesk_customer_list_page_v2(
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
language sql
stable
security invoker
set search_path = ''
as $$
  select public.repairdesk_customer_list_page_v3(
    p_store_id,
    p_search,
    p_tag_ids,
    p_work_filter,
    p_marketing,
    p_followup,
    p_page,
    p_page_size
  );
$$;

-- Preserve the older seven-argument overload as well. It predates the work
-- filter, so its compatible meaning is the v3 `all` work filter.
create or replace function public.repairdesk_customer_list_page_v2(
  p_store_id uuid,
  p_search text default null,
  p_tag_ids text[] default null,
  p_marketing text default 'all',
  p_followup text default 'all',
  p_page integer default 1,
  p_page_size integer default 50
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select public.repairdesk_customer_list_page_v3(
    p_store_id,
    p_search,
    p_tag_ids,
    'all',
    p_marketing,
    p_followup,
    p_page,
    p_page_size
  );
$$;

revoke all on function public.repairdesk_customer_list_page_v3(
  uuid,
  text,
  text[],
  text,
  text,
  text,
  integer,
  integer
) from public, anon, authenticated, service_role;

grant execute on function public.repairdesk_customer_list_page_v3(
  uuid,
  text,
  text[],
  text,
  text,
  text,
  integer,
  integer
) to service_role;

revoke all on function public.repairdesk_customer_list_page_v2(
  uuid,
  text,
  text[],
  text,
  text,
  text,
  integer,
  integer
) from public, anon, authenticated, service_role;

grant execute on function public.repairdesk_customer_list_page_v2(
  uuid,
  text,
  text[],
  text,
  text,
  text,
  integer,
  integer
) to service_role;

revoke all on function public.repairdesk_customer_list_page_v2(
  uuid,
  text,
  text[],
  text,
  text,
  integer,
  integer
) from public, anon, authenticated, service_role;

grant execute on function public.repairdesk_customer_list_page_v2(
  uuid,
  text,
  text[],
  text,
  text,
  integer,
  integer
) to service_role;

comment on function public.repairdesk_customer_list_page_v3(
  uuid,
  text,
  text[],
  text,
  text,
  text,
  integer,
  integer
) is 'Customer page v3: cancelled orders remain historical but are excluded from valid and finance aggregates.';
