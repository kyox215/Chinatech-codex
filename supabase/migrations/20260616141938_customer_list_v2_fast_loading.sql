create extension if not exists pg_trgm with schema extensions;

set search_path = public, extensions;

alter table public.customers
  add column if not exists email text,
  add column if not exists consent_sms boolean not null default true,
  add column if not exists preferred_channel public.message_channel not null default 'whatsapp',
  add column if not exists language text not null default 'it',
  add column if not exists last_contacted_at timestamptz,
  add column if not exists marketing_notes text,
  add column if not exists blacklisted_at timestamptz;

alter table public.customer_followups
  add column if not exists store_id uuid;

alter table public.customer_tags
  add column if not exists store_id uuid;

alter table public.customer_tag_assignments
  add column if not exists store_id uuid;

update public.customer_followups cf
set store_id = c.store_id
from public.customers c
where cf.customer_id = c.id
  and cf.store_id is null
  and c.store_id is not null;

update public.customer_tags
set store_id = '00000000-0000-0000-0000-000000000001'
where store_id is null;

update public.customer_tag_assignments cta
set store_id = c.store_id
from public.customers c
where cta.customer_id = c.id
  and cta.store_id is null
  and c.store_id is not null;

create index if not exists customers_store_marketing_idx
  on public.customers (store_id, consent_marketing, blacklisted_at);

create index if not exists devices_store_customer_created_desc_idx
  on public.devices (store_id, customer_id, created_at desc);

create index if not exists customer_followups_store_customer_open_due_idx
  on public.customer_followups (store_id, customer_id, due_at asc)
  where status = 'open';

create index if not exists repair_orders_store_customer_created_desc_idx
  on public.repair_orders (store_id, customer_id, created_at desc);

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
filtered_customers as (
  select
    c.*,
    latest.last_order_at
  from public.customers c
  join params p on p.store_id = c.store_id
  cross join search_params sp
  left join lateral (
    select max(ro.created_at) as last_order_at
    from public.repair_orders ro
    where ro.store_id = p.store_id
      and ro.customer_id = c.id
  ) latest on true
  where
    (
      sp.search is null
      or lower(c.name) like sp.term
      or lower(coalesce(c.email, '')) like sp.term
      or lower(array_to_string(c.contact_phones, ' ')) like sp.term
      or (
        sp.phone_term <> ''
        and (
          c.phone_raw like '%' || sp.phone_term || '%'
          or regexp_replace(c.phone_e164, '\D', '', 'g') like '%' || sp.phone_term || '%'
          or exists (
            select 1
            from unnest(c.contact_phones) contact_phone(phone)
            where regexp_replace(contact_phone.phone, '\D', '', 'g') like '%' || sp.phone_term || '%'
          )
        )
      )
      or exists (
        select 1
        from public.devices sd
        where sd.store_id = p.store_id
          and sd.customer_id = c.id
          and lower(concat_ws(' ', sd.brand, sd.model, sd.serial_or_imei, sd.device_notes)) like sp.term
      )
    )
    and (
      sp.tag_ids is null
      or exists (
        select 1
        from public.customer_tag_assignments cta
        where cta.store_id = p.store_id
          and cta.customer_id = c.id
          and cta.tag_id = any(sp.tag_ids)
      )
    )
    and (
      sp.work_filter = 'all'
      or (
        sp.work_filter = 'active'
        and exists (
          select 1
          from public.repair_orders ro
          where ro.store_id = p.store_id
            and ro.customer_id = c.id
            and ro.status not in ('completed', 'cancelled')
        )
      )
      or (
        sp.work_filter = 'unpaid'
        and exists (
          select 1
          from public.repair_orders ro
          where ro.store_id = p.store_id
            and ro.customer_id = c.id
            and ro.balance_amount > 0
        )
      )
      or (
        sp.work_filter = 'with_devices'
        and exists (
          select 1
          from public.devices d
          where d.store_id = p.store_id
            and d.customer_id = c.id
        )
      )
      or (
        sp.work_filter = 'repeat'
        and (
          select count(*)
          from public.repair_orders ro
          where ro.store_id = p.store_id
            and ro.customer_id = c.id
        ) > 1
      )
    )
    and (
      sp.marketing = 'all'
      or (sp.marketing = 'allowed' and c.consent_marketing and c.blacklisted_at is null)
      or (sp.marketing = 'blocked' and (not c.consent_marketing or c.blacklisted_at is not null))
    )
    and (
      sp.followup = 'all'
      or exists (
        select 1
        from public.customer_followups cf
        where cf.store_id = p.store_id
          and cf.customer_id = c.id
          and cf.status = 'open'
          and (
            (sp.followup = 'due' and cf.due_at <= date_trunc('day', now()) + interval '1 day' - interval '1 millisecond')
            or (sp.followup = 'overdue' and cf.due_at < now())
          )
      )
    )
),
totals as (
  select count(*)::integer as total
  from filtered_customers
),
paged_customers as (
  select fc.*
  from filtered_customers fc
  cross join params p
  order by fc.last_order_at desc nulls last, fc.name asc
  offset ((select page from params) - 1) * (select page_size from params)
  limit (select page_size from params)
),
paged_ids as (
  select id
  from paged_customers
),
tag_map as (
  select
    cta.customer_id,
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
  join paged_ids pi on pi.id = cta.customer_id
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
  join paged_ids pi on pi.id = d.customer_id
  group by d.customer_id
),
order_stats as (
  select
    ro.customer_id,
    count(*)::integer as order_count,
    count(*) filter (where ro.status not in ('completed', 'cancelled'))::integer as active_order_count,
    coalesce(sum(ro.quotation_amount) filter (where ro.is_paid), 0)::numeric as total_spent,
    coalesce(sum(ro.balance_amount), 0)::numeric as unpaid_amount,
    max(ro.created_at) as last_order_at
  from public.repair_orders ro
  join params p on p.store_id = ro.store_id
  join paged_ids pi on pi.id = ro.customer_id
  group by ro.customer_id
),
followup_stats as (
  select
    cf.customer_id,
    min(cf.due_at) filter (where cf.status = 'open') as next_followup_at
  from public.customer_followups cf
  join params p on p.store_id = cf.store_id
  join paged_ids pi on pi.id = cf.customer_id
  group by cf.customer_id
),
page_items as (
  select
    pc.*,
    coalesce(tm.tags, '[]'::jsonb) as tags,
    coalesce(ds.device_count, 0) as device_count,
    coalesce(os.order_count, 0) as order_count,
    coalesce(os.active_order_count, 0) as active_order_count,
    coalesce(os.total_spent, 0)::numeric as total_spent,
    coalesce(os.unpaid_amount, 0)::numeric as unpaid_amount,
    coalesce(os.last_order_at, pc.last_order_at) as computed_last_order_at,
    fs.next_followup_at,
    ds.latest_device_label,
    coalesce(ds.device_search_text, '') as device_search_text
  from paged_customers pc
  left join tag_map tm on tm.customer_id = pc.id
  left join device_stats ds on ds.customer_id = pc.id
  left join order_stats os on os.customer_id = pc.id
  left join followup_stats fs on fs.customer_id = pc.id
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
    (
      select count(*)::integer
      from public.customers c
      join params p on p.store_id = c.store_id
    ) as total,
    (
      select count(*)::integer
      from (
        select ro.customer_id
        from public.repair_orders ro
        join params p on p.store_id = ro.store_id
        group by ro.customer_id
        having count(*) > 1
      ) repeat_customers
    ) as repeat,
    (
      select count(distinct ro.customer_id)::integer
      from public.repair_orders ro
      join params p on p.store_id = ro.store_id
      where ro.status not in ('completed', 'cancelled')
    ) as active_repairs,
    (
      select count(distinct ro.customer_id)::integer
      from public.repair_orders ro
      join params p on p.store_id = ro.store_id
      where ro.balance_amount > 0
    ) as unpaid,
    (
      select count(distinct d.customer_id)::integer
      from public.devices d
      join params p on p.store_id = d.store_id
    ) as with_devices,
    (
      select count(distinct cf.customer_id)::integer
      from public.customer_followups cf
      join params p on p.store_id = cf.store_id
      where cf.status = 'open'
        and cf.due_at <= now()
    ) as due_followups,
    (
      select count(*)::integer
      from public.customers c
      join params p on p.store_id = c.store_id
      where c.consent_marketing
        and c.blacklisted_at is null
    ) as marketable
)
select jsonb_build_object(
  'items',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', pi.id,
            'name', pi.name,
            'phone_e164', pi.phone_e164,
            'phone_raw', pi.phone_raw,
            'contact_phones', pi.contact_phones,
            'consent_marketing', pi.consent_marketing,
            'consent_sms', pi.consent_sms,
            'email', pi.email,
            'preferred_channel', pi.preferred_channel,
            'language', pi.language,
            'notes', pi.notes,
            'marketing_notes', pi.marketing_notes,
            'last_contacted_at', pi.last_contacted_at,
            'blacklisted_at', pi.blacklisted_at,
            'tags', pi.tags,
            'device_count', pi.device_count,
            'order_count', pi.order_count,
            'active_order_count', pi.active_order_count,
            'total_spent', pi.total_spent,
            'unpaid_amount', pi.unpaid_amount,
            'last_order_at', pi.computed_last_order_at,
            'next_followup_at', pi.next_followup_at,
            'latest_device_label', pi.latest_device_label,
            'device_search_text', pi.device_search_text
          )
          order by pi.computed_last_order_at desc nulls last, pi.name asc
        )
        from page_items pi
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
    'activeRepairs', (select active_repairs from global_stats),
    'unpaid', (select unpaid from global_stats),
    'withDevices', (select with_devices from global_stats),
    'dueFollowups', (select due_followups from global_stats),
    'marketable', (select marketable from global_stats)
  )
);
$$;

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
  select public.repairdesk_customer_list_page_v2(
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

revoke all on function public.repairdesk_customer_list_page_v2(
	  uuid,
	  text,
	  text[],
	  text,
	  text,
	  text,
	  integer,
	  integer
) from public, anon, authenticated;

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
