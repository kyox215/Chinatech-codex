alter table public.repair_orders
  add column if not exists legacy_status text,
  add column if not exists workflow_status text not null default 'intake',
  add column if not exists exception_status text,
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists approval_flow_status text not null default 'not_required',
  add column if not exists parts_status text not null default 'not_required',
  add column if not exists notify_status text not null default 'not_sent';

update public.repair_orders
set legacy_status = coalesce(legacy_status, status);

update public.repair_orders
set workflow_status = case
    when status in ('new', 'rework', 'mail_in_progress') then 'intake'
    when status = 'diagnosing' then 'diagnosis'
    when status in ('quoted', 'waiting_approval') then 'quote'
    when status in ('parts_ordered', 'parts_arrived') then 'parts'
    when status in ('repairing', 'repaired') then 'repair'
    when status in ('notified', 'unfixed_pickup', 'waiting_pickup') then 'pickup'
    when status in ('completed', 'cancelled') then 'closed'
    else workflow_status
  end,
  exception_status = case
    when status = 'cancelled' then 'cancelled'
    when status = 'rework' then 'rework'
    when status = 'unfixed_pickup' then 'returned_unfixed'
    when pause_reason is not null and pause_reason <> '' then 'paused'
    else exception_status
  end,
  payment_status = case
    when is_paid then 'paid'
    when coalesce(deposit_amount, 0) > 0 then 'partial'
    else 'unpaid'
  end,
  approval_flow_status = case
    when status = 'waiting_approval' or approval_status = 'pending' then 'waiting_customer'
    when approval_status = 'approved' then 'approved'
    when approval_status = 'rejected' then 'rejected'
    else 'not_required'
  end,
  parts_status = case
    when status = 'parts_ordered' then 'ordered'
    when status = 'parts_arrived' then 'arrived'
    else 'not_required'
  end,
  notify_status = case
    when status in ('notified', 'waiting_pickup', 'completed') then 'sent'
    when delivered_at is not null then 'contacted'
    else 'not_sent'
  end;

do $$
begin
  alter table public.repair_orders
    add constraint repair_orders_workflow_status_check
    check (workflow_status in ('intake', 'diagnosis', 'quote', 'parts', 'repair', 'pickup', 'closed'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.repair_orders
    add constraint repair_orders_exception_status_check
    check (
      exception_status is null
      or exception_status in ('cancelled', 'unrepairable', 'returned_unfixed', 'rework', 'waiting_customer', 'paused')
    );
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.repair_orders
    add constraint repair_orders_payment_status_check
    check (payment_status in ('unpaid', 'partial', 'paid', 'refunded'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.repair_orders
    add constraint repair_orders_approval_flow_status_check
    check (approval_flow_status in ('not_required', 'waiting_customer', 'approved', 'rejected'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.repair_orders
    add constraint repair_orders_parts_status_check
    check (parts_status in ('not_required', 'needed', 'ordered', 'arrived', 'out_of_stock'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.repair_orders
    add constraint repair_orders_notify_status_check
    check (notify_status in ('not_sent', 'sent', 'contacted'));
exception when duplicate_object then null;
end $$;

create index if not exists repair_orders_store_workflow_status_idx
  on public.repair_orders (store_id, workflow_status, updated_at desc);

create index if not exists repair_orders_store_exception_status_idx
  on public.repair_orders (store_id, exception_status)
  where exception_status is not null;

create index if not exists repair_orders_store_payment_status_idx
  on public.repair_orders (store_id, payment_status, updated_at desc);

create index if not exists repair_orders_store_parts_status_idx
  on public.repair_orders (store_id, parts_status, updated_at desc);
