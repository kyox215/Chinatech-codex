-- Drain dashboard readers/writers and set BACKEND_DASHBOARD_READS=0 first.
-- Retain all canonical facts, projection rows, ACLs, functions and model versions.
begin;
alter table chinatech_v2.stores disable trigger dashboard_store_init;
alter table chinatech_v2_private.repair_intakes disable trigger dashboard_repair_sync;
alter table chinatech_v2_private.procurement_records disable trigger dashboard_procurement_sync;
alter table chinatech_v2_private.retail_units disable trigger dashboard_retail_sync;
-- All producer locks precede invalidation, including the new-store producer.
update chinatech_v2_private.dashboard_models set ready=false,generation=generation+1,verified_at=null,backfill_cursor=null;
commit;
