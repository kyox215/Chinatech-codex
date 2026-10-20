import assert from'node:assert/strict';import{readFileSync,writeFileSync}from'node:fs';import{createHash}from'node:crypto';
const dataFile='scripts/unicode/unicode17-data.json',raw=readFileSync(dataFile),data=JSON.parse(raw),dataHash=createHash('sha256').update(raw).digest('hex');assert.equal(data.unicodeVersion,'17.0.0');
const quote=value=>value===null?'null':"'"+String(value).replaceAll("'","''")+"'";
function pattern(points){const sorted=[...new Set(points)].sort((a,b)=>a-b),ranges=[];for(let index=0;index<sorted.length;index++){const first=sorted[index];let last=first;while(sorted[index+1]===last+1)last=sorted[++index];ranges.push(String.fromCodePoint(first)+(first===last?'':'-'+String.fromCodePoint(last)));}return'['+ranges.join('')+']';}
const normalNeeds=quote(pattern(data.normalNeeds)),lowerNeeds=quote(pattern(data.rows.filter(([cp,,,lower])=>cp>127&&lower!==null).map(([cp])=>cp))),upperNeeds=quote(pattern(data.rows.filter(([cp,,,,upper])=>cp>127&&upper!==null).map(([cp])=>cp))),secondNeeds=quote(pattern([...data.composition.map(([,second])=>second),...Array.from({length:21},(_,i)=>0x1161+i),...Array.from({length:27},(_,i)=>0x11a8+i)]));
const table='-- BEGIN GENERATED UNICODE17 DATA\n-- Dataset SHA256 '+dataHash+'; '+data.rows.length+' scalar rows and '+data.composition.length+' canonical pairs.\ninsert into chinatech_v2_private.unicode17_scalars(codepoint,decomposition,ccc,lower_value,upper_value,cased,ignorable)values\n'+data.rows.map(row=>'('+row.map((value,i)=>[1,3,4].includes(i)?quote(value):typeof value==='boolean'?String(value):value).join(',')+')').join(',\n')+';\ninsert into chinatech_v2_private.unicode17_composition(first_cp,second_cp,composite)values\n'+data.composition.map(row=>'('+row.join(',')+')').join(',\n')+';\n-- END GENERATED UNICODE17 DATA';
const functions=`-- BEGIN GENERATED UNICODE17 FUNCTIONS
create function chinatech_v2_private.unicode17_nfkc(value text)returns text
language plpgsql immutable strict set search_path='' as $$
declare item record;result text[]:='{}';starter integer:=0;starter_cp integer:=0;last_class integer:=0;cp integer;composite integer;
begin
 -- Official Quick_Check N/M, all nonzero CCC and algorithmic Hangul seconds.
 -- This includes context-sensitive unchanged scalars such as Kirat Rai AI.
 if value !~ ${normalNeeds} then return value;end if;
 for item in with input as(
  select c,n,ascii(c)cp from regexp_split_to_table(value,'')with ordinality t(c,n)where c<>''
 ),decomposed as(
  select i.n,z.part,z.c,coalesce(m2.ccc,0)ccc from input i
  left join chinatech_v2_private.unicode17_scalars m on m.codepoint=i.cp
  cross join lateral regexp_split_to_table(coalesce(m.decomposition,case when i.cp between 44032 and 55203 then chr(4352+(i.cp-44032)/588)||chr(4449+((i.cp-44032)%588)/28)||case when(i.cp-44032)%28>0 then chr(4519+(i.cp-44032)%28)else ''end else i.c end),'')with ordinality z(c,part)
  left join chinatech_v2_private.unicode17_scalars m2 on m2.codepoint=ascii(z.c)where z.c<>''
 ),grouped as(
  select *,sum(case when ccc=0 then 1 else 0 end)over(order by n,part rows unbounded preceding)segment from decomposed
 )select c,ccc from grouped order by segment,ccc,n,part loop
  cp:=ascii(item.c);composite:=null;
  if starter>0 and(last_class<item.ccc or last_class=0)and(item.ccc>0 or item.c~${secondNeeds})then
   if starter_cp between 4352 and 4370 and cp between 4449 and 4469 then composite:=44032+((starter_cp-4352)*21+cp-4449)*28;
   elsif starter_cp between 44032 and 55203 and(starter_cp-44032)%28=0 and cp between 4520 and 4546 then composite:=starter_cp+cp-4519;
   else select p.composite into composite from chinatech_v2_private.unicode17_composition p where p.first_cp=starter_cp and p.second_cp=cp;end if;
  end if;
  if composite is not null then result[starter]:=chr(composite);starter_cp:=composite;continue;end if;
  result:=array_append(result,item.c);if item.ccc=0 then starter:=cardinality(result);starter_cp:=cp;end if;last_class:=item.ccc;
 end loop;
 return array_to_string(result,'');
end;
$$;
create function chinatech_v2_private.unicode17_lower(value text)returns text
language plpgsql immutable strict set search_path='' as $$
declare prepared text:=translate(value,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz');result text;
begin
 if prepared !~ ${lowerNeeds} then return prepared;end if;
 with chars as materialized(
  select c,n,coalesce(m.cased,false)cased,coalesce(m.ignorable,false)ignorable,coalesce(m.lower_value,c)lowered
  from regexp_split_to_table(prepared,'')with ordinality t(c,n)left join chinatech_v2_private.unicode17_scalars m on m.codepoint=ascii(c)where c<>''
 ),context as(
  select *,max(n)filter(where not ignorable)over(order by n rows between unbounded preceding and 1 preceding)before,
  min(n)filter(where not ignorable)over(order by n rows between 1 following and unbounded following)after from chars
 )select string_agg(case when x.c='Σ'and coalesce(b.cased,false)and not coalesce(a.cased,false)then 'ς'else x.lowered end,''order by x.n)into result
 from context x left join chars b on b.n=x.before left join chars a on a.n=x.after;
 return coalesce(result,'');
end;
$$;
create function chinatech_v2_private.unicode17_upper(value text)returns text
language plpgsql immutable strict set search_path='' as $$
declare prepared text:=translate(value,'abcdefghijklmnopqrstuvwxyz','ABCDEFGHIJKLMNOPQRSTUVWXYZ');result text;
begin
 if prepared !~ ${upperNeeds} then return prepared;end if;
 select string_agg(coalesce(m.upper_value,c),''order by n)into result from regexp_split_to_table(prepared,'')with ordinality t(c,n)left join chinatech_v2_private.unicode17_scalars m on m.codepoint=ascii(c)where c<>'';
 return coalesce(result,'');
end;
$$;
-- Form keys keep their original business order: NFKC, then lowercase/filter;
-- the specification key additionally trims and collapses ECMAScript whitespace.
REPLACE_FORM_KEYS
REPLACE_FORM_PROJECTOR
-- END GENERATED UNICODE17 FUNCTIONS`;
const base=readFileSync('supabase/migrations/20261017060716_performance_retail_form_reads.sql','utf8'),replacements=['retail_form_catalog_key','retail_form_value_key'].map(name=>{
 const match=base.match(new RegExp('create function chinatech_v2_private\\.'+name+'\\(value text\\)[\\s\\S]*?as \\$\\$([\\s\\S]*?)\\$\\$;'));assert(match,'Expected reviewed base function '+name);
 let body=match[0].replace('create function','create or replace function');
 if(name==='retail_form_catalog_key')body=body.replace("lower(normalize(coalesce(value,''),NFKC) collate chinatech_v2_private.retail_list_ties)","chinatech_v2_private.unicode17_lower(chinatech_v2_private.unicode17_nfkc(coalesce(value,'')))");
 else body=body.replace('select lower(','select chinatech_v2_private.unicode17_lower(').replace("normalize(coalesce(value,''),NFKC)","chinatech_v2_private.unicode17_nfkc(coalesce(value,''))").replace(' collate chinatech_v2_private.retail_list_ties','');
 assert.notEqual(body,match[0].replace('create function','create or replace function'));return body;
}).join('\n');
const originalProjector=base.match(/create function chinatech_v2_private\.project_retail_form\([\s\S]*?as \$\$([\s\S]*?)\$\$;/)?.[0];assert(originalProjector,'Expected reviewed base projector');
const projector=originalProjector.replace('create function','create or replace function')
 .replace('declare kind text;raw text;value text;','declare kind text;raw text;value text;brand_value text;normalized_value text;catalog_value text;')
 .replace('if document is null then return;end if;',"if document is null then return;end if;\n brand_value:=chinatech_v2_private.retail_form_brand(document->>'brand');")
 .replace('  insert into chinatech_v2_private.retail_form_values(store_id,unit_id,field,category,brand_key,value,option_key,value_key,catalog_key,search)',"  normalized_value:=chinatech_v2_private.retail_form_value_key(value);catalog_value:=chinatech_v2_private.retail_form_catalog_key(value);\n  insert into chinatech_v2_private.retail_form_values(store_id,unit_id,field,category,brand_key,value,option_key,value_key,catalog_key,search,brand_key_hash,value_key_hash,catalog_key_hash)")
 .replace("chinatech_v2_private.retail_form_brand(document->>'brand'),value",'brand_value,value')
 .replace("chinatech_v2_private.retail_form_value_key(value),chinatech_v2_private.retail_form_catalog_key(value),lower(value collate chinatech_v2_private.retail_list_ties)","normalized_value,catalog_value,chinatech_v2_private.unicode17_lower(value),encode(sha256(convert_to(brand_value,'UTF8')),'hex'),encode(sha256(convert_to(normalized_value,'UTF8')),'hex'),encode(sha256(convert_to(catalog_value,'UTF8')),'hex')");
assert.notEqual(projector,originalProjector.replace('create function','create or replace function'));
const path='supabase/migrations/20261017063155_performance_unicode17_compatibility.sql',previous=readFileSync(path,'utf8');
function replaceBlock(source,name,text){const first=source.indexOf('-- BEGIN GENERATED '+name),last=source.indexOf('-- END GENERATED '+name);assert(first>=0&&last>first);return source.slice(0,first)+text+source.slice(last+('-- END GENERATED '+name).length);}
let next=replaceBlock(replaceBlock(previous,'UNICODE17 DATA',table),'UNICODE17 FUNCTIONS',functions.replace('REPLACE_FORM_KEYS',()=>replacements).replace('REPLACE_FORM_PROJECTOR',()=>projector));
const canonical=next.replace(/rules_hash set default '[^']*'/g,"rules_hash set default 'PENDING'").replace(/rules_hash='[^']*'/g,"rules_hash='PENDING'");
const implementationHash=createHash('sha256').update(canonical).digest('hex'),baseHash=readFileSync('lib/backend/retail-form-rules-version.ts','utf8').match(/retailFormRulesHash="([a-f0-9]+)"/)[1],hash=createHash('sha256').update(baseHash+dataHash+implementationHash).digest('hex');
next=next.replace(/rules_hash set default '[^']*'/g,"rules_hash set default '"+hash+"'").replace(/rules_hash='[^']*'/g,"rules_hash='"+hash+"'");
const version='// Unicode17 data and exact approved SQL implementation; not server ICU inference.\nexport const unicode17DataHash='+JSON.stringify(dataHash)+';\nexport const unicode17ImplementationHash='+JSON.stringify(implementationHash)+';\nexport const retailFormModelFormat=2;\nexport const retailFormProjectionHash='+JSON.stringify(hash)+';\n';
if(process.argv.includes('--write')){writeFileSync(path,next);writeFileSync('lib/backend/unicode17-version.ts',version);}else{assert.equal(previous,next);assert.equal(readFileSync('lib/backend/unicode17-version.ts','utf8'),version);}
console.log(JSON.stringify({pass:true,rows:data.rows.length,pairs:data.composition.length,implementationHash,modelHash:hash,bytes:Buffer.byteLength(next)}));
