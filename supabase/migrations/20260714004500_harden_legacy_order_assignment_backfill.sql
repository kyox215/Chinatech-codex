-- Remove only assignments created by the unsafe legacy display-name/owner backfill.
-- The original migration and its row updates share one transaction ID. Any later
-- application assignment has a different xmin and makes this migration fail closed.

do $$
declare
  v_backfill_xmin xid;
  v_backfilled_count bigint := 0;
  v_later_assignment_count bigint := 0;
  v_cleared_count bigint := 0;
begin
  select migration_row.xmin
  into strict v_backfill_xmin
  from supabase_migrations.schema_migrations migration_row
  where migration_row.version = '20260712003452';

  select
    count(*) filter (
      where repair_order.assignee_membership_id is not null
        and repair_order.xmin = v_backfill_xmin
    ),
    count(*) filter (
      where repair_order.assignee_membership_id is not null
        and repair_order.xmin <> v_backfill_xmin
    )
  into v_backfilled_count, v_later_assignment_count
  from public.repair_orders repair_order;

  if v_later_assignment_count > 0 then
    raise exception using
      message = format(
        'legacy assignment cleanup blocked: %s assignment rows changed after migration',
        v_later_assignment_count
      );
  end if;

  update public.repair_orders repair_order
  set assignee_membership_id = null
  where repair_order.assignee_membership_id is not null
    and repair_order.xmin = v_backfill_xmin;

  get diagnostics v_cleared_count = row_count;

  if v_cleared_count <> v_backfilled_count then
    raise exception using
      message = format(
        'legacy assignment cleanup mismatch: expected %s rows, cleared %s rows',
        v_backfilled_count,
        v_cleared_count
      );
  end if;
end;
$$;

comment on column public.repair_orders.assignee_membership_id is
  'Stable same-store membership assignment. Legacy orders remain unassigned until an authorized owner or manager selects a member.';

notify pgrst, 'reload schema';
