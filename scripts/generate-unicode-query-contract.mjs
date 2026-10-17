import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {sourceLoader} from '../tests/helpers/typescript-source.mjs';

assert(process.argv.slice(2).every(value=>value==='--check'),'Only --check is supported');
const sha=value=>createHash('sha256').update(value).digest('hex');
const sources={
 directory:['20261017000734_performance_customer_read_model.sql','e1040966e96537653630dd8c7d9b31856c84538af5ef8dce196a18e3ee5afd7e'],
 procurement:['20261017010109_performance_procurement_read_model.sql','b4f99cf0cb0621901073c23e34ff0eb1ba5990dfa6da6964a02478ae8525ad5e'],
 repair:['20261017015301_performance_repair_read_model.sql','64cba15819a329a1a3b5c40035b249c1bee36f10c0574954e4516f029a073d35'],
 retail:['20261017050521_performance_retail_read_model.sql','de5c86959568c2fcc6f29dd18a6443b8efb1041c4f6945f2eb7d78be0ea4b839'],
 record:['20261017133040_performance_customer_record_execution.sql','c62360166a418d282b3bdfcd20bd5f3c84e7c2f00984ebcee90ecff1d590daa3'],
};
for(const entry of Object.values(sources)){const value=readFileSync('supabase/migrations/'+entry[0],'utf8');assert.equal(sha(value),entry[1],'Immutable producer migration '+entry[0]);entry.push(value);}
const source=(kind)=>sources[kind][2];
function extract(kind,name){const value=source(kind),pattern=new RegExp('create (?:or replace )?function chinatech_v2_private\\.'+name+'\\('),match=pattern.exec(value);assert(match,name);const end=value.indexOf('\nrevoke all on function ',match.index);assert(end>match.index,name);return value.slice(match.index,end).replace(/^create (?:or replace )?function /,'create or replace function ');}
function once(value,from,to){assert.equal(value.split(from).length,2,from);return value.replace(from,to);}
const q=value=>"'"+String(value).replaceAll("'","''")+"'";
const load=sourceLoader(),messages={...JSON.parse(readFileSync('lib/i18n/structured.json')),...load('./lib/i18n/errors').errorMessages,...load('./lib/i18n/interface').interfaceMessages,...load('./lib/i18n/public').publicMessages};
const vocabularyHash=sha(Buffer.concat([Buffer.from(JSON.stringify(messages)),readFileSync('lib/i18n/translate.ts')]));
const {unicode17DataHash:unicodeDataHash,unicode17ImplementationHash}=load('./lib/backend/unicode17-version');
const vocabularyRows=Object.entries(messages).map(([key,values],index)=>{
 const names=[],pieces=key.split(/\{(\w+)\}/g),pattern=key.includes('{')?'^'+pieces.map((piece,i)=>{if(i%2){names.push(piece);return'(.+?)';}return piece.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}).join('')+'$':null;
 return`(${q(key)},array[${values.map(q).join(',')}],${index},${pattern?q(pattern):'null'},array[${names.map(q).join(',')}]::text[])`;
});
const models=['customer_directory','procurement_list','repair_list','retail_list','retail_form','customer_record','customer_device'];
const wrapper=['nfkc','lower','upper'].map(kind=>`create function chinatech_v2_private.query_${kind}(value text)returns text
language sql immutable strict security definer set search_path=''as $$select chinatech_v2_private.unicode17_${kind}(value)$$;
alter function chinatech_v2_private.query_${kind}(text)owner to chinatech_unicode_reader;
revoke all on function chinatech_v2_private.query_${kind}(text)from public,anon,authenticated,chinatech_runtime;
grant execute on function chinatech_v2_private.query_${kind}(text)to chinatech_runtime;`).join('\n\n');
let phone=extract('directory','directory_phone');
phone=once(phone,'directory_phone(raw text)','directory_phone_v2(raw text)');
phone=once(phone,"normalize(coalesce(raw,''),NFKC)","chinatech_v2_private.query_nfkc(coalesce(raw,''))");
let directory=extract('directory','project_customer_directory').replaceAll('chinatech_v2_private.directory_phone(','chinatech_v2_private.directory_phone_v2(');
assert(!directory.includes('chinatech_v2_private.directory_phone('));
let prepared=extract('record','customer_record_fact_prepared').replaceAll('chinatech_v2_private.directory_phone(','chinatech_v2_private.directory_phone_v2(');
assert(!prepared.includes('chinatech_v2_private.directory_phone('));
let procurement=extract('procurement','project_procurement_list');
procurement=once(procurement,'specification,repair_cancelled)','specification,repair_cancelled,search_v2)');
procurement=once(procurement,"document->>'specification',cancelled)","document->>'specification',cancelled,chinatech_v2_private.unicode17_lower(target_id||' '||(document->>'item')||' '||(document->>'supplier')||' '||(document->>'repairId')||' '||coalesce(model,'')))");
procurement=once(procurement,'repair_cancelled=excluded.repair_cancelled;','repair_cancelled=excluded.repair_cancelled,search_v2=excluded.search_v2;');
let repair=extract('repair','project_repair_list');
repair=once(repair,"lower(concat_ws(' ',target_id,summary->>'customerName',document->>'phone',document->>'brand',document->>'model',document->>'serial',document->>'issue'))","chinatech_v2_private.unicode17_lower(concat_ws(' ',target_id,summary->>'customerName',document->>'phone',document->>'brand',document->>'model',document->>'serial',document->>'issue'))");
let retailSearch=extract('retail','retail_list_search');
retailSearch=once(retailSearch,'retail_list_search(input_values','retail_list_search_v2(input_values');
retailSearch=once(retailSearch,"lower(normalize(chinatech_v2_private.directory_trim(array_to_string(input_values,' ','')),NFKC))","chinatech_v2_private.unicode17_lower(chinatech_v2_private.directory_trim(chinatech_v2_private.unicode17_nfkc(array_to_string(input_values,' ',''))))");
retailSearch=once(retailSearch,"lower(normalize(base||' '||array_to_string(extra,' '),NFKC))","chinatech_v2_private.unicode17_lower(chinatech_v2_private.unicode17_nfkc(base||' '||array_to_string(extra,' ')))");
let identifier=extract('retail','retail_identifier_hash');
identifier=once(identifier,'retail_identifier_hash(value','retail_identifier_hash_v2(value');
identifier=once(identifier,"upper(regexp_replace(normalize(coalesce(value,''),NFKC)","chinatech_v2_private.unicode17_upper(regexp_replace(chinatech_v2_private.unicode17_nfkc(coalesce(value,''))");
let retail=extract('retail','project_retail_list');
retail=retail.replaceAll('chinatech_v2_private.retail_list_search(','chinatech_v2_private.retail_list_search_v2(').replaceAll('chinatech_v2_private.retail_identifier_hash(','chinatech_v2_private.retail_identifier_hash_v2(');
retail=once(retail,'lower(normalize(chinatech_v2_private.directory_trim(title),NFKC))','chinatech_v2_private.unicode17_lower(chinatech_v2_private.directory_trim(chinatech_v2_private.unicode17_nfkc(title)))');
const whitespace="U&'\\0009\\000A\\000B\\000C\\000D\\0020\\00A0\\1680\\2000\\2001\\2002\\2003\\2004\\2005\\2006\\2007\\2008\\2009\\200A\\2028\\2029\\202F\\205F\\3000\\FEFF'";
const serial=`create function chinatech_v2_private.intake_serial_key_v2(raw text)returns text language sql immutable set search_path=''as $$
select translate(chinatech_v2_private.query_upper(chinatech_v2_private.directory_trim(raw)),${whitespace},'')$$;
revoke all on function chinatech_v2_private.intake_serial_key_v2(text)from public,anon,authenticated,chinatech_runtime;
grant execute on function chinatech_v2_private.intake_serial_key_v2(text)to chinatech_runtime;`;
const normalizeChanges=[phone,directory,prepared,procurement,repair,retailSearch,identifier,retail];
const queryHash=sha(JSON.stringify({unicodeDataHash,unicode17ImplementationHash,version:1,wrapper,normalizeChanges,serial}));
const revokeSignatures=['directory_phone_v2(text)','project_customer_directory(uuid,text,text,jsonb,boolean)','customer_record_fact_prepared(text,jsonb,integer,jsonb)','project_procurement_list(uuid,text,jsonb,text,boolean)','project_repair_list(uuid,text)','retail_list_search_v2(text[],text[])','retail_identifier_hash_v2(text)','project_retail_list(uuid,text,text,jsonb,jsonb,boolean)'];
assert(normalizeChanges.length===revokeSignatures.length);
const migration=`-- Additive Unicode17 query semantics. All original immutable index functions
-- and their indexes remain unchanged; new predicates use new bounded indexes.
-- Only projection facts/vocabulary/model metadata change. No canonical rewrite.
-- Drain application writers, disable new reads, then use reviewed bounded
-- operators/complete canonical verification before enabling any model or flag.
-- Unicode constants SHA256 ${unicodeDataHash}; query contract ${queryHash}.
-- This entire file must execute atomically, never as partially applied DDL.
lock table chinatech_v2.stores in share row exclusive mode;
create role chinatech_unicode_reader nologin noinherit nosuperuser nobypassrls nocreatedb nocreaterole noreplication;
grant usage on schema chinatech_v2_private to chinatech_unicode_reader;
grant select on chinatech_v2_private.unicode17_scalars,chinatech_v2_private.unicode17_composition to chinatech_unicode_reader;
grant execute on function chinatech_v2_private.unicode17_nfkc(text),chinatech_v2_private.unicode17_lower(text),chinatech_v2_private.unicode17_upper(text)to chinatech_unicode_reader;
${wrapper}

${models.map(model=>`alter table chinatech_v2_private.${model}_models add column query_rules_hash text not null default '${queryHash}'check(query_rules_hash~'^[a-f0-9]{64}$');
update chinatech_v2_private.${model}_models set ready=false,query_rules_hash='${queryHash}',verified_at=null,backfill_cursor=null,generation=generation+1;`).join('\n')}

${normalizeChanges.map((body,index)=>body+'\nrevoke all on function chinatech_v2_private.'+revokeSignatures[index]+'from public,anon,authenticated,chinatech_runtime;').join('\n\n')}
grant execute on function chinatech_v2_private.directory_phone_v2(text)to chinatech_runtime;
${serial}

-- Keep the original generated search column for code/write rollback. New
-- facts are populated only by the bounded projector and gated by model rules.
alter table chinatech_v2_private.procurement_list_sources add column search_v2 text not null default '';

-- New index names and new versioned normalizers. Hashes keep legacy text
-- out of oversized B-tree keys; readers also compare full normalized values.
-- md5 is only a bounded candidate bucket, never an identity/security digest.
create index repair_scan_id_unicode17 on chinatech_v2_private.repair_intakes(store_id,pg_catalog.md5(chinatech_v2_private.query_upper(id)));
create index repair_scan_serial_unicode17 on chinatech_v2_private.repair_intakes(store_id,pg_catalog.md5(chinatech_v2_private.query_upper(chinatech_v2_private.directory_trim(data->>'serial'))));
create index intake_history_exact_unicode17 on chinatech_v2_private.repair_intakes(store_id,pg_catalog.md5(chinatech_v2_private.intake_serial_key_v2(data->>'serial')),pg_catalog.md5(chinatech_v2_private.query_lower(data->>'brand')),((data->>'createdAt')collate "C")desc,id);
create index intake_history_related_unicode17 on chinatech_v2_private.repair_intakes(store_id,pg_catalog.md5(chinatech_v2_private.query_lower(data->>'brand')),pg_catalog.md5(chinatech_v2_private.query_lower(data->>'model')),((data->>'createdAt')collate "C")desc,id);

-- First-party presentation labels only. Existing translator algorithm/ACLs
-- remain unchanged; every affected store stays unready until verification.
delete from chinatech_v2_private.retail_list_vocabulary;
-- BEGIN GENERATED QUERY VOCABULARY
insert into chinatech_v2_private.retail_list_vocabulary(original,translations,position,pattern,slots)values
${vocabularyRows.join(',\n')};
-- END GENERATED QUERY VOCABULARY
alter table chinatech_v2_private.retail_list_models alter column vocabulary_hash set default '${vocabularyHash}';
update chinatech_v2_private.retail_list_models set vocabulary_hash='${vocabularyHash}';
`;
const version=`// Additive query semantics: Unicode17 constants, exact JS normalization order.\nexport const projectionQueryRulesHash=${JSON.stringify(queryHash)};\nexport const projectionQueryRulesVersion=1;\n`;
const vocabularyVersion='// Generated from the first-party vocabulary and translate implementation.\nexport const retailVocabularyHash='+JSON.stringify(vocabularyHash)+';\n';
const priorVocabulary=source('retail').slice(source('retail').indexOf('-- BEGIN GENERATED RETAIL VOCABULARY'),source('retail').indexOf('-- END GENERATED RETAIL VOCABULARY')+'-- END GENERATED RETAIL VOCABULARY'.length);
assert(priorVocabulary.includes('insert into chinatech_v2_private.retail_list_vocabulary'));
const priorVocabularyHash=source('retail').match(/vocabulary_hash text not null default '([a-f0-9]{64})'/)[1];
const rollback=`-- Drain writers and turn bounded reads off before this owner-only rollback.
-- The stores lock prevents an empty-store ready row racing final invalidation.
-- Canonical facts and all original expression functions/indexes stay untouched.
BEGIN;
lock table chinatech_v2.stores in share row exclusive mode;
${[['directory','project_customer_directory'],['record','customer_record_fact_prepared'],['procurement','project_procurement_list'],['repair','project_repair_list'],['retail','project_retail_list']].map(([kind,name])=>extract(kind,name)).join('\n\n')}
${['repair_scan_id_unicode17','repair_scan_serial_unicode17','intake_history_exact_unicode17','intake_history_related_unicode17'].map(name=>'drop index chinatech_v2_private.'+name+';').join('\n')}
delete from chinatech_v2_private.retail_list_vocabulary;
${priorVocabulary}
alter table chinatech_v2_private.retail_list_models alter column vocabulary_hash set default '${priorVocabularyHash}';
update chinatech_v2_private.retail_list_models set vocabulary_hash='${priorVocabularyHash}';
${models.map(model=>`alter table chinatech_v2_private.${model}_models alter column query_rules_hash set default '${'0'.repeat(64)}';
update chinatech_v2_private.${model}_models set ready=false,query_rules_hash='${'0'.repeat(64)}',verified_at=null,backfill_cursor=null,generation=generation+1;`).join('\n')}
COMMIT;
`;
// Re-enable only after the exact rollback has completed. Private functions and
// metadata columns persist; indexes are rebuilt with their explicit new names.
let enable=migration.replace(/create role chinatech_unicode_reader[^;]+;\n/,()=>`do $$begin
 if not exists(select 1 from pg_roles where rolname='chinatech_unicode_reader'and not rolcanlogin and not rolinherit and not rolsuper and not rolbypassrls and not rolcreatedb and not rolcreaterole and not rolreplication)
 or exists(select 1 from pg_auth_members where roleid=(select oid from pg_roles where rolname='chinatech_unicode_reader')or member=(select oid from pg_roles where rolname='chinatech_unicode_reader'))then
 raise exception 'Expected unchanged isolated Unicode constant owner';end if;
end $$;\n`);
enable=enable.replaceAll('create function chinatech_v2_private.','create or replace function chinatech_v2_private.');
for(const model of models)enable=once(enable,`alter table chinatech_v2_private.${model}_models add column query_rules_hash text not null default '${queryHash}'check(query_rules_hash~'^[a-f0-9]{64}$');`,`alter table chinatech_v2_private.${model}_models alter column query_rules_hash set default '${queryHash}';`);
enable=once(enable,"alter table chinatech_v2_private.procurement_list_sources add column search_v2 text not null default '';",'-- Existing search_v2 is invalid until bounded rebuilding completes.');
enable='-- Re-enable exact query contract after its reviewed rollback; rebuild and verify before flags.\nBEGIN;\n'+enable+'COMMIT;\n';
const outputs={'supabase/migrations/20261017142651_performance_unicode_query_contract.sql':migration,'lib/backend/query-rules-version.ts':version,'lib/backend/retail-vocabulary-version.ts':vocabularyVersion,'scripts/rollback-unicode-query-contract.sql':rollback,'scripts/enable-unicode-query-contract.sql':enable};
for(const[path,value]of Object.entries(outputs)){if(process.argv.includes('--check'))assert.equal(readFileSync(path,'utf8'),value,'Generated contract '+path);else writeFileSync(path,value);}
console.log(JSON.stringify({checkOnly:process.argv.includes('--check'),queryHash,vocabularyHash,entries:vocabularyRows.length,sourceSha256:Object.fromEntries(Object.entries(sources).map(([name,[,hash]])=>[name,hash])),outputs:Object.fromEntries(Object.entries(outputs).map(([path,value])=>[path,sha(value)]))}));
