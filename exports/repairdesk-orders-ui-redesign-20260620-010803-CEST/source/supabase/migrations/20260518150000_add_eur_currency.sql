alter table public.repair_orders
  add column if not exists currency_code text not null default 'EUR';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'repair_orders_currency_code_eur'
      and conrelid = 'public.repair_orders'::regclass
  ) then
    alter table public.repair_orders
      add constraint repair_orders_currency_code_eur
      check (currency_code = 'EUR');
  end if;
end $$;

update public.repair_orders
set currency_code = 'EUR'
where currency_code is distinct from 'EUR';

update public.repair_orders
set fault_prices = coalesce(
  (
    select jsonb_agg(
      case
        when jsonb_typeof(item) = 'object'
          then item || '{"currency_code":"EUR"}'::jsonb
        else item
      end
    )
    from jsonb_array_elements(fault_prices) as item
  ),
  '[]'::jsonb
)
where jsonb_typeof(fault_prices) = 'array'
  and fault_prices <> '[]'::jsonb;

update public.order_events
set payload = payload || '{"currency_code":"EUR"}'::jsonb
where jsonb_typeof(payload) = 'object'
  and not (payload ? 'currency_code')
  and (
    payload ? 'amount'
    or payload ? 'quotation_amount'
    or payload ? 'deposit_amount'
    or payload ? 'balance_amount'
    or payload ? 'balance'
  );
