-- New-intake history has different semantics from the scanner: remove every
-- ECMAScript whitespace character after uppercase, without NFKC normalization.
create function chinatech_v2_private.intake_serial_key(raw text) returns text
language sql immutable set search_path='' as $$
 select translate(upper(chinatech_v2_private.directory_trim(raw)),U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF','')
$$;
revoke all on function chinatech_v2_private.intake_serial_key(text) from public,anon,authenticated;
grant execute on function chinatech_v2_private.intake_serial_key(text) to chinatech_runtime;
create index intake_history_serial_idx on chinatech_v2_private.repair_intakes
 (store_id,chinatech_v2_private.intake_serial_key(data->>'serial'),lower(data->>'brand'),((data->>'createdAt') collate "C") desc,id);
create index intake_history_model_idx on chinatech_v2_private.repair_intakes
 (store_id,lower(data->>'brand'),lower(data->>'model'),((data->>'createdAt') collate "C") desc,id);
