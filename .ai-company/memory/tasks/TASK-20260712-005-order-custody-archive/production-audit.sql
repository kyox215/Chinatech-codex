begin transaction read only;
set local statement_timeout = '60s';
set local lock_timeout = '2s';

with params as (
  select
    '5248dda1-2b32-46cd-8ed0-d15386a9e8ed'::uuid as target_store_id,
    'seatable:chinatech-riparazione-20260711-v2'::text as source_tag
),
base as (
  select
    o.*,
    upper(btrim(coalesce(o.status_raw, ''))) as normalized_raw_status,
    (
      coalesce(o.balance_amount, 0) = 0
      and o.is_paid is true
      and o.payment_status = 'paid'
    ) as financially_settled
  from public.repair_orders o
  where o.deleted_at is null
),
target_import as (
  select b.*
  from base b
  cross join params p
  where b.store_id = p.target_store_id
    and b.internal_tag = p.source_tag
),
mapped as (
  select
    t.*,
    case
      when normalized_raw_status = 'FATTO' then 'completed'
      when normalized_raw_status in ('INCORSO', 'IN CORSO') then 'diagnosing'
      when normalized_raw_status in ('下单', '已经下单了', 'PEZZI ORDINATI') then 'parts_ordered'
      when normalized_raw_status in ('到货', '到货已通知', '到货一通知') then 'parts_arrived'
      when normalized_raw_status in ('寄修', '外修') then 'mail_in_progress'
      when normalized_raw_status in ('修好', '修好已通知', '修好一通知') then 'repaired'
      when normalized_raw_status in ('欠款 已拿走', 'RITIRATO', 'CONSEGNATO') then 'completed'
      when normalized_raw_status in ('作废', '作废已通知') then 'cancelled'
      else null
    end as target_status,
    case
      when normalized_raw_status = 'FATTO' then 'closed'
      when normalized_raw_status in ('INCORSO', 'IN CORSO') then 'diagnosis'
      when normalized_raw_status in (
        '下单', '已经下单了', 'PEZZI ORDINATI', '到货', '到货已通知', '到货一通知'
      ) then 'parts'
      when normalized_raw_status in ('寄修', '外修', '修好', '修好已通知', '修好一通知')
        then 'repair'
      when normalized_raw_status in (
        '欠款 已拿走', 'RITIRATO', 'CONSEGNATO', '作废', '作废已通知'
      ) then 'closed'
      else null
    end as target_workflow_status,
    case
      when normalized_raw_status in ('作废', '作废已通知') then 'cancelled'
      else null
    end as target_exception_status,
    case
      when normalized_raw_status in (
        '到货已通知', '到货一通知', '修好已通知', '修好一通知',
        '欠款 已拿走', 'RITIRATO', 'CONSEGNATO', 'FATTO', '作废已通知'
      ) then 'sent'
      when normalized_raw_status <> '' then 'not_sent'
      else null
    end as target_notify_status,
    case
      when normalized_raw_status in ('到货', '到货已通知', '到货一通知') then 'arrived'
      when normalized_raw_status in ('下单', '已经下单了', 'PEZZI ORDINATI') then 'ordered'
      when normalized_raw_status <> '' then 'not_required'
      else null
    end as target_parts_status,
    normalized_raw_status in (
      'INCORSO', 'IN CORSO', '下单', '已经下单了', 'PEZZI ORDINATI',
      '到货', '到货已通知', '到货一通知', '寄修', '外修',
      '修好', '修好已通知', '修好一通知', '作废', '作废已通知'
    ) as must_clear_terminal_timestamps
  from target_import t
),
candidates as (
  select m.*
  from mapped m
  where m.target_status is not null
    and (
      m.status is distinct from m.target_status
      or m.workflow_status is distinct from m.target_workflow_status
      or m.exception_status is distinct from m.target_exception_status
      or m.notify_status is distinct from m.target_notify_status
      or m.parts_status is distinct from m.target_parts_status
      or (m.must_clear_terminal_timestamps and m.completed_at is not null)
      or (m.must_clear_terminal_timestamps and m.delivered_at is not null)
    )
),
candidate_activity as (
  select
    c.id,
    c.updated_at,
    (select count(*) from public.order_events e
      where e.order_id = c.id and e.created_at > c.updated_at) as later_events,
    (select count(*) from public.message_logs m
      where m.order_id = c.id and m.sent_at > c.updated_at) as later_messages,
    (select count(*) from public.order_attachments a
      where a.order_id = c.id and a.created_at > c.updated_at) as later_attachments,
    (select count(*) from public.order_payment_ledger l
      where l.order_id = c.id and l.created_at > c.updated_at) as later_payments
  from candidates c
),
store_summary as (
  select
    left(md5(b.store_id::text), 12) as store_key,
    count(*) as total_orders,
    count(*) filter (
      where b.status in (
        'parts_arrived', 'mail_in_progress', 'repairing', 'repaired', 'notified', 'waiting_pickup'
      ) and b.delivered_at is not null
    ) as active_with_delivery_timestamp,
    count(*) filter (
      where b.status in ('completed', 'cancelled')
        and b.workflow_status = 'closed'
        and b.financially_settled
        and b.delivered_at is not null
    ) as exact_archive_eligible,
    count(*) filter (
      where b.status = 'cancelled' and b.delivered_at is null
    ) as cancelled_without_delivery
  from base b
  group by b.store_id
)
select jsonb_build_object(
  'schema_version', 2,
  'audited_at', now(),
  'target_store_key', left(md5((select target_store_id::text from params)), 12),
  'source_tag', (select source_tag from params),
  'store_summary', coalesce((
    select jsonb_agg(to_jsonb(s) order by s.store_key) from store_summary s
  ), '[]'::jsonb),
  'target_candidate_count', (select count(*) from candidates),
  'target_candidate_breakdown', coalesce((
    select jsonb_agg(to_jsonb(g) order by g.normalized_raw_status)
    from (
      select normalized_raw_status, count(*) as row_count
      from candidates
      group by normalized_raw_status
    ) g
  ), '[]'::jsonb),
  'target_candidates_with_later_activity', (
    select count(*) from candidate_activity
    where later_events > 0 or later_messages > 0 or later_attachments > 0 or later_payments > 0
  ),
  'target_candidate_manifest', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'store_id', c.store_id,
        'id', c.id,
        'status_raw', c.normalized_raw_status,
        'expected_updated_at', c.updated_at,
        'before', jsonb_build_object(
          'status', c.status,
          'workflow_status', c.workflow_status,
          'exception_status', c.exception_status,
          'notify_status', c.notify_status,
          'parts_status', c.parts_status,
          'completed_at', c.completed_at,
          'delivered_at', c.delivered_at
        ),
        'after', jsonb_build_object(
          'status', c.target_status,
          'workflow_status', c.target_workflow_status,
          'exception_status', c.target_exception_status,
          'notify_status', c.target_notify_status,
          'parts_status', c.target_parts_status,
          'completed_at', case when c.must_clear_terminal_timestamps then null else c.completed_at end,
          'delivered_at', case when c.must_clear_terminal_timestamps then null else c.delivered_at end
        ),
        'later_activity', jsonb_build_object(
          'events', a.later_events,
          'messages', a.later_messages,
          'attachments', a.later_attachments,
          'payments', a.later_payments
        )
      ) order by c.id
    )
    from candidates c
    join candidate_activity a on a.id = c.id
  ), '[]'::jsonb)
) as audit;

rollback;
