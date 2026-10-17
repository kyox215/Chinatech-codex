-- Reviewed operator only; first turn BACKEND_CUSTOMER_DEVICE_READS off and
-- drain the candidate application. This is not a production execution request.
-- Keep canonical data and projection rows; disabled models must be rebuilt and
-- fully verified before the reader may be enabled again.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
do $$declare target uuid;begin
 for target in select id from chinatech_v2.stores order by id loop
  perform pg_advisory_xact_lock(hashtextextended('ct:'||target::text,0));
 end loop;
end $$;
alter table chinatech_v2_private.repair_intakes disable trigger customer_device_repair;
alter table chinatech_v2_private.retail_units disable trigger customer_device_sale;
alter table chinatech_v2.stores disable trigger customer_device_store_init;
update chinatech_v2_private.customer_device_models set ready=false,verified_at=null,backfill_cursor=null,generation=generation+1;
commit;
