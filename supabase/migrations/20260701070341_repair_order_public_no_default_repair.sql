create sequence if not exists public.repair_order_public_no_seq start with 2027000;

do $$
declare
  max_public_no bigint;
begin
  select coalesce(max(substring(public_no from '^R([0-9]+)$')::bigint), 2026999)
    into max_public_no
  from public.repair_orders
  where public_no ~ '^R[0-9]+$';

  perform setval(
    'public.repair_order_public_no_seq',
    greatest(max_public_no, 2026999),
    true
  );
end $$;

create or replace function public.generate_repair_order_public_no()
returns text
language sql
security definer
set search_path = public
as $$
  select 'R' || lpad(nextval('public.repair_order_public_no_seq')::text, 7, '0');
$$;

alter table public.repair_orders
  alter column public_no set default public.generate_repair_order_public_no();

revoke all on sequence public.repair_order_public_no_seq from anon, authenticated;
grant usage, select on sequence public.repair_order_public_no_seq to service_role;

revoke execute on function public.generate_repair_order_public_no() from anon, authenticated;
grant execute on function public.generate_repair_order_public_no() to service_role;
