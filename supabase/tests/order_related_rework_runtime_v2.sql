begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

create temporary table phase34_runtime_context as
select
  order_row.store_id,
  membership.user_id as actor_id,
  order_row.id as source_order_id,
  order_row.updated_at as source_updated_at,
  order_row.status as source_status,
  order_row.quotation_amount as source_quotation,
  order_row.deposit_amount as source_deposit,
  order_row.balance_amount as source_balance,
  order_row.completed_at as source_completed_at,
  gen_random_uuid() as start_operation_id,
  gen_random_uuid() as disposition_operation_id
from public.repair_orders as order_row
join public.store_memberships as membership
  on membership.store_id = order_row.store_id
 and membership.role::text = 'owner'
 and membership.status::text = 'active'
where order_row.status::text = 'completed'
  and order_row.customer_id is not null
  and order_row.device_id is not null
  and order_row.record_state::text = 'active'
limit 1;

select is((select count(*)::integer from phase34_runtime_context), 1, 'runtime fixture exists');

insert into auth.users (id, email, role, aud, created_at, updated_at)
select actor_id, 'phase34-runtime@example.invalid', 'authenticated', 'authenticated', now(), now()
from phase34_runtime_context
on conflict (id) do nothing;

create temporary table phase34_start_result as
select public.repairdesk_create_related_order_v2(
  context.store_id,
  context.source_order_id,
  context.actor_id,
  context.source_updated_at,
  context.start_operation_id,
  repeat('a', 64),
  '{"schema_version":2,"kind":"preset","primary_code":"suspected_same_issue","catalog_revision":"order-reasons-2026-07-21.v1","context":"rework.triage","internal_snapshot":{"locale":"zh-CN","labels":["疑似原故障复发"],"text":"返修接收判断：疑似原故障复发，尚未判定保修或费用。"}}'::jsonb,
  '返修接收判断：疑似原故障复发，尚未判定保修或费用。'
) as result
from phase34_runtime_context as context;

select is(result ->> 'code', 'created', 'completed source creates a rework child')
from phase34_start_result;
select is(result ->> 'relation_type', 'followup', 'triage relation starts as followup')
from phase34_start_result;
select is(result ->> 'episode_status', 'open', 'triage episode starts open')
from phase34_start_result;

select is(order_row.status::text, 'rework', 'child status is rework')
from public.repair_orders as order_row, phase34_start_result as started
where order_row.id = (started.result ->> 'related_order_id')::uuid;
select is(order_row.original_order_id::text, context.source_order_id::text, 'child links original')
from public.repair_orders as order_row, phase34_start_result as started, phase34_runtime_context as context
where order_row.id = (started.result ->> 'related_order_id')::uuid;
select ok(
  order_row.quotation_amount = 0 and order_row.deposit_amount = 0 and order_row.balance_amount = 0,
  'child starts with zero finance'
)
from public.repair_orders as order_row, phase34_start_result as started
where order_row.id = (started.result ->> 'related_order_id')::uuid;

select ok(
  order_row.status = context.source_status
  and order_row.quotation_amount = context.source_quotation
  and order_row.deposit_amount = context.source_deposit
  and order_row.balance_amount = context.source_balance
  and order_row.completed_at is not distinct from context.source_completed_at
  and order_row.updated_at = context.source_updated_at,
  'original terminal and finance evidence remains immutable'
)
from public.repair_orders as order_row, phase34_runtime_context as context
where order_row.id = context.source_order_id;

select is(
  public.repairdesk_create_related_order_v2(
    context.store_id,
    context.source_order_id,
    context.actor_id,
    context.source_updated_at,
    context.start_operation_id,
    repeat('a', 64),
    '{"schema_version":2,"kind":"preset","primary_code":"suspected_same_issue","catalog_revision":"order-reasons-2026-07-21.v1","context":"rework.triage","internal_snapshot":{"locale":"zh-CN","labels":["疑似原故障复发"],"text":"返修接收判断：疑似原故障复发，尚未判定保修或费用。"}}'::jsonb,
    '返修接收判断：疑似原故障复发，尚未判定保修或费用。'
  ) ->> 'code',
  'idempotent_replay',
  'start operation is idempotent'
)
from phase34_runtime_context as context;

select is(
  public.repairdesk_create_related_order_v2(
    context.store_id,
    context.source_order_id,
    context.actor_id,
    context.source_updated_at - interval '1 second',
    gen_random_uuid(),
    repeat('b', 64),
    '{"schema_version":2,"kind":"preset","primary_code":"uncertain","catalog_revision":"order-reasons-2026-07-21.v1","context":"rework.triage","internal_snapshot":{"locale":"zh-CN","labels":["暂时无法判断"],"text":"返修接收判断：当前无法判断，等待检测结论。"}}'::jsonb,
    '返修接收判断：当前无法判断，等待检测结论。'
  ) ->> 'code',
  'stale_source_order',
  'stale source version is rejected'
)
from phase34_runtime_context as context;

update public.repair_orders as order_row
set diagnosis_result = '检测确认原维修项目故障复发', updated_at = clock_timestamp()
from phase34_start_result as started
where order_row.id = (started.result ->> 'related_order_id')::uuid;

create temporary table phase34_disposition_result as
select public.repairdesk_record_rework_disposition_v2(
  context.store_id,
  child.id,
  context.actor_id,
  child.updated_at,
  context.disposition_operation_id,
  repeat('c', 64),
  '{"schema_version":2,"kind":"preset","primary_code":"warranty_original_item","catalog_revision":"order-reasons-2026-07-21.v1","context":"rework.disposition","internal_snapshot":{"locale":"zh-CN","labels":["原项目保修"],"text":"返修检测处置：判定为原维修项目保修处理。"}}'::jsonb,
  '返修检测处置：判定为原维修项目保修处理。'
) as result
from phase34_runtime_context as context
join phase34_start_result as started on true
join public.repair_orders as child on child.id = (started.result ->> 'related_order_id')::uuid;

select is(result ->> 'code', 'recorded', 'diagnosed rework child accepts disposition')
from phase34_disposition_result;
select is(result ->> 'relation_type', 'warranty_rework', 'warranty disposition updates relation')
from phase34_disposition_result;
select is(result ->> 'episode_status', 'decided', 'warranty disposition closes episode')
from phase34_disposition_result;

select ok(
  not (audit.metadata -> 'triage_selection' ? 'internal_snapshot')
  and not (audit.metadata -> 'triage_selection' ? 'note'),
  'triage audit metadata excludes free text snapshot'
)
from public.audit_logs as audit, phase34_runtime_context as context
where audit.store_id = context.store_id
  and audit.action = 'create_related_order'
  and audit.entity_id = context.source_order_id::text
order by audit.created_at desc
limit 1;

select ok(
  not (audit.metadata -> 'disposition_selection' ? 'internal_snapshot')
  and not (audit.metadata -> 'disposition_selection' ? 'note'),
  'disposition audit metadata excludes free text snapshot'
)
from public.audit_logs as audit, phase34_start_result as started
where audit.action = 'record_rework_disposition'
  and audit.entity_id = started.result ->> 'related_order_id'
order by audit.created_at desc
limit 1;

select * from finish();
rollback;
