create or replace function public.repairdesk_valid_unlock_pattern(pattern integer[])
returns boolean
language sql
immutable
as $$
  select
    pattern is not null
    and cardinality(pattern) between 4 and 128
    and (
      select coalesce(bool_and(point is not null and point between 1 and 9), false)
      from unnest(pattern) as point
    );
$$;

comment on function public.repairdesk_valid_unlock_pattern(integer[]) is
  'Validates order device unlock pattern trajectories: 4-128 ordered steps, each step a 1-9 Android pattern point. Repeated points are allowed after leaving and re-entering a point.';
