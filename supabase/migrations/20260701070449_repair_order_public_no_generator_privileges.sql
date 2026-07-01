revoke execute on function public.generate_repair_order_public_no() from public;
revoke execute on function public.generate_repair_order_public_no() from anon, authenticated;
grant execute on function public.generate_repair_order_public_no() to service_role;

revoke all on sequence public.repair_order_public_no_seq from public;
revoke all on sequence public.repair_order_public_no_seq from anon, authenticated;
grant usage, select on sequence public.repair_order_public_no_seq to service_role;
