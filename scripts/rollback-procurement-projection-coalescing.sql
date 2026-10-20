-- Explicit owner-only operational rollback; never invoked by the application.
-- Reinstates the old per-row projection cost without deleting canonical facts,
-- signatures, summaries or model versions. Review and authorize the target
-- separately before any formal execution; this file is not a production action.
begin;
drop trigger zz_repair_list_procurement_insert_sync on chinatech_v2_private.procurement_records;
drop trigger zz_repair_list_procurement_update_sync on chinatech_v2_private.procurement_records;
drop trigger zz_repair_list_procurement_delete_sync on chinatech_v2_private.procurement_records;
create trigger zz_repair_list_procurement_sync after insert or update or delete on chinatech_v2_private.procurement_records for each row execute function chinatech_v2_private.repair_list_sync();
drop function chinatech_v2_private.repair_list_procurement_statement_sync();
commit;
