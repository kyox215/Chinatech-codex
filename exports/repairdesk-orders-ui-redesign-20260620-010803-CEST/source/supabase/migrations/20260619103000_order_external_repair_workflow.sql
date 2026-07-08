update public.order_workflow_statuses
set
  label = '寄修中',
  short_label = '寄修',
  tone = 'progress',
  bucket = 'repair',
  sort_order = 85,
  show_in_order_filters = true,
  updated_at = now()
where code = 'mail_in_progress';

update public.repair_orders
set workflow_status = 'repair'
where status = 'mail_in_progress'
  and workflow_status is distinct from 'repair';

update public.order_workflow_transitions
set
  is_primary = false,
  updated_at = now()
where from_status_code = 'mail_in_progress'
  and is_primary = true;

insert into public.order_workflow_transitions (
  store_id,
  from_status_code,
  to_status_code,
  is_primary,
  sort_order,
  enabled
)
select
  stores.id,
  defaults.from_status_code,
  defaults.to_status_code,
  defaults.is_primary,
  defaults.sort_order,
  true
from public.stores
cross join (
  values
    ('quoted', 'mail_in_progress', false, 35),
    ('waiting_approval', 'mail_in_progress', false, 25),
    ('repairing', 'mail_in_progress', false, 15),
    ('mail_in_progress', 'repaired', true, 10),
    ('mail_in_progress', 'repairing', false, 20),
    ('mail_in_progress', 'diagnosing', false, 30),
    ('mail_in_progress', 'unfixed_pickup', false, 40),
    ('mail_in_progress', 'cancelled', false, 50)
) as defaults(from_status_code, to_status_code, is_primary, sort_order)
on conflict (store_id, from_status_code, to_status_code) do update
set
  is_primary = excluded.is_primary,
  sort_order = excluded.sort_order,
  enabled = true,
  updated_at = now();
