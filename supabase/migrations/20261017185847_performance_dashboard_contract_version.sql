-- Reader contract only. D17 functions, table facts, policies and indexes stay unchanged.
-- The SQL fallback literal now uses an identical value parameter for i18n tooling.
begin;
lock table chinatech_v2.stores in share row exclusive mode;
alter table chinatech_v2_private.dashboard_models alter column rules_hash set default '9c989499d1d3a9643433cf3100155540daf5d25568a3a42e0a44f54899dedfa9';
update chinatech_v2_private.dashboard_models set rules_hash='9c989499d1d3a9643433cf3100155540daf5d25568a3a42e0a44f54899dedfa9',ready=false,generation=generation+1,verified_at=null,backfill_cursor=null;
commit;
