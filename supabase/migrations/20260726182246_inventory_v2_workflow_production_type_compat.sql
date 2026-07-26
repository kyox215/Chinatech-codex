-- Production migration history version: 20260726182246.
set lock_timeout = '5s';

-- Production inventory columns are constrained text. Earlier development
-- snapshots exposed enum names used by the workflow casts, so provide
-- service-role-only compatibility domains without rewriting any stored row.
do $$
begin
  if pg_catalog.to_regtype('public.inventory_check_status') is null then
    create domain public.inventory_check_status as text;
  end if;
  if pg_catalog.to_regtype('public.inventory_cosmetic_grade') is null then
    create domain public.inventory_cosmetic_grade as text;
  end if;
  if pg_catalog.to_regtype('public.inventory_functional_grade') is null then
    create domain public.inventory_functional_grade as text;
  end if;
  if pg_catalog.to_regtype('public.inventory_item_status') is null then
    create domain public.inventory_item_status as text;
  end if;
end;
$$;

revoke all on domain public.inventory_check_status
  from public, anon, authenticated, service_role;
revoke all on domain public.inventory_cosmetic_grade
  from public, anon, authenticated, service_role;
revoke all on domain public.inventory_functional_grade
  from public, anon, authenticated, service_role;
revoke all on domain public.inventory_item_status
  from public, anon, authenticated, service_role;

grant usage on domain public.inventory_check_status to service_role;
grant usage on domain public.inventory_cosmetic_grade to service_role;
grant usage on domain public.inventory_functional_grade to service_role;
grant usage on domain public.inventory_item_status to service_role;

comment on domain public.inventory_check_status is
  'Service-role compatibility alias for constrained text inventory check values.';
comment on domain public.inventory_cosmetic_grade is
  'Service-role compatibility alias for constrained text inventory cosmetic grades.';
comment on domain public.inventory_functional_grade is
  'Service-role compatibility alias for constrained text inventory functional grades.';
comment on domain public.inventory_item_status is
  'Service-role compatibility alias for constrained text inventory workflow states.';
