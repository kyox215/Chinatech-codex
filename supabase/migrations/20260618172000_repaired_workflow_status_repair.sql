update public.order_workflow_statuses
set
  bucket = 'repair',
  updated_at = now()
where code = 'repaired'
  and bucket <> 'repair';

update public.repair_orders
set
  workflow_status = 'repair',
  updated_at = now()
where status = 'repaired'
  and workflow_status <> 'repair';
