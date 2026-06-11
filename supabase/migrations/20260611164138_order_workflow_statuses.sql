create table if not exists public.order_workflow_statuses (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  code text not null,
  label text not null,
  short_label text not null default '',
  tone text not null default 'neutral',
  bucket text not null default 'custom',
  sort_order integer not null default 0,
  enabled boolean not null default true,
  show_in_order_filters boolean not null default true,
  allowed_for_create boolean not null default false,
  is_default_create_status boolean not null default false,
  is_system boolean not null default false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_workflow_statuses_store_id_fkey
    foreign key (store_id) references public.stores(id)
    on update cascade on delete cascade,
  constraint order_workflow_statuses_created_by_fkey
    foreign key (created_by) references public.staff_profiles(id)
    on update cascade on delete set null,
  constraint order_workflow_statuses_updated_by_fkey
    foreign key (updated_by) references public.staff_profiles(id)
    on update cascade on delete set null,
  constraint order_workflow_statuses_code_format
    check (code ~ '^[a-z][a-z0-9_]{1,47}$'),
  constraint order_workflow_statuses_tone_check
    check (tone in ('neutral', 'info', 'progress', 'warn', 'success', 'danger')),
  constraint order_workflow_statuses_bucket_check
    check (bucket in ('intake', 'diagnosing', 'quote', 'parts', 'repair', 'pickup', 'done', 'cancelled', 'custom')),
  constraint order_workflow_statuses_store_code_unique
    unique (store_id, code)
);

create table if not exists public.order_workflow_transitions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  from_status_code text not null,
  to_status_code text not null,
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  enabled boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_workflow_transitions_store_id_fkey
    foreign key (store_id) references public.stores(id)
    on update cascade on delete cascade,
  constraint order_workflow_transitions_created_by_fkey
    foreign key (created_by) references public.staff_profiles(id)
    on update cascade on delete set null,
  constraint order_workflow_transitions_updated_by_fkey
    foreign key (updated_by) references public.staff_profiles(id)
    on update cascade on delete set null,
  constraint order_workflow_transitions_from_fkey
    foreign key (store_id, from_status_code)
    references public.order_workflow_statuses(store_id, code)
    on update cascade on delete restrict,
  constraint order_workflow_transitions_to_fkey
    foreign key (store_id, to_status_code)
    references public.order_workflow_statuses(store_id, code)
    on update cascade on delete restrict,
  constraint order_workflow_transitions_no_self
    check (from_status_code <> to_status_code),
  constraint order_workflow_transitions_unique
    unique (store_id, from_status_code, to_status_code)
);

create unique index if not exists order_workflow_statuses_default_create_unique
  on public.order_workflow_statuses (store_id)
  where is_default_create_status and enabled;

create unique index if not exists order_workflow_transitions_primary_unique
  on public.order_workflow_transitions (store_id, from_status_code)
  where is_primary and enabled;

create index if not exists order_workflow_statuses_store_sort_idx
  on public.order_workflow_statuses (store_id, sort_order, label);

create index if not exists order_workflow_transitions_store_from_idx
  on public.order_workflow_transitions (store_id, from_status_code, sort_order);

insert into public.order_workflow_statuses (
  store_id,
  code,
  label,
  short_label,
  tone,
  bucket,
  sort_order,
  enabled,
  show_in_order_filters,
  allowed_for_create,
  is_default_create_status,
  is_system
)
select
  stores.id,
  defaults.code,
  defaults.label,
  defaults.short_label,
  defaults.tone,
  defaults.bucket,
  defaults.sort_order,
  true,
  defaults.show_in_order_filters,
  defaults.allowed_for_create,
  defaults.is_default_create_status,
  true
from public.stores
cross join (
  values
    ('new', '新建', '新建', 'info', 'intake', 10, true, true, true),
    ('rework', '返修', '返修', 'warn', 'intake', 20, true, true, false),
    ('mail_in_progress', '邮寄中', '邮寄', 'info', 'intake', 30, true, true, false),
    ('diagnosing', '检测中', '检测', 'progress', 'diagnosing', 40, true, true, false),
    ('quoted', '已报价', '报价', 'progress', 'quote', 50, true, false, false),
    ('waiting_approval', '待审批', '审批', 'warn', 'quote', 60, true, false, false),
    ('parts_ordered', '配件已订', '订件', 'progress', 'parts', 70, true, false, false),
    ('parts_arrived', '配件已到', '到件', 'progress', 'parts', 80, true, false, false),
    ('repairing', '维修中', '维修', 'progress', 'repair', 90, true, false, false),
    ('repaired', '已修复', '修复', 'success', 'pickup', 100, true, false, false),
    ('notified', '已通知', '通知', 'success', 'pickup', 110, true, false, false),
    ('unfixed_pickup', '未修取机', '未修', 'danger', 'pickup', 120, true, false, false),
    ('waiting_pickup', '待取机', '待取', 'warn', 'pickup', 130, true, false, false),
    ('completed', '已完成', '完成', 'success', 'done', 140, true, false, false),
    ('cancelled', '已取消', '取消', 'neutral', 'cancelled', 150, true, false, false)
) as defaults(
  code,
  label,
  short_label,
  tone,
  bucket,
  sort_order,
  show_in_order_filters,
  allowed_for_create,
  is_default_create_status
)
on conflict (store_id, code) do update
set
  label = excluded.label,
  short_label = excluded.short_label,
  tone = excluded.tone,
  bucket = excluded.bucket,
  sort_order = excluded.sort_order,
  show_in_order_filters = excluded.show_in_order_filters,
  allowed_for_create = excluded.allowed_for_create,
  is_default_create_status = excluded.is_default_create_status,
  is_system = true,
  updated_at = now();

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
    ('new', 'diagnosing', true, 10),
    ('new', 'quoted', false, 20),
    ('new', 'repairing', false, 30),
    ('new', 'cancelled', false, 40),
    ('rework', 'diagnosing', true, 10),
    ('rework', 'repairing', false, 20),
    ('rework', 'cancelled', false, 30),
    ('mail_in_progress', 'diagnosing', true, 10),
    ('mail_in_progress', 'cancelled', false, 20),
    ('diagnosing', 'quoted', true, 10),
    ('diagnosing', 'repairing', false, 20),
    ('diagnosing', 'unfixed_pickup', false, 30),
    ('diagnosing', 'cancelled', false, 40),
    ('quoted', 'waiting_approval', true, 10),
    ('quoted', 'repairing', false, 20),
    ('quoted', 'cancelled', false, 30),
    ('waiting_approval', 'repairing', true, 10),
    ('waiting_approval', 'parts_ordered', false, 20),
    ('waiting_approval', 'cancelled', false, 30),
    ('parts_ordered', 'parts_arrived', true, 10),
    ('parts_ordered', 'cancelled', false, 20),
    ('parts_arrived', 'repairing', true, 10),
    ('parts_arrived', 'cancelled', false, 20),
    ('repairing', 'repaired', true, 10),
    ('repairing', 'parts_ordered', false, 20),
    ('repairing', 'unfixed_pickup', false, 30),
    ('repairing', 'cancelled', false, 40),
    ('repaired', 'notified', true, 10),
    ('repaired', 'completed', false, 20),
    ('repaired', 'waiting_pickup', false, 30),
    ('notified', 'completed', true, 10),
    ('notified', 'waiting_pickup', false, 20),
    ('notified', 'unfixed_pickup', false, 30),
    ('unfixed_pickup', 'completed', true, 10),
    ('unfixed_pickup', 'rework', false, 20),
    ('waiting_pickup', 'completed', true, 10),
    ('waiting_pickup', 'notified', false, 20),
    ('completed', 'rework', true, 10),
    ('cancelled', 'new', true, 10),
    ('cancelled', 'rework', false, 20)
) as defaults(from_status_code, to_status_code, is_primary, sort_order)
on conflict (store_id, from_status_code, to_status_code) do update
set
  is_primary = excluded.is_primary,
  sort_order = excluded.sort_order,
  enabled = true,
  updated_at = now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'repair_orders'
      and column_name = 'status'
      and udt_name = 'repair_order_status'
  ) then
    alter table public.repair_orders
      alter column status type text using status::text;
  end if;
end $$;

do $$
begin
  alter table public.repair_orders
    add constraint repair_orders_store_status_fkey
    foreign key (store_id, status)
    references public.order_workflow_statuses(store_id, code)
    on update cascade on delete restrict
    not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.repair_orders validate constraint repair_orders_store_status_fkey;
exception
  when foreign_key_violation then
    raise notice 'repair_orders_store_status_fkey left not valid because legacy rows have unknown statuses';
end $$;

alter table public.order_workflow_statuses enable row level security;
alter table public.order_workflow_transitions enable row level security;

revoke all on table public.order_workflow_statuses from anon, authenticated;
revoke all on table public.order_workflow_transitions from anon, authenticated;

grant all on table public.order_workflow_statuses to service_role;
grant all on table public.order_workflow_transitions to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'order_workflow_statuses'
      and policyname = 'order_workflow_statuses_store_member_select'
  ) then
    create policy order_workflow_statuses_store_member_select
    on public.order_workflow_statuses
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.store_memberships sm
        where sm.store_id = order_workflow_statuses.store_id
          and sm.user_id = (select auth.uid())
          and sm.status = 'active'
      )
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'order_workflow_transitions'
      and policyname = 'order_workflow_transitions_store_member_select'
  ) then
    create policy order_workflow_transitions_store_member_select
    on public.order_workflow_transitions
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.store_memberships sm
        where sm.store_id = order_workflow_transitions.store_id
          and sm.user_id = (select auth.uid())
          and sm.status = 'active'
      )
    );
  end if;
end $$;
