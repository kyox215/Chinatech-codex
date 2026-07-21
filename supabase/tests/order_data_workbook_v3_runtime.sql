begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

create temporary table workbook_v3_context as
select
  order_row.store_id,
  membership.user_id as actor_id,
  order_row.id as order_id,
  order_row.updated_at,
  order_row.intake_intent_selection as before_intake,
  gen_random_uuid() as batch_id
from public.repair_orders as order_row
join public.stores as store_row
  on store_row.id = order_row.store_id
 and store_row.owner_user_id is not null
 and store_row.status::text = 'active'
join public.store_memberships as membership
  on membership.store_id = store_row.id
 and membership.user_id = store_row.owner_user_id
 and membership.role::text = 'owner'
 and membership.status::text = 'active'
where order_row.record_state::text = 'active'
  and order_row.status::text not in ('completed', 'cancelled')
  and coalesce(order_row.workflow_status::text, '') <> 'closed'
limit 1;

select is((select count(*)::integer from workbook_v3_context), 1, 'workbook v3 fixture exists');

insert into auth.users (id, email, role, aud, created_at, updated_at)
select actor_id, 'workbook-v3@example.invalid', 'authenticated', 'authenticated', now(), now()
from workbook_v3_context
on conflict (id) do nothing;

insert into public.order_data_batches (
  id, store_id, actor_id, kind, template_version, parser_version,
  mode, status, summary, previewed_at, expires_at
)
select
  batch_id, store_id, actor_id, 'import', 'repairdesk-order-data-v3', '1.1.0',
  'update_only', 'previewed', '{"total":1,"ready":1,"update":1}'::jsonb,
  now(), now() + interval '1 hour'
from workbook_v3_context;

insert into public.order_data_batch_rows (
  batch_id, store_id, row_number, action, status, order_id,
  expected_updated_at, normalized_data, changed_fields
)
select
  batch_id, store_id, 2, 'update', 'ready', order_id, updated_at,
  '{"intake_intent_selection":{"schema_version":2,"field":"intake_intent","codes":["known_problem"],"catalog_revision":"order-facts-2026-07-21.v1"}}'::jsonb,
  array['intake_intent_selection']::text[]
from workbook_v3_context;

select ok(
  (public.repairdesk_apply_order_data_batch_v3(
    context.batch_id,
    context.store_id,
    context.actor_id,
    'workbook-v3@example.invalid',
    'Workbook v3 test'
  ) ->> 'applied')::integer = 1,
  'workbook v3 batch applies one row'
)
from workbook_v3_context as context;

select is(
  order_row.intake_intent_selection ->> 'field',
  'intake_intent',
  'workbook v3 persists structured selection'
)
from public.repair_orders as order_row, workbook_v3_context as context
where order_row.id = context.order_id;

select ok(
  batch_row.before_data ? 'structured_facts_v3_applied'
  and batch_row.before_data #> '{order,intake_intent_selection}'
      is not distinct from coalesce(context.before_intake, 'null'::jsonb),
  'workbook v3 captures structured before image'
)
from public.order_data_batch_rows as batch_row, workbook_v3_context as context
where batch_row.batch_id = context.batch_id;

create temporary table workbook_v3_rollback_result as
select public.repairdesk_rollback_order_data_batch_v3(
    context.batch_id,
    context.store_id,
    context.actor_id,
    'workbook-v3@example.invalid',
    'Workbook v3 test'
  ) as result
from workbook_v3_context as context;

select is(batch.status, 'rolled_back', 'workbook v3 batch reaches rolled_back state')
from public.order_data_batches as batch, workbook_v3_context as context
where batch.id = context.batch_id;

select ok(
  order_row.intake_intent_selection is not distinct from context.before_intake,
  'workbook v3 rollback restores previous structured selection'
)
from public.repair_orders as order_row, workbook_v3_context as context
where order_row.id = context.order_id;

select * from finish();
rollback;
