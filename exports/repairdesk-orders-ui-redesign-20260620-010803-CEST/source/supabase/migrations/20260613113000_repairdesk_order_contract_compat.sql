alter table public.repair_orders
  add column if not exists store_id uuid not null default '00000000-0000-0000-0000-000000000001',
  add column if not exists currency_code text not null default 'EUR',
  add column if not exists device_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists accessory_notes text,
  add column if not exists contact_phones text[] not null default '{}'::text[],
  add column if not exists warranty_months integer,
  add column if not exists warranty_change_reason text,
  add column if not exists warranty_changed_by uuid,
  add column if not exists warranty_changed_at timestamptz,
  add column if not exists legacy_status text,
  add column if not exists workflow_status text not null default 'intake',
  add column if not exists exception_status text,
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists approval_flow_status text not null default 'not_required',
  add column if not exists parts_status text not null default 'not_required',
  add column if not exists notify_status text not null default 'not_sent';

update public.repair_orders
set
  currency_code = coalesce(nullif(currency_code, ''), 'EUR'),
  legacy_status = coalesce(legacy_status, status),
  workflow_status = case
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
    when nullif(pause_reason, '') is not null then 'paused'
    else null
  end,
  payment_status = case
    when is_paid or coalesce(balance_amount, 0) <= 0 then 'paid'
    when coalesce(deposit_amount, 0) > 0 then 'partial'
    else 'unpaid'
  end,
  approval_flow_status = case
    when approval_status = 'approved' then 'approved'
    when approval_status = 'rejected' then 'rejected'
    when status = 'waiting_approval' then 'waiting_customer'
    else 'not_required'
  end,
  parts_status = case
    when status = 'parts_ordered' then 'ordered'
    when status = 'parts_arrived' then 'arrived'
    else 'not_required'
  end,
  notify_status = case
    when status in ('notified', 'waiting_pickup', 'completed') then 'sent'
    else 'not_sent'
  end;

do $$
begin
  alter table public.repair_orders
    add constraint repair_orders_device_snapshot_object
    check (jsonb_typeof(device_snapshot) = 'object');
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.repair_orders
    add constraint repair_orders_currency_eur
    check (currency_code = 'EUR');
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.repair_orders
    add constraint repair_orders_warranty_months_check
    check (warranty_months is null or warranty_months in (0, 3, 6, 12, 24));
exception when duplicate_object then null;
end $$;

create index if not exists repair_orders_store_approval_flow_status_idx
  on public.repair_orders (store_id, approval_flow_status, updated_at desc);

create index if not exists repair_orders_store_paid_idx
  on public.repair_orders (store_id, is_paid, updated_at desc);

create index if not exists repair_orders_store_created_idx
  on public.repair_orders (store_id, created_at desc);

create index if not exists repair_orders_store_order_type_idx
  on public.repair_orders (store_id, order_type, updated_at desc);

create index if not exists repair_orders_store_technician_idx
  on public.repair_orders (store_id, technician_name, updated_at desc);

create index if not exists repair_orders_store_supplier_idx
  on public.repair_orders (store_id, supplier_id, updated_at desc);

notify pgrst, 'reload schema';
