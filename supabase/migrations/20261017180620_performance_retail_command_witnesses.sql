-- Canonical command witnesses, independent of read-model readiness or customer
-- phone validity. Apply after the additive Unicode17 query contract (D16).
-- MD5 is only an index bucket; readers retain full normalized text equality.
-- No canonical rewrite, extra runtime table privilege, or business-rule change.
create function chinatech_v2_private.command_identifier_v1(raw text)returns text
language sql immutable set search_path=''as $$select chinatech_v2_private.query_upper(translate(chinatech_v2_private.query_nfkc(coalesce(raw,'')),U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF',''))$$;
create function chinatech_v2_private.command_imei_v1(raw text)returns text
language sql immutable set search_path=''as $$select translate(coalesce(raw,''),U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF-', '')$$;
-- All unsafe numeric suffixes are equivalent for the original rejection. Keep
-- only a bounded bigint witness; never index the full legal5000-character code.
create function chinatech_v2_private.command_code_sequence_v1(raw text)returns bigint
language plpgsql immutable set search_path=''as $$declare suffix text:=substr(chinatech_v2_private.command_identifier_v1(raw),13);begin
 if suffix collate"C"!~'^[0-9]+$'then return null;end if;
 suffix:=coalesce(nullif(ltrim(suffix,'0'),''),'0');
 if length(suffix)>16 or(length(suffix)=16 and suffix collate"C">'9007199254740990')then return 9007199254740991;end if;
 return suffix::bigint;
end $$;
-- Keep string leaves of id values, including historical id arrays. The GIN
-- candidate must be a conservative superset of JSONB primitive-in-array
-- containment. Every reader retains the original exact containment predicate.
create function chinatech_v2_private.command_sale_ids_v1(sales jsonb)returns jsonb
language sql immutable set search_path=''as $$select case when jsonb_typeof(sales)='array'then jsonb_path_query_array(sales,'lax $.**.id.** ? (@.type() == "string")','{}',true)else'[]'::jsonb end$$;
revoke all on function chinatech_v2_private.command_identifier_v1(text),chinatech_v2_private.command_imei_v1(text),chinatech_v2_private.command_code_sequence_v1(text),chinatech_v2_private.command_sale_ids_v1(jsonb)from public,anon,authenticated,chinatech_runtime;
grant execute on function chinatech_v2_private.command_identifier_v1(text),chinatech_v2_private.command_imei_v1(text),chinatech_v2_private.command_code_sequence_v1(text),chinatech_v2_private.command_sale_ids_v1(jsonb)to chinatech_runtime;
create index retail_command_code_v1 on chinatech_v2_private.retail_units(store_id,pg_catalog.md5(chinatech_v2_private.command_identifier_v1(data->>'code')));
create index retail_command_serial_v1 on chinatech_v2_private.retail_units(store_id,pg_catalog.md5(chinatech_v2_private.command_identifier_v1(data->>'brand')),pg_catalog.md5(chinatech_v2_private.command_identifier_v1(data->>'serial')));
create index retail_command_imei1_v1 on chinatech_v2_private.retail_units(store_id,pg_catalog.md5(chinatech_v2_private.command_imei_v1(data->>'imei1')));
create index retail_command_imei2_v1 on chinatech_v2_private.retail_units(store_id,pg_catalog.md5(chinatech_v2_private.command_imei_v1(data->>'imei2')));
create index retail_command_sequence_v1 on chinatech_v2_private.retail_units(store_id,left(chinatech_v2_private.command_identifier_v1(data->>'code'),12),chinatech_v2_private.command_code_sequence_v1(data->>'code')desc,id)where chinatech_v2_private.command_code_sequence_v1(data->>'code')is not null;
create index retail_command_sale_ids_v1 on chinatech_v2_private.retail_units using gin(chinatech_v2_private.command_sale_ids_v1(data->'sales')jsonb_path_ops);
create index retail_command_history_origin_v1 on chinatech_v2_private.retail_units(store_id,(data->'historyOrigin'->>'recordId'));

-- RLS evaluates non-leakproof expressions after tenant admission, which prevents
-- the canonical expression predicates from becoming index conditions. These
-- narrow read-only entrances repeat authoritative admission internally, before
-- reading any canonical row. No LEAKPROOF flag or table/RLS privilege change.
create function chinatech_v2_private.command_retail_access_v1(target_store uuid)returns void
language plpgsql stable security definer set search_path=''as $$begin
 if target_store is null or target_store::text is distinct from current_setting('app.store_id',true)
 or not chinatech_v2_private.live_user()or not chinatech_v2_private.member_access(target_store,'retail.view')then raise exception using errcode='42501',message='Retail access denied';end if;
end $$;
revoke all on function chinatech_v2_private.command_retail_access_v1(uuid)from public,anon,authenticated,service_role,chinatech_runtime;

create function chinatech_v2_private.command_retail_code_witness_v1(target_store uuid,prefix text)returns table(id text,code text)
language plpgsql stable security definer set search_path=''as $$begin
 perform chinatech_v2_private.command_retail_access_v1(target_store);
 if prefix is null or prefix collate"C"!~'^CT-[0-9]{8}-$'then raise exception using errcode='22023',message='Invalid retail prefix';end if;
 return query select u.id,u.data->>'code'from chinatech_v2_private.retail_units u where u.store_id=target_store
 and left(chinatech_v2_private.command_identifier_v1(u.data->>'code'),12)=prefix
 and chinatech_v2_private.command_code_sequence_v1(u.data->>'code')is not null
 order by chinatech_v2_private.command_code_sequence_v1(u.data->>'code')desc,u.id limit 1;
end $$;
create function chinatech_v2_private.command_retail_origin_witness_v1(target_store uuid,record_id text)returns table(id text)
language plpgsql stable security definer set search_path=''as $$begin
 perform chinatech_v2_private.command_retail_access_v1(target_store);
 if record_id is null or length(record_id)>100 then raise exception using errcode='22023',message='Invalid retail identity';end if;
 return query select u.id from chinatech_v2_private.retail_units u where u.store_id=target_store and(u.id=record_id or u.data->'historyOrigin'->>'recordId'=record_id)order by u.id limit 1;
end $$;
create function chinatech_v2_private.command_retail_conflict_v1(target_store uuid,target_id text,raw_code text,raw_brand text,raw_serial text,raw_imei1 text,raw_imei2 text)returns table(id text)
language plpgsql stable security definer set search_path=''as $$declare code text;brand text;serial text;imeis text[];has_serial boolean;begin
 perform chinatech_v2_private.command_retail_access_v1(target_store);
 if target_id is null or length(target_id)>100 or greatest(length(raw_code),length(raw_brand),length(raw_serial),length(raw_imei1),length(raw_imei2))>20000 then raise exception using errcode='22023',message='Invalid retail identity';end if;
 code:=chinatech_v2_private.command_identifier_v1(raw_code);brand:=chinatech_v2_private.command_identifier_v1(raw_brand);serial:=chinatech_v2_private.command_identifier_v1(raw_serial);
 has_serial:=chinatech_v2_private.directory_trim(coalesce(raw_serial,''))<>'';
 imeis:=array_remove(array[chinatech_v2_private.command_imei_v1(raw_imei1),chinatech_v2_private.command_imei_v1(raw_imei2)],'');
 return query select candidates.id from(
 select u.id from chinatech_v2_private.retail_units u where code<>''and u.store_id=target_store and u.id<>target_id and pg_catalog.md5(chinatech_v2_private.command_identifier_v1(u.data->>'code'))=pg_catalog.md5(code)and chinatech_v2_private.command_identifier_v1(u.data->>'code')collate"C"=code
 union
 select u.id from chinatech_v2_private.retail_units u where has_serial and u.store_id=target_store and u.id<>target_id and pg_catalog.md5(chinatech_v2_private.command_identifier_v1(u.data->>'brand'))=pg_catalog.md5(brand)and pg_catalog.md5(chinatech_v2_private.command_identifier_v1(u.data->>'serial'))=pg_catalog.md5(serial)and chinatech_v2_private.command_identifier_v1(u.data->>'brand')collate"C"=brand and chinatech_v2_private.command_identifier_v1(u.data->>'serial')collate"C"=serial
 union
 select u.id from chinatech_v2_private.retail_units u where u.store_id=target_store and u.id<>target_id and pg_catalog.md5(chinatech_v2_private.command_imei_v1(u.data->>'imei1'))=any(select pg_catalog.md5(v)from unnest(imeis)v)and chinatech_v2_private.command_imei_v1(u.data->>'imei1')collate"C"=any(imeis)
 union
 select u.id from chinatech_v2_private.retail_units u where u.store_id=target_store and u.id<>target_id and pg_catalog.md5(chinatech_v2_private.command_imei_v1(u.data->>'imei2'))=any(select pg_catalog.md5(v)from unnest(imeis)v)and chinatech_v2_private.command_imei_v1(u.data->>'imei2')collate"C"=any(imeis)
 )candidates order by candidates.id limit 1;
end $$;
create function chinatech_v2_private.command_retail_sale_exists_v1(target_store uuid,sale_id text)returns boolean
language plpgsql stable security definer set search_path=''as $$begin
 perform chinatech_v2_private.command_retail_access_v1(target_store);
 if sale_id is null or length(sale_id)>200 then raise exception using errcode='22023',message='Invalid retail sale identity';end if;
 return exists(select 1 from chinatech_v2_private.retail_units u where u.store_id=target_store
 and chinatech_v2_private.command_sale_ids_v1(u.data->'sales') @> jsonb_build_array(sale_id)
 and u.data->'sales' @> jsonb_build_array(jsonb_build_object('id',sale_id)));
end $$;
revoke all on function chinatech_v2_private.command_retail_code_witness_v1(uuid,text),chinatech_v2_private.command_retail_origin_witness_v1(uuid,text),chinatech_v2_private.command_retail_conflict_v1(uuid,text,text,text,text,text,text),chinatech_v2_private.command_retail_sale_exists_v1(uuid,text)from public,anon,authenticated,service_role,chinatech_runtime;
grant execute on function chinatech_v2_private.command_retail_code_witness_v1(uuid,text),chinatech_v2_private.command_retail_origin_witness_v1(uuid,text),chinatech_v2_private.command_retail_conflict_v1(uuid,text,text,text,text,text,text),chinatech_v2_private.command_retail_sale_exists_v1(uuid,text)to chinatech_runtime;
