-- Drain writers, re-enable only these four producers, then truly rebuild/verify.
-- This script never changes the application flag or marks a model ready.
begin;
alter table chinatech_v2.stores enable trigger dashboard_store_init;
alter table chinatech_v2_private.repair_intakes enable trigger dashboard_repair_sync;
alter table chinatech_v2_private.procurement_records enable trigger dashboard_procurement_sync;
alter table chinatech_v2_private.retail_units enable trigger dashboard_retail_sync;
update chinatech_v2_private.dashboard_models set ready=false,generation=generation+1,verified_at=null,backfill_cursor=null;
commit;
