-- Extends the minimal Phase 1 fixture with only the columns needed by the
-- Phase 2 profit migration. Apply after the ledger migration and before the
-- profit migration.

alter table public.stores
  add column timezone text not null default 'Europe/Rome';

alter table public.repair_orders
  add column public_no text,
  add column status text not null default 'received',
  add column exception_status text,
  add column payment_status text not null default 'unpaid',
  add column original_order_id uuid,
  add column created_at timestamptz not null default now(),
  add column completed_at timestamptz,
  add column delivered_at timestamptz,
  add column quotation_amount numeric(12, 2) not null default 0;

create unique index repair_orders_profit_fixture_public_no_idx
  on public.repair_orders (public_no);

create table public.order_payment_ledger (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  order_id uuid not null,
  entry_type text not null default 'collection',
  amount numeric(12, 2) not null,
  currency_code text not null,
  created_at timestamptz not null,
  foreign key (order_id, store_id) references public.repair_orders(id, store_id)
);

insert into public.store_member_permission_grants (
  store_id, membership_id, user_id, action, granted_by
) values (
  '00000000-0000-4000-8000-000000008000',
  '00000000-0000-4000-8000-000000008012',
  '00000000-0000-4000-8000-000000008002',
  'finance:profit_read',
  '00000000-0000-4000-8000-000000008001'
);

update public.repair_orders
set public_no = 'R-PROFIT-A',
    status = 'delivered',
    payment_status = 'partial',
    created_at = '2026-07-18 08:00:00+00',
    completed_at = '2026-07-18 09:00:00+00',
    delivered_at = '2026-07-18 10:00:00+00',
    quotation_amount = 100
where id = '00000000-0000-4000-8000-000000008101';

insert into public.repair_orders (
  id, store_id, public_no, status, exception_status, payment_status,
  original_order_id, fault_prices, created_at, completed_at, delivered_at,
  quotation_amount
) values
  (
    '00000000-0000-4000-8000-000000008102',
    '00000000-0000-4000-8000-000000008000', 'R-PROFIT-B', 'diagnosing', null, 'unpaid', null,
    '[{"line_id":"00000000-0000-4000-8000-000000008202","name":"Battery","price":60},{"line_id":"00000000-0000-4000-8000-000000008203","name":"Port","price":40}]',
    '2026-07-18 11:00:00+00', null, null, 100
  ),
  (
    '00000000-0000-4000-8000-000000008103',
    '00000000-0000-4000-8000-000000008000', 'R-PROFIT-C', 'delivered', null, 'paid', null,
    '[{"line_id":"00000000-0000-4000-8000-000000008204","name":"Software","price":40}]',
    '2026-07-18 12:00:00+00', '2026-07-18 13:00:00+00', '2026-07-18 14:00:00+00', 40
  ),
  (
    '00000000-0000-4000-8000-000000008104',
    '00000000-0000-4000-8000-000000008000', 'R-PROFIT-D', 'delivered', null, 'refunded', null,
    '[{"line_id":"00000000-0000-4000-8000-000000008205","name":"Refunded","price":50}]',
    '2026-07-18 15:00:00+00', '2026-07-18 15:30:00+00', '2026-07-18 16:00:00+00', 50
  ),
  (
    '00000000-0000-4000-8000-000000008105',
    '00000000-0000-4000-8000-000000008000', 'R-PROFIT-E', 'cancelled', 'cancelled', 'unpaid', null,
    '[{"line_id":"00000000-0000-4000-8000-000000008206","name":"Cancelled","price":70}]',
    '2026-07-18 17:00:00+00', null, null, 70
  ),
  (
    '00000000-0000-4000-8000-000000008106',
    '00000000-0000-4000-8000-000000008000', 'R-PROFIT-F', 'delivered', 'rework', 'unpaid',
    '00000000-0000-4000-8000-000000008101',
    '[{"line_id":"00000000-0000-4000-8000-000000008207","name":"Rework","price":30}]',
    '2026-07-17 22:30:00+00', '2026-07-18 18:00:00+00', '2026-07-18 19:00:00+00', 30
  ),
  (
    '00000000-0000-4000-8000-000000008107',
    '00000000-0000-4000-8000-000000008000', 'R-PROFIT-G', 'received', null, 'unpaid', null,
    '[{"line_id":"00000000-0000-4000-8000-000000008208","name":"Next day","price":90}]',
    '2026-07-18 22:30:00+00', null, null, 90
  );

insert into public.repair_order_line_costs (
  store_id, order_id, line_id, cost_amount, source, is_active, revision,
  created_by, updated_by
) values
  ('00000000-0000-4000-8000-000000008000', '00000000-0000-4000-8000-000000008102', '00000000-0000-4000-8000-000000008202', 20, 'manual', true, 1, '00000000-0000-4000-8000-000000008001', '00000000-0000-4000-8000-000000008001'),
  ('00000000-0000-4000-8000-000000008000', '00000000-0000-4000-8000-000000008102', '00000000-0000-4000-8000-000000008203', null, 'manual_blank', true, 1, '00000000-0000-4000-8000-000000008001', '00000000-0000-4000-8000-000000008001'),
  ('00000000-0000-4000-8000-000000008000', '00000000-0000-4000-8000-000000008103', '00000000-0000-4000-8000-000000008204', 0, 'manual', true, 1, '00000000-0000-4000-8000-000000008001', '00000000-0000-4000-8000-000000008001'),
  ('00000000-0000-4000-8000-000000008000', '00000000-0000-4000-8000-000000008104', '00000000-0000-4000-8000-000000008205', 10, 'manual', true, 1, '00000000-0000-4000-8000-000000008001', '00000000-0000-4000-8000-000000008001'),
  ('00000000-0000-4000-8000-000000008000', '00000000-0000-4000-8000-000000008105', '00000000-0000-4000-8000-000000008206', 20, 'manual', true, 1, '00000000-0000-4000-8000-000000008001', '00000000-0000-4000-8000-000000008001'),
  ('00000000-0000-4000-8000-000000008000', '00000000-0000-4000-8000-000000008106', '00000000-0000-4000-8000-000000008207', 40, 'manual', true, 1, '00000000-0000-4000-8000-000000008001', '00000000-0000-4000-8000-000000008001'),
  ('00000000-0000-4000-8000-000000008000', '00000000-0000-4000-8000-000000008107', '00000000-0000-4000-8000-000000008208', 30, 'manual', true, 1, '00000000-0000-4000-8000-000000008001', '00000000-0000-4000-8000-000000008001');

insert into public.order_payment_ledger (
  store_id, order_id, entry_type, amount, currency_code, created_at
) values
  ('00000000-0000-4000-8000-000000008000', '00000000-0000-4000-8000-000000008101', 'collection', 60, 'EUR', '2026-07-18 10:30:00+00'),
  ('00000000-0000-4000-8000-000000008000', '00000000-0000-4000-8000-000000008104', 'collection', 50, 'EUR', '2026-07-18 16:30:00+00'),
  ('00000000-0000-4000-8000-000000008000', '00000000-0000-4000-8000-000000008102', 'collection', 20, 'USD', '2026-07-18 11:30:00+00');
