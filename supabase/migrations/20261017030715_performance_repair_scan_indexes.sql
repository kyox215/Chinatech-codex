-- Exact scanner semantics: JavaScript trim's existing SQL equivalent and ICU
-- uppercase, without NFKC or substring matching. No privileges/policies change.
create index repair_scan_id_idx on chinatech_v2_private.repair_intakes (store_id, upper(id));
create index repair_scan_serial_idx on chinatech_v2_private.repair_intakes (store_id, upper(chinatech_v2_private.directory_trim(data->>'serial')));
