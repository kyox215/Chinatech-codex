update public.order_workflow_statuses
set
  bucket = 'repair',
  updated_at = now()
where code = 'repaired'
  and bucket <> 'repair';
