create extension if not exists pg_trgm with schema extensions;

set search_path = public, extensions;

create index if not exists customers_store_updated_idx
  on public.customers (store_id, updated_at desc);

create index if not exists customers_name_trgm_idx
  on public.customers using gin (lower(name) gin_trgm_ops);

create index if not exists customers_email_trgm_idx
  on public.customers using gin (lower(coalesce(email, '')) gin_trgm_ops);

create index if not exists devices_search_trgm_idx
  on public.devices using gin (
    lower(concat_ws(' ', brand, model, serial_or_imei, device_notes)) gin_trgm_ops
  );

create index if not exists repair_orders_store_customer_created_idx
  on public.repair_orders (store_id, customer_id, created_at desc);

create index if not exists customer_tag_assignments_store_customer_idx
  on public.customer_tag_assignments (store_id, customer_id);

create or replace function public.repairdesk_customer_list_page(
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
set search_path = public, extensions
as $$
with params as (
  select
    p_store_id as store_id,
    nullif(trim(coalesce(p_search, '')), '') as search,
    case
      when p_tag_ids is null or cardinality(p_tag_ids) = 0 then null::text[]
      else p_tag_ids
    end as tag_ids,
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
tag_map as (
  select
    cta.customer_id,
    array_agg(cta.tag_id order by ct.name) as tag_ids,
    jsonb_agg(
      jsonb_build_object(
        'id', ct.id,
        'name', ct.name,
        'color', ct.color,
        'description', ct.description
      )
      order by ct.name
    ) as tags
  from public.customer_tag_assignments cta
  join public.customer_tags ct
    on ct.id = cta.tag_id
   and ct.store_id = cta.store_id
  join params p on p.store_id = cta.store_id
  group by cta.customer_id
),
device_stats as (
  select
    d.customer_id,
    count(*)::integer as device_count,
    (array_agg(concat_ws(' ', d.brand, d.model) order by d.created_at desc))[1] as latest_device_label,
    lower(string_agg(concat_ws(' ', d.brand, d.model, d.serial_or_imei, d.device_notes), ' ')) as device_search_text
  from public.devices d
  join params p on p.store_id = d.store_id
  group by d.customer_id
),
order_stats as (
  select
    ro.customer_id,
    count(*)::integer as order_count,
    coalesce(sum(ro.quotation_amount) filter (where ro.is_paid), 0)::numeric as total_spent,
    coalesce(sum(ro.balance_amount), 0)::numeric as unpaid_amount,
    max(ro.created_at) as last_order_at
  from public.repair_orders ro
  join params p on p.store_id = ro.store_id
  group by ro.customer_id
),
followup_stats as (
  select
    cf.customer_id,
    min(cf.due_at) filter (where cf.status = 'open') as next_followup_at
  from public.customer_followups cf
  join params p on p.store_id = cf.store_id
  group by cf.customer_id
),
enriched as (
  select
    c.id,
    c.name,
    c.phone_e164,
    c.phone_raw,
    c.contact_phones,
    c.consent_marketing,
    c.consent_sms,
    c.email,
    c.preferred_channel,
    c.language,
    c.notes,
    c.marketing_notes,
    c.last_contacted_at,
    c.blacklisted_at,
    coalesce(tm.tags, '[]'::jsonb) as tags,
    coalesce(tm.tag_ids, '{}'::text[]) as tag_ids,
    coalesce(ds.device_count, 0) as device_count,
    coalesce(os.order_count, 0) as order_count,
    coalesce(os.total_spent, 0)::numeric as total_spent,
    coalesce(os.unpaid_amount, 0)::numeric as unpaid_amount,
    os.last_order_at,
    fs.next_followup_at,
    ds.latest_device_label,
    coalesce(ds.device_search_text, '') as device_search_text
  from public.customers c
  join params p on p.store_id = c.store_id
  left join tag_map tm on tm.customer_id = c.id
  left join device_stats ds on ds.customer_id = c.id
  left join order_stats os on os.customer_id = c.id
  left join followup_stats fs on fs.customer_id = c.id
),
filtered as (
  select e.*
  from enriched e
  cross join search_params p
  where
    (
      p.search is null
      or lower(e.name) like p.term
      or lower(coalesce(e.email, '')) like p.term
      or (p.phone_term <> '' and e.phone_raw like '%' || p.phone_term || '%')
      or (
        p.phone_term <> ''
        and regexp_replace(e.phone_e164, '\D', '', 'g') like '%' || p.phone_term || '%'
      )
      or lower(array_to_string(e.contact_phones, ' ')) like p.term
      or e.device_search_text like p.term
      or exists (
        select 1
        from public.devices sd
        where sd.store_id = p.store_id
          and sd.customer_id = e.id
          and lower(concat_ws(' ', sd.brand, sd.model, sd.serial_or_imei, sd.device_notes)) like p.term
      )
    )
    and (
      p.tag_ids is null
      or exists (
        select 1
        from unnest(p.tag_ids) selected_tag(id)
        where selected_tag.id = any(e.tag_ids)
      )
    )
    and (
      p.marketing = 'all'
      or (p.marketing = 'allowed' and e.consent_marketing and e.blacklisted_at is null)
      or (p.marketing = 'blocked' and (not e.consent_marketing or e.blacklisted_at is not null))
    )
    and (
      p.followup = 'all'
      or (
        e.next_followup_at is not null
        and (
          (p.followup = 'due' and e.next_followup_at <= date_trunc('day', now()) + interval '1 day' - interval '1 millisecond')
          or (p.followup = 'overdue' and e.next_followup_at < now())
        )
      )
    )
),
totals as (
  select count(*)::integer as total
  from filtered
),
paged as (
  select f.*
  from filtered f
  cross join params p
  order by f.last_order_at desc nulls last, f.name asc
  offset ((select page from params) - 1) * (select page_size from params)
  limit (select page_size from params)
),
all_tags as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ct.id,
        'name', ct.name,
        'color', ct.color,
        'description', ct.description
      )
      order by ct.name
    ),
    '[]'::jsonb
  ) as tags
  from public.customer_tags ct
  join params p on p.store_id = ct.store_id
),
global_stats as (
  select
    count(*)::integer as total,
    count(*) filter (where e.order_count > 1)::integer as repeat,
    count(*) filter (where e.next_followup_at is not null and e.next_followup_at <= now())::integer as due_followups,
    count(*) filter (where e.consent_marketing and e.blacklisted_at is null)::integer as marketable
  from enriched e
)
select jsonb_build_object(
  'items',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'name', p.name,
            'phone_e164', p.phone_e164,
            'phone_raw', p.phone_raw,
            'contact_phones', p.contact_phones,
            'consent_marketing', p.consent_marketing,
            'consent_sms', p.consent_sms,
            'email', p.email,
            'preferred_channel', p.preferred_channel,
            'language', p.language,
            'notes', p.notes,
            'marketing_notes', p.marketing_notes,
            'last_contacted_at', p.last_contacted_at,
            'blacklisted_at', p.blacklisted_at,
            'tags', p.tags,
            'device_count', p.device_count,
            'order_count', p.order_count,
            'total_spent', p.total_spent,
            'unpaid_amount', p.unpaid_amount,
            'last_order_at', p.last_order_at,
            'next_followup_at', p.next_followup_at,
            'latest_device_label', p.latest_device_label,
            'device_search_text', p.device_search_text
          )
          order by p.last_order_at desc nulls last, p.name asc
        )
        from paged p
      ),
      '[]'::jsonb
    ),
  'total', (select total from totals),
  'page', (select page from params),
  'pageSize', (select page_size from params),
  'pageCount', greatest(1, ceil((select total from totals)::numeric / (select page_size from params))::integer),
  'tags', (select tags from all_tags),
  'stats', jsonb_build_object(
    'total', (select total from global_stats),
    'repeat', (select repeat from global_stats),
    'dueFollowups', (select due_followups from global_stats),
    'marketable', (select marketable from global_stats)
  )
);
$$;

revoke all on function public.repairdesk_customer_list_page(
  uuid,
  text,
  text[],
  text,
  text,
  integer,
  integer
) from public, anon, authenticated;

grant execute on function public.repairdesk_customer_list_page(
  uuid,
  text,
  text[],
  text,
  text,
  integer,
  integer
) to service_role;
