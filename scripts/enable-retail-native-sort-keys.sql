-- Exact producer contract before a bounded, canonical verified operator rebuild.
begin;
lock table chinatech_v2.stores,chinatech_v2_private.retail_units,chinatech_v2_private.retail_history_records,chinatech_v2_private.retail_list_sources in share row exclusive mode;
alter table chinatech_v2_private.retail_list_sources enable trigger retail_sort_source;
alter table chinatech_v2_private.retail_list_sources enable trigger retail_sort_dirty;
update chinatech_v2_private.retail_list_models set ready=false,sort_resume_ready=false,sort_resume_xid=null,sort_rules_hash='7cc5f8a20676644266f5f9f3e896e954cae151a167e331c051bc6d016540ea80',verified_at=null,backfill_cursor=null,generation=generation+1;
commit;
