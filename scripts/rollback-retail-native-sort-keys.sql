-- Retain derived bytes for diagnosis. Read flag must be off during rollback.
begin;
lock table chinatech_v2.stores,chinatech_v2_private.retail_units,chinatech_v2_private.retail_history_records,chinatech_v2_private.retail_list_sources in share row exclusive mode;
alter table chinatech_v2_private.retail_list_sources disable trigger retail_sort_source;
alter table chinatech_v2_private.retail_list_sources disable trigger retail_sort_dirty;
update chinatech_v2_private.retail_list_models set ready=false,sort_resume_ready=false,sort_resume_xid=null,verified_at=null,backfill_cursor=null,generation=generation+1;
commit;
