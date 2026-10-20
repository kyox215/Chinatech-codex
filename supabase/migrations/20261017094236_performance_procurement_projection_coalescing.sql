begin;

-- Canonical ledgers and their per-row procurement summaries finish before these
-- statement triggers run. Recompute each affected repair once per transition
-- event set, with the same owner-only projector and in the same transaction.
-- Mixed INSERT ... ON CONFLICT DO UPDATE can expose two event sets; it is still
-- bounded by two repair projections per target, never one per ledger row.
create function chinatech_v2_private.repair_list_procurement_statement_sync() returns trigger
language plpgsql security definer set search_path='' as $$
declare target record;
begin
 if tg_op='INSERT' then
  for target in select distinct n.store_id,n.repair_id collate "C" repair_id from perf_procurement_new n order by 1,2 loop
   perform chinatech_v2_private.project_repair_list(target.store_id,target.repair_id);
  end loop;
 elsif tg_op='DELETE' then
  for target in select distinct o.store_id,o.repair_id collate "C" repair_id from perf_procurement_old o order by 1,2 loop
   perform chinatech_v2_private.project_repair_list(target.store_id,target.repair_id);
  end loop;
 elsif tg_op='UPDATE' then
  for target in
   select distinct changed.store_id,changed.repair_id collate "C" repair_id
   from(select o.store_id,o.repair_id from perf_procurement_old o union all select n.store_id,n.repair_id from perf_procurement_new n)changed
   order by 1,2
  loop
   perform chinatech_v2_private.project_repair_list(target.store_id,target.repair_id);
  end loop;
 end if;
 return null;
end $$;
revoke all on function chinatech_v2_private.repair_list_procurement_statement_sync() from public,anon,authenticated,chinatech_runtime;

drop trigger zz_repair_list_procurement_sync on chinatech_v2_private.procurement_records;
create trigger zz_repair_list_procurement_insert_sync after insert on chinatech_v2_private.procurement_records
 referencing new table as perf_procurement_new for each statement execute function chinatech_v2_private.repair_list_procurement_statement_sync();
create trigger zz_repair_list_procurement_update_sync after update on chinatech_v2_private.procurement_records
 referencing old table as perf_procurement_old new table as perf_procurement_new for each statement execute function chinatech_v2_private.repair_list_procurement_statement_sync();
create trigger zz_repair_list_procurement_delete_sync after delete on chinatech_v2_private.procurement_records
 referencing old table as perf_procurement_old for each statement execute function chinatech_v2_private.repair_list_procurement_statement_sync();

-- No canonical values, RLS, grants, read format, projector definition or ready
-- state changes. Every nonempty mutation still advances repair generation.
commit;
