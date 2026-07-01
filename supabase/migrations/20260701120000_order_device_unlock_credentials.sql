alter table public.repair_orders
  add column if not exists device_unlock_method text,
  add column if not exists device_unlock_value text,
  add column if not exists device_unlock_pattern integer[];

create or replace function public.repairdesk_valid_unlock_pattern(pattern integer[])
returns boolean
language sql
immutable
as $$
  select
    pattern is not null
    and cardinality(pattern) between 4 and 9
    and (
      select coalesce(bool_and(point between 1 and 9), false)
      from unnest(pattern) as point
    )
    and (
      select count(distinct point) = cardinality(pattern)
      from unnest(pattern) as point
    );
$$;

do $$
begin
  alter table public.repair_orders
    add constraint repair_orders_device_unlock_method_check
    check (
      device_unlock_method is null
      or device_unlock_method in ('text', 'pin', 'pattern')
    );
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.repair_orders
    add constraint repair_orders_device_unlock_shape_check
    check (
      (
        device_unlock_method is null
        and device_unlock_value is null
        and device_unlock_pattern is null
      )
      or (
        device_unlock_method = 'text'
        and device_unlock_value is not null
        and char_length(device_unlock_value) between 1 and 80
        and device_unlock_pattern is null
      )
      or (
        device_unlock_method = 'pin'
        and device_unlock_value is not null
        and device_unlock_value ~ '^[0-9]{1,16}$'
        and device_unlock_pattern is null
      )
      or (
        device_unlock_method = 'pattern'
        and device_unlock_value is null
        and public.repairdesk_valid_unlock_pattern(device_unlock_pattern)
      )
    );
exception when duplicate_object then null;
end $$;
