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
  'quoted',
  'parts_ordered',
  false,
  30,
  true
from public.stores
on conflict (store_id, from_status_code, to_status_code) do update
set
  is_primary = excluded.is_primary,
  sort_order = excluded.sort_order,
  enabled = true,
  updated_at = now();

update public.order_workflow_transitions
set
  sort_order = 40,
  updated_at = now()
where from_status_code = 'quoted'
  and to_status_code = 'cancelled'
  and sort_order < 40;
