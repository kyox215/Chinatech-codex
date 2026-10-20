-- Reader flag stays off. Re-enable owner projection, then run the bounded
-- backfill and independent canonical verifier for each target store.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
do $$declare target uuid;begin
 for target in select id from chinatech_v2.stores order by id loop
  perform pg_advisory_xact_lock(hashtextextended('ct:'||target::text,0));
 end loop;
end $$;
alter table chinatech_v2_private.repair_intakes enable trigger customer_device_repair;
alter table chinatech_v2_private.retail_units enable trigger customer_device_sale;
alter table chinatech_v2.stores enable trigger customer_device_store_init;
update chinatech_v2_private.customer_device_models set ready=false,verified_at=null,backfill_cursor=null,generation=generation+1;
commit;
