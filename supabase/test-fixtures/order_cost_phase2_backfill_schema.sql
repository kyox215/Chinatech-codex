-- Adds legacy orders and the Phase 1 order-line synchronization triggers needed
-- to behavior-test the preview-first history backfill migration.

alter table public.repair_orders
  add column updated_at timestamptz not null default now();

-- A current default exists today, but the legacy order below predates it. The
-- closed historical version is the only admissible estimate for that order.
insert into public.store_fault_cost_defaults (
  store_id, catalog_key, catalog_name, default_cost_amount, revision, updated_by
) values (
  '00000000-0000-4000-8000-000000008000',
  'phone:legacy', 'Legacy Screen', 99, 1,
  '00000000-0000-4000-8000-000000008001'
);

insert into public.store_fault_cost_default_versions (
  store_id, catalog_key, catalog_name, default_cost_amount, currency_code,
  revision, change_kind, effective_from, effective_to, actor_id
) values (
  '00000000-0000-4000-8000-000000008000',
  'phone:legacy', 'Legacy Screen', 15, 'EUR', 1, 'set',
  '2025-01-01 00:00:00+00', '2026-02-01 00:00:00+00',
  '00000000-0000-4000-8000-000000008001'
);

-- These rows intentionally predate stable line IDs and cost projections.
insert into public.repair_orders (
  id, store_id, public_no, status, payment_status, fault_prices,
  created_at, updated_at, quotation_amount
) values
  (
    '00000000-0000-4000-8000-000000008150',
    '00000000-0000-4000-8000-000000008000', 'R-LEGACY-A', 'delivered', 'paid',
    '[{"catalog_key":"phone:legacy","name":"Legacy Screen","price":80,"currency_code":"EUR"}]',
    '2026-01-10 10:00:00+00', '2026-01-10 10:00:00+00', 80
  ),
  (
    '00000000-0000-4000-8000-000000008151',
    '00000000-0000-4000-8000-000000008000', 'R-LEGACY-B', 'delivered', 'paid',
    '[{"line_id":"00000000-0000-4000-8000-000000008251","catalog_key":"phone:unknown","name":"Unknown Repair","price":45,"currency_code":"EUR"}]',
    '2026-01-11 10:00:00+00', '2026-01-11 10:00:00+00', 45
  ),
  (
    '00000000-0000-4000-8000-000000008152',
    '00000000-0000-4000-8000-000000008000', 'R-LEGACY-C', 'delivered', 'paid',
    '[{"line_id":"00000000-0000-4000-8000-000000008252","catalog_key":"phone:conflict","name":"Conflict Repair","price":55,"currency_code":"EUR"}]',
    '2026-01-12 10:00:00+00', '2026-01-12 10:00:00+00', 55
  );

-- Stage 04B replaces this function while preserving the trigger. Legacy rows
-- were inserted before the trigger so the fixture stays genuinely unnormalized.
create or replace function public.repairdesk_normalize_order_fault_prices()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  return new;
end;
$$;

create trigger repairdesk_normalize_order_fault_prices_trigger
before insert or update of fault_prices on public.repair_orders
for each row execute function public.repairdesk_normalize_order_fault_prices();

-- Production-equivalent current-default synchronization. Its conflict update
-- deliberately preserves an existing sentinel's amount/source/evidence.
create or replace function public.repairdesk_sync_order_line_costs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_line_id uuid;
  v_catalog_key text;
  v_default_amount numeric(12, 2);
  v_current_version bigint := 0;
  v_next_version bigint;
  v_now timestamptz := clock_timestamp();
begin
  if tg_op = 'UPDATE' and new.fault_prices is not distinct from old.fault_prices then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.store_id::text || ':order-costs', 0)
  );
  select coalesce(max(cost_row.revision), 0)
  into v_current_version
  from public.repair_order_line_costs as cost_row
  where cost_row.store_id = new.store_id and cost_row.order_id = new.id;
  v_next_version := v_current_version + 1;

  update public.repair_order_line_costs
  set is_active = false, revision = v_next_version, updated_at = v_now
  where store_id = new.store_id and order_id = new.id;

  for v_item in select value from jsonb_array_elements(new.fault_prices)
  loop
    v_line_id := (v_item ->> 'line_id')::uuid;
    v_catalog_key := nullif(v_item ->> 'catalog_key', '');
    v_default_amount := null;
    if v_catalog_key is not null then
      select default_row.default_cost_amount
      into v_default_amount
      from public.store_fault_cost_defaults as default_row
      where default_row.store_id = new.store_id
        and default_row.catalog_key = v_catalog_key;
    end if;

    insert into public.repair_order_line_costs (
      store_id, order_id, line_id, catalog_key, cost_amount, currency_code,
      source, is_active, revision, created_at, updated_at
    ) values (
      new.store_id, new.id, v_line_id, v_catalog_key, v_default_amount, 'EUR',
      'store_default', true, v_next_version, v_now, v_now
    )
    on conflict (store_id, order_id, line_id) do update
    set catalog_key = excluded.catalog_key, is_active = true,
        revision = excluded.revision, updated_at = excluded.updated_at;
  end loop;
  return new;
end;
$$;

create trigger repairdesk_sync_order_line_costs_trigger
after insert or update of fault_prices on public.repair_orders
for each row execute function public.repairdesk_sync_order_line_costs();

insert into public.store_member_permission_grants (
  store_id, membership_id, user_id, action, granted_by
) values (
  '00000000-0000-4000-8000-000000008000',
  '00000000-0000-4000-8000-000000008012',
  '00000000-0000-4000-8000-000000008002',
  'finance:cost_backfill_preview',
  '00000000-0000-4000-8000-000000008001'
);
