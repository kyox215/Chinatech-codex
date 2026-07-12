begin transaction read only;
set local statement_timeout = '30s';

with scoped as (
  select
    o.*,
    upper(btrim(coalesce(o.status_raw, ''))) as raw_status
  from public.repair_orders o
  where o.store_id = '5248dda1-2b32-46cd-8ed0-d15386a9e8ed'::uuid
    and o.internal_tag = 'seatable:chinatech-riparazione-20260711-v2'
    and o.deleted_at is null
), mismatches as (
  select id
  from scoped
  where
    (
      raw_status in ('修好已通知', '修好一通知')
      and (
        status is distinct from 'repaired'
        or workflow_status is distinct from 'repair'
        or exception_status is not null
        or notify_status is distinct from 'sent'
        or parts_status is distinct from 'not_required'
        or completed_at is not null
        or delivered_at is not null
      )
    ) or (
      raw_status in ('寄修', '外修')
      and (
        status is distinct from 'mail_in_progress'
        or workflow_status is distinct from 'repair'
        or exception_status is not null
        or notify_status is distinct from 'not_sent'
        or parts_status is distinct from 'not_required'
        or completed_at is not null
        or delivered_at is not null
      )
    ) or (
      raw_status = '作废'
      and (
        status is distinct from 'cancelled'
        or workflow_status is distinct from 'closed'
        or exception_status is distinct from 'cancelled'
        or notify_status is distinct from 'not_sent'
        or parts_status is distinct from 'not_required'
        or completed_at is not null
        or delivered_at is not null
      )
    ) or (
      raw_status = '作废已通知'
      and (
        status is distinct from 'cancelled'
        or workflow_status is distinct from 'closed'
        or exception_status is distinct from 'cancelled'
        or notify_status is distinct from 'sent'
        or parts_status is distinct from 'not_required'
        or completed_at is not null
        or delivered_at is not null
      )
    )
)
select jsonb_build_object(
  'mismatch_count', (select count(*) from mismatches),
  'patch_event_count', (
    select count(*) from public.order_events
    where payload->>'batch_id' = 'order-custody-archive-20260712-v1'
  ),
  'other_store_patch_event_count', (
    select count(*) from public.order_events
    where payload->>'batch_id' = 'order-custody-archive-20260712-v1'
      and store_id <> '5248dda1-2b32-46cd-8ed0-d15386a9e8ed'::uuid
  )
) as state_summary;

rollback;
