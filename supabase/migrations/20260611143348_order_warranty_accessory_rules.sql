alter table public.store_settings
  add column if not exists default_order_warranty_months integer not null default 6;

do $$
begin
  alter table public.store_settings
    add constraint store_settings_order_warranty_months_check
    check (default_order_warranty_months in (0, 3, 6, 12, 24));
exception when duplicate_object then null;
end $$;

update public.store_settings
set
  default_order_warranty_months = case
    when default_order_warranty_text ~* '(无|none|nessuna|no warranty)' then 0
    when default_order_warranty_text ~ '(两年|2年|24)' then 24
    when default_order_warranty_text ~ '(12|一年|1年)' then 12
    when default_order_warranty_text ~ '(3|90)' then 3
    else 6
  end,
  default_order_warranty_text = case
    when default_order_warranty_text ~* '(无|none|nessuna|no warranty)' then '无保修'
    when default_order_warranty_text ~ '(两年|2年|24)' then '两年'
    when default_order_warranty_text ~ '(12|一年|1年)' then '12个月'
    when default_order_warranty_text ~ '(3|90)' then '3个月'
    else '6个月'
  end;

alter table public.repair_orders
  add column if not exists warranty_months integer,
  add column if not exists warranty_change_reason text,
  add column if not exists warranty_changed_by uuid,
  add column if not exists warranty_changed_at timestamptz;

do $$
begin
  alter table public.repair_orders
    add constraint repair_orders_warranty_months_check
    check (warranty_months is null or warranty_months in (0, 3, 6, 12, 24));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.repair_orders
    add constraint repair_orders_warranty_changed_by_fkey
    foreign key (warranty_changed_by) references public.staff_profiles(id)
    on update cascade on delete set null;
exception when duplicate_object then null;
end $$;

update public.repair_orders
set
  warranty_months = case
    when warranty_text ~* '(无|none|nessuna|no warranty)' then 0
    when warranty_text ~ '(两年|2年|24)' then 24
    when warranty_text ~ '(12|一年|1年)' then 12
    when warranty_text ~ '(3|90)' then 3
    else 6
  end,
  warranty_text = case
    when warranty_text ~* '(无|none|nessuna|no warranty)' then '无保修'
    when warranty_text ~ '(两年|2年|24)' then '两年'
    when warranty_text ~ '(12|一年|1年)' then '12个月'
    when warranty_text ~ '(3|90)' then '3个月'
    else coalesce(nullif(warranty_text, ''), '6个月')
  end
where warranty_months is null;

create index if not exists repair_orders_store_warranty_changed_idx
  on public.repair_orders (store_id, warranty_changed_at desc)
  where warranty_changed_at is not null;
