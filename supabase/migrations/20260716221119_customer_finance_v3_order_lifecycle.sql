-- Runs after the production cancelled-receivables/payment guards from 20260716175044/175056.
alter table public.customers
  add column if not exists deleted_at timestamptz;

alter table public.repair_orders
  add column if not exists deleted_at timestamptz,
  add column if not exists record_state text not null default 'active',
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid,
  add column if not exists void_reason text;

do $$
begin
  if exists (select 1 from public.repair_orders where deleted_at is not null) then
    raise exception using
      message = 'repair_orders contains historical deleted_at rows; lifecycle migration requires manual reconciliation',
      errcode = 'P0001';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'repair_orders_voided_by_fkey'
      and conrelid = 'public.repair_orders'::regclass
  ) then
    alter table public.repair_orders
      add constraint repair_orders_voided_by_fkey
      foreign key (voided_by) references auth.users(id)
      on update restrict on delete restrict
      not valid;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'repair_orders_record_state_check'
      and conrelid = 'public.repair_orders'::regclass
  ) then
    alter table public.repair_orders
      add constraint repair_orders_record_state_check
      check (record_state in ('active', 'voided')) not valid;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'repair_orders_void_metadata_check'
      and conrelid = 'public.repair_orders'::regclass
  ) then
    alter table public.repair_orders
      add constraint repair_orders_void_metadata_check
      check (
        (
          record_state = 'active'
          and voided_at is null
          and voided_by is null
          and void_reason is null
          and deleted_at is null
        )
        or
        (
          record_state = 'voided'
          and voided_at is not null
          and voided_by is not null
          and deleted_at is not null
          and deleted_at = voided_at
          and void_reason is not null
          and char_length(btrim(void_reason)) between 5 and 1000
        )
      ) not valid;
  end if;
end;
$$;

alter table public.repair_orders validate constraint repair_orders_voided_by_fkey;
alter table public.repair_orders validate constraint repair_orders_record_state_check;
alter table public.repair_orders validate constraint repair_orders_void_metadata_check;

create index if not exists repair_orders_store_live_updated_idx
  on public.repair_orders (store_id, updated_at desc)
  where record_state = 'active' and deleted_at is null;

create table if not exists public.order_terminal_operations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  order_id uuid not null,
  idempotency_key uuid not null,
  operation_type text not null,
  request_hash text not null,
  actor_id uuid,
  actor_name_snapshot text not null,
  actor_role_snapshot text not null,
  reason text not null,
  before_data jsonb not null,
  after_data jsonb not null,
  order_updated_at_before timestamptz not null,
  order_updated_at_after timestamptz not null,
  created_at timestamptz not null default now(),
  constraint order_terminal_operations_store_fkey
    foreign key (store_id) references public.stores(id)
    on update cascade on delete restrict,
  constraint order_terminal_operations_order_store_fkey
    foreign key (order_id, store_id) references public.repair_orders(id, store_id)
    on update cascade on delete restrict,
  constraint order_terminal_operations_actor_fkey
    foreign key (actor_id) references auth.users(id)
    on update cascade on delete set null,
  constraint order_terminal_operations_idempotency_unique
    unique (store_id, idempotency_key),
  constraint order_terminal_operations_type_check
    check (operation_type in ('correction', 'reopen', 'void')),
  constraint order_terminal_operations_hash_check
    check (request_hash ~ '^[0-9a-f]{64}$'),
  constraint order_terminal_operations_reason_check
    check (char_length(btrim(reason)) between 5 and 1000)
);

create index if not exists order_terminal_operations_order_created_idx
  on public.order_terminal_operations (store_id, order_id, created_at desc);

alter table public.order_terminal_operations enable row level security;
revoke all on table public.order_terminal_operations from public, anon, authenticated, service_role;
grant select, insert on table public.order_terminal_operations to service_role;

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
    nullif(btrim(coalesce(p_search, '')), '') as search,
    case when p_tag_ids is null or cardinality(p_tag_ids) = 0 then null::text[] else p_tag_ids end as tag_ids,
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
    pg_catalog.regexp_replace(coalesce(params.search, ''), '\D', '', 'g') as phone_term
  from params
),
historical_order_facts as (
  select
    ro.customer_id,
    count(*)::integer as historical_order_count,
    max(ro.created_at) as last_order_at
  from public.repair_orders ro
  join params p on p.store_id = ro.store_id
  group by ro.customer_id
),
valid_order_facts as (
  select
    ro.id,
    ro.store_id,
    ro.customer_id,
    ro.created_at,
    greatest(coalesce(ro.quotation_amount, 0), 0)::numeric as quoted_amount,
    greatest(coalesce(ro.balance_amount, 0), 0)::numeric as outstanding_amount,
    (
      ro.status::text <> 'completed'
      and case
        when ws.code is not null then ws.bucket::text not in ('done', 'cancelled')
        else coalesce(ro.workflow_status::text, '') <> 'closed'
      end
    ) as is_active
  from public.repair_orders ro
  join params p on p.store_id = ro.store_id
  left join public.order_workflow_statuses ws
    on ws.store_id = ro.store_id
   and ws.code::text = ro.status::text
  where ro.record_state = 'active'
    and ro.deleted_at is null
    and ro.status::text <> 'cancelled'
    and coalesce(ro.exception_status::text, '') <> 'cancelled'
    and (ws.code is null or ws.bucket::text <> 'cancelled')
),
order_facts_by_customer as (
  select
    customer_id,
    count(*)::integer as valid_order_count,
    count(*) filter (where is_active)::integer as active_order_count,
    coalesce(sum(quoted_amount), 0)::numeric as lifetime_quoted_amount,
    coalesce(sum(outstanding_amount), 0)::numeric as outstanding_amount
  from valid_order_facts
  group by customer_id
),
filtered_customers as (
  select c.*, history.last_order_at as historical_last_order_at
  from public.customers c
  join params p on p.store_id = c.store_id
  cross join search_params sp
  left join order_facts_by_customer facts on facts.customer_id = c.id
  left join historical_order_facts history on history.customer_id = c.id
  where c.deleted_at is null
    and (
      sp.search is null
      or lower(c.name) like sp.term
      or lower(coalesce(c.email, '')) like sp.term
      or lower(pg_catalog.array_to_string(c.contact_phones, ' ')) like sp.term
      or (
        sp.phone_term <> '' and (
          c.phone_raw like '%' || sp.phone_term || '%'
          or pg_catalog.regexp_replace(c.phone_e164, '\D', '', 'g') like '%' || sp.phone_term || '%'
          or exists (
            select 1 from pg_catalog.unnest(c.contact_phones) contact_phone(phone)
            where pg_catalog.regexp_replace(contact_phone.phone, '\D', '', 'g') like '%' || sp.phone_term || '%'
          )
        )
      )
      or exists (
        select 1 from public.devices d
        where d.store_id = p.store_id
          and d.customer_id = c.id
          and lower(pg_catalog.concat_ws(' ', d.brand, d.model, d.serial_or_imei, d.device_notes)) like sp.term
      )
    )
    and (
      sp.tag_ids is null or exists (
        select 1 from public.customer_tag_assignments cta
        where cta.store_id = p.store_id
          and cta.customer_id = c.id
          and cta.tag_id = any(sp.tag_ids)
      )
    )
    and (
      sp.work_filter = 'all'
      or (sp.work_filter = 'active' and coalesce(facts.active_order_count, 0) > 0)
      or (sp.work_filter = 'unpaid' and coalesce(facts.outstanding_amount, 0) > 0)
      or (sp.work_filter = 'with_devices' and exists (
        select 1 from public.devices d where d.store_id = p.store_id and d.customer_id = c.id
      ))
      or (sp.work_filter = 'repeat' and coalesce(facts.valid_order_count, 0) > 1)
    )
    and (
      sp.marketing = 'all'
      or (sp.marketing = 'allowed' and c.consent_marketing and c.blacklisted_at is null)
      or (sp.marketing = 'blocked' and (not c.consent_marketing or c.blacklisted_at is not null))
    )
    and (
      sp.followup = 'all' or exists (
        select 1 from public.customer_followups cf
        where cf.store_id = p.store_id
          and cf.customer_id = c.id
          and cf.status::text = 'open'
          and (
            (sp.followup = 'due' and cf.due_at <= pg_catalog.date_trunc('day', pg_catalog.now()) + interval '1 day' - interval '1 millisecond')
            or (sp.followup = 'overdue' and cf.due_at < pg_catalog.now())
          )
      )
    )
),
totals as (select count(*)::integer as total from filtered_customers),
paged_customers as (
  select fc.*
  from filtered_customers fc cross join params p
  order by fc.historical_last_order_at desc nulls last, fc.name asc
  offset ((select page from params) - 1) * (select page_size from params)
  limit (select page_size from params)
),
paged_ids as (select id from paged_customers),
tag_map as (
  select cta.customer_id,
    jsonb_agg(jsonb_build_object('id', ct.id, 'name', ct.name, 'color', ct.color, 'description', ct.description) order by ct.name) as tags
  from public.customer_tag_assignments cta
  join public.customer_tags ct on ct.id = cta.tag_id and ct.store_id = cta.store_id
  join params p on p.store_id = cta.store_id
  join paged_ids pi on pi.id = cta.customer_id
  group by cta.customer_id
),
device_stats as (
  select d.customer_id,
    count(*)::integer as device_count,
    (array_agg(pg_catalog.concat_ws(' ', d.brand, d.model) order by d.created_at desc))[1] as latest_device_label,
    lower(string_agg(pg_catalog.concat_ws(' ', d.brand, d.model, d.serial_or_imei, d.device_notes), ' ')) as device_search_text
  from public.devices d
  join params p on p.store_id = d.store_id
  join paged_ids pi on pi.id = d.customer_id
  group by d.customer_id
),
followup_stats as (
  select cf.customer_id, min(cf.due_at) filter (where cf.status::text = 'open') as next_followup_at
  from public.customer_followups cf
  join params p on p.store_id = cf.store_id
  join paged_ids pi on pi.id = cf.customer_id
  group by cf.customer_id
),
page_items as (
  select pc.*,
    coalesce(tm.tags, '[]'::jsonb) as tags,
    coalesce(ds.device_count, 0) as device_count,
    coalesce(history.historical_order_count, 0) as historical_order_count,
    coalesce(facts.valid_order_count, 0) as valid_order_count,
    coalesce(facts.active_order_count, 0) as active_order_count,
    coalesce(facts.lifetime_quoted_amount, 0)::numeric as lifetime_quoted_amount,
    coalesce(facts.outstanding_amount, 0)::numeric as outstanding_amount,
    pc.historical_last_order_at as computed_last_order_at,
    fs.next_followup_at,
    ds.latest_device_label,
    coalesce(ds.device_search_text, '') as device_search_text
  from paged_customers pc
  left join tag_map tm on tm.customer_id = pc.id
  left join device_stats ds on ds.customer_id = pc.id
  left join historical_order_facts history on history.customer_id = pc.id
  left join order_facts_by_customer facts on facts.customer_id = pc.id
  left join followup_stats fs on fs.customer_id = pc.id
),
all_tags as (
  select coalesce(jsonb_agg(jsonb_build_object('id', ct.id, 'name', ct.name, 'color', ct.color, 'description', ct.description) order by ct.name), '[]'::jsonb) as tags
  from public.customer_tags ct join params p on p.store_id = ct.store_id
),
global_stats as (
  select
    (select count(*)::integer from public.customers c join params p on p.store_id = c.store_id where c.deleted_at is null) as total,
    (select count(*)::integer from order_facts_by_customer where valid_order_count > 1) as repeat,
    (select count(*)::integer from order_facts_by_customer where active_order_count > 0) as active_repairs,
    (select count(*)::integer from order_facts_by_customer where outstanding_amount > 0) as unpaid,
    (select count(distinct d.customer_id)::integer from public.devices d join params p on p.store_id = d.store_id) as with_devices,
    (select count(distinct cf.customer_id)::integer from public.customer_followups cf join params p on p.store_id = cf.store_id where cf.status::text = 'open' and cf.due_at <= pg_catalog.now()) as due_followups,
    (select count(*)::integer from public.customers c join params p on p.store_id = c.store_id where c.deleted_at is null and c.consent_marketing and c.blacklisted_at is null) as marketable
)
select jsonb_build_object(
  'items', coalesce((select jsonb_agg(jsonb_build_object(
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
    'order_count', pi.historical_order_count,
    'valid_order_count', pi.valid_order_count,
    'active_order_count', pi.active_order_count,
    'lifetime_quoted_amount', pi.lifetime_quoted_amount,
    'outstanding_amount', pi.outstanding_amount,
    'total_spent', pi.lifetime_quoted_amount,
    'unpaid_amount', pi.outstanding_amount,
    'last_order_at', pi.computed_last_order_at,
    'next_followup_at', pi.next_followup_at,
    'latest_device_label', pi.latest_device_label,
    'device_search_text', pi.device_search_text
  ) order by pi.computed_last_order_at desc nulls last, pi.name asc) from page_items pi), '[]'::jsonb),
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

revoke all on function public.repairdesk_customer_list_page_v3(
  uuid, text, text[], text, text, text, integer, integer
) from public, anon, authenticated;
grant execute on function public.repairdesk_customer_list_page_v3(
  uuid, text, text[], text, text, text, integer, integer
) to service_role;

-- Final payment boundary after lifecycle/catalog columns exist. Idempotent
-- replay remains ahead of terminal-state guards so a completed request is
-- stable even if the order is later cancelled or voided.
create or replace function public.repairdesk_record_order_payment(
  p_store_id uuid,
  p_order_id uuid,
  p_actor_id uuid,
  p_amount numeric,
  p_method text,
  p_expected_updated_at timestamptz,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor_email text;
  v_actor_name text;
  v_actor_role text;
  v_existing public.order_payment_ledger%rowtype;
  v_order public.repair_orders%rowtype;
  v_workflow_bucket text;
  v_payment_id uuid := gen_random_uuid();
  v_method text := btrim(coalesce(p_method, ''));
  v_balance_after numeric(12, 2);
  v_now timestamptz := clock_timestamp();
begin
  if p_store_id is null or p_order_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_target');
  end if;
  if p_actor_id is null then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;
  if p_idempotency_key is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_idempotency_key');
  end if;
  if p_expected_updated_at is null then
    return jsonb_build_object('ok', false, 'code', 'missing_expected_version');
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
    return jsonb_build_object('ok', false, 'code', 'invalid_amount');
  end if;
  if char_length(v_method) < 1 or char_length(v_method) > 64 then
    return jsonb_build_object('ok', false, 'code', 'invalid_method');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_store_id::text || ':' || p_idempotency_key::text, 0)
  );

  select profile.email, coalesce(membership.display_name, profile.display_name), membership.role::text
    into v_actor_email, v_actor_name, v_actor_role
    from public.staff_profiles as profile
    join public.store_memberships as membership
      on membership.user_id = profile.id
     and membership.store_id = p_store_id
     and membership.status::text = 'active'
    join public.stores as store_row
      on store_row.id = membership.store_id
     and store_row.status::text = 'active'
   where profile.id = p_actor_id
     and profile.status::text = 'active'
   limit 1;

  if v_actor_role is null or v_actor_role not in ('owner', 'manager', 'sales') then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;

  select ledger.*
    into v_existing
    from public.order_payment_ledger as ledger
   where ledger.store_id = p_store_id
     and ledger.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.order_id <> p_order_id
       or v_existing.actor_id is distinct from p_actor_id
       or v_existing.amount <> p_amount
       or v_existing.payment_method <> v_method
       or v_existing.order_updated_at_before <> p_expected_updated_at then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return jsonb_build_object(
      'ok', true,
      'code', 'idempotent_replay',
      'payment_id', v_existing.id,
      'balance', v_existing.balance_after,
      'is_paid', v_existing.balance_after = 0,
      'updated_at', v_existing.order_updated_at_after
    );
  end if;

  select order_row.*
    into v_order
    from public.repair_orders as order_row
   where order_row.store_id = p_store_id
     and order_row.id = p_order_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'order_not_found');
  end if;

  select ledger.*
    into v_existing
    from public.order_payment_ledger as ledger
   where ledger.store_id = p_store_id
     and ledger.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.order_id <> p_order_id
       or v_existing.actor_id is distinct from p_actor_id
       or v_existing.amount <> p_amount
       or v_existing.payment_method <> v_method
       or v_existing.order_updated_at_before <> p_expected_updated_at then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return jsonb_build_object(
      'ok', true,
      'code', 'idempotent_replay',
      'payment_id', v_existing.id,
      'balance', v_existing.balance_after,
      'is_paid', v_existing.balance_after = 0,
      'updated_at', v_existing.order_updated_at_after
    );
  end if;

  if v_order.record_state::text <> 'active' or v_order.deleted_at is not null then
    return jsonb_build_object('ok', false, 'code', 'order_voided');
  end if;

  select status_row.bucket::text
    into v_workflow_bucket
    from public.order_workflow_statuses as status_row
   where status_row.store_id = p_store_id
     and status_row.code::text = v_order.status::text
   limit 1;

  if lower(coalesce(v_order.status::text, '')) = 'cancelled'
     or lower(coalesce(v_order.exception_status::text, '')) = 'cancelled'
     or v_workflow_bucket = 'cancelled' then
    return jsonb_build_object('ok', false, 'code', 'order_cancelled');
  end if;

  if v_order.updated_at <> p_expected_updated_at then
    return jsonb_build_object('ok', false, 'code', 'stale_version');
  end if;
  if v_order.is_paid or v_order.balance_amount <= 0 then
    return jsonb_build_object('ok', false, 'code', 'already_settled');
  end if;
  if p_amount > v_order.balance_amount then
    return jsonb_build_object('ok', false, 'code', 'overpayment');
  end if;

  v_balance_after := v_order.balance_amount - p_amount;

  insert into public.order_payment_ledger (
    id,
    store_id,
    order_id,
    idempotency_key,
    actor_id,
    actor_name_snapshot,
    amount,
    payment_method,
    currency_code,
    balance_before,
    balance_after,
    order_updated_at_before,
    order_updated_at_after,
    created_at
  ) values (
    v_payment_id,
    p_store_id,
    p_order_id,
    p_idempotency_key,
    p_actor_id,
    v_actor_name,
    p_amount,
    v_method,
    v_order.currency_code,
    v_order.balance_amount,
    v_balance_after,
    v_order.updated_at,
    v_now,
    v_now
  );

  update public.repair_orders
     set balance_amount = v_balance_after,
         is_paid = v_balance_after = 0,
         payment_status = case when v_balance_after = 0 then 'paid' else 'partial' end,
         updated_at = v_now
   where store_id = p_store_id
     and id = p_order_id;

  insert into public.order_events (
    id,
    store_id,
    order_id,
    event_type,
    payload,
    operator_name,
    created_at
  ) values (
    gen_random_uuid(),
    p_store_id,
    p_order_id,
    'payment',
    jsonb_build_object(
      'amount', p_amount,
      'method', v_method,
      'balance', v_balance_after,
      'currency_code', v_order.currency_code,
      'payment_id', v_payment_id
    ),
    v_actor_name,
    v_now
  );

  insert into public.audit_logs (
    id,
    actor_id,
    actor_email,
    actor_name,
    store_id,
    action,
    entity_type,
    entity_id,
    metadata,
    created_at
  ) values (
    gen_random_uuid()::text,
    p_actor_id,
    v_actor_email,
    v_actor_name,
    p_store_id,
    'payment',
    'repair_order',
    p_order_id::text,
    jsonb_build_object('payment_id', v_payment_id),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'code', 'recorded',
    'payment_id', v_payment_id,
    'balance', v_balance_after,
    'is_paid', v_balance_after = 0,
    'updated_at', v_now
  );
end;
$$;

revoke all on function public.repairdesk_record_order_payment(
  uuid, uuid, uuid, numeric, text, timestamptz, uuid
) from public, anon, authenticated;
grant execute on function public.repairdesk_record_order_payment(
  uuid, uuid, uuid, numeric, text, timestamptz, uuid
) to service_role;
