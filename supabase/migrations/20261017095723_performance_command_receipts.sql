begin;
-- Existing immutable receipt rows remain valid: NULL means the original server
-- did not retain frozen result versions. Never backfill them from current data.
alter table chinatech_v2_private.command_receipts
 add column result jsonb,
 add column effects jsonb,
 add constraint command_receipts_result_check check(result is null or(jsonb_typeof(result)='object' and result @> '{"formatVersion":2}'::jsonb and octet_length(result::text)<=10000)),
 add constraint command_receipts_effects_check check(effects is null or(jsonb_typeof(effects)='array' and jsonb_array_length(effects)<=500 and octet_length(effects::text)<=250000));
-- Existing table FORCE RLS and INSERT/SELECT-only runtime privileges apply to the
-- two new columns. No UPDATE is granted: frozen results cannot be replaced.
-- Narrow canonical relation lookup preserves the original after-sale duplicate
-- relation check without loading unrelated work orders.
create index repair_intakes_retail_case_lookup on chinatech_v2_private.repair_intakes
 (store_id,(data->'retailOrigin'->>'unitId'),(data->'retailOrigin'->>'saleId'),(data->'retailOrigin'->>'caseId'))
 where data ? 'retailOrigin';
commit;
