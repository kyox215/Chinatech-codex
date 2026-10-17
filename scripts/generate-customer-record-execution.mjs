import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const prior='supabase/migrations/20261017083601_performance_customer_record_reads.sql';
const target='supabase/migrations/20261017133040_performance_customer_record_execution.sql';
const source=readFileSync(prior,'utf8'),sha=createHash('sha256').update(source).digest('hex');
assert(process.argv.slice(2).every(argument=>argument==='--check'),'Only the optional --check argument is supported');
assert.equal(sha,'0687fff65447ad71618ee7ccf234e8e51e96c1e74d70548325b2548f6d76485a','Reviewed migration10 must be present unchanged before deriving execution helpers');
function extract(name){const start=source.indexOf('create function chinatech_v2_private.'+name+'(');assert(start>=0);const end=source.indexOf('\nrevoke all on function ',start);assert(end>start);return source.slice(start,end);}
function replaceOnce(value,from,to){assert.equal(value.split(from).length,2,from);return value.replace(from,to);}
let fact=extract('customer_record_fact');
fact=replaceOnce(fact,'customer_record_fact(kind text,document jsonb,event_position integer)','customer_record_fact_prepared(kind text,document jsonb,event_position integer,prepared jsonb)');
fact=replaceOnce(fact,"search:=chinatech_v2_private.unicode17_lower(chinatech_v2_private.unicode17_nfkc(array_to_string(raw_values,' ')));", "search:=chinatech_v2_private.customer_record_search(raw_values,prepared);");
let projector=extract('project_customer_record_fact');
projector=replaceOnce(projector,'event_position integer,document jsonb)returns void','event_position integer,document jsonb,prepared jsonb)returns void');
projector=replaceOnce(projector,'facts:=chinatech_v2_private.customer_record_fact(kind,document,event_position);','facts:=chinatech_v2_private.customer_record_fact_prepared(kind,document,event_position,prepared);');
let sync=extract('customer_record_sync');
sync=replaceOnce(sync,'position integer;','position integer;prepared jsonb;');
sync=replaceOnce(sync,"if source_kind='sales'then\n   for", "if source_kind='sales'then\n   prepared:=chinatech_v2_private.customer_record_sale_prepared(source_row->'data');\n   for");
sync=replaceOnce(sync,"'model',source_row->'data'->'model','sale',item));", "'model',source_row->'data'->'model','sale',item),prepared);");
const statements=[`-- Equivalent customer association execution; original migration10 SHA256 ${sha}.
-- ASCII U+0020 (CCC0, not Case_Ignorable) separates each raw field exactly as
-- array_to_string(...,' ') did. NULL fields are skipped; empty fields remain.
-- Full Unicode boundary/fact and actual canonical-trigger oracles are required.
-- No canonical rows, model format/rules/generation, RLS, trigger mode or grants
-- change. New helpers are private invoker functions; old entry points remain.
create function chinatech_v2_private.customer_record_search(raw_values text[],folded jsonb)returns text
language plpgsql immutable strict set search_path=''as $$
declare value text;parts text[]:='{}';
begin
 foreach value in array raw_values loop
  if value is null then continue;end if;
  parts:=array_append(parts,case when folded?value then folded->>value else chinatech_v2_private.unicode17_lower(chinatech_v2_private.unicode17_nfkc(value))end);
 end loop;
 return array_to_string(parts,' ');
end $$;
revoke all on function chinatech_v2_private.customer_record_search(text[],jsonb)from public,anon,authenticated,chinatech_runtime;

create function chinatech_v2_private.customer_record_sale_prepared(document jsonb)returns jsonb
language plpgsql immutable strict set search_path=''as $$
declare fallback_name text:=chinatech_v2_private.directory_trim(coalesce(document->>'brand','')||' '||coalesce(document->>'model',''));folded jsonb;
begin
 select coalesce(jsonb_object_agg(value,chinatech_v2_private.unicode17_lower(chinatech_v2_private.unicode17_nfkc(value))),'{}')into folded from(
  select distinct value collate "C" as value from(
   select document->>'code'value union all select fallback_name
   union all select case when sale?'product'then chinatech_v2_private.directory_trim(coalesce(sale->'product'->>'brand','')||' '||coalesce(sale->'product'->>'model',''))else fallback_name end from jsonb_array_elements(coalesce(document->'sales','[]'))sale
   union all select nullif(sale->'product'->>'code','')from jsonb_array_elements(coalesce(document->'sales','[]'))sale
  )values_to_prepare where value is not null
 )distinct_values;
 return folded;
end $$;
revoke all on function chinatech_v2_private.customer_record_sale_prepared(jsonb)from public,anon,authenticated,chinatech_runtime;
`,fact,
`revoke all on function chinatech_v2_private.customer_record_fact_prepared(text,jsonb,integer,jsonb)from public,anon,authenticated,chinatech_runtime;
create or replace function chinatech_v2_private.customer_record_fact(kind text,document jsonb,event_position integer)returns jsonb
language sql immutable strict set search_path=''as $$select chinatech_v2_private.customer_record_fact_prepared(kind,document,event_position,'{}'::jsonb)$$;
revoke all on function chinatech_v2_private.customer_record_fact(text,jsonb,integer)from public,anon,authenticated,chinatech_runtime;`,
projector,
`revoke all on function chinatech_v2_private.project_customer_record_fact(uuid,text,text,text,integer,jsonb,jsonb)from public,anon,authenticated,chinatech_runtime;
create or replace function chinatech_v2_private.project_customer_record_fact(target_store uuid,kind text,target_id text,event_id text,event_position integer,document jsonb)returns void
language sql set search_path=''as $$select chinatech_v2_private.project_customer_record_fact(target_store,kind,target_id,event_id,event_position,document,'{}'::jsonb)$$;
revoke all on function chinatech_v2_private.project_customer_record_fact(uuid,text,text,text,integer,jsonb)from public,anon,authenticated,chinatech_runtime;`,
sync.replace('create function ','create or replace function '),
`revoke all on function chinatech_v2_private.customer_record_sync()from public,anon,authenticated,chinatech_runtime;`];
const rollback='-- Execution-only rollback after draining writers. Original migration10 '+sha+'.\n-- New unused private helpers remain revoked; no facts/models/canonical rows change.\nBEGIN;\n'+['customer_record_fact','project_customer_record_fact','customer_record_sync'].map(name=>extract(name).replace('create function ','create or replace function ')).join('\n\n')+'\nCOMMIT;\n';
const generated=statements.join('\n\n')+'\n',rollbackPath='scripts/rollback-customer-record-execution.sql',check=process.argv.includes('--check');
if(check){assert.equal(readFileSync(target,'utf8'),generated,'Generated migration bytes must match');assert.equal(readFileSync(rollbackPath,'utf8'),rollback,'Generated rollback bytes must match');}
else{writeFileSync(rollbackPath,rollback);writeFileSync(target,generated);}
console.log(JSON.stringify({migration:target,sourceSha256:sha,migrationSha256:createHash('sha256').update(generated).digest('hex'),rollbackSha256:createHash('sha256').update(rollback).digest('hex'),checkOnly:check,condition:'Local generated candidate; no database connection'}));
